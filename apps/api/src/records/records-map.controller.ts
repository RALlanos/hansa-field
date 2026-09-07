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
const projectAppIdsSchema = z.array(z.string().uuid()).min(1).max(50);
const projectIdSchema = z.string().uuid();

@Controller("map/records")
export class RecordsMapController {
  constructor(
    @Inject(RecordsService) private readonly recordsService: RecordsService,
  ) {}

  @Get()
  async list(
    @Query("bbox") bbox?: string,
    @Query("zoom") zoom?: string,
    @Query("projectAppIds") projectAppIds?: string,
    @Query("projectId") projectId?: string,
  ) {
    const parsedBounds = boundsSchema.safeParse(bbox?.split(","));
    const parsedZoom = zoomSchema.safeParse(zoom);
    const parsedProjectAppIds = projectAppIds
      ? projectAppIdsSchema.safeParse(projectAppIds.split(","))
      : { success: true as const, data: undefined };
    const parsedProjectId = projectId
      ? projectIdSchema.safeParse(projectId)
      : { success: true as const, data: undefined };
    if (
      !parsedBounds.success ||
      !parsedZoom.success ||
      !parsedProjectAppIds.success ||
      !parsedProjectId.success
    ) {
      throw new UnprocessableEntityException({
        code: "INVALID_MAP_QUERY",
        message:
          "El mapa requiere bbox válido, zoom entre 0 y 22 y hasta 50 Apps.",
      });
    }
    return this.recordsService.listMapFeatures({
      bounds: parsedBounds.data,
      zoom: parsedZoom.data,
      ...(parsedProjectAppIds.data ? { appIds: parsedProjectAppIds.data } : {}),
      ...(parsedProjectId.data ? { projectId: parsedProjectId.data } : {}),
    });
  }
}
