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
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { RecordsService } from "./records.service.js";

const positionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const geometrySchema = z.discriminatedUnion("type", [
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
const createRecordSchema = z
  .object({
    attributes: z.record(z.string(), z.unknown()),
    geometry: geometrySchema.nullable(),
  })
  .strict();

@Controller("apps/:appId/records")
export class RecordsController {
  constructor(
    @Inject(RecordsService) private readonly recordsService: RecordsService,
  ) {}

  @Get()
  async list(
    @Param("appId") appId: string,
    @Query("bbox") bbox?: string,
    @Query("limit") requestedLimit?: string,
  ) {
    const parsedBounds = bbox
      ? z
          .tuple([
            z.coerce.number(),
            z.coerce.number(),
            z.coerce.number(),
            z.coerce.number(),
          ])
          .safeParse(bbox.split(","))
      : null;
    if (bbox && !parsedBounds?.success) {
      throw new UnprocessableEntityException({
        code: "INVALID_BBOX",
        message: "bbox debe contener minX,minY,maxX,maxY.",
      });
    }
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(2_000)
      .catch(500)
      .parse(requestedLimit);
    return {
      data: await this.recordsService.list(
        appId,
        parsedBounds?.success ? parsedBounds.data : undefined,
        limit,
      ),
    };
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
