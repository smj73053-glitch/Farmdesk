import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';
import { useAuth } from '@/context/AuthContext';
import {
  countOutbox,
  enqueueOutbox,
  listOutbox,
  type OutboxItem,
  type OutboxOperation,
  type OutboxTable,
} from '@/lib/offlineQueue';
import { flushOutbox } from '@/lib/offlineSync';

const OUTBOX_EVENT = 'farmdesk:outbox';

/**
 * Only these tables carry a direct user_id. Crop activities are owned through
 * their parent farm_crop, so adding user_id there would break the insert.
 */
const TABLES_WITH_USER_ID: ReadonlySet<OutboxTable> = new Set([
  'expenses',
  'income_records',
  'farm_tasks',
]);

function notifyOutbox() {
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

function isNetworkFailure(error: { message?: string } | null): boolean {
  return Boolean(error?.message && /fetch|network|load failed|timeout|abort/i.test(error.message));
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(() => navigator.onLine);
  React.useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export interface WriteResult<T> {
  queued: boolean;
  data: T | null;
}

/**
 * Writes financial rows and field activities either directly or through the
 * IndexedDB outbox. Queued inserts carry a client_mutation_id so replay is safe.
 */
export function useOfflineWrite(table: OutboxTable) {
  const { user } = useAuth();
  const online = useOnlineStatus();

  const write = React.useCallback(async (
    operation: OutboxOperation,
    payload: Record<string, unknown>,
    recordId?: string,
    baseUpdatedAt?: string | null
  ): Promise<WriteResult<Record<string, unknown>>> => {
    if (!user) throw new AppError('Please sign in to continue', 'AUTH_REQUIRED');
    const clientMutationId = crypto.randomUUID();
    const prepared = operation === 'insert'
      ? {
          ...payload,
          ...(TABLES_WITH_USER_ID.has(table) ? { user_id: user.id } : {}),
          client_mutation_id: clientMutationId,
        }
      : payload;

    const queue = async (message?: string): Promise<WriteResult<Record<string, unknown>>> => {
      await enqueueOutbox({
        userId: user.id,
        table,
        operation,
        recordId: recordId ?? null,
        payload: prepared,
        clientMutationId,
        baseUpdatedAt: baseUpdatedAt ?? null,
      });
      notifyOutbox();
      if (message) toast.info(message);
      return { queued: true, data: null };
    };

    if (!online) {
      return queue('Saved offline. It will sync when you reconnect.');
    }

    try {
      if (operation === 'insert') {
        const { data, error } = await supabase.from(table).insert(prepared).select('*').single();
        if (error) {
          if (isNetworkFailure(error)) return queue('Connection lost. Saved offline and will retry.');
          if (error.code === '23505') {
            const { data: existing } = await supabase
              .from(table)
              .select('*')
              .eq('client_mutation_id', clientMutationId)
              .maybeSingle();
            return { queued: false, data: (existing as Record<string, unknown>) ?? null };
          }
          throw new AppError(error.message, error.code);
        }
        return { queued: false, data: data as Record<string, unknown> };
      }

      if (operation === 'update' && recordId) {
        const { data, error } = await supabase.from(table).update(prepared).eq('id', recordId).select('*').single();
        if (error) {
          if (isNetworkFailure(error)) {
            return queue('Connection lost. Edit saved offline and will retry.');
          }
          throw new AppError(error.message, error.code);
        }
        return { queued: false, data: data as Record<string, unknown> };
      }

      if (operation === 'delete' && recordId) {
        const { error } = await supabase.from(table).delete().eq('id', recordId);
        if (error) {
          if (isNetworkFailure(error)) return queue('Connection lost. Delete queued and will retry.');
          throw new AppError(error.message, error.code);
        }
        return { queued: false, data: null };
      }

      throw new AppError('Unsupported offline operation');
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (isNetworkFailure({ message: error instanceof Error ? error.message : '' })) {
        return queue('Connection lost. Saved offline and will retry.');
      }
      throw error;
    }
  }, [online, table, user]);

  return { write, online };
}

export function useOfflineSync() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState(0);
  const [conflicts, setConflicts] = React.useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!user) {
      setPending(0);
      setConflicts([]);
      return;
    }
    const items = await listOutbox(user.id);
    setPending(items.length);
    setConflicts(items.filter((item) => item.conflict));
  }, [user]);

  const sync = React.useCallback(async (silent = false) => {
    if (!user || !navigator.onLine) {
      await refresh();
      return;
    }
    setSyncing(true);
    try {
      const result = await flushOutbox(user.id);
      await refresh();
      if (result.sent > 0) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['expenses'] }),
          queryClient.invalidateQueries({ queryKey: ['income'] }),
          queryClient.invalidateQueries({ queryKey: ['finance'] }),
          queryClient.invalidateQueries({ queryKey: ['activities'] }),
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        ]);
        if (!silent) toast.success(`${result.sent} offline change${result.sent === 1 ? '' : 's'} synced.`);
      }
      if (result.conflicts > 0) {
        toast.warning('Some offline edits conflict with newer server data. Review them in Settings.', { duration: 7000 });
      }
      if (result.failed > 0 && !silent) {
        toast.error(`${result.failed} offline change${result.failed === 1 ? '' : 's'} could not be synced. Open Settings to inspect.`);
      }
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Could not sync offline changes.');
    } finally {
      setSyncing(false);
    }
  }, [queryClient, refresh, user]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener(OUTBOX_EVENT, handler);
    return () => window.removeEventListener(OUTBOX_EVENT, handler);
  }, [refresh]);

  React.useEffect(() => {
    if (!online || !user) return;
    void sync(true);
    const interval = window.setInterval(() => void sync(true), 60000);
    return () => window.clearInterval(interval);
  }, [online, sync, user]);

  return { online, pending, conflicts, syncing, sync, refresh };
}
