"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DragEvent, useEffect, useMemo, useState } from "react";

type FieldType =
  | "shortText"
  | "longText"
  | "number"
  | "boolean"
  | "date"
  | "time"
  | "singleChoice"
  | "multipleChoice"
  | "photo"
  | "file"
  | "signature";
type BuilderField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};
type BuilderSection = { id: string; title: string; fields: BuilderField[] };
type AppSchema = { sections: BuilderSection[] };
type AppSummary = {
  id: string;
  code: string;
  name: string;
  allowedGeometries: string[];
};
type AppVersion = { version: number; schema: AppSchema };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
const palette: ReadonlyArray<{
  type: FieldType;
  label: string;
  group: string;
}> = [
  { type: "shortText", label: "Texto corto", group: "Básicos" },
  { type: "longText", label: "Texto largo", group: "Básicos" },
  { type: "number", label: "Número", group: "Básicos" },
  { type: "boolean", label: "Sí / No", group: "Básicos" },
  { type: "date", label: "Fecha", group: "Básicos" },
  { type: "time", label: "Hora", group: "Básicos" },
  { type: "singleChoice", label: "Selección única", group: "Opciones" },
  { type: "multipleChoice", label: "Selección múltiple", group: "Opciones" },
  { type: "photo", label: "Foto", group: "Medios" },
  { type: "file", label: "Archivo", group: "Medios" },
  { type: "signature", label: "Firma", group: "Medios" },
];

function identifier(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized && /^[a-z]/.test(normalized)
    ? normalized.slice(0, 64)
    : "campo";
}

function newId(): string {
  return crypto.randomUUID();
}

function createField(type: FieldType, index: number): BuilderField {
  const label = palette.find((field) => field.type === type)?.label ?? "Campo";
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
    if (palette.some((field) => field.type === type)) addField(type, sectionId);
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
          {Array.from(new Set(palette.map((item) => item.group))).map(
            (group) => (
              <section key={group}>
                <h3>{group}</h3>
                {palette
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
                      <span aria-hidden="true">⋮⋮</span>
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
                {section.fields.length === 0 ? (
                  <p className="section-drop">
                    Suelta aquí los campos para esta sección.
                  </p>
                ) : (
                  section.fields.map((field) => (
                    <button
                      className={`builder-field ${field.id === selectedId ? "selected" : ""}`}
                      key={field.id}
                      onClick={() => setSelectedId(field.id)}
                      type="button"
                    >
                      <span aria-hidden="true">⋮⋮</span>
                      <strong>{field.label}</strong>
                      <small>
                        {
                          palette.find((item) => item.type === field.type)
                            ?.label
                        }{" "}
                        · {field.key}
                      </small>
                      {field.required && <em>Obligatorio</em>}
                    </button>
                  ))
                )}
              </article>
            ))
          )}
        </section>
        <aside
          className="builder-properties"
          aria-label="Propiedades del campo"
        >
          <h2>Propiedades</h2>
          {!selected ? (
            <p>Selecciona un campo del formulario para configurarlo.</p>
          ) : (
            <div className="properties-form">
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
              <label>
                Tipo de campo
                <select
                  value={selected.type}
                  onChange={(event) =>
                    mutateField(selected.id, {
                      type: event.target.value as FieldType,
                    })
                  }
                >
                  {palette.map((item) => (
                    <option key={item.type} value={item.type}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
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
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
