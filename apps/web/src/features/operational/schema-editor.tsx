"use client";
import type { Schema } from "./contracts";
export function SchemaEditor({
  value,
  onChange,
}: {
  value: Schema;
  onChange: (schema: Schema) => void;
}) {
  const fields = value.sections.flatMap((section) => section.fields);
  return (
    <fieldset>
      <legend>Campos del formulario</legend>
      {fields.map((field, index) => (
        <div key={field.id} className="op-field">
          <input
            aria-label="Nombre del campo"
            value={field.label}
            onChange={(event) =>
              onChange({
                sections: [
                  {
                    id: value.sections[0]!.id,
                    title: "Datos",
                    fields: fields.map((item, i) =>
                      i === index
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  },
                ],
              })
            }
          />
          <input
            aria-label="Código del campo"
            value={field.key}
            onChange={(event) =>
              onChange({
                sections: [
                  {
                    id: value.sections[0]!.id,
                    title: "Datos",
                    fields: fields.map((item, i) =>
                      i === index ? { ...item, key: event.target.value } : item,
                    ),
                  },
                ],
              })
            }
          />
          <select
            aria-label="Tipo de campo"
            value={field.type}
            onChange={(event) =>
              onChange({
                sections: [
                  {
                    id: value.sections[0]!.id,
                    title: "Datos",
                    fields: fields.map((item, i) =>
                      i === index
                        ? { ...item, type: event.target.value }
                        : item,
                    ),
                  },
                ],
              })
            }
          >
            <option value="shortText">Texto</option>
            <option value="longText">Texto largo</option>
            <option value="number">Número</option>
            <option value="boolean">Sí / No</option>
            <option value="date">Fecha</option>
          </select>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            sections: [
              {
                id: value.sections[0]?.id ?? crypto.randomUUID(),
                title: "Datos",
                fields: [
                  ...fields,
                  {
                    id: crypto.randomUUID(),
                    key: `campo_${fields.length + 1}`,
                    label: `Campo ${fields.length + 1}`,
                    type: "shortText",
                    required: false,
                  },
                ],
              },
            ],
          })
        }
      >
        + Agregar campo
      </button>
    </fieldset>
  );
}
