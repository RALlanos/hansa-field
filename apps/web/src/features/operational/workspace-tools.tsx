"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Catalog } from "./contracts";
import type { MultiAppMapStatus } from "../maps/multi-app-map";
import { SegmentationAdmin } from "../segmentation/segmentation-admin";

const MultiAppMap = dynamic(
  () => import("../maps/multi-app-map").then((module) => module.MultiAppMap),
  { ssr: false },
);

export function WorkspaceSegmentation({
  catalog,
  context,
  onContextChange,
}: {
  catalog: Catalog;
  context: string;
  onContextChange: (context: string) => void;
}) {
  const [kind, id] = context.split(":");
  const contextName =
    kind === "app"
      ? catalog.apps.find((app) => app.id === id)?.name
      : catalog.projects.find((project) => project.id === id)?.name;
  return (
    <section className="workspace-segmentation">
      <header className="workspace-segmentation-header">
        <div>
          <p className="op-kicker">Organización de registros</p>
          <h2>Segmentación</h2>
          <p>
            Crea estructuras opcionales para ordenar registros sin crear más Apps o Proyectos.
          </p>
        </div>
      </header>
      <label className="workspace-context-select">
        Configurar segmentación para
        <select
          value={context}
          onChange={(event) => onContextChange(event.target.value)}
        >
          <option value="">Seleccionar una App o un Proyecto</option>
          <optgroup label="Apps">
            {catalog.apps.map((app) => (
              <option key={app.id} value={`app:${app.id}`}>
                {app.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Proyectos">
            {catalog.projects.map((project) => (
              <option key={project.id} value={`project:${project.id}`}>
                {project.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {id ? (
        <SegmentationAdmin
          context={kind === "app" ? { appId: id } : { projectId: id }}
          contextName={contextName ?? (kind === "app" ? "App" : "Proyecto")}
        />
      ) : (
        <div className="workspace-segmentation-empty">
          <strong>Elige dónde organizar los registros.</strong>
          <p>La Segmentación de una App clasifica sus Records. La de un Proyecto clasifica solamente sus Project Records.</p>
        </div>
      )}
    </section>
  );
}

export function WorkspaceUniversalMap({ catalog }: { catalog: Catalog }) {
  const [appIds, setAppIds] = useState<string[]>(() =>
    catalog.apps.map((app) => app.id),
  );
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [localCollectionIds, setLocalCollectionIds] = useState<string[]>([]);
  const [status, setStatus] = useState<MultiAppMapStatus>({
    visibleFeatures: 0,
    totalRecords: 0,
    clustered: false,
    truncated: false,
  });
  const localCollections = catalog.collections.filter(
    (collection, index, all) =>
      collection.local_project_id &&
      all.findIndex((item) => item.id === collection.id) === index,
  );
  const groups = [
    { label: "Apps", items: catalog.apps, selected: appIds, update: setAppIds },
    {
      label: "Proyectos",
      items: catalog.projects,
      selected: projectIds,
      update: setProjectIds,
    },
    {
      label: "Colecciones locales",
      items: localCollections,
      selected: localCollectionIds,
      update: setLocalCollectionIds,
    },
  ];
  return (
    <section>
      <div className="op-toolbar">
        {groups.map((group) => (
          <details key={group.label}>
            <summary>
              {group.label} · {group.selected.length} seleccionadas
            </summary>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {group.items.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={group.selected.includes(item.id)}
                    onChange={() =>
                      group.update((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                  />
                  {item.name}
                </label>
              ))}
              {!group.items.length && <p>Sin elementos.</p>}
            </div>
          </details>
        ))}
      </div>
      <p aria-live="polite">
        {status.totalRecords} registros en esta vista
        {status.truncated ? " · Acerca el mapa para ver más detalle." : ""}
      </p>
      <MultiAppMap
        mode="universal"
        appIds={appIds}
        projectIds={projectIds}
        localCollectionIds={localCollectionIds}
        onStatus={setStatus}
      />
    </section>
  );
}
