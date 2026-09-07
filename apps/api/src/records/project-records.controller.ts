import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { RecordsService } from "./records.service.js";

const uuidSchema = z.string().uuid();
const projectAppIdsSchema = z.array(uuidSchema).min(1).max(50);
const pageSchema = z.coerce.number().int().min(1).max(100_000).catch(1);
const pageSizeSchema = z.coerce.number().int().min(10).max(100).catch(50);
const boundsSchema = z
  .tuple([
    z.coerce.number().min(-180).max(180),
    z.coerce.number().min(-90).max(90),
    z.coerce.number().min(-180).max(180),
    z.coerce.number().min(-90).max(90),
  ])
  .refine(([west, south, east, north]) => west < east && south < north);

@Controller("projects/:projectId/records")
export class ProjectRecordsController {
  constructor(
    @Inject(RecordsService) private readonly recordsService: RecordsService,
  ) {}

  @Get()
  async list(
    @Param("projectId") projectId: string,
    @Query("projectAppIds") projectAppIds?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("bbox") bbox?: string,
  ) {
    const parsedProjectId = uuidSchema.safeParse(projectId);
    const parsedProjectAppIds = projectAppIdsSchema.safeParse(
      projectAppIds?.split(","),
    );
    const parsedBounds = boundsSchema.safeParse(bbox?.split(","));
    if (
      !parsedProjectId.success ||
      !parsedProjectAppIds.success ||
      !parsedBounds.success
    ) {
      throw new UnprocessableEntityException({
        code: "INVALID_PROJECT_RECORDS_QUERY",
        message:
          "El proyecto y sus Apps de Proyecto seleccionadas deben ser válidos.",
      });
    }
    return this.recordsService.listProjectRecords({
      projectId: parsedProjectId.data,
      appIds: parsedProjectAppIds.data,
      bounds: parsedBounds.data,
      page: pageSchema.parse(page),
      pageSize: pageSizeSchema.parse(pageSize),
    });
  }
}
