"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { MapSymbol } from "../apps/map-symbols";

export type RecordsWorkspaceApp = Readonly<{
  id: string;
  code: string;
  name: string;
  mapColor: string;
  mapIcon: string;
  allowedGeometries: string[];
}>;
type Mode = "map" | "split" | "table";
type Props = Readonly<{
  title: string;
  contextLabel: string;
  backHref: string;
  backLabel: string;
  totalRecords: number;
  apps: readonly RecordsWorkspaceApp[];
  selectedIds: readonly string[];
  onSelectedIdsChange: (ids: string[]) => void;
  map: ReactNode;
  table: ReactNode;
  action?: ReactNode;
  message?: ReactNode;
}>;

export function RecordsWorkspace({
  title,
  contextLabel,
  backHref,
  backLabel,
  totalRecords,
  apps,
  selectedIds,
  onSelectedIdsChange,
  map,
  table,
  action,
  message,
}: Props) {
  const [mode, setMode] = useState<Mode>("split");
  const [filtersOpen, setFiltersOpen] = useState(true);

  function toggleApp(appId: string) {
    onSelectedIdsChange(
      selectedIds.includes(appId)
        ? selectedIds.filter((id) => id !== appId)
        : [...selectedIds, appId],
    );
  }

  return (
    <main className="records-workspace-page">
      <header className="records-workspace-header">
        <Link href={backHref}>← {backLabel}</Link>
        <div className="records-workspace-title">
          <span>{contextLabel}</span>
          <h1>{title}</h1>
        </div>
        <p className="records-workspace-count">
          <strong>{totalRecords.toLocaleString("es-BO")}</strong> registros
        </p>
        <div className="view-switch" aria-label="Modo de visualización">
          <button
            aria-pressed={mode === "map"}
            onClick={() => setMode("map")}
            type="button"
          >
            Mapa
          </button>
          <button
            aria-pressed={mode === "split"}
            onClick={() => setMode("split")}
            type="button"
          >
            Mitad
          </button>
          <button
            aria-pressed={mode === "table"}
            onClick={() => setMode("table")}
            type="button"
          >
            Tabla
          </button>
        </div>
        <button
          aria-expanded={filtersOpen}
          className="filter-toggle"
          onClick={() => setFiltersOpen((current) => !current)}
          type="button"
        >
          {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
        {action}
      </header>
      {message}
      <div
        className={`operational-records-workspace ${filtersOpen ? "" : "filters-collapsed"}`}
      >
        <aside
          className="records-workspace-filters"
          aria-label="Filtros por aplicación"
        >
          <div className="multi-map-toolbar">
            <div>
              <strong>Aplicaciones</strong>
              <span>
                {selectedIds.length} de {apps.length} activas
              </span>
            </div>
            <button
              disabled={!apps.length}
              onClick={() =>
                onSelectedIdsChange(
                  selectedIds.length === apps.length
                    ? []
                    : apps.map(({ id }) => id),
                )
              }
              type="button"
            >
              {selectedIds.length === apps.length
                ? "Ocultar todas"
                : "Mostrar todas"}
            </button>
          </div>
          <div className="multi-map-layer-list">
            {apps.map((app) => (
              <label className="multi-map-layer" key={app.id}>
                <input
                  checked={selectedIds.includes(app.id)}
                  onChange={() => toggleApp(app.id)}
                  type="checkbox"
                />
                <span className="multi-map-layer-symbol">
                  <MapSymbol
                    icon={app.mapIcon}
                    color={app.mapColor}
                    label={`Símbolo de ${app.name}`}
                  />
                </span>
                <span>
                  <strong>{app.name}</strong>
                  <small>
                    {app.code} · {app.allowedGeometries.join(", ")}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </aside>
        <div className={`records-view ${mode}`}>
          <section className="records-map" aria-label="Mapa de registros">
            {map}
          </section>
          <section className="records-table">{table}</section>
        </div>
      </div>
    </main>
  );
}
