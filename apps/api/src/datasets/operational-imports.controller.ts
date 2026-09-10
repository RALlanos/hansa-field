import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { open } from "shapefile";
import { z } from "zod";
import { DatabaseService } from "../database/database.service.js";
import { readShapefileParts } from "../transfers/shapefile-inspector.js";
import { geometrySchema } from "../records/record-input.js";
import { datasetSchema, validateValues } from "./dataset-contracts.js";
import { DatasetRecordsService } from "./dataset-records.service.js";
import { LOCAL_ORGANIZATION } from "./operational.controller.js";

const rowSchema = z.object({
  properties: z.record(z.string(), z.unknown()),
  geometry: geometrySchema.nullable(),
});
const mappingSchema = z.object({
  datasetId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  projectAppId: z.string().uuid().optional(),
  expectedVersion: z.number().int().positive(),
  mapping: z.record(z.string(), z.string().uuid()),
  status: z.string().optional(),
});
const planSchema = z
  .object({ routes: z.array(mappingSchema).min(1).max(100) })
  .strict();

@Controller("workspace/imports")
export class OperationalImportsController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Post("inspect")
  async inspect(@Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file)
      throw new BadRequestException("Selecciona ZIP Shapefile o GeoJSON.");
    const bytes = await file.toBuffer();
    const rows: z.infer<typeof rowSchema>[] = [];
    if (file.filename.toLowerCase().endsWith(".zip")) {
      const parts = await readShapefileParts(bytes);
      const crs = parts.prj.toString("utf8");
      if (/PROJCS|PROJCRS/i.test(crs) || !/WGS[_ ]?(1984|84)/i.test(crs))
        throw new BadRequestException(
          "Convierte el archivo a EPSG:4326 para este flujo inicial.",
        );
      const source = await open(parts.shp, parts.dbf, {
        encoding: "windows-1252",
      });
      while (true) {
        const entry = await source.read();
        if (entry.done) break;
        rows.push(
          rowSchema.parse({
            properties: entry.value.properties ?? {},
            geometry: entry.value.geometry,
          }),
        );
        if (rows.length > 20000)
          throw new BadRequestException(
            "Máximo 20.000 registros por carga piloto.",
          );
      }
    } else {
      const data = z
        .object({
          type: z.literal("FeatureCollection"),
          features: z
            .array(rowSchema.extend({ type: z.literal("Feature") }))
            .max(20000),
        })
        .parse(JSON.parse(bytes.toString("utf8")));
      rows.push(...data.features);
    }
    const result = await this.db.query<{ id: string }>(
      "INSERT INTO import_jobs(organization_id,filename,checksum,rows) VALUES($1,$2,$3,$4) RETURNING id",
      [
        LOCAL_ORGANIZATION,
        file.filename.slice(0, 255),
        createHash("sha256").update(bytes).digest("hex"),
        JSON.stringify(rows),
      ],
    );
    const statuses = Object.entries(
      rows.reduce<Record<string, number>>((acc, row) => {
        const status = String(row.properties._status ?? "");
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {}),
    );
    return {
      id: result.rows[0]!.id,
      count: rows.length,
      fields: [...new Set(rows.flatMap((row) => Object.keys(row.properties)))],
      statuses,
      crs: "EPSG:4326",
      preview: rows.slice(0, 5),
    };
  }
  @Post(":id/preview") preview(@Param("id") id: string, @Body() body: unknown) {
    return this.execute(id, body, false);
  }
  @Post(":id/confirm") confirm(@Param("id") id: string, @Body() body: unknown) {
    return this.execute(id, body, true);
  }
  private async execute(id: string, body: unknown, confirm: boolean) {
    z.string().uuid().parse(id);
    const plan = planSchema.parse(body);
    return this.db.withTransaction(async (tx) => {
      const job = await tx.query<{
        rows: unknown;
        filename: string;
        result: unknown;
      }>(
        "SELECT rows,filename,result FROM import_jobs WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, LOCAL_ORGANIZATION],
      );
      if (!job.rows[0])
        throw new BadRequestException("Importación inexistente.");
      if (job.rows[0].result) return job.rows[0].result;
      const rows = z.array(rowSchema).parse(job.rows[0].rows);
      const prepared = [];
      for (const route of plan.routes) {
        const version = await tx.query<{
          version: number;
          schema_definition: unknown;
        }>(
          "SELECT v.version,v.schema_definition FROM datasets d JOIN LATERAL(SELECT * FROM dataset_versions WHERE dataset_id=d.id ORDER BY version DESC LIMIT 1)v ON true WHERE d.id=$1 AND d.organization_id=$2 FOR UPDATE OF d",
          [route.datasetId, LOCAL_ORGANIZATION],
        );
        if (version.rows[0]?.version !== route.expectedVersion)
          throw new ConflictException(
            "El formulario cambió. Revisa el mapeo nuevamente.",
          );
        if (
          new Set(Object.values(route.mapping)).size !==
          Object.values(route.mapping).length
        )
          throw new BadRequestException(
            "Dos columnas no pueden escribir el mismo campo.",
          );
        prepared.push({
          route,
          schema: datasetSchema.parse(version.rows[0].schema_definition),
        });
      }
      let imported = 0,
        skipped = 0;
      const issues: string[] = [];
      const writer = new DatasetRecordsService({
        query: (sql, values) => tx.query(sql, values),
        withTransaction: (action) => action(tx),
      });
      for (const [index, row] of rows.entries()) {
        const routes = prepared.filter(
          (p) =>
            p.route.status === undefined ||
            p.route.status === String(row.properties._status ?? ""),
        );
        if (routes.length > 1)
          throw new BadRequestException(
            "Cada status debe tener un solo destino.",
          );
        const chosen = routes[0];
        if (!chosen) {
          skipped++;
          continue;
        }
        const attributes: Record<string, unknown> = {};
        for (const [source, target] of Object.entries(chosen.route.mapping))
          attributes[target] = row.properties[source] ?? null;
        try {
          validateValues(chosen.schema, attributes);
        } catch (error) {
          issues.push(
            `Fila ${index + 1}: ${error instanceof Error ? error.message : "Valor inválido"}`,
          );
          continue;
        }
        imported++;
        if (confirm) {
          const externalId =
            row.properties._record_id ?? row.properties.record_id;
          const result = await writer.create(
            {
              organizationId: LOCAL_ORGANIZATION,
              actorId: "local-development",
              operationId: randomUUID(),
            },
            {
              datasetId: chosen.route.datasetId,
              ...(chosen.route.projectId
                ? { projectId: chosen.route.projectId }
                : {}),
              ...(chosen.route.projectAppId
                ? { projectAppId: chosen.route.projectAppId }
                : {}),
              attributes,
              geometry: row.geometry,
              importSource: {
                jobId: id,
                filename: job.rows[0].filename,
                externalId: externalId == null ? null : String(externalId),
              },
            },
          );
          await tx.query(
            "INSERT INTO import_sources(job_id,record_id,project_record_id,external_id) VALUES($1,$2,$3,$4)",
            [
              id,
              result.recordId,
              result.projectRecordId,
              externalId == null ? null : String(externalId),
            ],
          );
        }
      }
      if (confirm && issues.length)
        throw new BadRequestException(issues.slice(0, 20).join("; "));
      const result = {
        imported,
        skipped,
        issues: issues.slice(0, 100),
        confirmed: confirm,
      };
      if (confirm)
        await tx.query(
          "UPDATE import_jobs SET result=$2,rows='[]' WHERE id=$1",
          [id, result],
        );
      return result;
    });
  }
}
