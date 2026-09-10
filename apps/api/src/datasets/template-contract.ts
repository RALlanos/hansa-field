import { z } from "zod";
import { MAP_ICON_IDS } from "../apps/map-icons.js";
export const templateFormSchema = z
  .object({
    sections: z.array(
      z
        .object({
          id: z.string().uuid(),
          title: z.string().trim().min(1).max(120),
          subtitle: z.string().trim().max(240).optional(),
          fields: z.array(
            z
              .object({
                id: z.string().uuid(),
                key: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
                label: z.string().trim().min(1).max(120),
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
                options: z
                  .array(z.string().trim().min(1).max(120))
                  .max(100)
                  .optional(),
                description: z.string().trim().max(1000).optional(),
                display: z.enum(["inline", "fullWidth"]).optional(),
                hidden: z.boolean().optional(),
                visibility: z
                  .object({
                    match: z.enum(["all", "any"]),
                    preserveValue: z.boolean(),
                    conditions: z
                      .array(
                        z
                          .object({
                            fieldId: z.string().uuid(),
                            operator: z.enum([
                              "equals",
                              "notEquals",
                              "isEmpty",
                              "isNotEmpty",
                            ]),
                            value: z.string().max(250).optional(),
                          })
                          .strict(),
                      )
                      .min(1)
                      .max(20),
                  })
                  .optional(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export const templateInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    expectedVersion: z.number().int().nonnegative().optional(),
    schema: templateFormSchema.extend({
      settings: z
        .object({
          id: z.string().optional(),
          name: z.string(),
          code: z.string().max(64),
          description: z.string().max(1000),
          allowedGeometries: z
            .array(z.enum(["Point", "LineString", "Polygon"]))
            .min(1),
          mapIcon: z.enum(MAP_ICON_IDS),
          mapColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        })
        .strict(),
    }),
  })
  .strict();
