"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Field = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  hidden?: boolean;
  visibility?: {
    match: "all" | "any";
    conditions: Array<{ fieldId: string; operator: string; value?: string }>;
  };
};
type AppSchema = {
  sections: Array<{ id: string; title: string; fields: Field[] }>;
};
type App = { name: string; code: string; mapColor: string; mapIcon: string };
type RecordItem = {
  id: string;
  attributes: Record<string, unknown>;
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  updatedAt: string;
};
type Mode = "map" | "split" | "table";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

function visible(
  field: Field,
  fields: Field[],
  values: Record<string, string>,
): boolean {
  if (field.hidden) return false;
  const rules = field.visibility;
  if (!rules?.conditions.length) return true;
  const result = rules.conditions.map((condition) => {
    const source = fields.find((item) => item.id === condition.fieldId);
    const value = source ? (values[source.key] ?? "") : "";
    if (condition.operator === "isEmpty") return value === "";
    if (condition.operator === "isNotEmpty") return value !== "";
    if (condition.operator === "notEquals")
      return value !== (condition.value ?? "");
    return value === (condition.value ?? "");
  });
  return rules.match === "all" ? result.every(Boolean) : result.some(Boolean);
}

export default function RecordsPage() {
  const { appId } = useParams<{ appId: string }>();
  const [app, setApp] = useState<App | null>(null);
  const [schema, setSchema] = useState<AppSchema>({ sections: [] });
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [mode, setMode] = useState<Mode>("split");
  const [editor, setEditor] = useState<RecordItem | "new" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/api/apps/${appId}`).then(
        (response) => response.json() as Promise<App>,
      ),
      fetch(`${apiUrl}/api/apps/${appId}/versions/latest`).then(
        (response) => response.json() as Promise<{ schema: AppSchema } | null>,
      ),
      fetch(`${apiUrl}/api/apps/${appId}/records`).then(
        (response) => response.json() as Promise<{ data: RecordItem[] }>,
      ),
    ])
      .then(([currentApp, version, items]) => {
        setApp(currentApp);
        setSchema(version?.schema ?? { sections: [] });
        setRecords(items.data);
      })
      .catch(() => setMessage("No se pudieron cargar los registros."))
      .finally(() => setLoading(false));
  }, [appId]);

  const fields = useMemo(
    () => schema.sections.flatMap((section) => section.fields),
    [schema],
  );
  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const attributes = Object.fromEntries(
      fields.map((field) => [field.key, form.get(field.key) ?? ""]),
    );
    const longitude = String(form.get("longitude") ?? "");
    const latitude = String(form.get("latitude") ?? "");
    const geometry =
      longitude !== "" && latitude !== ""
        ? {
            type: "Point" as const,
            coordinates: [Number(longitude), Number(latitude)] as [
              number,
              number,
            ],
          }
        : null;
    const isNew = editor === "new";
    const url = isNew
      ? `${apiUrl}/api/apps/${appId}/records`
      : `${apiUrl}/api/apps/${appId}/records/${editor?.id}`;
    try {
      const response = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attributes, geometry }),
      });
      if (!response.ok) throw new Error("No se pudo guardar el registro.");
      const saved = (await response.json()) as RecordItem;
      setRecords((current) =>
        isNew
          ? [saved, ...current]
          : current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setEditor(null);
      setMessage(isNew ? "Registro creado." : "Registro actualizado.");
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el registro.",
      );
    }
  }
  if (loading)
    return <main className="builder-loading">Cargando registros…</main>;
  if (!app)
    return (
      <main className="builder-loading" role="alert">
        {message ?? "No se encontró la App."}
      </main>
    );
  return (
    <main className="records-page">
      <header className="builder-header">
        <Link href={`/apps/${appId}`}>← Configurar App</Link>
        <div>
          <p className="eyebrow">Registros</p>
          <h1>{app.name}</h1>
        </div>
        <p className="builder-code">{records.length} registros</p>
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
          className="primary-button"
          disabled={!schema.sections.length}
          onClick={() => setEditor("new")}
          type="button"
        >
          + Nuevo registro
        </button>
      </header>
      {message && (
        <p className="builder-message" role="status">
          {message}
        </p>
      )}
      {!schema.sections.length && (
        <p className="records-notice">
          Configura y guarda al menos un campo antes de crear registros.
        </p>
      )}
      <div className={`records-view ${mode}`}>
        <section className="records-map" aria-label="Mapa de registros">
          <p>Mapa · {app.mapIcon}</p>
          {records
            .filter((record) => record.geometry)
            .map((record, index) => (
              <button
                aria-label={`Abrir registro ${record.id}`}
                className="record-pin"
                key={record.id}
                onClick={() => setEditor(record)}
                style={{
                  background: app.mapColor,
                  left: `${15 + ((index * 17) % 70)}%`,
                  top: `${20 + ((index * 23) % 60)}%`,
                }}
                type="button"
              >
                ●
              </button>
            ))}
          <small>
            Los puntos se ubican mediante longitud y latitud en WGS84.
          </small>
        </section>
        <section className="records-table">
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                {fields.slice(0, 4).map((field) => (
                  <th key={field.id}>{field.label}</th>
                ))}
                <th>Ubicación</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.id.slice(0, 8)}</td>
                  {fields.slice(0, 4).map((field) => (
                    <td key={field.id}>
                      {String(record.attributes[field.key] ?? "—")}
                    </td>
                  ))}
                  <td>{record.geometry ? "Punto" : "Sin ubicación"}</td>
                  <td>
                    <button
                      className="row-action"
                      onClick={() => setEditor(record)}
                      type="button"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && (
            <p className="records-empty">
              Aún no hay registros. Crea el primero manualmente.
            </p>
          )}
        </section>
      </div>
      {editor && (
        <div className="modal-backdrop">
          <form
            aria-label="Editor de registro"
            className="record-editor"
            onSubmit={saveRecord}
          >
            <div className="form-heading">
              <h2>{editor === "new" ? "Nuevo registro" : "Editar registro"}</h2>
              <button
                aria-label="Cerrar"
                className="icon-button"
                onClick={() => setEditor(null)}
                type="button"
              >
                ×
              </button>
            </div>
            {schema.sections.map((section) => (
              <fieldset key={section.id}>
                <legend>{section.title}</legend>
                {section.fields
                  .filter((field) =>
                    visible(
                      field,
                      fields,
                      editor === "new"
                        ? {}
                        : Object.fromEntries(
                            Object.entries(editor.attributes).map(
                              ([key, value]) => [key, String(value)],
                            ),
                          ),
                    ),
                  )
                  .map((field) => (
                    <label key={field.id}>
                      {field.label}
                      {field.type === "boolean" ? (
                        <input
                          defaultChecked={Boolean(
                            editor !== "new" && editor.attributes[field.key],
                          )}
                          name={field.key}
                          type="checkbox"
                        />
                      ) : field.type === "longText" ? (
                        <textarea
                          defaultValue={
                            editor === "new"
                              ? ""
                              : String(editor.attributes[field.key] ?? "")
                          }
                          name={field.key}
                          required={field.required}
                        />
                      ) : field.type === "singleChoice" ? (
                        <select
                          defaultValue={
                            editor === "new"
                              ? ""
                              : String(editor.attributes[field.key] ?? "")
                          }
                          name={field.key}
                          required={field.required}
                        >
                          <option value="">Selecciona…</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          defaultValue={
                            editor === "new"
                              ? ""
                              : String(editor.attributes[field.key] ?? "")
                          }
                          name={field.key}
                          required={field.required}
                          type={
                            field.type === "number"
                              ? "number"
                              : field.type === "date"
                                ? "date"
                                : field.type === "time"
                                  ? "time"
                                  : "text"
                          }
                        />
                      )}
                    </label>
                  ))}
              </fieldset>
            ))}
            <fieldset>
              <legend>Ubicación opcional</legend>
              <label>
                Longitud
                <input
                  defaultValue={
                    editor !== "new" && editor.geometry
                      ? editor.geometry.coordinates[0]
                      : ""
                  }
                  name="longitude"
                  step="any"
                  type="number"
                />
              </label>
              <label>
                Latitud
                <input
                  defaultValue={
                    editor !== "new" && editor.geometry
                      ? editor.geometry.coordinates[1]
                      : ""
                  }
                  name="latitude"
                  step="any"
                  type="number"
                />
              </label>
            </fieldset>
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => setEditor(null)}
                type="button"
              >
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                Guardar registro
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
