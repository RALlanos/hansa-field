"use client";
import { useCallback } from "react";
import { MultiAppMap, type MultiAppMapStatus } from "../maps/multi-app-map";
import type { MapBounds } from "../maps/multi-app-map-model";
import { recordScope } from "./record-scope";
import type { Catalog, Row } from "./contracts";

export function RecordMap({
  catalog,
  projectId,
  datasetId,
  segmentIds,
  refresh,
  viewportTotal,
  onBounds,
  onSelect,
  onStatus,
}: {
  catalog: Catalog;
  projectId: string;
  datasetId: string;
  refresh: number;
  viewportTotal: number;
  segmentIds: readonly string[];
  onBounds: (bbox: string) => void;
  onSelect: (row: Row) => void;
  onStatus: (status: MultiAppMapStatus) => void;
}) {
  const scope = recordScope(catalog, projectId, datasetId);
  const bounds = useCallback(
    (value: MapBounds) => onBounds(value.join(",")),
    [onBounds],
  );
  return (
    <MultiAppMap
      mode={scope.mode}
      appIds={scope.appIds ?? []}
      projectIds={scope.projectIds ?? []}
      localCollectionIds={scope.localCollectionIds ?? []}
      segmentIds={segmentIds}
      refresh={refresh}
      viewportTotal={viewportTotal}
      onStatus={onStatus}
      onViewportChange={bounds}
      onSelect={(feature) => {
        if (!feature.recordUuid) return;
        onSelect({
          record_id: feature.recordUuid,
          project_record_id: feature.projectRecordUuid,
          project_app_id: feature.projectAppId,
          dataset_id: feature.datasetId,
          revision: feature.revision,
          attributes: {},
          geometry: feature.geometry,
          display_geometry: feature.geometry,
        });
      }}
    />
  );
}
