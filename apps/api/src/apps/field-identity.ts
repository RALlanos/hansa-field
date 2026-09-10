import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

const schema = z.object({
  sections: z.array(
    z.object({
      fields: z.array(
        z.object({
          id: z.string().uuid(),
          key: z.string().min(1),
          type: z.string().min(1),
        }),
      ),
    }),
  ),
});

/** A label is presentation, never identity. Existing identities cannot be retyped or recycled. */
export function assertFieldIdentity(
  history: readonly unknown[],
  next: unknown,
): void {
  const parsed = schema.safeParse(next);
  if (!parsed.success)
    throw new UnprocessableEntityException(
      "La identidad de campos no es válida.",
    );
  const prior = history.flatMap((version) => {
    const result = schema.safeParse(version);
    if (!result.success)
      throw new ConflictException(
        "Una versión histórica no tiene identidades válidas.",
      );
    return result.data.sections.flatMap((section) => section.fields);
  });
  const fields = parsed.data.sections.flatMap((section) => section.fields);
  if (
    new Set(fields.map((field) => field.id)).size !== fields.length ||
    new Set(fields.map((field) => field.key)).size !== fields.length
  )
    throw new UnprocessableEntityException(
      "El schema repite una identidad o clave de campo.",
    );
  for (const field of fields) {
    if (
      prior.some(
        (old) =>
          (old.id === field.id &&
            (old.type !== field.type || old.key !== field.key)) ||
          (old.key === field.key && old.id !== field.id),
      )
    )
      throw new ConflictException(
        "Un campo existente conserva identidad, clave y tipo. Crea otro campo para un significado nuevo.",
      );
  }
}
