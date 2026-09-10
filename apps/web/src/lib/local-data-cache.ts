"use client";

export type CacheCategory =
  "catalog" | "segmentation" | "map" | "table" | "record-detail" | "sync";

type CacheEntry = {
  key: string;
  category: CacheCategory;
  scope: string;
  value: unknown;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  revision?: number;
  approximateSize: number;
};

export type CacheRead<T> = Readonly<{
  value: T;
  stale: boolean;
  revision?: number;
}>;

export type CacheWriteOptions = Readonly<{
  category: CacheCategory;
  scope: string;
  maxAgeMs: number;
  revision?: number;
}>;

const DATABASE = "hansa-field-local-cache";
const STORE = "entries";
const MAX_BYTES = 48 * 1024 * 1024;
const memory = new Map<string, CacheEntry>();
let databasePromise: Promise<IDBDatabase | null> | null = null;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function cacheKey(
  category: CacheCategory,
  parts: Record<string, unknown>,
): string {
  return `${category}:${canonical(parts)}`;
}

export const cacheKeys = {
  catalog: () => cacheKey("catalog", { version: 1 }),
  map: (scope: Record<string, unknown>) => cacheKey("map", scope),
  table: (scope: Record<string, unknown>) => cacheKey("table", scope),
  recordDetail: (scope: Record<string, unknown>) =>
    cacheKey("record-detail", scope),
  segmentation: (scope: Record<string, unknown>) =>
    cacheKey("segmentation", scope),
};

function estimateSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 1024;
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;
  if (typeof window === "undefined" || !("indexedDB" in window))
    return Promise.resolve(null);
  databasePromise = new Promise((resolve) => {
    const request = window.indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.createObjectStore(STORE, { keyPath: "key" });
      store.createIndex("lastAccessedAt", "lastAccessedAt");
      store.createIndex("category", "category");
      store.createIndex("scope", "scope");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return databasePromise;
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  const database = await openDatabase();
  if (!database) return undefined;
  return new Promise((resolve) => {
    const tx = database.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
    tx.onabort = () => resolve(undefined);
  });
}

async function evict(): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  const entries = await transaction<CacheEntry[]>("readonly", (store) =>
    store.getAll(),
  );
  if (!entries) return;
  let size = entries.reduce((total, item) => total + item.approximateSize, 0);
  if (size <= MAX_BYTES) return;
  const victims = [...entries].sort(
    (left, right) => left.lastAccessedAt - right.lastAccessedAt,
  );
  await new Promise<void>((resolve) => {
    const tx = database.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const victim of victims) {
      if (size <= MAX_BYTES) break;
      store.delete(victim.key);
      memory.delete(victim.key);
      size -= victim.approximateSize;
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => resolve();
  });
}

export const localDataCache = {
  async read<T>(key: string): Promise<CacheRead<T> | null> {
    const now = Date.now();
    const inMemory = memory.get(key);
    const entry =
      inMemory ??
      (await transaction<CacheEntry>("readonly", (store) => store.get(key)));
    if (!entry) return null;
    entry.lastAccessedAt = now;
    memory.set(key, entry);
    void transaction("readwrite", (store) => store.put(entry));
    return {
      value: entry.value as T,
      stale: entry.expiresAt < now,
      revision: entry.revision,
    };
  },

  async write<T>(
    key: string,
    value: T,
    options: CacheWriteOptions,
  ): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry = {
      key,
      category: options.category,
      scope: options.scope,
      value,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + options.maxAgeMs,
      revision: options.revision,
      approximateSize: estimateSize(value),
    };
    memory.set(key, entry);
    await transaction("readwrite", (store) => store.put(entry));
    void evict();
  },

  async invalidateScope(scope: string): Promise<void> {
    for (const [key, entry] of memory)
      if (entry.scope === scope) memory.delete(key);
    const database = await openDatabase();
    if (!database) return;
    const entries = await transaction<CacheEntry[]>("readonly", (store) =>
      store.index("scope").getAll(scope),
    );
    if (!entries?.length) return;
    await new Promise<void>((resolve) => {
      const tx = database.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      entries.forEach((entry) => store.delete(entry.key));
      tx.oncomplete = () => resolve();
      tx.onabort = () => resolve();
    });
  },

  async invalidateCategory(category: CacheCategory): Promise<void> {
    for (const [key, entry] of memory)
      if (entry.category === category) memory.delete(key);
    const database = await openDatabase();
    if (!database) return;
    const entries = await transaction<CacheEntry[]>("readonly", (store) =>
      store.index("category").getAll(category),
    );
    if (!entries?.length) return;
    await new Promise<void>((resolve) => {
      const tx = database.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      entries.forEach((entry) => store.delete(entry.key));
      tx.oncomplete = () => resolve();
      tx.onabort = () => resolve();
    });
  },
};

export type SyncCheckpoint = Readonly<{
  cursor: string | null;
  revision: number | null;
  updatedAt: number;
}>;

export type IncrementalCacheChange = Readonly<{
  entityType: "record" | "projectRecord";
  entityId: string;
  recordId: string;
  projectRecordId: string | null;
  revision: number;
  operation: "created" | "updated" | "archived";
  updatedAt: string;
}>;

export async function readSyncCheckpoint(
  scope: string,
): Promise<SyncCheckpoint | null> {
  const entry = await localDataCache.read<SyncCheckpoint>(
    cacheKey("sync", { scope }),
  );
  return entry?.value ?? null;
}

export async function writeSyncCheckpoint(
  scope: string,
  checkpoint: Omit<SyncCheckpoint, "updatedAt">,
): Promise<void> {
  await localDataCache.write(
    cacheKey("sync", { scope }),
    { ...checkpoint, updatedAt: Date.now() },
    {
      category: "sync",
      scope,
      maxAgeMs: 7 * 24 * 60 * 60 * 1000,
      revision: checkpoint.revision ?? undefined,
    },
  );
}

/** Removes only entries affected by an incremental server-side change feed. */
export async function applyIncrementalChanges(
  scope: string,
  changes: readonly IncrementalCacheChange[],
): Promise<void> {
  if (!changes.length) return;
  await localDataCache.invalidateScope(scope);
  await Promise.all(
    changes.flatMap((change) => [
      localDataCache.invalidateScope(`record:${change.recordId}`),
      ...(change.projectRecordId
        ? [localDataCache.invalidateScope(`project-record:${change.projectRecordId}`)]
        : []),
    ]),
  );
}

export function canPrefetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return !connection?.saveData && connection?.effectiveType !== "2g";
}
