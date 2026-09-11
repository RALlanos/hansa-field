import { getApiBase } from "../../lib/api-base";
export type Field = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
};
export type Schema = {
  sections: { id: string; title: string; fields: Field[] }[];
};
export type Collection = {
  id: string;
  name: string;
  app_id: string | null;
  local_project_id: string | null;
  project_id: string | null;
  project_app_id: string | null;
  schema_definition: Schema;
  version: number;
};
export type Catalog = {
  templates: { id: string; name: string; version_id: string }[];
  apps: { id: string; name: string; dataset_id: string }[];
  projects: { id: string; name: string }[];
  collections: Collection[];
  blocks: { id: string; name: string; app_ids: string[] }[];
};
export type Row = {
  record_id: string;
  project_record_id: string | null;
  project_app_id: string | null;
  dataset_id: string;
  revision: number;
  attributes: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
  display_geometry: GeoJSON.Geometry | null;
};
export type Page = { rows: Row[]; total: number; nextCursor: string | null };
export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(
    `${getApiBase()}/api/workspace${path}`,
    body === undefined
      ? {}
      : {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-operation-id": crypto.randomUUID(),
          },
          body: JSON.stringify(body),
        },
  );
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data === "object" && data !== null && "message" in data
        ? String(data.message)
        : `HTTP ${response.status}`,
    );
  return data as T;
}
