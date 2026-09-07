export type MapBounds = readonly [number, number, number, number];

export function buildMapRecordsUrl(
  apiUrl: string,
  bounds: MapBounds,
  zoom: number,
  appIds: readonly string[],
  projectId?: string,
): string {
  const parameters = new URLSearchParams({
    bbox: bounds.map((value) => Number(value.toFixed(5))).join(","),
    zoom: String(Math.round(zoom)),
  });
  if (appIds.length) parameters.set("projectAppIds", appIds.join(","));
  if (projectId) parameters.set("projectId", projectId);
  return `${apiUrl}/api/map/records?${parameters.toString()}`;
}

export function buildProjectRecordsUrl(
  apiUrl: string,
  projectId: string,
  appIds: readonly string[],
  bounds: MapBounds,
  page: number,
  pageSize = 50,
): string {
  const parameters = new URLSearchParams({
    projectAppIds: appIds.join(","),
    bbox: bounds.map((value) => Number(value.toFixed(5))).join(","),
    page: String(page),
    pageSize: String(pageSize),
  });
  return `${apiUrl}/api/projects/${projectId}/records?${parameters.toString()}`;
}
