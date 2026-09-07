"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DragEvent, useEffect, useMemo, useState } from "react";
import {
  duplicateField,
  fieldDefinition,
  fieldDefinitions,
  identifier,
  removeField,
  type AppSchema,
  type BuilderField,
  type FieldType,
} from "../../../features/app-builder/model";
import { type MapIconId } from "../../../features/apps/map-symbols";
import { AppSymbolPicker } from "../../../features/apps/app-symbol-picker";
type AppSummary = {
  id: string;
  code: string;
  name: string;
  allowedGeometries: string[];
  description: string;
  mapIcon: MapIconId;
  mapColor: string;
};
type AppVersion = { version: number; schema: AppSchema };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
function newId(): string {
  return crypto.randomUUID();
}

function createField(type: FieldType, index: number): BuilderField {
  const label = fieldDefinition(type).label;
  return {
    id: newId(),
    type,
    label,
    key: `${identifier(label)}_${index + 1}`,
    required: false,
    ...(type === "singleChoice" || type === "multipleChoice"
      ? { options: ["Opción 1"] }
      : {}),
  };
}

export default function AppBuilderPage() {
  const params = useParams<{ appId: string }>();
  const appId = params.appId;
  const [app, setApp] = useState<AppSummary | null>(null);
  const [schema, setSchema] = useState<AppSchema>({ sections: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingField, setEditingField] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [fieldPendingDeletion, setFieldPendingDeletion] =
    useState<BuilderField | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${apiUrl}/api/apps/${appId}`).then(async (response) => {
        if (!response.ok) throw new Error("No se encontró la App.");
        return response.json() as Promise<AppSummary>;
      }),
      fetch(`${apiUrl}/api/apps/${appId}/versions/latest`).then(
        async (response) => {
          if (!response.ok) throw new Error("No se pudo cargar el formulario.");
          return response.json() as Promise<AppVersion | null>;
        },
      ),
    ])
      .then(([currentApp, latest]) => {
        if (!mounted) return;
        setApp(currentApp);
        setSchema(latest?.schema ?? { sections: [] });
      })
      .catch(
        (reason: unknown) =>
          mounted &&
          setMessage(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar la App.",
          ),
      )
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [appId]);

  const selected = useMemo(
    () =>
      schema.sections
        .flatMap((section) => section.fields)
        .find((field) => field.id === selectedId) ?? null,
    [schema, selectedId],
  );

  function mutateField(fieldId: string, update: Partial<BuilderField>) {
    setSchema((current) => ({
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.id === fieldId ? { ...field, ...update } : field,
        ),
      })),
    }));
  }

  function addField(type: FieldType, sectionId?: string) {
    const targetId = sectionId ?? schema.sections[0]?.id;
    const field = createField(
      type,
      schema.sections.flatMap((section) => section.fields).length,
    );
    setSchema((current) => {
      const selectedSectionId = targetId ?? newId();
      const sections = current.sections.length
        ? current.sections.map((section) =>
            section.id === selectedSectionId
              ? { ...section, fields: [...section.fields, field] }
              : section,
          )
        : [
            {
              id: selectedSectionId,
              title: "Información general",
              fields: [field],
            },
          ];
      return { sections };
    });
    setSelectedId(field.id);
    setEditingField(true);
  }

  function addSection() {
    const section = {
      id: newId(),
      title: `Sección ${schema.sections.length + 1}`,
      fields: [],
    };
    setSchema((current) => ({ sections: [...current.sections, section] }));
  }

  function handleDrop(event: DragEvent<HTMLElement>, sectionId?: string) {
    event.preventDefault();
    const type = event.dataTransfer.getData(
      "application/x-hansa-field",
    ) as FieldType;
    if (fieldDefinitions.some((field) => field.type === type))
      addField(type, sectionId);
  }

  async function save() {
    if (!schema.sections.length) {
      setMessage("Añade al menos una sección antes de guardar.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/apps/${appId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(schema),
      });
      if (!response.ok)
        throw new Error("No se pudo guardar la versión de la App.");
      const version = (await response.json()) as AppVersion;
      setMessage(`Formulario guardado como versión ${version.version}.`);
    } catch (reason: unknown) {
      setMessage(
        reason instanceof Error ? reason.message : "No se pudo guardar la App.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    if (!app) return;
    setSavingSettings(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/api/apps/${appId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: app.description,
          mapIcon: app.mapIcon,
          mapColor: app.mapColor,
        }),
      });
      if (!response.ok)
        throw new Error("No se pudieron guardar los ajustes de la App.");
      setApp((await response.json()) as AppSummary);
      setMessage("Ajustes globales de la App guardados.");
    } catch (reason: unknown) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No se pudieron guardar los ajustes.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading)
    return <main className="builder-loading">Cargando constructor…</main>;
  if (!app)
    return (
      <main className="builder-loading" role="alert">
        {message ?? "No se encontró la App."}
      </main>
    );

  return (
    <main className="app-builder">
      <header className="builder-header">
        <Link href="/apps">← Apps</Link>
        <div>
          <p className="eyebrow">Constructor de aplicación</p>
          <h1>{app.name}</h1>
        </div>
        <p className="builder-code">
          {app.code} · {app.allowedGeometries.join(", ")}
        </p>
        <Link
          className="secondary-button app-configure-link"
          href={`/apps/${appId}/records`}
        >
          Ver registros
        </Link>
        <button
          className="primary-button"
          disabled={saving}
          onClick={save}
          type="button"
        >
          {saving ? "Guardando…" : "Guardar App"}
        </button>
      </header>
      {message && (
        <p className="builder-message" role="status">
          {message}
        </p>
      )}
      <div className="builder-grid">
        <aside className="builder-palette" aria-label="Campos disponibles">
          <h2>Campos</h2>
          {Array.from(new Set(fieldDefinitions.map((item) => item.group))).map(
            (group) => (
              <section key={group}>
                <h3>{group}</h3>
                {fieldDefinitions
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      draggable
                      key={item.type}
                      onClick={() => addField(item.type)}
                      onDragStart={(event) =>
                        event.dataTransfer.setData(
                          "application/x-hansa-field",
                          item.type,
                        )
                      }
                      type="button"
                    >
                      <span aria-hidden="true" className="palette-icon">
                        {item.icon}
                      </span>
                      {item.label}
                      <b aria-hidden="true">+</b>
                    </button>
                  ))}
              </section>
            ),
          )}
          <p>Arrastra un campo al formulario o usa el botón +.</p>
        </aside>
        <section
          className="builder-layout"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          aria-label="Diseño del formulario"
        >
          <div className="layout-heading">
            <div>
              <p className="eyebrow">Formulario</p>
              <h2>{app.name}</h2>
            </div>
            <button
              className="secondary-button"
              onClick={addSection}
              type="button"
            >
              + Agregar sección
            </button>
          </div>
          {schema.sections.length === 0 ? (
            <div className="builder-empty">
              <h3>Tu formulario está vacío</h3>
              <p>Arrastra un campo aquí o selecciónalo en la paleta.</p>
            </div>
          ) : (
            schema.sections.map((section) => (
              <article
                className="builder-section"
                key={section.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, section.id)}
              >
                <div className="section-heading-inputs">
                  <input
                    aria-label="Nombre de la sección"
                    value={section.title}
                    onChange={(event) =>
                      setSchema((current) => ({
                        sections: current.sections.map((item) =>
                          item.id === section.id
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                  <input
                    aria-label="Subtítulo de la sección"
                    placeholder="Subtítulo o indicación para el grupo"
                    value={section.subtitle ?? ""}
                    onChange={(event) =>
                      setSchema((current) => ({
                        sections: current.sections.map((item) =>
                          item.id === section.id
                            ? { ...item, subtitle: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                </div>
                {section.fields.length === 0 ? (
                  <p className="section-drop">
                    Suelta aquí los campos para esta sección.
                  </p>
                ) : (
                  section.fields.map((field) => (
                    <article
                      className={`builder-field ${field.id === selectedId ? "selected" : ""}`}
                      key={field.id}
                    >
                      <button
                        className="builder-field-select"
                        onClick={() => {
                          setSelectedId(field.id);
                          setEditingField(true);
                        }}
                        type="button"
                      >
                        <span aria-hidden="true" className="field-type-icon">
                          {fieldDefinition(field.type).icon}
                        </span>
                        <strong>{field.label}</strong>
                        <small>
                          {fieldDefinition(field.type).label} · {field.key}
                        </small>
                        {field.required && <em>Obligatorio</em>}
                      </button>
                      <div className="field-controls">
                        <button
                          aria-label={`Duplicar ${field.label}`}
                          onClick={() =>
                            setSchema((current) =>
                              duplicateField(current, field.id),
                            )
                          }
                          type="button"
                        >
                          ⧉
                        </button>
                        <button
                          aria-label={`Eliminar ${field.label}`}
                          className="danger-icon"
                          onClick={() => setFieldPendingDeletion(field)}
                          type="button"
                        >
                          ⌫
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </article>
            ))
          )}
        </section>
        <aside className="builder-properties" aria-label="Ajustes de la App">
          <h2>Ajustes de la App</h2>
          <div className="properties-form">
            <label>
              Descripción
              <textarea
                value={app.description}
                onChange={(event) =>
                  setApp({ ...app, description: event.target.value })
                }
              />
            </label>
            <AppSymbolPicker
              color={app.mapColor}
              icon={app.mapIcon}
              onColorChange={(mapColor) => setApp({ ...app, mapColor })}
              onIconChange={(mapIcon) => setApp({ ...app, mapIcon })}
            />
            <p>
              Estos ajustes pertenecen a toda la App, no a un atributo
              individual.
            </p>
            <button
              className="secondary-button"
              disabled={savingSettings}
              onClick={saveSettings}
              type="button"
            >
              {savingSettings ? "Guardando…" : "Guardar ajustes"}
            </button>
          </div>
        </aside>
      </div>
      {selected && editingField && (
        <div className="modal-backdrop">
          <section
            aria-label="Propiedades del campo"
            className="field-editor"
            role="dialog"
            aria-modal="true"
          >
            <div className="form-heading">
              <h2>{selected.label}</h2>
              <button
                aria-label="Cerrar propiedades"
                className="icon-button"
                onClick={() => setEditingField(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <label>
              Etiqueta
              <input
                value={selected.label}
                onChange={(event) =>
                  mutateField(selected.id, { label: event.target.value })
                }
              />
            </label>
            <label>
              Descripción
              <textarea
                value={selected.description ?? ""}
                onChange={(event) =>
                  mutateField(selected.id, { description: event.target.value })
                }
              />
            </label>
            <label>
              Nombre del atributo
              <input
                pattern="[a-z][a-z0-9_]{0,63}"
                value={selected.key}
                onChange={(event) =>
                  mutateField(selected.id, {
                    key: identifier(event.target.value),
                  })
                }
              />
            </label>
            <p>
              <strong>Tipo fijo:</strong> {fieldDefinition(selected.type).label}
              . Para usar otro tipo, crea un nuevo atributo.
            </p>
            {(selected.type === "singleChoice" ||
              selected.type === "multipleChoice") && (
              <label>
                Opciones (una por línea)
                <textarea
                  value={(selected.options ?? []).join("\n")}
                  onChange={(event) =>
                    mutateField(selected.id, {
                      options: event.target.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            )}
            <label>
              Mostrar
              <select
                value={selected.display ?? "fullWidth"}
                onChange={(event) =>
                  mutateField(selected.id, {
                    display: event.target.value as "inline" | "fullWidth",
                  })
                }
              >
                <option value="fullWidth">Ancho completo</option>
                <option value="inline">En línea</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                checked={selected.required}
                onChange={(event) =>
                  mutateField(selected.id, { required: event.target.checked })
                }
                type="checkbox"
              />
              Campo obligatorio
            </label>
            <label className="checkbox-label">
              <input
                checked={selected.hidden ?? false}
                onChange={(event) =>
                  mutateField(selected.id, { hidden: event.target.checked })
                }
                type="checkbox"
              />
              Oculto por defecto
            </label>
            <button
              className="secondary-button"
              onClick={() => setEditingRules(true)}
              type="button"
            >
              Reglas de visibilidad{" "}
              {selected.visibility
                ? `(${selected.visibility.conditions.length})`
                : ""}
            </button>
          </section>
        </div>
      )}
      {selected && editingRules && (
        <div className="modal-backdrop">
          <section
            aria-label="Reglas de visibilidad"
            className="rules-dialog"
            role="dialog"
            aria-modal="true"
          >
            <h2>Reglas de visibilidad</h2>
            <p>
              Determinan si se muestra este atributo sin cambiar ni duplicar el
              formulario.
            </p>
            <label>
              Mostrar cuando
              <select
                value={selected.visibility?.match ?? "all"}
                onChange={(event) =>
                  mutateField(selected.id, {
                    visibility: {
                      match: event.target.value as "all" | "any",
                      preserveValue:
                        selected.visibility?.preserveValue ?? false,
                      conditions: selected.visibility?.conditions ?? [],
                    },
                  })
                }
              >
                <option value="all">se cumplan todas las condiciones</option>
                <option value="any">se cumpla alguna condición</option>
              </select>
            </label>
            {(selected.visibility?.conditions ?? []).map((condition, index) => (
              <div className="rule-row" key={`${condition.fieldId}-${index}`}>
                <select
                  value={condition.fieldId}
                  onChange={(event) =>
                    mutateField(selected.id, {
                      visibility: {
                        ...selected.visibility!,
                        conditions: selected.visibility!.conditions.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, fieldId: event.target.value }
                              : item,
                        ),
                      },
                    })
                  }
                >
                  {schema.sections
                    .flatMap((section) => section.fields)
                    .filter((field) => field.id !== selected.id)
                    .map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                </select>
                <select
                  value={condition.operator}
                  onChange={(event) =>
                    mutateField(selected.id, {
                      visibility: {
                        ...selected.visibility!,
                        conditions: selected.visibility!.conditions.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  operator: event.target
                                    .value as typeof item.operator,
                                }
                              : item,
                        ),
                      },
                    })
                  }
                >
                  <option value="equals">es igual a</option>
                  <option value="notEquals">no es igual a</option>
                  <option value="isEmpty">está vacío</option>
                  <option value="isNotEmpty">no está vacío</option>
                </select>
                {condition.operator !== "isEmpty" &&
                  condition.operator !== "isNotEmpty" && (
                    <input
                      aria-label="Valor de la condición"
                      value={condition.value ?? ""}
                      onChange={(event) =>
                        mutateField(selected.id, {
                          visibility: {
                            ...selected.visibility!,
                            conditions: selected.visibility!.conditions.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, value: event.target.value }
                                  : item,
                            ),
                          },
                        })
                      }
                    />
                  )}
              </div>
            ))}
            <button
              className="secondary-button"
              disabled={
                schema.sections.flatMap((section) => section.fields).length < 2
              }
              onClick={() => {
                const source = schema.sections
                  .flatMap((section) => section.fields)
                  .find((field) => field.id !== selected.id);
                if (source)
                  mutateField(selected.id, {
                    visibility: {
                      match: selected.visibility?.match ?? "all",
                      preserveValue:
                        selected.visibility?.preserveValue ?? false,
                      conditions: [
                        ...(selected.visibility?.conditions ?? []),
                        { fieldId: source.id, operator: "equals", value: "" },
                      ],
                    },
                  });
              }}
              type="button"
            >
              + Añadir condición
            </button>
            <label className="checkbox-label">
              <input
                checked={selected.visibility?.preserveValue ?? false}
                onChange={(event) =>
                  mutateField(selected.id, {
                    visibility: {
                      match: selected.visibility?.match ?? "all",
                      conditions: selected.visibility?.conditions ?? [],
                      preserveValue: event.target.checked,
                    },
                  })
                }
                type="checkbox"
              />
              Conservar valor cuando quede oculto
            </label>
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => setEditingRules(false)}
                type="button"
              >
                Listo
              </button>
            </div>
          </section>
        </div>
      )}
      {fieldPendingDeletion && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="delete-field-title"
            className="app-form"
            role="dialog"
            aria-modal="true"
          >
            <h2 id="delete-field-title">¿Eliminar atributo?</h2>
            <p>
              “{fieldPendingDeletion.label}” se eliminará solo de este borrador.
              Las versiones ya guardadas y sus registros no cambian.
            </p>
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => setFieldPendingDeletion(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setSchema((current) =>
                    removeField(current, fieldPendingDeletion.id),
                  );
                  if (selectedId === fieldPendingDeletion.id) {
                    setSelectedId(null);
                    setEditingField(false);
                  }
                  setFieldPendingDeletion(null);
                }}
                type="button"
              >
                Eliminar atributo
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
