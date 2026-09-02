import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { TransfersService } from "./transfers.service.js";

const position = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }).strict(),
  z
    .object({
      type: z.literal("LineString"),
      coordinates: z.array(position).min(2).max(50_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(position).min(4)).min(1).max(1_000),
    })
    .strict(),
]);
const feature = z
  .object({
    type: z.literal("Feature"),
    id: z.string().uuid().optional(),
    geometry: geometry.nullable(),
    properties: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const collection = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(feature).min(1).max(500),
  })
  .strict();

@Controller("apps/:appId/transfers")
export class TransfersController {
  constructor(
    @Inject(TransfersService) private readonly transfers: TransfersService,
  ) {}

  @Post("preview")
  @HttpCode(200)
  async preview(@Param("appId") appId: string, @Body() body: unknown) {
    return this.transfers.preview(appId, this.parse(body));
  }

  @Post("confirm")
  async confirm(@Param("appId") appId: string, @Body() body: unknown) {
    return this.transfers.confirm(appId, this.parse(body));
  }

  @Get("export.geojson")
  async export(
    @Param("appId") appId: string,
    @Query("limit") requestedLimit?: string,
  ) {
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(10_000)
      .catch(2_000)
      .parse(requestedLimit);
    return this.transfers.exportGeoJson(appId, limit);
  }

  private parse(body: unknown) {
    const result = collection.safeParse(body);
    if (!result.success) {
      throw new UnprocessableEntityException({
        code: "INVALID_GEOJSON",
        message:
          "Se requiere un FeatureCollection GeoJSON válido de hasta 500 elementos.",
        details: result.error.flatten(),
      });
    }
    return result.data.features;
  }
}
