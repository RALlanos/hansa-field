"use client";

import { useEffect, useState } from "react";
import { segmentationApi, type Context, type Scheme } from "./contracts";

type Option = {
  id: string;
  name: string;
  levelName: string;
  depth: number;
};

export type SegmentFilter = Readonly<{ id: string; name: string }>;

export function SegmentationMapFilter({
  context,
  value,
  onChange,
}: {
  context: Context | null;
  value: SegmentFilter | null;
  onChange: (value: SegmentFilter | null) => void;
}) {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [schemeId, setSchemeId] = useState("");
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    setSchemes([]);
    setSchemeId("");
    setOptions([]);
    onChange(null);
    if (!context) return;
    const query = new URLSearchParams(
      context.appId
        ? { appId: context.appId }
        : { projectId: context.projectId! },
    );
    void segmentationApi<Scheme[]>(`/schemes?${query}`)
      .then((items) =>
        setSchemes(items.filter((item) => item.status === "active")),
      )
      .catch(() => setSchemes([]));
  }, [context?.appId, context?.projectId]);

  useEffect(() => {
    setOptions([]);
    onChange(null);
    if (!schemeId) return;
    void segmentationApi<Option[]>(`/schemes/${schemeId}/filter-options`)
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [schemeId]);

  if (!context || !schemes.length) return null;

  return (
    <div className="flex items-center gap-1.5 shrink-0 text-xs">
      <span className="text-slate-400 font-medium">Segmento:</span>
      <select
        aria-label="Estructura de segmentación"
        className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700 max-w-[160px]"
        onChange={(event) => setSchemeId(event.target.value)}
        value={schemeId}
      >
        <option value="">Sin filtro</option>
        {schemes.map((scheme) => (
          <option key={scheme.id} value={scheme.id}>
            {scheme.name}
          </option>
        ))}
      </select>
      {schemeId ? (
        <select
          aria-label="Segmento para filtrar"
          className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700 max-w-[190px]"
          onChange={(event) => {
            const option = options.find(
              (item) => item.id === event.target.value,
            );
            onChange(option ? { id: option.id, name: option.name } : null);
          }}
          value={value?.id ?? ""}
        >
          <option value="">Todos los segmentos</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {`${"· ".repeat(option.depth)}${option.name} (${option.levelName})`}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
