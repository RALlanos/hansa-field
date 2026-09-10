import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Headers,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { DatabaseService } from "../database/database.service.js";
import { DatasetsService } from "./datasets.service.js";
import { DatasetRecordsService } from "./dataset-records.service.js";
import { datasetSchema } from "./dataset-contracts.js";
import { geometrySchema } from "../records/record-input.js";
import { mapScopeSchema } from "./map-scope.js";
import { MapRecordsService } from "./map-records.service.js";
import {
  WorkspaceChangesService,
  type WorkspaceChangesCursor,
} from "./workspace-changes.service.js";

export const LOCAL_ORGANIZATION = "00000000-0000-4000-8000-000000000001";
const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(160);
const attrs = z.record(z.string().uuid(), z.unknown());
const patch = z
  .object({
    expectedRevision: z.number().int().positive(),
    attributesOverride: attrs.optional(),
    projectAttributes: attrs.optional(),
    geometryOverride: geometrySchema.nullable().optional(),
    displayGeometryOverride: geometrySchema.nullable().optional(),
    resetAttributeOverrides: z.array(uuid).optional(),
  })
  .strict();

/** Local development workspace. Actor and organization are server-owned, not request fields. */
@Controller("workspace")
export class OperationalController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(DatasetsService) private readonly datasets: DatasetsService,
    @Inject(DatasetRecordsService)
    private readonly records: DatasetRecordsService,
    @Inject(MapRecordsService)
    private readonly mapRecords: MapRecordsService,
    @Inject(WorkspaceChangesService)
    private readonly changes: WorkspaceChangesService,
  ) {}
  private actor(operationId: string) {
    return {
      organizationId: LOCAL_ORGANIZATION,
      actorId: "local-development",
      operationId: uuid.parse(operationId),
    };
  }
  @Get()
  async catalog() {
    const [templates, apps, projects, collections, blocks] = await Promise.all([
      this.db.query(
        "SELECT t.id,t.name,v.id AS version_id,v.schema_definition FROM templates t JOIN LATERAL (SELECT * FROM template_versions WHERE template_id=t.id ORDER BY version DESC LIMIT 1)v ON true WHERE organization_id=$1 ORDER BY name",
        [LOCAL_ORGANIZATION],
      ),
      this.db.query(
        "SELECT a.id,a.name,d.id dataset_id FROM apps a JOIN datasets d ON d.app_id=a.id WHERE a.organization_id=$1 ORDER BY a.name",
        [LOCAL_ORGANIZATION],
      ),
      this.db.query(
        "SELECT id,name FROM projects WHERE organization_id=$1 ORDER BY name",
        [LOCAL_ORGANIZATION],
      ),
      this.db.query(
        `SELECT d.id,d.name,d.app_id,d.local_project_id,pa.project_id,pa.id project_app_id,v.schema_definition,v.version FROM datasets d
        LEFT JOIN project_apps pa ON pa.dataset_id=d.id
        JOIN LATERAL(SELECT * FROM dataset_versions WHERE dataset_id=d.id ORDER BY version DESC LIMIT 1)v ON true
        WHERE d.organization_id=$1 ORDER BY d.name`,
        [LOCAL_ORGANIZATION],
      ),
      this.db.query(
        "SELECT b.id,b.name,COALESCE(jsonb_agg(m.app_id) FILTER(WHERE m.app_id IS NOT NULL),'[]') app_ids FROM app_blocks b LEFT JOIN block_members m ON m.block_id=b.id WHERE organization_id=$1 GROUP BY b.id ORDER BY name",
        [LOCAL_ORGANIZATION],
      ),
    ]);
    return {
      templates: templates.rows,
      apps: apps.rows,
      projects: projects.rows,
      collections: collections.rows,
      blocks: blocks.rows,
    };
  }
  @Post("apps") app(@Body() body: unknown) {
    const input = z
      .object({ name, templateVersionId: uuid.optional() })
      .strict()
      .parse(body);
    return this.datasets.createApp(
      LOCAL_ORGANIZATION,
      input.name,
      input.templateVersionId,
    );
  }
  @Post("projects") project(@Body() body: unknown) {
    return this.datasets.createProject(
      LOCAL_ORGANIZATION,
      z.object({ name }).strict().parse(body).name,
    );
  }
  @Post("projects/:projectId/apps") relate(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    return this.datasets.relateApp(
      LOCAL_ORGANIZATION,
      uuid.parse(projectId),
      z.object({ appId: uuid }).strict().parse(body).appId,
    );
  }
  @Post("projects/:projectId/collections") local(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({ name, schema: datasetSchema })
      .strict()
      .parse(body);
    return this.datasets.createLocalCollection(
      LOCAL_ORGANIZATION,
      uuid.parse(projectId),
      input.name,
      input.schema,
    );
  }
  @Post("datasets/:datasetId/schema") schema(
    @Param("datasetId") datasetId: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        expectedVersion: z.number().int().positive(),
        schema: datasetSchema,
      })
      .strict()
      .parse(body);
    return this.datasets.publishSchema(
      LOCAL_ORGANIZATION,
      uuid.parse(datasetId),
      input.expectedVersion,
      input.schema,
    );
  }
  @Post("records") create(
    @Body() body: unknown,
    @Headers("x-operation-id") operationId: string,
  ) {
    const input = z
      .object({
        datasetId: uuid,
        projectId: uuid.optional(),
        projectAppId: uuid.optional(),
        attributes: attrs,
        geometry: geometrySchema.nullable(),
      })
      .strict()
      .parse(body);
    return this.records.create(this.actor(operationId), {
      datasetId: input.datasetId,
      attributes: input.attributes,
      geometry: input.geometry,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.projectAppId ? { projectAppId: input.projectAppId } : {}),
    });
  }
  @Post("projects/:projectId/incorporate") incorporate(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @Headers("x-operation-id") operationId: string,
  ) {
    const input = z
      .object({ recordId: uuid, projectAppId: uuid.optional() })
      .strict()
      .parse(body);
    return this.records.incorporate(
      this.actor(operationId),
      input.recordId,
      uuid.parse(projectId),
      input.projectAppId,
    );
  }
  @Patch("projects/:projectId/records/:id") edit(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-operation-id") operationId: string,
  ) {
    const input = patch.parse(body);
    return this.records.patchProject(
      this.actor(operationId),
      uuid.parse(projectId),
      uuid.parse(id),
      {
        expectedRevision: input.expectedRevision,
        ...(input.attributesOverride !== undefined
          ? { attributesOverride: input.attributesOverride }
          : {}),
        ...(input.projectAttributes !== undefined
          ? { projectAttributes: input.projectAttributes }
          : {}),
        ...(input.geometryOverride !== undefined
          ? { geometryOverride: input.geometryOverride }
          : {}),
        ...(input.displayGeometryOverride !== undefined
          ? { displayGeometryOverride: input.displayGeometryOverride }
          : {}),
        ...(input.resetAttributeOverrides !== undefined
          ? { resetAttributeOverrides: input.resetAttributeOverrides }
          : {}),
      },
    );
  }
  @Delete("projects/:projectId/records/:id") remove(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-operation-id") operationId: string,
  ) {
    const input = z
      .object({ expectedRevision: z.number().int().positive() })
      .strict()
      .parse(body);
    return this.records.removeProject(
      this.actor(operationId),
      uuid.parse(projectId),
      uuid.parse(id),
      input.expectedRevision,
    );
  }
  @Post("records/:id/publish") publish(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-operation-id") operationId: string,
  ) {
    return this.records.publish(
      this.actor(operationId),
      uuid.parse(id),
      z.object({ expectedRevision: z.number().int().positive() }).parse(body)
        .expectedRevision,
    );
  }
  @Patch("records/:id") baseline(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-operation-id") operationId: string,
  ) {
    const input = z
      .object({
        expectedRevision: z.number().int().positive(),
        attributes: attrs,
        geometry: geometrySchema.nullable(),
      })
      .strict()
      .parse(body);
    return this.records.patchBaseline(
      this.actor(operationId),
      uuid.parse(id),
      input,
    );
  }
  @Get("records/:id") async detail(@Param("id") id: string) {
    const record = await this.records.detail(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
    );
    const events = await this.db.query(
      "SELECT operation,snapshot,created_at FROM record_events WHERE record_id=$1 ORDER BY created_at DESC LIMIT 100",
      [id],
    );
    return { ...record, history: events.rows };
  }
  @Get("projects/:projectId/records/:id") projectDetail(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    return this.records.projectDetail(
      LOCAL_ORGANIZATION,
      uuid.parse(projectId),
      uuid.parse(id),
    );
  }
  @Get("records") async list(@Query() raw: unknown) {
    const query =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};
    const { cursor: rawCursor, limit: rawLimit, ...scopeQuery } = query;
    const input = mapScopeSchema.parse({
      ...scopeQuery,
      ...(typeof query.bbox === "string"
        ? { bbox: query.bbox.split(",").map(Number) }
        : {}),
      ...(typeof query.appIds === "string"
        ? { appIds: query.appIds.split(",").filter(Boolean) }
        : {}),
      ...(typeof query.projectIds === "string"
        ? { projectIds: query.projectIds.split(",").filter(Boolean) }
        : {}),
      ...(typeof query.localCollectionIds === "string"
        ? {
            localCollectionIds: query.localCollectionIds
              .split(",")
              .filter(Boolean),
          }
        : {}),
    });
    const cursor = typeof rawCursor === "string" ? uuid.parse(rawCursor) : null;
    const limit = z.coerce.number().int().min(1).max(200).parse(rawLimit ?? 100);
    if (input.bbox[0] >= input.bbox[2] || input.bbox[1] >= input.bbox[3])
      throw new BadRequestException("Área inválida.");
    return this.mapRecords.table(LOCAL_ORGANIZATION, input, cursor, limit);
  }
  @Get("changes") async changeFeed(@Query() raw: unknown) {
    const query =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};
    const splitIds = (value: unknown) =>
      typeof value === "string" ? value.split(",").filter(Boolean) : [];
    const input = z
      .object({
        mode: z.enum(["app", "project"]),
        appIds: z.array(uuid).max(200).default([]),
        projectIds: z.array(uuid).max(200).default([]),
        datasetIds: z.array(uuid).max(200).default([]),
        cursor: z.string().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
      })
      .strict()
      .parse({
        ...query,
        appIds: splitIds(query.appIds),
        projectIds: splitIds(query.projectIds),
        datasetIds: splitIds(query.datasetIds),
      });
    if (input.mode === "app" && !input.appIds.length)
      throw new BadRequestException("Selecciona al menos una App.");
    if (input.mode === "project" && !input.projectIds.length)
      throw new BadRequestException("Selecciona al menos un Proyecto.");
    let cursor: WorkspaceChangesCursor | null = null;
    if (input.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(input.cursor, "base64url").toString("utf8"),
        ) as unknown;
        cursor = z
          .object({ createdAt: z.string().datetime({ offset: true }), eventId: uuid })
          .strict()
          .parse(decoded);
      } catch {
        throw new BadRequestException("Cursor de cambios inválido.");
      }
    }
    return this.changes.list(
      LOCAL_ORGANIZATION,
      input,
      cursor,
      input.limit,
    );
  }
  @Get("map") async map(@Query() raw: unknown) {
    const query =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};
    const input = mapScopeSchema.parse({
      ...query,
      ...(typeof query.bbox === "string"
        ? {
            bbox:
              query.bbox.split(",").map(Number),
          }
        : {}),
      ...(typeof query.appIds === "string"
        ? {
            appIds:
              query.appIds.split(",").filter(Boolean),
          }
        : {}),
      ...(typeof query.projectIds === "string"
        ? {
            projectIds:
              query.projectIds.split(",").filter(Boolean),
          }
        : {}),
      ...(typeof query.localCollectionIds === "string"
        ? {
            localCollectionIds:
              query.localCollectionIds.split(",").filter(Boolean),
          }
        : {}),
    });
    if (input.bbox[0] >= input.bbox[2] || input.bbox[1] >= input.bbox[3])
      throw new BadRequestException("Área inválida.");
    return this.mapRecords.map(LOCAL_ORGANIZATION, input);
  }
  @Post("blocks") async block(@Body() body: unknown) {
    const input = z
      .object({ name, appIds: z.array(uuid).min(1).max(100) })
      .strict()
      .parse(body);
    return this.db.withTransaction(async (tx) => {
      const block = await tx.query<{ id: string }>(
        "INSERT INTO app_blocks(organization_id,name) VALUES($1,$2) RETURNING id",
        [LOCAL_ORGANIZATION, input.name],
      );
      for (const appId of new Set(input.appIds)) {
        const version = await tx.query<{ id: string }>(
          "SELECT v.id FROM dataset_versions v JOIN datasets d ON d.id=v.dataset_id WHERE d.app_id=$1 AND d.organization_id=$2 ORDER BY v.version DESC LIMIT 1",
          [appId, LOCAL_ORGANIZATION],
        );
        if (!version.rows[0]) throw new BadRequestException("App inexistente.");
        await tx.query(
          "INSERT INTO block_members(block_id,app_id,dataset_version_id) VALUES($1,$2,$3)",
          [block.rows[0]!.id, appId, version.rows[0].id],
        );
      }
      return block.rows[0];
    });
  }
  @Post("projects/:id/blocks/:blockId") async apply(
    @Param("id") projectId: string,
    @Param("blockId") blockId: string,
  ) {
    uuid.parse(projectId);
    uuid.parse(blockId);
    return this.db.withTransaction(async (tx) => {
      const project = await tx.query(
        "SELECT id FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [projectId, LOCAL_ORGANIZATION],
      );
      if (!project.rows.length)
        throw new BadRequestException("Proyecto inexistente.");
      const members = await tx.query<{
        app_id: string;
        dataset_id: string;
        schema_definition: unknown;
      }>(
        "SELECT m.app_id,v.dataset_id,v.schema_definition FROM block_members m JOIN app_blocks b ON b.id=m.block_id JOIN dataset_versions v ON v.id=m.dataset_version_id WHERE b.id=$1 AND b.organization_id=$2",
        [blockId, LOCAL_ORGANIZATION],
      );
      if (!members.rows.length)
        throw new BadRequestException("Cajón vacío o inexistente.");
      for (const member of members.rows) {
        const pa = await tx.query<{ id: string }>(
          "INSERT INTO project_apps(organization_id,project_id,app_id,dataset_id) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,app_id) DO NOTHING RETURNING id",
          [LOCAL_ORGANIZATION, projectId, member.app_id, member.dataset_id],
        );
        if (pa.rows[0])
          await tx.query(
            "INSERT INTO project_app_versions(project_app_id,version,schema_definition) VALUES($1,1,$2)",
            [pa.rows[0].id, member.schema_definition],
          );
      }
      return { ok: true };
    });
  }
}
