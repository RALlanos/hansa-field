import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import {
  AppsService,
  type AppSummary,
  type CreateAppInput,
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

@Controller("apps")
export class AppsController {
  constructor(@Inject(AppsService) private readonly appsService: AppsService) {}

  @Get()
  async list(): Promise<{ data: AppSummary[] }> {
    return { data: await this.appsService.list() };
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
}
