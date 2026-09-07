import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { ProjectsService } from "./projects.service.js";

const schema = z
  .object({
    sections: z.array(
      z
        .object({
          id: z.string().uuid(),
          title: z.string().trim().min(1).max(120),
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
                required: z.boolean(),
                hidden: z.boolean().optional(),
                options: z
                  .array(z.string().min(1).max(120))
                  .max(100)
                  .optional(),
                visibility: z
                  .object({
                    match: z.enum(["all", "any"]),
                    preserveValue: z.boolean().optional(),
                    conditions: z
                      .array(
                        z.object({
                          fieldId: z.string().uuid(),
                          operator: z.enum([
                            "equals",
                            "notEquals",
                            "isEmpty",
                            "isNotEmpty",
                          ]),
                          value: z.string().max(250).optional(),
                        }),
                      )
                      .min(1)
                      .max(20),
                  })
                  .optional(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough()
  .superRefine((value, context) => {
    const fields = value.sections.flatMap((section) => section.fields);
    if (
      new Set(fields.map((field) => field.id)).size !== fields.length ||
      new Set(fields.map((field) => field.key)).size !== fields.length
    )
      context.addIssue({
        code: "custom",
        message: "Identidades o claves de campo repetidas.",
      });
    for (const field of fields)
      for (const condition of field.visibility?.conditions ?? [])
        if (
          !fields.some((source) => source.id === condition.fieldId) ||
          condition.fieldId === field.id
        )
          context.addIssue({
            code: "custom",
            message: "La regla referencia un campo inválido.",
          });
  });

@Controller("project-apps/:projectAppId")
export class ProjectAppsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  @Get("versions/latest")
  async latest(@Param("projectAppId") projectAppId: string) {
    if (!z.string().uuid().safeParse(projectAppId).success)
      throw new UnprocessableEntityException("Project App inválida.");
    return this.projects.latestProjectAppVersion(projectAppId);
  }

  @Post("versions")
  @HttpCode(201)
  async createVersion(
    @Param("projectAppId") projectAppId: string,
    @Body() body: unknown,
  ) {
    const parsed = schema.safeParse(body);
    if (!parsed.success || !z.string().uuid().safeParse(projectAppId).success) {
      throw new UnprocessableEntityException({
        code: "PROJECT_APP_SCHEMA_INVALID",
        message: "La configuración de la App de Proyecto no es válida.",
        details: parsed.success ? undefined : parsed.error.flatten(),
      });
    }
    return this.projects.createProjectAppVersion(projectAppId, parsed.data);
  }
}
