"use client";

import { FormEvent, useMemo, useState } from "react";

export type AppBlockSummary = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
  members: ReadonlyArray<
    Readonly<{
      id: string;
      appId: string;
      appCode: string;
      appName: string;
    }>
  >;
}>;

type ProjectCreationFormProps = Readonly<{
  blocks: readonly AppBlockSummary[];
  disabled: boolean;
  onCreate: (input: {
    code: string;
    name: string;
    description: string;
    blockIds: string[];
  }) => Promise<void>;
}>;

export function ProjectCreationForm({
  blocks,
  disabled,
  onCreate,
}: ProjectCreationFormProps) {
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const selectedApps = useMemo(() => {
    const appsByTemplate = new Map<
      string,
      { appCode: string; appName: string }
    >();
    for (const block of blocks) {
      if (!selectedBlockIds.includes(block.id)) continue;
      for (const member of block.members) {
        appsByTemplate.set(member.appId, {
          appCode: member.appCode,
          appName: member.appName,
        });
      }
    }
    return [...appsByTemplate.values()];
  }, [blocks, selectedBlockIds]);

  function toggleBlock(blockId: string) {
    setSelectedBlockIds((current) =>
      current.includes(blockId)
        ? current.filter((id) => id !== blockId)
        : [...current, blockId],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    try {
      await onCreate({
        code: String(data.get("code") ?? ""),
        name: String(data.get("name") ?? ""),
        description: String(data.get("description") ?? ""),
        blockIds: selectedBlockIds,
      });
      form.reset();
      setSelectedBlockIds([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="compact-form" onSubmit={submit}>
      <h2>Nuevo proyecto</h2>
      <label>
        Nombre
        <input
          disabled={disabled || submitting}
          name="name"
          required
          minLength={2}
        />
      </label>
      <label>
        Código
        <input
          disabled={disabled || submitting}
          name="code"
          required
          pattern="[A-Z][A-Z0-9_]{1,63}"
        />
      </label>
      <label>
        Descripción
        <textarea disabled={disabled || submitting} name="description" />
      </label>
      <fieldset>
        <legend>Bloques de Apps</legend>
        {blocks.map((block) => (
          <label key={block.id}>
            <input
              checked={selectedBlockIds.includes(block.id)}
              disabled={disabled || submitting}
              onChange={() => toggleBlock(block.id)}
              type="checkbox"
            />{" "}
            <strong>{block.name}</strong> · {block.members.length} Plantillas
          </label>
        ))}
        {!disabled && blocks.length === 0 && (
          <small>Primero configura un Bloque de Apps.</small>
        )}
      </fieldset>
      <section aria-live="polite" className="project-app-preview">
        <strong>Apps de Proyecto que se crearán</strong>
        {selectedApps.length > 0 ? (
          <ul>
            {selectedApps.map((app) => (
              <li key={app.appCode}>
                {app.appName} <small>({app.appCode})</small>
              </li>
            ))}
          </ul>
        ) : (
          <small>Selecciona uno o más Bloques.</small>
        )}
      </section>
      <button
        className="primary-button"
        disabled={disabled || submitting || selectedBlockIds.length === 0}
        type="submit"
      >
        {submitting ? "Creando…" : "Crear proyecto"}
      </button>
    </form>
  );
}
