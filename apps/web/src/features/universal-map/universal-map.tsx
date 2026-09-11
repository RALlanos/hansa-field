"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Catalog, Row } from "../operational/contracts";
import type { MultiAppMapStatus } from "../maps/multi-app-map";
import { RecordInspector } from "../records/record-inspector";

const MultiAppMap = dynamic(
  () => import("../maps/multi-app-map").then((module) => module.MultiAppMap),
  { ssr: false },
);

export function UniversalMapWorkspace({ catalog }: { catalog: Catalog }) {
  const [appIds, setAppIds] = useState<string[]>(() =>
    catalog.apps.map((a) => a.id),
  );
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [localCollectionIds, setLocalCollectionIds] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const [status, setStatus] = useState<MultiAppMapStatus>({
    visibleFeatures: 0,
    totalRecords: 0,
    clustered: false,
    truncated: false,
  });

  const localCollections = catalog.collections.filter(
    (c, idx, arr) =>
      c.local_project_id && arr.findIndex((x) => x.id === c.id) === idx,
  );

  const activeCollection = catalog.collections.find(
    (c) => c.id === selectedRow?.dataset_id,
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-100 font-sans relative">
      {/* Compact Top Bar */}
      <header className="h-13 bg-slate-900 text-white px-4 flex items-center justify-between border-b border-slate-800 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h1 className="text-sm font-semibold tracking-wide text-white">
              Mapa Universal
            </h1>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-xs text-slate-400 hidden sm:inline">
            Superposición de múltiples Apps, Proyectos y Colecciones
          </span>
        </div>

        {/* Map status metrics */}
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded font-mono text-[11px]">
            {status.visibleFeatures} en pantalla / {status.totalRecords} total
          </span>
          {status.clustered && (
            <span className="bg-amber-900/40 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[11px]">
              Agrupado (Zoom para expandir)
            </span>
          )}
          <button
            onClick={() => setRefresh((v) => v + 1)}
            className="px-2 py-0.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
            title="Recargar capas"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 relative flex">
        {/* Scope Selector Floating Drawer / Overlay */}
        <div className="absolute top-3 left-3 z-10 w-72 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg shadow-lg p-3.5 space-y-3 max-h-[85vh] overflow-y-auto text-xs text-slate-700">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
              Capas Activas
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              {appIds.length + projectIds.length + localCollectionIds.length}{" "}
              activas
            </span>
          </div>

          {/* Apps */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Apps ({catalog.apps.length})</span>
              <button
                onClick={() =>
                  setAppIds(
                    appIds.length === catalog.apps.length
                      ? []
                      : catalog.apps.map((a) => a.id),
                  )
                }
                className="text-[10px] text-sky-600 hover:underline"
              >
                {appIds.length === catalog.apps.length ? "Ninguna" : "Todas"}
              </button>
            </div>
            <div className="space-y-1 pl-1">
              {catalog.apps.map((app) => (
                <label
                  key={app.id}
                  className="flex items-center gap-2 cursor-pointer hover:text-slate-900 select-none"
                >
                  <input
                    type="checkbox"
                    checked={appIds.includes(app.id)}
                    onChange={(e) =>
                      setAppIds(
                        e.target.checked
                          ? [...appIds, app.id]
                          : appIds.filter((id) => id !== app.id),
                      )
                    }
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="truncate">{app.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Projects */}
          {catalog.projects.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>Proyectos ({catalog.projects.length})</span>
                <button
                  onClick={() =>
                    setProjectIds(
                      projectIds.length === catalog.projects.length
                        ? []
                        : catalog.projects.map((p) => p.id),
                    )
                  }
                  className="text-[10px] text-sky-600 hover:underline"
                >
                  {projectIds.length === catalog.projects.length
                    ? "Ninguna"
                    : "Todas"}
                </button>
              </div>
              <div className="space-y-1 pl-1">
                {catalog.projects.map((proj) => (
                  <label
                    key={proj.id}
                    className="flex items-center gap-2 cursor-pointer hover:text-slate-900 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={projectIds.includes(proj.id)}
                      onChange={(e) =>
                        setProjectIds(
                          e.target.checked
                            ? [...projectIds, proj.id]
                            : projectIds.filter((id) => id !== proj.id),
                        )
                      }
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span className="truncate">{proj.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Local collections */}
          {localCollections.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>Colecciones Locales ({localCollections.length})</span>
              </div>
              <div className="space-y-1 pl-1">
                {localCollections.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 cursor-pointer hover:text-slate-900 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={localCollectionIds.includes(col.id)}
                      onChange={(e) =>
                        setLocalCollectionIds(
                          e.target.checked
                            ? [...localCollectionIds, col.id]
                            : localCollectionIds.filter((id) => id !== col.id),
                        )
                      }
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span className="truncate">{col.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* The MultiAppMap Engine */}
        <div className="w-full h-full">
          <MultiAppMap
            mode="universal"
            appIds={appIds}
            projectIds={projectIds}
            localCollectionIds={localCollectionIds}
            refresh={refresh}
            onStatus={setStatus}
            onSelect={(feature) => {
              if (!feature.recordUuid) return;
              setSelectedRow({
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
        </div>
      </div>

      {/* Record Inspector Drawer if a feature is selected */}
      {selectedRow && (
        <RecordInspector
          row={selectedRow}
          projectId={selectedRow.project_record_id ? (projectIds[0] ?? "") : ""}
          datasetId={selectedRow.dataset_id}
          catalog={catalog}
          collection={activeCollection}
          onClose={() => setSelectedRow(null)}
          onUpdated={() => setRefresh((v) => v + 1)}
        />
      )}
    </div>
  );
}
