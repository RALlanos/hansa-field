"use client";
import { useState } from "react";
import { segmentationApi, type Scheme } from "./contracts";
type Preview = {
  created: number;
  matched: number;
  issueCount: number;
  issues: string[];
  confirmed: boolean;
};
/** CSV/TSV parser: quoted delimiters, escaped quotes and embedded newlines are preserved. */
function parseTable(text: string) {
  const delimiter = text.split(/\r?\n/, 1)[0]?.includes("\t")
    ? "\t"
    : text.split(/\r?\n/, 1)[0]?.includes(";")
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("Hay comillas sin cerrar en el archivo.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers =
    rows.shift()?.map((h) => h.trim().replace(/^\uFEFF/, "")) ?? [];
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("Encabezados vacíos o repetidos.");
  if (rows.length > 20000) throw new Error("Máximo 20.000 filas por archivo.");
  return {
    headers,
    rows: rows.map((values) => {
      if (values.length !== headers.length)
        throw new Error(
          "Una fila no tiene la misma cantidad de columnas que los encabezados.",
        );
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    }),
  };
}
export function HierarchyImport({
  scheme,
  onSaved,
}: {
  scheme: Scheme;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [table, setTable] = useState<ReturnType<typeof parseTable> | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<Preview | null>(null),
    [revision, setRevision] = useState(scheme.revision),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const plan = () => ({
    expectedRevision: revision,
    columns: scheme.levels
      .filter((l) => mapping[l.id])
      .map((l) => ({ levelId: l.id, sourceColumn: mapping[l.id] })),
    rows: table?.rows ?? [],
  });
  return (
    <section>
      <h2>Cargar estructura</h2>
      <p>
        CSV o texto tabulado con encabezados. La importación solo afecta este
        estructura. Crea los niveles antes de asociar las columnas.
      </p>
      {error && (
        <p role="alert" className="seg-error">
          {error}
        </p>
      )}
      <input
        aria-label="Archivo de estructura"
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run(async () => {
              if (file.size > 10 * 1024 * 1024)
                throw new Error("Máximo 10 MB.");
              setText(await file.text());
              setTable(null);
              setPreview(null);
            });
        }}
      />
      <textarea
        aria-label="Tabla de estructura"
        placeholder="País&#9;Departamento&#9;Nodo"
        rows={8}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setTable(null);
          setPreview(null);
        }}
      />
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const parsed = parseTable(text);
            setTable(parsed);
            setRevision(scheme.revision);
            setMapping(
              Object.fromEntries(
                scheme.levels.map((l) => [
                  l.id,
                  parsed.headers.find(
                    (h) => h.toLowerCase() === l.name.toLowerCase(),
                  ) ?? "",
                ]),
              ),
            );
            setPreview(null);
          })
        }
      >
        Leer columnas
      </button>
      {table && (
        <>
          <p>{table.rows.length} filas</p>
          {scheme.levels
            .filter((l) => l.status === "active")
            .map((level) => (
              <label key={level.id}>
                {level.position}. {level.name}
                <select
                  value={mapping[level.id] ?? ""}
                  onChange={(e) => {
                    setMapping({ ...mapping, [level.id]: e.target.value });
                    setPreview(null);
                  }}
                >
                  <option value="">Sin columna</option>
                  {table.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () =>
                setPreview(
                  await segmentationApi<Preview>(
                    `/schemes/${scheme.id}/import/preview`,
                    plan(),
                  ),
                ),
              )
            }
          >
            Vista previa
          </button>
        </>
      )}
      {preview && (
        <>
          <p>
            {preview.created} zonas nuevas · {preview.matched} zonas
            existentes reutilizadas
          </p>
          {preview.issues.map((issue, i) => (
            <p key={i} role="alert">
              {issue}
            </p>
          ))}
          <button
            disabled={busy || preview.issueCount > 0 || preview.confirmed}
            onClick={() =>
              void run(async () => {
                setPreview(
                  await segmentationApi<Preview>(
                    `/schemes/${scheme.id}/import/confirm`,
                    plan(),
                  ),
                );
                await onSaved();
              })
            }
          >
            {preview.confirmed
              ? "Importación guardada"
              : "Confirmar importación"}
          </button>
        </>
      )}
    </section>
  );
}
