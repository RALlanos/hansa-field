import { getApiBase } from "../../lib/api-base";
import { cacheKeys, localDataCache } from "../../lib/local-data-cache";
export type Context = { appId?: string; projectId?: string };
export type MetadataField = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "date";
  required: boolean;
};
export type Level = {
  id: string;
  schemeId: string;
  name: string;
  position: number;
  status: "active" | "archived";
  configuration: {
    metadataFields?: MetadataField[];
    allowAdditional?: boolean;
    [key: string]: unknown;
  };
};
export type Scheme = {
  id: string;
  appId: string | null;
  projectId: string | null;
  name: string;
  description: string;
  status: "active" | "archived";
  revision: number;
  configuration: Record<string, unknown>;
  levels: Level[];
};
export type Segment = {
  id: string;
  schemeId: string;
  levelId: string;
  parentSegmentId: string | null;
  name: string;
  code: string | null;
  externalId: string | null;
  description: string;
  status: "active" | "archived";
  metadata: Record<string, unknown>;
  geometry: unknown;
  hasChildren: boolean;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export async function segmentationApi<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const url = `${getApiBase()}/api/segmentation${path}`;
  const readOnly = body === undefined;
  const key = cacheKeys.segmentation({ url });
  if (readOnly) {
    const cached = await localDataCache.read<T>(key);
    if (cached && !cached.stale) return cached.value;
  }
  const response = await fetch(
    url,
    body === undefined
      ? {}
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(result.message)
        ? result.message.join("; ")
        : (result.message ?? "No se pudo guardar Segmentación."),
    );
  if (readOnly) {
    await localDataCache.write(key, result as T, {
      category: "segmentation",
      scope: "segmentation",
      maxAgeMs: 5 * 60 * 1000,
      revision:
        typeof result === "object" &&
        result !== null &&
        "revision" in result &&
        typeof result.revision === "number"
          ? result.revision
          : undefined,
    });
  } else {
    await localDataCache.invalidateCategory("segmentation");
  }
  return result;
}
