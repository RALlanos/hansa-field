"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

type AppSummary = {
  id: string;
  code: string;
  name: string;
  allowedGeometries: string[];
};
type GeoJsonCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: string;
    geometry: unknown;
    properties: Record<string, unknown>;
  }>;
};
type Preview = {
  total: number;
  creates: number;
  updates: number;
  errors: Array<{ index: number; message: string }>;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

export function TransferWorkspace({ mode }: { mode: "import" | "export" }) {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [appId, setAppId] = useState("");
  const [collection, setCollection] = useState<GeoJsonCollection | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`${apiUrl}/api/apps`)
      .then((response) => response.json() as Promise<{ data: AppSummary[] }>)
      .then(({ data }) => {
        setApps(data);
        setAppId(data[0]?.id ?? "");
      })
      .catch(() => setStatus("No se pudieron cargar las Apps."));
  }, []);
  const selected = useMemo(
    () => apps.find((app) => app.id === appId),
    [appId, apps],
  );

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setStatus("");
    if (!file) return;
    if (file.size > 5_000_000) {
      setStatus("El archivo excede el límite inicial de 5 MB.");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as GeoJsonCollection;
      if (
        parsed.type !== "FeatureCollection" ||
        !Array.isArray(parsed.features)
      ) {
        throw new Error("El archivo no es un FeatureCollection GeoJSON.");
      }
      setCollection(parsed);
      setFileName(file.name);
    } catch (error: unknown) {
      setCollection(null);
      setStatus(
        error instanceof Error ? error.message : "No se pudo leer el archivo.",
      );
    }
  }

  async function previewImport() {
    if (!appId || !collection) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(
        `${apiUrl}/api/apps/${appId}/transfers/preview`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(collection),
        },
      );
      const body = (await response.json()) as Preview & { message?: string };
      if (!response.ok)
        throw new Error(body.message ?? "No se pudo validar el archivo.");
      setPreview(body);
    } catch (error: unknown) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo validar el archivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!appId || !collection || preview?.errors.length) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/apps/${appId}/transfers/confirm`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(collection),
        },
      );
      const report = (await response.json()) as {
        created?: number;
        updated?: number;
        message?: string;
      };
      if (!response.ok)
        throw new Error(report.message ?? "No se pudo importar.");
      setStatus(
        `Importación terminada: ${report.created ?? 0} creados y ${report.updated ?? 0} actualizados.`,
      );
      setPreview(null);
      setCollection(null);
      setFileName("");
    } catch (error: unknown) {
      setStatus(
        error instanceof Error ? error.message : "No se pudo importar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!appId || !selected) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(
        `${apiUrl}/api/apps/${appId}/transfers/export.geojson?limit=2000`,
      );
      if (!response.ok) throw new Error("No se pudo generar la exportación.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selected.code.toLowerCase()}.geojson`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Archivo GeoJSON generado.");
    } catch (error: unknown) {
      setStatus(
        error instanceof Error ? error.message : "No se pudo exportar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="module-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">Transferencia de datos</p>
          <h1>
            {mode === "import" ? "Nueva importación" : "Exportar registros"}
          </h1>
          <p>
            {mode === "import"
              ? "Carga inicial controlada con revisión antes de guardar."
              : "Genera una copia interoperable de los registros actuales."}
          </p>
        </div>
      </header>
      <section className="transfer-panel">
        <div className="transfer-step">
          <span>1</span>
          <strong>App y formato</strong>
        </div>
        <label>
          Aplicación
          <select
            value={appId}
            onChange={(event) => setAppId(event.target.value)}
          >
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} · {app.code}
              </option>
            ))}
          </select>
        </label>
        {mode === "import" ? (
          <>
            <label className="file-drop">
              <strong>{fileName || "Seleccionar archivo GeoJSON"}</strong>
              <span>FeatureCollection · hasta 500 elementos y 5 MB</span>
              <input
                accept=".geojson,.json,application/geo+json,application/json"
                onChange={selectFile}
                type="file"
              />
            </label>
            <button
              className="secondary-button"
              disabled={!collection || busy}
              onClick={previewImport}
              type="button"
            >
              {busy ? "Validando…" : "Revisar importación"}
            </button>
            {preview && (
              <div className="transfer-preview">
                <h2>Vista previa</h2>
                <div>
                  <strong>{preview.total}</strong>
                  <span>Total</span>
                  <strong>{preview.creates}</strong>
                  <span>Nuevos</span>
                  <strong>{preview.updates}</strong>
                  <span>Actualizaciones</span>
                </div>
                {preview.errors.length ? (
                  <ul>
                    {preview.errors.slice(0, 10).map((error) => (
                      <li key={`${error.index}-${error.message}`}>
                        Fila {error.index + 1}: {error.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    El archivo está listo para confirmarse. Todavía no se guardó
                    ningún registro.
                  </p>
                )}
                <button
                  className="primary-button"
                  disabled={busy || Boolean(preview.errors.length)}
                  onClick={confirmImport}
                  type="button"
                >
                  Confirmar e importar
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="export-action">
            <p>
              La primera versión exporta hasta 2.000 registros en WGS84,
              conservando atributos y geometría.
            </p>
            <button
              className="primary-button"
              disabled={!appId || busy}
              onClick={download}
              type="button"
            >
              {busy ? "Generando…" : "Descargar GeoJSON"}
            </button>
          </div>
        )}
        {status && <output className="transfer-status">{status}</output>}
        {selected && (
          <Link className="inline-link" href={`/apps/${selected.id}/records`}>
            Ver registros de {selected.name} →
          </Link>
        )}
      </section>
    </main>
  );
}
