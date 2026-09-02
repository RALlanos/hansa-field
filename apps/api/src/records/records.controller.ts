import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { RecordsService } from "./records.service.js";

const pointSchema = z
  .object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  })
  .strict();
const createRecordSchema = z
  .object({
    attributes: z.record(z.string(), z.unknown()),
    geometry: pointSchema.nullable(),
  })
  .strict();

@Controller("apps/:appId/records")
export class RecordsController {
  constructor(
    @Inject(RecordsService) private readonly recordsService: RecordsService,
  ) {}

  @Get()
  async list(@Param("appId") appId: string) {
    return { data: await this.recordsService.list(appId) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Param("appId") appId: string, @Body() body: unknown) {
    const result = createRecordSchema.safeParse(body);
    if (!result.success)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Registro inválido.",
        details: result.error.flatten(),
      });
    return this.recordsService.create(appId, result.data);
  }

  @Patch(":recordId")
  async update(
    @Param("appId") appId: string,
    @Param("recordId") recordId: string,
    @Body() body: unknown,
  ) {
    const result = createRecordSchema.safeParse(body);
    if (!result.success)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Registro inválido.",
        details: result.error.flatten(),
      });
    return this.recordsService.update(appId, recordId, result.data);
  }
}
