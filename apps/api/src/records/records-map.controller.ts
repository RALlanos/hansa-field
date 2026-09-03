import {
  Controller,
  Get,
  Inject,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { RecordsService } from "./records.service.js";

const boundsSchema = z
  .tuple([
    z.coerce.number().min(-180).max(180),
    z.coerce.number().min(-90).max(90),
    z.coerce.number().min(-180).max(180),
    z.coerce.number().min(-90).max(90),
  ])
  .refine(([west, south, east, north]) => west < east && south < north);
const zoomSchema = z.coerce.number().int().min(0).max(22);
const appIdsSchema = z.array(z.string().uuid()).min(1).max(50);

@Controller("map/records")
export class RecordsMapController {
  constructor(
    @Inject(RecordsService) private readonly recordsService: RecordsService,
  ) {}

  @Get()
  async list(
    @Query("bbox") bbox?: string,
    @Query("zoom") zoom?: string,
    @Query("appIds") appIds?: string,
  ) {
    const parsedBounds = boundsSchema.safeParse(bbox?.split(","));
    const parsedZoom = zoomSchema.safeParse(zoom);
    const parsedAppIds = appIds
      ? appIdsSchema.safeParse(appIds.split(","))
      : { success: true as const, data: undefined };
    if (!parsedBounds.success || !parsedZoom.success || !parsedAppIds.success) {
      throw new UnprocessableEntityException({
        code: "INVALID_MAP_QUERY",
        message:
          "El mapa requiere bbox válido, zoom entre 0 y 22 y hasta 50 Apps.",
      });
    }
    return this.recordsService.listMapFeatures({
      bounds: parsedBounds.data,
      zoom: parsedZoom.data,
      ...(parsedAppIds.data ? { appIds: parsedAppIds.data } : {}),
    });
  }
}
