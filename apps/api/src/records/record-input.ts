import { z } from "zod";

const positionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const geometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: positionSchema }).strict(),
  z
    .object({
      type: z.literal("LineString"),
      coordinates: z.array(positionSchema).min(2).max(50_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(positionSchema).min(4)).min(1).max(1_000),
    })
    .strict(),
]);

export const recordInputSchema = z
  .object({
    attributes: z.record(z.string(), z.unknown()),
    geometry: geometrySchema.nullable(),
  })
  .strict();

export type GeoJsonGeometry = z.infer<typeof geometrySchema>;
