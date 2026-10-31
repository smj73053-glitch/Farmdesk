import { supabase } from '@/lib/supabase';
import { listOutbox, removeOutbox, updateOutbox, type OutboxItem } from '@/lib/offlineQueue';

export interface SyncResult {
  sent: number;
  conflicts: number;
  failed: number;
  remaining: number;
}

function isNetworkError(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  return /fetch|network|load failed|timeout|abort/i.test(error.message);
}

async function serverUpdatedAt(table: string, id: string): Promise<{ value: string | null; error: string | null }> {
  const { data, error } = await supabase.from(table).select('updated_at').eq('id', id).maybeSingle();
  if (error) return { value: null, error: error.message };
  return { value: (data as { updated_at?: string } | null)?.updated_at ?? null, error: null };
}

/**
 * Replay queued writes. Inserts are idempotent through client_mutation_id; updates
 * are only applied when the server row has not changed since the edit was queued.
 * Conflicts are kept in the outbox so the user decides what to do.
 */
export async function flushOutbox(userId: string): Promise<SyncResult> {
  const items = await listOutbox(userId);
  let sent = 0;
  let conflicts = 0;
  let failed = 0;

  for (const item of items) {
    if (item.conflict) {
      conflicts += 1;
      continue;
    }
    try {
      if (item.operation === 'insert') {
        const payload = { ...item.payload, client_mutation_id: item.clientMutationId };
        const { error } = await supabase.from(item.table).insert(payload).select('id').single();
        if (!error) {
          await removeOutbox(item.id);
          sent += 1;
          continue;
        }
        if (error.code === '23505') {
          await removeOutbox(item.id);
          sent += 1;
          continue;
        }
        if (isNetworkError(error)) {
          await bump(item, error.message);
          break;
        }
        await bump(item, error.message);
        failed += 1;
        continue;
      }

      if (item.operation === 'update' && item.recordId) {
        const current = await serverUpdatedAt(item.table, item.recordId);
        if (current.error) {
          if (isNetworkError({ message: current.error })) {
            await bump(item, current.error);
            break;
          }
          await markConflict(item, 'The record could not be checked before syncing.');
          conflicts += 1;
          continue;
        }
        if (!current.value) {
          await markConflict(item, 'The record was deleted on the server.');
          conflicts += 1;
          continue;
        }
        if (item.baseUpdatedAt && current.value !== item.baseUpdatedAt) {
          await markConflict(item, 'This record changed on another device after you edited it here.');
          conflicts += 1;
          continue;
        }
        const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.recordId);
        if (error) {
          if (isNetworkError(error)) {
            await bump(item, error.message);
            break;
          }
          await bump(item, error.message);
          failed += 1;
          continue;
        }
        await removeOutbox(item.id);
        sent += 1;
        continue;
      }

      if (item.operation === 'delete' && item.recordId) {
        const { error } = await supabase.from(item.table).delete().eq('id', item.recordId);
        if (error && !isNetworkError(error)) {
          await bump(item, error.message);
          failed += 1;
          continue;
        }
        if (error) {
          await bump(item, error.message);
          break;
        }
        await removeOutbox(item.id);
        sent += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      await bump(item, message);
      if (isNetworkError({ message })) break;
      failed += 1;
    }
  }

  const remaining = (await listOutbox(userId)).length;
  return { sent, conflicts, failed, remaining };
}

async function bump(item: OutboxItem, message: string): Promise<void> {
  await updateOutbox({
    ...item,
    attempts: item.attempts + 1,
    lastError: message,
  });
}

async function markConflict(item: OutboxItem, message: string): Promise<void> {
  await updateOutbox({
    ...item,
    attempts: item.attempts + 1,
    lastError: message,
    conflict: true,
  });
}

/** Apply the user's queued version, deliberately overwriting the server row. */
export async function resolveConflictApplyMine(item: OutboxItem, userId: string): Promise<void> {
  if (item.operation === 'insert') {
    await supabase.from(item.table).insert({ ...item.payload, client_mutation_id: item.clientMutationId });
  } else if (item.operation === 'update' && item.recordId) {
    await supabase.from(item.table).update(item.payload).eq('id', item.recordId);
  } else if (item.operation === 'delete' && item.recordId) {
    await supabase.from(item.table).delete().eq('id', item.recordId);
  }
  await removeOutbox(item.id);
  if (userId) await flushOutbox(userId);
}

/** Keep the server version and discard the queued change. */
export async function resolveConflictKeepServer(item: OutboxItem): Promise<void> {
  await removeOutbox(item.id);
}
