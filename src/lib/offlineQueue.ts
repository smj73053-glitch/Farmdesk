import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type OutboxTable = 'expenses' | 'income_records' | 'crop_activities' | 'farm_tasks';
export type OutboxOperation = 'insert' | 'update' | 'delete';

export interface OutboxItem {
  id: string;
  userId: string;
  table: OutboxTable;
  operation: OutboxOperation;
  recordId: string | null;
  payload: Record<string, unknown>;
  clientMutationId: string;
  baseUpdatedAt: string | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  conflict: boolean;
}

interface FarmDeskDB extends DBSchema {
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-user': string; 'by-created': string };
  };
}

let dbPromise: Promise<IDBPDatabase<FarmDeskDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<FarmDeskDB>('farmdesk-offline', 1, {
      upgrade(database) {
        const store = database.createObjectStore('outbox', { keyPath: 'id' });
        store.createIndex('by-user', 'userId');
        store.createIndex('by-created', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function enqueueOutbox(
  item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts' | 'lastError' | 'conflict'>
): Promise<OutboxItem> {
  const full: OutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    conflict: false,
  };
  const database = await db();
  await database.add('outbox', full);
  return full;
}

export async function listOutbox(userId: string): Promise<OutboxItem[]> {
  const database = await db();
  const items = await database.getAllFromIndex('outbox', 'by-user', userId);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateOutbox(item: OutboxItem): Promise<void> {
  const database = await db();
  await database.put('outbox', item);
}

export async function removeOutbox(id: string): Promise<void> {
  const database = await db();
  await database.delete('outbox', id);
}

export async function countOutbox(userId: string): Promise<number> {
  const database = await db();
  return database.countFromIndex('outbox', 'by-user', userId);
}

export async function clearOutbox(userId: string): Promise<void> {
  const items = await listOutbox(userId);
  const database = await db();
  const tx = database.transaction('outbox', 'readwrite');
  await Promise.all(items.map((item) => tx.store.delete(item.id)));
  await tx.done;
}
