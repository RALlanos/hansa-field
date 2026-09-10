import { z } from "zod";

export const datasetSchema = z
  .object({
    sections: z.array(
      z
        .object({
          id: z.string().uuid(),
          title: z.string().min(1),
          fields: z.array(
            z
              .object({
                id: z.string().uuid(),
                key: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
                label: z.string().min(1),
                type: z.enum([
                  "shortText",
                  "longText",
                  "number",
                  "boolean",
                  "date",
                  "time",
                  "singleChoice",
                  "multipleChoice",
                  "photo",
                  "file",
                  "signature",
                ]),
                required: z.boolean().default(false),
                unit: z.string().optional(),
                options: z.array(z.string()).optional(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough()
  .superRefine((schema, ctx) => {
    const fields = schema.sections.flatMap((section) => section.fields);
    if (
      new Set(fields.map((f) => f.id)).size !== fields.length ||
      new Set(fields.map((f) => f.key)).size !== fields.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Field identities and keys must be unique.",
      });
  });
export type DatasetSchema = z.infer<typeof datasetSchema>;
export type ActorContext = Readonly<{
  organizationId: string;
  actorId: string;
  operationId: string;
}>;

/** Values are keyed by field UUID, never label or technical key. */
export function validateValues(
  schema: DatasetSchema,
  values: Readonly<Record<string, unknown>>,
  partial = false,
): void {
  const fields = schema.sections.flatMap((section) => section.fields);
  for (const id of Object.keys(values))
    if (!fields.some((field) => field.id === id))
      throw new Error(`Unknown field identity: ${id}`);
  for (const field of fields) {
    const value = values[field.id];
    if (partial && value === undefined) continue;
    if (value === undefined || value === null) {
      if (field.required) throw new Error(`Required field: ${field.id}`);
      continue;
    }
    const valid =
      field.type === "number"
        ? typeof value === "number" && Number.isFinite(value)
        : field.type === "boolean"
          ? typeof value === "boolean"
          : field.type === "multipleChoice"
            ? Array.isArray(value) &&
              value.every(
                (item) =>
                  typeof item === "string" && field.options?.includes(item),
              )
            : typeof value === "string";
    if (!valid) throw new Error(`Invalid value type: ${field.id}`);
    if (
      field.type === "singleChoice" &&
      !field.options?.includes(String(value))
    )
      throw new Error(`Unknown choice: ${field.id}`);
  }
}
