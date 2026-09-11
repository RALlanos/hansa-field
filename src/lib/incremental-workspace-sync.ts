"use client";

import { getApiBase } from "./api-base";
import {
  applyIncrementalChanges,
  readSyncCheckpoint,
  writeSyncCheckpoint,
  type IncrementalCacheChange,
} from "./local-data-cache";

export type WorkspaceSyncScope = Readonly<{
  mode: "app" | "project" | "universal";
  appIds?: readonly string[];
  projectIds?: readonly string[];
  localCollectionIds?: readonly string[];
}>;

type ChangesResponse = Readonly<{
  changes: IncrementalCacheChange[];
  nextCursor: string | null;
  hasMore: boolean;
}>;

const MINIMUM_SYNC_INTERVAL_MS = 30_000;

export function workspaceScopeKey(scope: WorkspaceSyncScope): string {
  return [
    scope.mode,
    ...(scope.appIds ?? []).slice().sort(),
    ...(scope.projectIds ?? []).slice().sort(),
    ...(scope.localCollectionIds ?? []).slice().sort(),
  ].join(":");
}

/**
 * Synchronizes a known scope only when its cache is revisited. Initial sync
 * establishes a cursor after a fresh query; it deliberately does not replay
 * historical events into a brand-new local cache.
 */
export async function synchronizeWorkspaceScope(
  scope: WorkspaceSyncScope,
): Promise<Readonly<{ invalidated: boolean; initialized: boolean }>> {
  if (scope.mode === "universal") return { invalidated: false, initialized: false };
  const scopeKey = workspaceScopeKey(scope);
  const checkpoint = await readSyncCheckpoint(scopeKey);
  if (
    checkpoint &&
    Date.now() - checkpoint.updatedAt < MINIMUM_SYNC_INTERVAL_MS
  )
    return { invalidated: false, initialized: false };
  const params = new URLSearchParams({ mode: scope.mode });
  if (scope.appIds?.length) params.set("appIds", scope.appIds.join(","));
  if (scope.projectIds?.length)
    params.set("projectIds", scope.projectIds.join(","));
  if (scope.localCollectionIds?.length)
    params.set("datasetIds", scope.localCollectionIds.join(","));
  if (checkpoint?.cursor) params.set("cursor", checkpoint.cursor);
  const response = await fetch(
    `${getApiBase()}/api/workspace/changes?${params.toString()}`,
  );
  if (!response.ok) throw new Error("No se pudo sincronizar el espacio de trabajo.");
  const data = (await response.json()) as ChangesResponse;
  if (data.changes.length) await applyIncrementalChanges(scopeKey, data.changes);
  await writeSyncCheckpoint(scopeKey, {
    cursor: data.nextCursor,
    revision: data.changes.at(-1)?.revision ?? null,
  });
  return { invalidated: data.changes.length > 0, initialized: !checkpoint };
}
