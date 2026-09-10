"use client";

import { useCallback, useEffect, useState } from "react";
import { SegmentationBuilder } from "./segmentation-builder";
import { segmentationApi, type Context, type Scheme } from "./contracts";
import "./segmentation.css";

type EditorState = "overview" | "create" | "edit";
type SchemeSummary = Omit<Scheme, "levels"> & { levels?: Scheme["levels"] };

export function SegmentationAdmin({ context, contextName }: { context: Context; contextName: string }) {
  const [schemes, setSchemes] = useState<SchemeSummary[]>([]);
  const [selected, setSelected] = useState<Scheme | null>(null);
  const [editor, setEditor] = useState<EditorState>("overview");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const contextQuery = context.appId ? `appId=${encodeURIComponent(context.appId)}` : `projectId=${encodeURIComponent(context.projectId ?? "")}`;
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSchemes(await segmentationApi<SchemeSummary[]>(`/schemes?${contextQuery}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las estructuras.");
    } finally {
      setLoading(false);
    }
  }, [contextQuery]);

  useEffect(() => { void reload(); }, [reload]);

  const openBuilder = async (schemeId: string) => {
    setError("");
    try {
      const scheme = await segmentationApi<Scheme>(`/schemes/${schemeId}`);
      setSelected(scheme);
      setEditor("edit");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir la estructura.");
    }
  };

  const create = async () => {
    if (!name.trim()) {
      setError("Indica un nombre para la estructura.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await segmentationApi<{ id: string }>("/schemes", {
        ...context,
        name: name.trim(),
        description: description.trim(),
        configuration: {},
      });
      await reload();
      await openBuilder(created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la estructura.");
    } finally {
      setSaving(false);
    }
  };

  if (editor === "edit" && selected) {
    return (
      <SegmentationBuilder
        onClose={() => {
          setEditor("overview");
          setSelected(null);
          void reload();
        }}
        onSaved={async () => {
          const refreshed = await segmentationApi<Scheme>(`/schemes/${selected.id}`);
          setSelected(refreshed);
          await reload();
        }}
        scheme={selected}
      />
    );
  }

  return (
    <section className="seg-admin" aria-label="Estructuras de segmentación">
      <header className="seg-context-header">
        <p className="seg-kicker">Segmentación de {context.appId ? "App" : "Proyecto"}</p>
        <h3>{contextName}</h3>
        <p>Una estructura define cómo se ordenan los registros. Un <strong>nivel</strong> es el tipo, como País o Departamento. Un <strong>segmento</strong> es el valor, como Bolivia o La Paz.</p>
      </header>
      {error ? <p className="seg-error" role="alert">{error}</p> : null}
      <div className="seg-admin-overview">
        <section className="seg-structure-overview">
          <header className="seg-list-heading">
            <div>
              <p className="seg-kicker">Estructuras</p>
              <h3>Estructuras de segmentación</h3>
            </div>
            <button className="seg-primary" onClick={() => { setName(""); setDescription(""); setEditor("create"); }} type="button">+ Nueva estructura</button>
          </header>
          {loading ? <p className="seg-loading">Cargando estructuras…</p> : null}
          {!loading && !schemes.length ? <p className="seg-empty-list">Todavía no hay una estructura. Crea una para definir niveles como País, Departamento o Nodo.</p> : null}
          {!loading && schemes.map((scheme) => (
            <article className="seg-structure-overview-row" key={scheme.id}>
              <div>
                <strong>{scheme.name}</strong>
                <small>{scheme.levels?.length ? `${scheme.levels.length} nivel${scheme.levels.length === 1 ? "" : "es"}: ${[...scheme.levels].sort((a, b) => a.position - b.position).map((level) => level.name).join(" → ")}` : "Abre la estructura para ver o configurar sus niveles"}</small>
                {scheme.description ? <p>{scheme.description}</p> : null}
              </div>
              <button onClick={() => void openBuilder(scheme.id)} type="button">Editar estructura</button>
            </article>
          ))}
        </section>
        {editor === "create" ? (
          <section className="seg-panel seg-create-structure">
            <p className="seg-kicker">Nueva estructura</p>
            <h3>Define el nombre antes de crear sus niveles</h3>
            <label>Nombre<input autoFocus disabled={saving} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Red nacional" value={name} /></label>
            <label>Descripción<textarea disabled={saving} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" value={description} /></label>
            <div className="seg-actions">
              <button className="seg-primary" disabled={saving} onClick={() => void create()} type="button">{saving ? "Creando…" : "Crear y editar estructura"}</button>
              <button disabled={saving} onClick={() => setEditor("overview")} type="button">Cancelar</button>
            </div>
          </section>
        ) : (
          <aside className="seg-glossary">
            <p className="seg-kicker">Cómo se organiza</p>
            <h3>Dos conceptos simples</h3>
            <dl>
              <div><dt>Nivel</dt><dd>El tipo de división: País, Departamento, Provincia.</dd></div>
              <div><dt>Segmento</dt><dd>El valor real dentro de un nivel: Bolivia, La Paz, Cercado.</dd></div>
            </dl>
            <p>Al abrir una estructura podrás crear los niveles a la izquierda y, en el centro, los segmentos dentro de cada segmento padre.</p>
          </aside>
        )}
      </div>
    </section>
  );
}
