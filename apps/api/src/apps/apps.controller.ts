import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Param,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import {
  AppsService,
  type AppSummary,
  type CreateAppInput,
  type UpdateAppSettingsInput,
} from "./apps.service.js";

const createAppSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]{1,63}$/),
    name: z.string().trim().min(2).max(120),
    allowedGeometries: z
      .array(z.enum(["Point", "LineString", "Polygon"]))
      .min(1),
  })
  .strict();
const appSchemaSchema = z
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
const appSettingsSchema = z
  .object({
    description: z.string().trim().max(1000),
    mapIcon: z.enum(["pin", "post", "cable", "node", "building"]),
    mapColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  })
  .strict();

@Controller("apps")
export class AppsController {
  constructor(@Inject(AppsService) private readonly appsService: AppsService) {}

  @Get()
  async list(): Promise<{ data: AppSummary[] }> {
    return { data: await this.appsService.list() };
  }

  @Get(":appId/versions/latest")
  async latestVersion(@Param("appId") appId: string) {
    return this.appsService.latestVersion(appId);
  }

  @Get(":appId")
  async get(@Param("appId") appId: string): Promise<AppSummary> {
    return this.appsService.get(appId);
  }

  @Patch(":appId")
  async updateSettings(@Param("appId") appId: string, @Body() body: unknown) {
    const result = appSettingsSchema.safeParse(body);
    if (!result.success)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Ajustes de App inválidos.",
        details: result.error.flatten(),
      });
    return this.appsService.updateSettings(
      appId,
      result.data as UpdateAppSettingsInput,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<AppSummary> {
    const result = createAppSchema.safeParse(body);
    if (!result.success)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Datos de App inválidos.",
        details: result.error.flatten(),
      });
    return this.appsService.create(result.data as CreateAppInput);
  }

  @Post(":appId/versions")
  @HttpCode(HttpStatus.CREATED)
  async createVersion(@Param("appId") appId: string, @Body() body: unknown) {
    const result = appSchemaSchema.safeParse(body);
    if (!result.success)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Esquema de App inválido.",
        details: result.error.flatten(),
      });
    return this.appsService.createVersion(appId, result.data);
  }
}
