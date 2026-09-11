import type { Catalog } from "./contracts";
import type { MapScopeInput } from "../maps/multi-app-map-model";

export function recordScope(catalog: Catalog, projectId: string, datasetId: string): Omit<MapScopeInput, "bbox" | "zoom"> {
  const collection = catalog.collections.find((item) => item.id === datasetId);
  return {
    mode: projectId ? "project" : "app",
    projectIds: projectId ? [projectId] : [],
    appIds: collection?.app_id ? [collection.app_id] : [],
    localCollectionIds: collection?.local_project_id ? [collection.id] : [],
  };
}
