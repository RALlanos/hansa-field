"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MultiAppMap } from "../../../../features/maps/multi-app-map";
import {
  RecordsWorkspace,
  type RecordsWorkspaceApp,
} from "../../../../features/records/records-workspace";

type ProjectApp = RecordsWorkspaceApp & {
  projectId: string;
  projectName: string;
};
type Column = { id: string; label: string; keys: Record<string, string> };
type Metadata = { name: string; projectApps: ProjectApp[]; columns: Column[] };
type Participation = {
  recordUuid: string;
  projectRecordUuid: string;
  projectAppId: string;
  projectId: string;
  projectName: string;
  appName: string;
  attributes: Record<string, unknown>;
};
type Result = { data: Participation[]; totalRecords: number };
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
const ignoreStatus = () => {};
function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export default function RecordsPage() {
  const { appId } = useParams<{ appId: string }>();
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [project, setProject] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result>({ data: [], totalRecords: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setMetadata(null);
    void fetch(`${api}/api/apps/${appId}/records/metadata`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudo cargar la App.");
        return r.json() as Promise<Metadata>;
      })
      .then((data) => {
        setMetadata(data);
        setSelected(data.projectApps.map((a) => a.id));
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Error al cargar la App.");
      });
    return () => controller.abort();
  }, [appId]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const apps = useMemo(
    () =>
      metadata?.projectApps.filter(
        (a) => !project || a.projectId === project,
      ) ?? [],
    [metadata, project],
  );
  const ids = apps
    .filter((a) => selected.includes(a.id))
    .map((a) => a.id)
    .join(",");
  const filters = useMemo(
    () =>
      new URLSearchParams({
        projectAppIds: ids,
        search: debounced,
        ...(project ? { projectId: project } : {}),
      }).toString(),
    [ids, debounced, project],
  );
  useEffect(() => {
    if (!metadata) return;
    const controller = new AbortController();
    if (!ids) {
      setResult({ data: [], totalRecords: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void fetch(
      `${api}/api/apps/${appId}/records?${filters}&page=${page}&pageSize=50`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok)
          throw new Error("No se pudieron cargar las participaciones.");
        return r.json() as Promise<Result>;
      })
      .then(setResult)
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Error al cargar registros.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [appId, filters, page, metadata, ids]);
  if (!metadata)
    return (
      <main className="builder-loading" role={error ? "alert" : "status"}>
        {error || "Cargando App…"}
      </main>
    );
  const projects = [
    ...new Map(
      metadata.projectApps.map((a) => [a.projectId, a.projectName]),
    ).entries(),
  ];
  const columns = metadata.columns.filter((c) =>
    apps.some((a) => selected.includes(a.id) && c.keys[a.id]),
  );
  return (
    <RecordsWorkspace
      title={metadata.name}
      contextLabel="Registros consolidados · una fila por participación"
      backHref="/apps"
      backLabel="Apps"
      totalRecords={result.totalRecords}
      apps={apps.map((a) => ({ ...a, name: `${a.name} · ${a.projectName}` }))}
      selectedIds={selected.filter((id) => apps.some((a) => a.id === id))}
      onSelectedIdsChange={(ids) => {
        setSelected(ids);
        setPage(1);
      }}
      message={
        <>
          <div className="consolidated-filters">
            <label>
              Proyecto
              <select
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  setSelected(
                    metadata.projectApps
                      .filter(
                        (a) =>
                          !e.target.value || a.projectId === e.target.value,
                      )
                      .map((a) => a.id),
                  );
                  setPage(1);
                }}
              >
                <option value="">Todos los proyectos</option>
                {projects.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Buscar registros
              <input
                type="search"
                value={search}
                maxLength={250}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Atributos o UUID del registro"
              />
            </label>
            <span>
              Vista de consulta. Cada fila conserva los valores de su proyecto.
            </span>
          </div>
          {error && <p role="alert">{error}</p>}
        </>
      }
      map={
        <MultiAppMap
          appIds={ids ? ids.split(",") : []}
          onStatus={ignoreStatus}
          endpoint={`${api}/api/apps/${appId}/records/map`}
          search={debounced}
          {...(project ? { projectId: project } : {})}
        />
      }
      table={
        <>
          <div aria-busy={loading}>
            {loading && <p role="status">Cargando participaciones…</p>}
            <table>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Project App</th>
                  <th>Registro Hansa</th>
                  {columns.map((c) => (
                    <th key={c.id} title={`Identidad de campo: ${c.id}`}>
                      {c.label}
                      {columns.filter((x) => x.label === c.label).length > 1
                        ? ` (${c.id.slice(0, 8)})`
                        : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((row) => (
                  <tr
                    key={row.projectRecordUuid}
                    data-participation={row.projectRecordUuid}
                  >
                    <td>{row.projectName}</td>
                    <td>{row.appName}</td>
                    <td title={`Participación: ${row.projectRecordUuid}`}>
                      <code>{row.recordUuid}</code>
                    </td>
                    {columns.map((c) => {
                      const key = c.keys[row.projectAppId];
                      return (
                        <td key={c.id}>
                          {key === undefined ? (
                            <span title="No aplica en este proyecto">N/A</span>
                          ) : (
                            valueText(row.attributes[key])
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !result.data.length && (
              <p className="records-empty">
                No hay participaciones activas para estos filtros.
              </p>
            )}
          </div>
          <nav className="records-pagination" aria-label="Paginación">
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de{" "}
              {Math.max(1, Math.ceil(result.totalRecords / 50))}
            </span>
            <button
              disabled={page * 50 >= result.totalRecords || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </nav>
        </>
      }
    />
  );
}
