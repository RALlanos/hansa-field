import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";
import { ConsolidatedRecordsService } from "./consolidated-records.service.js";
const filters = z.object({
  projectId: z.string().uuid().optional(),
  projectAppIds: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(z.string().uuid()).max(200))
    .optional(),
  search: z.string().max(250).default(""),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
function parse(appId: string, query: unknown) {
  const result = filters.safeParse(query);
  if (!z.string().uuid().safeParse(appId).success || !result.success)
    throw new UnprocessableEntityException("Filtros inválidos.");
  const { projectId, projectAppIds, ...rest } = result.data;
  return {
    ...rest,
    ...(projectId ? { projectId } : {}),
    ...(projectAppIds ? { projectAppIds } : {}),
  };
}

@Controller("apps/:appId/records")
export class RecordsController {
  constructor(
    @Inject(ConsolidatedRecordsService)
    private readonly records: ConsolidatedRecordsService,
  ) {}
  @Get() list(@Param("appId") id: string, @Query() query: unknown) {
    return this.records.list(id, parse(id, query));
  }
  @Get("metadata") metadata(@Param("appId") id: string) {
    parse(id, {});
    return this.records.metadata(id);
  }
  @Get("map") map(
    @Param("appId") id: string,
    @Query() query: Record<string, string>,
  ) {
    const bounds = z
      .tuple([
        z.coerce.number().min(-180).max(180),
        z.coerce.number().min(-90).max(90),
        z.coerce.number().min(-180).max(180),
        z.coerce.number().min(-90).max(90),
      ])
      .refine(([w, s, e, n]) => w < e && s < n)
      .safeParse(query.bbox?.split(","));
    const zoom = z.coerce.number().int().min(0).max(22).safeParse(query.zoom);
    if (!bounds.success || !zoom.success)
      throw new UnprocessableEntityException("Viewport inválido.");
    return this.records.map(id, parse(id, query), bounds.data, zoom.data);
  }
}
