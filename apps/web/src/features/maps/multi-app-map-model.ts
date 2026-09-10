export type MapBounds = readonly [number, number, number, number];
export type MapMode = "app" | "project" | "universal";

export type MapScopeInput = Readonly<{
  mode: MapMode;
  appIds?: readonly string[];
  projectIds?: readonly string[];
  localCollectionIds?: readonly string[];
  bbox: MapBounds;
  zoom: number;
  budget?: number;
}>;

export function buildMapRecordsUrl(
  apiUrl: string,
  scope: MapScopeInput,
): string {
  const parameters = new URLSearchParams({
    mode: scope.mode,
    bbox: scope.bbox.map((value) => Number(value.toFixed(5))).join(","),
    zoom: String(Math.round(scope.zoom)),
    budget: String(scope.budget ?? 2000),
  });
  if (scope.appIds?.length) parameters.set("appIds", scope.appIds.join(","));
  if (scope.projectIds?.length)
    parameters.set("projectIds", scope.projectIds.join(","));
  if (scope.localCollectionIds?.length)
    parameters.set("localCollectionIds", scope.localCollectionIds.join(","));
  return `${apiUrl}/api/workspace/map?${parameters.toString()}`;
}
