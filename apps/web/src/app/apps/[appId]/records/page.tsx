"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  RecordsMap,
  type MapRecord,
} from "../../../../features/records/records-map";

type Field = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  description?: string;
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
type RecordItem = MapRecord;
type Mode = "map" | "split" | "table";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

function visible(
  field: Field,
  fields: Field[],
  values: Record<string, unknown>,
): boolean {
  if (field.hidden) return false;
  const rules = field.visibility;
  if (!rules?.conditions.length) return true;
  const result = rules.conditions.map((condition) => {
    const source = fields.find((item) => item.id === condition.fieldId);
    const rawValue = source ? values[source.key] : undefined;
    const value = Array.isArray(rawValue)
      ? rawValue.join(",")
      : String(rawValue ?? "");
    if (condition.operator === "isEmpty") return value.length === 0;
    if (condition.operator === "isNotEmpty") return value.length > 0;
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
  const [draftPoint, setDraftPoint] = useState<[number, number] | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
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
  function openEditor(record: RecordItem | "new") {
    setEditor(record);
    setFormValues(record === "new" ? {} : record.attributes);
    setDraftPoint(
      record !== "new" && record.geometry?.type === "Point"
        ? record.geometry.coordinates
        : null,
    );
  }
  function closeEditor() {
    setEditor(null);
    setDraftPoint(null);
    setFormValues({});
  }
  function changeField(key: string, value: unknown) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }
  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const attributes = Object.fromEntries(
      fields.map((field) => {
        if (field.type === "boolean") return [field.key, form.has(field.key)];
        if (field.type === "multipleChoice")
          return [field.key, form.getAll(field.key).map(String)];
        const value = String(form.get(field.key) ?? "");
        if (field.type === "number")
          return [field.key, value === "" ? null : Number(value)];
        return [field.key, value];
      }),
    );
    const geometry = draftPoint
      ? { type: "Point" as const, coordinates: draftPoint }
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
      closeEditor();
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
          onClick={() => openEditor("new")}
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
          Esta App todavía no tiene atributos. Puedes crear un punto con
          ubicación o configurar su formulario antes de continuar.
        </p>
      )}
      <div className={`records-view ${mode}`}>
        <section className="records-map" aria-label="Mapa de registros">
          <RecordsMap
            appId={appId}
            color={app.mapColor}
            onPick={setDraftPoint}
            onRecords={setRecords}
            onSelect={openEditor}
            pickedPoint={draftPoint}
            picking={editor !== null}
            records={records}
          />
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
                      onClick={() => openEditor(record)}
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
        <div className="modal-backdrop record-editor-backdrop">
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
                onClick={closeEditor}
                type="button"
              >
                ×
              </button>
            </div>
            {schema.sections.map((section) => (
              <fieldset key={section.id}>
                <legend>{section.title}</legend>
                {section.fields
                  .filter((field) => visible(field, fields, formValues))
                  .map((field) => (
                    <label key={field.id}>
                      <span>
                        {field.label}
                        {field.required ? " *" : ""}
                      </span>
                      {field.type === "boolean" ? (
                        <input
                          defaultChecked={Boolean(
                            editor !== "new" && editor.attributes[field.key],
                          )}
                          name={field.key}
                          onChange={(event) =>
                            changeField(field.key, event.target.checked)
                          }
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
                          onChange={(event) =>
                            changeField(field.key, event.target.value)
                          }
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
                          onChange={(event) =>
                            changeField(field.key, event.target.value)
                          }
                          required={field.required}
                        >
                          <option value="">Selecciona…</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : field.type === "multipleChoice" ? (
                        <select
                          defaultValue={
                            editor === "new"
                              ? []
                              : Array.isArray(editor.attributes[field.key])
                                ? (editor.attributes[field.key] as string[])
                                : []
                          }
                          multiple
                          name={field.key}
                          onChange={(event) =>
                            changeField(
                              field.key,
                              Array.from(
                                event.currentTarget.selectedOptions,
                                (option) => option.value,
                              ),
                            )
                          }
                          required={field.required}
                        >
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
                          onChange={(event) =>
                            changeField(
                              field.key,
                              field.type === "number"
                                ? event.target.value === ""
                                  ? null
                                  : Number(event.target.value)
                                : event.target.value,
                            )
                          }
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
                      {field.description && <small>{field.description}</small>}
                    </label>
                  ))}
              </fieldset>
            ))}
            <fieldset>
              <legend>Ubicación del punto</legend>
              <p className="map-pick-hint">
                Haz clic en el mapa para ubicar el punto.
              </p>
              <label>
                Longitud
                <input
                  onChange={(event) => {
                    const longitude = Number(event.target.value);
                    setDraftPoint((current) => [longitude, current?.[1] ?? 0]);
                  }}
                  name="longitude"
                  placeholder="Selecciona en el mapa"
                  step="any"
                  type="number"
                  value={draftPoint?.[0] ?? ""}
                />
              </label>
              <label>
                Latitud
                <input
                  onChange={(event) => {
                    const latitude = Number(event.target.value);
                    setDraftPoint((current) => [current?.[0] ?? 0, latitude]);
                  }}
                  name="latitude"
                  placeholder="Selecciona en el mapa"
                  step="any"
                  type="number"
                  value={draftPoint?.[1] ?? ""}
                />
              </label>
              {draftPoint && (
                <button
                  className="row-action clear-location"
                  onClick={() => setDraftPoint(null)}
                  type="button"
                >
                  Quitar ubicación
                </button>
              )}
            </fieldset>
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={closeEditor}
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
