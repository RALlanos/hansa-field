import { z } from "zod";
import { geometrySchema } from "../records/record-input.js";
export const uuid = z.string().uuid();
export const status = z.enum(["active", "archived"]);
const name = z.string().trim().min(1).max(200);
export const metadataFields = z
  .array(
    z
      .object({
        key: z
          .string()
          .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
          .max(100),
        label: name,
        type: z.enum(["text", "number", "boolean", "date"]),
        required: z.boolean().default(false),
      })
      .strict(),
  )
  .refine(
    (fields) => new Set(fields.map((f) => f.key)).size === fields.length,
    "Claves de metadata repetidas.",
  );
export const configuration = z
  .object({
    metadataFields: metadataFields.optional(),
    allowAdditional: z.boolean().optional(),
  })
  .passthrough();
export const schemeInput = z
  .object({
    appId: uuid.optional(),
    projectId: uuid.optional(),
    name,
    description: z.string().max(2000).default(""),
    configuration: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .refine(
    (value) => Boolean(value.appId) !== Boolean(value.projectId),
    "Selecciona solo App o Proyecto.",
  );
export const schemePatch = z
  .object({
    name: name.optional(),
    description: z.string().max(2000).optional(),
    status: status.optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const levelInput = z
  .object({ name, configuration: configuration.default({}) })
  .strict();
export const levelPatch = z
  .object({
    name: name.optional(),
    configuration: configuration.optional(),
    status: status.optional(),
  })
  .strict();
export const segmentInput = z
  .object({
    levelId: uuid,
    parentSegmentId: uuid.nullable().default(null),
    name,
    code: z.string().max(200).nullable().default(null),
    externalId: z.string().max(250).nullable().default(null),
    description: z.string().max(4000).default(""),
    status: status.default("active"),
    metadata: z.record(z.string(), z.unknown()).default({}),
    geometry: geometrySchema.nullable().default(null),
  })
  .strict();
export const segmentPatch = segmentInput.partial();
export const membershipInput = z
  .object({ recordId: uuid.optional(), projectRecordId: uuid.optional() })
  .strict()
  .refine(
    (v) => Boolean(v.recordId) !== Boolean(v.projectRecordId),
    "Selecciona Record o ProjectRecord, no ambos.",
  );
export const accessInput = z
  .object({
    principalType: z.enum(["user", "role"]),
    principalId: z.string().trim().min(1).max(200),
    permission: z.enum(["view", "edit", "manage"]),
    includeDescendants: z.boolean().default(true),
  })
  .strict();
export const hierarchyInput = z
  .object({
    expectedRevision: z.number().int().positive(),
    columns: z
      .array(z.object({ sourceColumn: name, levelId: uuid }).strict())
      .min(1),
    rows: z
      .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
      .max(20000),
  })
  .strict();
/** Future record importer maps source columns explicitly, separately from normal attributes. */
export const segmentationColumnMapping = z
  .object({
    kind: z.literal("segmentation"),
    schemeId: uuid,
    levelId: uuid,
    sourceColumn: name,
    onMissing: z.enum(["reject", "skip", "create"]).default("reject"),
  })
  .strict();
export type SchemeInput = z.infer<typeof schemeInput>;
export type SegmentInput = z.infer<typeof segmentInput>;
export type SegmentPatch = z.infer<typeof segmentPatch>;
export type HierarchyInput = z.infer<typeof hierarchyInput>;
export type Scheme = {
  id: string;
  appId: string | null;
  projectId: string | null;
  name: string;
  description: string;
  status: "active" | "archived";
  configuration: Record<string, unknown>;
  revision: number;
};
export type Level = {
  id: string;
  schemeId: string;
  name: string;
  position: number;
  status: "active" | "archived";
  configuration: z.infer<typeof configuration>;
};
export type Segment = {
  id: string;
  schemeId: string;
  levelId: string;
  parentSegmentId: string | null;
  name: string;
  code: string | null;
  externalId: string | null;
  description: string;
  status: "active" | "archived";
  metadata: Record<string, unknown>;
  geometry: z.infer<typeof geometrySchema> | null;
  hasChildren: boolean;
};
