"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  segmentationApi,
  type Page,
  type Segment,
  type Scheme,
} from "./contracts";

type LevelDraft = { id?: string; name: string };
type SegmentDraft = {
  levelId: string;
  parentSegmentId: string | null;
  name: string;
  code: string;
  description: string;
};
type SegmentMembership = {
  id: string;
  recordId: string | null;
  projectRecordId: string | null;
};
const ROOT_KEY = "__root__";

function toDraft(segment: Segment): SegmentDraft {
  return {
    levelId: segment.levelId,
    parentSegmentId: segment.parentSegmentId,
    name: segment.name,
    code: segment.code ?? "",
    description: segment.description,
  };
}

export function SegmentationBuilder({
  scheme,
  onSaved,
  onClose,
}: {
  scheme: Scheme;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const orderedLevels = useMemo(
    () => [...scheme.levels].sort((a, b) => a.position - b.position),
    [scheme.levels],
  );
  const [levelDrafts, setLevelDrafts] = useState<LevelDraft[]>([]);
  const [nodes, setNodes] = useState<Record<string, Page<Segment>>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingBranches, setLoadingBranches] = useState<Set<string>>(
    new Set(),
  );
  const [selected, setSelected] = useState<Segment | null>(null);
  const [draft, setDraft] = useState<SegmentDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [members, setMembers] = useState<SegmentMembership[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [savingSegment, setSavingSegment] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLevelDrafts(
      orderedLevels.map((level) => ({ id: level.id, name: level.name })),
    );
  }, [scheme.id, scheme.revision, orderedLevels]);

  const loadBranch = useCallback(
    async (parentId: string | null, append = false) => {
      const key = parentId ?? ROOT_KEY;
      const existing = nodes[key];
      if (append && !existing?.nextCursor) return;
      setLoadingBranches((current) => new Set(current).add(key));
      try {
        const query = new URLSearchParams();
        if (parentId) query.set("parentId", parentId);
        if (append && existing?.nextCursor)
          query.set("cursor", existing.nextCursor);
        const result = await segmentationApi<Page<Segment>>(
          `/schemes/${scheme.id}/children?${query}`,
        );
        setNodes((current) => ({
          ...current,
          [key]:
            append && current[key]
              ? {
                  items: [...current[key].items, ...result.items],
                  nextCursor: result.nextCursor,
                }
              : result,
        }));
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar esta rama del árbol.",
        );
      } finally {
        setLoadingBranches((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [nodes, scheme.id],
  );

  useEffect(() => {
    setNodes({});
    setExpanded(new Set());
    setSelected(null);
    setDraft(null);
    setEditingId(null);
    void loadBranch(null);
  }, [scheme.id, scheme.revision]); // Uses the current scheme snapshot only.

  useEffect(() => {
    if (!selected) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    let active = true;
    setMembersLoading(true);
    void segmentationApi<Page<SegmentMembership>>(
      `/segments/${selected.id}/memberships?includeDescendants=false`,
    )
      .then((result) => {
        if (active) setMembers(result.items);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudieron cargar los registros.",
          );
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected?.id]);

  const nextLevel = (parent: Segment | null) => {
    if (!parent)
      return orderedLevels.find((level) => level.status === "active") ?? null;
    const parentLevel = orderedLevels.find(
      (level) => level.id === parent.levelId,
    );
    return (
      orderedLevels.find(
        (level) =>
          level.status === "active" &&
          level.position > (parentLevel?.position ?? 0),
      ) ?? null
    );
  };

  const selectSegment = (segment: Segment) => {
    setSelected(segment);
    setDraft(toDraft(segment));
    setEditingId(segment.id);
  };

  const startCreate = (parent: Segment | null) => {
    const level = nextLevel(parent);
    if (!level) {
      setError(
        "No existe un nivel posterior para crear un segmento dentro de este elemento.",
      );
      return;
    }
    setDraft({
      levelId: level.id,
      parentSegmentId: parent?.id ?? null,
      name: "",
      code: "",
      description: "",
    });
    setEditingId(null);
    setSelected(parent);
  };

  const toggle = (segment: Segment) => {
    const isOpen = expanded.has(segment.id);
    setExpanded((current) => {
      const next = new Set(current);
      if (isOpen) next.delete(segment.id);
      else next.add(segment.id);
      return next;
    });
    if (!isOpen && !nodes[segment.id]) void loadBranch(segment.id);
  };

  const updateLevel = (index: number, name: string) =>
    setLevelDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, name } : item,
      ),
    );
  const moveLevel = (index: number, offset: number) =>
    setLevelDrafts((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + offset, 0, item!);
      return next;
    });

  const saveStructure = async () => {
    if (!levelDrafts.every((level) => level.name.trim())) {
      setError("Nombra cada nivel antes de guardar la estructura.");
      return;
    }
    setSavingStructure(true);
    setError("");
    try {
      const ids: string[] = [];
      for (const item of levelDrafts) {
        const name = item.name.trim();
        if (item.id) {
          if (
            orderedLevels.find((level) => level.id === item.id)?.name !== name
          )
            await segmentationApi(
              `/schemes/${scheme.id}/levels/${item.id}`,
              { name },
              "PATCH",
            );
          ids.push(item.id);
        } else {
          const created = await segmentationApi<{ id: string }>(
            `/schemes/${scheme.id}/levels`,
            { name, configuration: {} },
          );
          ids.push(created.id);
        }
      }
      const currentOrder = orderedLevels.map((level) => level.id);
      if (
        ids.length &&
        (ids.length !== currentOrder.length ||
          ids.some((id, index) => id !== currentOrder[index]))
      )
        await segmentationApi(`/schemes/${scheme.id}/levels/order`, {
          levelIds: ids,
        });
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar la estructura.",
      );
    } finally {
      setSavingStructure(false);
    }
  };

  const saveSegment = async () => {
    if (!draft?.name.trim()) {
      setError("Indica el nombre del segmento.");
      return;
    }
    setSavingSegment(true);
    setError("");
    try {
      const payload = {
        levelId: draft.levelId,
        parentSegmentId: draft.parentSegmentId,
        name: draft.name.trim(),
        code: draft.code.trim() || null,
        description: draft.description.trim(),
      };
      const saved = await segmentationApi<Segment>(
        editingId ? `/segments/${editingId}` : `/schemes/${scheme.id}/segments`,
        payload,
        editingId ? "PATCH" : "POST",
      );
      await loadBranch(saved.parentSegmentId);
      if (saved.parentSegmentId)
        setExpanded((current) => new Set(current).add(saved.parentSegmentId!));
      setSelected(saved);
      setDraft(toDraft(saved));
      setEditingId(saved.id);
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el segmento.",
      );
    } finally {
      setSavingSegment(false);
    }
  };

  const renderBranch = (parentId: string | null, depth: number): ReactNode => {
    const key = parentId ?? ROOT_KEY;
    const page = nodes[key];
    if (!page && loadingBranches.has(key))
      return <p className="tree-loading">Cargando…</p>;
    if (!page) return null;
    return (
      <ul className="seg-tree-branch" data-depth={depth}>
        {page.items.map((segment) => {
          const level = orderedLevels.find(
            (item) => item.id === segment.levelId,
          );
          const open = expanded.has(segment.id);
          return (
            <li key={segment.id}>
              <div
                className={
                  selected?.id === segment.id
                    ? "seg-tree-node is-selected"
                    : "seg-tree-node"
                }
                style={{ "--tree-depth": depth } as CSSProperties}
              >
                <button
                  aria-label={
                    open ? `Cerrar ${segment.name}` : `Abrir ${segment.name}`
                  }
                  className="seg-tree-toggle"
                  disabled={!segment.hasChildren}
                  onClick={() => toggle(segment)}
                  type="button"
                >
                  {segment.hasChildren ? (open ? "−" : "+") : "·"}
                </button>
                <button
                  className="seg-tree-node-content"
                  onClick={() => selectSegment(segment)}
                  type="button"
                >
                  <span>{segment.name}</span>
                  <small>
                    {level?.name ?? "Nivel"}
                    {segment.code ? ` · ${segment.code}` : ""}
                  </small>
                </button>
                <button
                  className="seg-tree-child-action"
                  disabled={!nextLevel(segment)}
                  onClick={() => startCreate(segment)}
                  type="button"
                >
                  + {nextLevel(segment)?.name ?? ""}
                </button>
              </div>
              {open ? renderBranch(segment.id, depth + 1) : null}
              {open && nodes[segment.id]?.nextCursor ? (
                <button
                  className="seg-tree-more"
                  onClick={() => void loadBranch(segment.id, true)}
                  type="button"
                >
                  Cargar más
                </button>
              ) : null}
            </li>
          );
        })}
        {!page.items.length && parentId === null ? (
          <li className="seg-tree-empty">
            No hay segmentos aún. Crea el primero para comenzar el árbol.
          </li>
        ) : null}
      </ul>
    );
  };

  const draftLevel = draft
    ? orderedLevels.find((level) => level.id === draft.levelId)
    : null;
  const draftParentName = draft?.parentSegmentId
    ? (selected?.name ?? "segmento seleccionado")
    : "inicio de la estructura";

  return (
    <section
      className="segmentation-builder"
      aria-label="Editor de estructura de segmentación"
    >
      <header className="segmentation-builder-header">
        <div>
          <h2>{scheme.name}</h2>
          <p>
            Diseña los <strong>niveles</strong> a la izquierda. Luego crea los{" "}
            <strong>segmentos</strong> en el árbol: Bolivia dentro de País, La
            Paz dentro de Bolivia.
          </p>
        </div>
        <div className="segmentation-builder-actions">
          <button disabled={savingStructure} onClick={onClose} type="button">
            Volver
          </button>
          <button
            className="seg-primary"
            disabled={savingStructure || scheme.status !== "active"}
            onClick={() => void saveStructure()}
            type="button"
          >
            {savingStructure ? "Guardando…" : "Guardar estructura"}
          </button>
        </div>
      </header>
      {error ? (
        <p className="seg-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="segmentation-builder-grid">
        <aside className="segment-levels-panel">
          <header>
            <h3>Niveles de la estructura</h3>
            <p>
              El orden define qué puede contener a qué: de lo más amplio a lo
              más específico.
            </p>
          </header>
          <ol className="segment-level-list">
            {levelDrafts.map((level, index) => (
              <li
                className="segment-level-row"
                key={level.id ?? `new-${index}`}
              >
                <span>{index + 1}</span>
                <label>
                  <small>Nivel {index + 1}</small>
                  <input
                    aria-label={`Nombre del nivel ${index + 1}`}
                    disabled={savingStructure}
                    onChange={(event) => updateLevel(index, event.target.value)}
                    placeholder="Ej.: Departamento"
                    value={level.name}
                  />
                </label>
                <div>
                  <button
                    aria-label={`Subir ${level.name}`}
                    disabled={savingStructure || index === 0}
                    onClick={() => moveLevel(index, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Bajar ${level.name}`}
                    disabled={
                      savingStructure || index === levelDrafts.length - 1
                    }
                    onClick={() => moveLevel(index, 1)}
                    type="button"
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            className="segment-add-level"
            disabled={savingStructure || scheme.status !== "active"}
            onClick={() =>
              setLevelDrafts((current) => [...current, { name: "" }])
            }
            type="button"
          >
            + Añadir nivel
          </button>
        </aside>
        <main className="segment-tree-panel">
          <header className="segment-tree-header">
            <div>
              <h3>Árbol de segmentos</h3>
              <p>
                Usa + para desplegar una rama. Selecciona un nombre para ver sus
                datos o agregar el siguiente nivel.
              </p>
            </div>
            <button
              className="seg-primary"
              disabled={!nextLevel(null) || scheme.status !== "active"}
              onClick={() => startCreate(null)}
              type="button"
            >
              +{" "}
              {nextLevel(null)
                ? `Crear ${nextLevel(null)?.name}`
                : "Añadir nivel primero"}
            </button>
          </header>
          <div className="seg-tree-legend">
            <span>
              <b>1</b> Nivel
            </span>
            <span>
              <b>Bolivia</b> Segmento
            </span>
            <span>+ crea el siguiente nivel dentro del segmento</span>
          </div>
          <div className="seg-tree-canvas">{renderBranch(null, 0)}</div>
          {nodes[ROOT_KEY]?.nextCursor ? (
            <button
              className="seg-tree-more"
              onClick={() => void loadBranch(null, true)}
              type="button"
            >
              Cargar más segmentos
            </button>
          ) : null}
        </main>
        <aside className="segment-details-panel">
          <header>
            <h3>
              {draft
                ? editingId
                  ? "Datos del segmento"
                  : "Nuevo segmento"
                : "Selecciona un segmento"}
            </h3>
            <p>
              {draft
                ? `Ubicación: ${draftParentName}`
                : "Elige un segmento en el árbol para editarlo o crear el siguiente nivel."}
            </p>
          </header>
          {draft ? (
            <>
              <div className="segment-context">
                <span>Tipo de segmento</span>
                <strong>{draftLevel?.name ?? "Nivel"}</strong>
              </div>
              <label>
                Nombre
                <input
                  autoFocus={!editingId}
                  disabled={savingSegment}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  placeholder={
                    draftLevel?.name === "País"
                      ? "Ej.: Bolivia"
                      : "Nombre del segmento"
                  }
                  value={draft.name}
                />
              </label>
              <label>
                Código <span>opcional</span>
                <input
                  disabled={savingSegment}
                  onChange={(event) =>
                    setDraft({ ...draft, code: event.target.value })
                  }
                  value={draft.code}
                />
              </label>
              <label>
                Descripción <span>opcional</span>
                <textarea
                  disabled={savingSegment}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  value={draft.description}
                />
              </label>
              <div className="segment-details-actions">
                <button
                  className="seg-primary"
                  disabled={savingSegment || scheme.status !== "active"}
                  onClick={() => void saveSegment()}
                  type="button"
                >
                  {savingSegment ? "Guardando…" : "Guardar segmento"}
                </button>
                <button
                  disabled={savingSegment}
                  onClick={() => {
                    setDraft(null);
                    setEditingId(null);
                  }}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
              {editingId ? (
                <section className="segment-records-preview">
                  <header>
                    <div>
                      <h4>Registros en este segmento</h4>
                      <p>Solo lectura por ahora.</p>
                    </div>
                    <span>{members.length}</span>
                  </header>
                  {membersLoading ? <p>Cargando registros…</p> : null}
                  {!membersLoading && !members.length ? (
                    <p>Aún no hay registros asociados.</p>
                  ) : null}
                  {!membersLoading &&
                    members.map((membership) => (
                      <div key={membership.id}>
                        <strong>
                          {membership.projectRecordId
                            ? "Registro de Proyecto"
                            : "Registro de App"}
                        </strong>
                        <small>
                          {membership.projectRecordId ??
                            membership.recordId ??
                            ""}
                        </small>
                      </div>
                    ))}
                </section>
              ) : null}
            </>
          ) : (
            <div className="segment-details-empty">
              <strong>¿Dónde estoy?</strong>
              <p>
                El árbol del centro muestra toda la jerarquía. Cada fila muestra
                el segmento y debajo su nivel. Selecciona uno para continuar
                desde allí.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
