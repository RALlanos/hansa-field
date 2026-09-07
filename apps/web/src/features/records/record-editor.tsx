"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import type { MapRecord } from "./records-map";

export type RecordField = Readonly<{
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  description?: string;
  hidden?: boolean;
  visibility?: Readonly<{
    match: "all" | "any";
    conditions: Array<{
      fieldId: string;
      operator: string;
      value?: string;
    }>;
  }>;
}>;

export type RecordSchema = Readonly<{
  sections: Array<
    Readonly<{ id: string; title: string; fields: RecordField[] }>
  >;
}>;

type PointGeometry = Readonly<{
  type: "Point";
  coordinates: [number, number];
}>;

type Props = Readonly<{
  draftPoint: [number, number] | null;
  locationHint?: string;
  onCancel: () => void;
  onDraftPointChange: (point: [number, number] | null) => void;
  onSave: (
    attributes: Record<string, unknown>,
    geometry: PointGeometry | null,
  ) => Promise<void>;
  record: MapRecord | "new";
  schema: RecordSchema;
  saving?: boolean;
}>;

function isVisible(
  field: RecordField,
  fields: RecordField[],
  values: Record<string, unknown>,
): boolean {
  if (field.hidden) return false;
  const rules = field.visibility;
  if (!rules?.conditions.length) return true;
  const results = rules.conditions.map((condition) => {
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
  return rules.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function RecordEditor({
  draftPoint,
  locationHint = "Haz clic en el mapa para ubicar el punto.",
  onCancel,
  onDraftPointChange,
  onSave,
  record,
  schema,
  saving = false,
}: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);
  const [formValues, setFormValues] = useState<Record<string, unknown>>(
    record === "new" ? {} : record.attributes,
  );
  const fields = useMemo(
    () => schema.sections.flatMap((section) => section.fields),
    [schema],
  );

  function changeField(key: string, value: unknown) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
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
    await onSave(
      attributes,
      draftPoint ? { type: "Point", coordinates: draftPoint } : null,
    );
  }

  return (
    <div
      className="modal-backdrop record-editor-backdrop"
      onMouseDown={onCancel}
    >
      <form
        aria-label="Editor de registro"
        className="record-editor"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="form-heading">
          <h2>{record === "new" ? "Nuevo registro" : "Editar registro"}</h2>
          <button
            aria-label="Cerrar"
            className="icon-button"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>
        {schema.sections.map((section) => (
          <fieldset key={section.id}>
            <legend>{section.title}</legend>
            {section.fields
              .filter((field) => isVisible(field, fields, formValues))
              .map((field) => (
                <label key={field.id}>
                  <span>
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  {field.type === "boolean" ? (
                    <input
                      defaultChecked={Boolean(
                        record !== "new" && record.attributes[field.key],
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
                        record === "new"
                          ? ""
                          : String(record.attributes[field.key] ?? "")
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
                        record === "new"
                          ? ""
                          : String(record.attributes[field.key] ?? "")
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
                        record === "new"
                          ? []
                          : Array.isArray(record.attributes[field.key])
                            ? (record.attributes[field.key] as string[])
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
                        record === "new"
                          ? ""
                          : String(record.attributes[field.key] ?? "")
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
          <p className="map-pick-hint">{locationHint}</p>
          <label>
            Longitud
            <input
              onChange={(event) => {
                const longitude = Number(event.target.value);
                onDraftPointChange([longitude, draftPoint?.[1] ?? 0]);
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
                onDraftPointChange([draftPoint?.[0] ?? 0, latitude]);
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
              onClick={() => onDraftPointChange(null)}
              type="button"
            >
              Quitar ubicación
            </button>
          )}
        </fieldset>
        <div className="form-actions">
          <button
            className="secondary-button"
            disabled={saving}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Guardando…" : "Guardar registro"}
          </button>
        </div>
      </form>
    </div>
  );
}
