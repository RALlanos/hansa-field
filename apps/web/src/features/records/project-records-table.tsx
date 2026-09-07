"use client";

import { useEffect, useState } from "react";

import {
  buildProjectRecordsUrl,
  type MapBounds,
} from "../maps/multi-app-map-model";
import type { MapRecord } from "./records-map";

export type ProjectRecord = MapRecord &
  Readonly<{
    recordUuid: string;
    projectRecordUuid: string;
    projectAppId: string;
    appName: string;
    displayGeometry: MapRecord["geometry"];
  }>;
type ProjectRecordsResponse = Readonly<{
  data: ProjectRecord[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}>;
type Props = Readonly<{
  projectId: string;
  projectAppIds: readonly string[];
  bounds: MapBounds | null;
  onEdit: (record: ProjectRecord) => void;
  onTotal: (total: number) => void;
}>;

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

function attributeValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function ProjectRecordsTable({
  projectId,
  projectAppIds,
  bounds,
  onEdit,
  onTotal,
}: Props) {
  const [result, setResult] = useState<ProjectRecordsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const projectAppIdsKey = projectAppIds.join(",");
  const attributeKeys = Array.from(
    new Set(
      result?.data.flatMap((record) => Object.keys(record.attributes)) ?? [],
    ),
  );

  useEffect(() => {
    if (!projectAppIdsKey || !bounds) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(
      buildProjectRecordsUrl(apiUrl, projectId, projectAppIds, bounds, page),
      {
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok)
          throw new Error("No se pudieron cargar los registros del proyecto.");
        return response.json() as Promise<ProjectRecordsResponse>;
      })
      .then((response) => {
        setResult(response);
        onTotal(response.totalRecords);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudieron cargar los registros del proyecto.",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [bounds, onTotal, page, projectAppIds, projectAppIdsKey, projectId]);

  if (!projectAppIds.length)
    return (
      <p className="records-empty">
        Activa una App del proyecto para ver sus registros.
      </p>
    );
  if (!bounds)
    return <p className="records-empty">Calculando área visible del mapa…</p>;
  if (loading && !result)
    return <p className="records-empty">Cargando registros…</p>;
  if (error)
    return (
      <p className="records-table-error" role="alert">
        {error}
      </p>
    );
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>App</th>
            <th>Registro</th>
            {attributeKeys.map((key) => (
              <th key={key}>{key}</th>
            ))}
            <th>Actualizado</th>
            <th>Geometría</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {result?.data.map((record) => (
            <tr key={record.projectRecordUuid}>
              <td>{record.appName}</td>
              <td>{record.recordUuid.slice(0, 8)}</td>
              {attributeKeys.map((key) => (
                <td key={key}>{attributeValue(record.attributes[key])}</td>
              ))}
              <td>{new Date(record.updatedAt).toLocaleString("es-BO")}</td>
              <td>{record.displayGeometry?.type ?? "Sin ubicación"}</td>
              <td>
                <button
                  className="row-action"
                  onClick={() => onEdit(record)}
                  type="button"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!result?.data.length && (
        <p className="records-empty">
          El proyecto no tiene registros para estas Apps.
        </p>
      )}
      {(result?.totalPages ?? 0) > 1 && (
        <nav
          className="records-pagination"
          aria-label="Paginación de registros"
        >
          <button
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
            type="button"
          >
            Anterior
          </button>
          <span>
            Página {page} de {result?.totalPages}
          </span>
          <button
            disabled={page >= (result?.totalPages ?? 1)}
            onClick={() => setPage((current) => current + 1)}
            type="button"
          >
            Siguiente
          </button>
        </nav>
      )}
    </>
  );
}
