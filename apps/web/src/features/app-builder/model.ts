export type FieldType =
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

export type BuilderField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  description?: string;
  display?: "inline" | "fullWidth";
  hidden?: boolean;
  visibility?: {
    match: "all" | "any";
    preserveValue: boolean;
    conditions: Array<{
      fieldId: string;
      operator: "equals" | "notEquals" | "isEmpty" | "isNotEmpty";
      value?: string;
    }>;
  };
};
export type BuilderSection = {
  id: string;
  title: string;
  subtitle?: string;
  fields: BuilderField[];
};
export type AppSchema = { sections: BuilderSection[] };

type FieldDefinition = {
  type: FieldType;
  label: string;
  group: "Básicos" | "Opciones" | "Medios";
  icon: string;
};

export const fieldDefinitions: readonly FieldDefinition[] = [
  { type: "shortText", label: "Texto corto", group: "Básicos", icon: "T" },
  { type: "longText", label: "Texto largo", group: "Básicos", icon: "¶" },
  { type: "number", label: "Número", group: "Básicos", icon: "123" },
  { type: "boolean", label: "Sí / No", group: "Básicos", icon: "☑" },
  { type: "date", label: "Fecha", group: "Básicos", icon: "▣" },
  { type: "time", label: "Hora", group: "Básicos", icon: "◷" },
  {
    type: "singleChoice",
    label: "Selección única",
    group: "Opciones",
    icon: "◉",
  },
  {
    type: "multipleChoice",
    label: "Selección múltiple",
    group: "Opciones",
    icon: "☷",
  },
  { type: "photo", label: "Foto", group: "Medios", icon: "▧" },
  { type: "file", label: "Archivo", group: "Medios", icon: "▤" },
  { type: "signature", label: "Firma", group: "Medios", icon: "✎" },
] as const;

export function fieldDefinition(type: FieldType): FieldDefinition {
  const definition = fieldDefinitions.find((item) => item.type === type);
  if (!definition) throw new Error(`Tipo de campo no reconocido: ${type}`);
  return definition;
}

export function identifier(value: string): string {
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

export function duplicateField(schema: AppSchema, fieldId: string): AppSchema {
  const existingKeys = new Set(
    schema.sections.flatMap((section) =>
      section.fields.map((field) => field.key),
    ),
  );
  return {
    sections: schema.sections.map((section) => ({
      ...section,
      fields: section.fields.flatMap((field) => {
        if (field.id !== fieldId) return [field];
        let sequence = 2;
        let key = `${field.key}_${sequence}`;
        while (existingKeys.has(key)) key = `${field.key}_${++sequence}`;
        existingKeys.add(key);
        return [
          field,
          {
            ...field,
            id: crypto.randomUUID(),
            key,
            label: `${field.label} copia`,
          },
        ];
      }),
    })),
  };
}

export function removeField(schema: AppSchema, fieldId: string): AppSchema {
  return {
    sections: schema.sections.map((section) => ({
      ...section,
      fields: section.fields.filter((field) => field.id !== fieldId),
    })),
  };
}
