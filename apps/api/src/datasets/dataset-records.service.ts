import { createHash } from "node:crypto";
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";
import type {
  DatabaseQuery,
  TransactionalDatabase,
} from "../database/database.service.js";
import type { GeoJsonGeometry } from "../records/record-input.js";
import { geometrySchema } from "../records/record-input.js";
import {
  datasetSchema,
  validateValues,
  type ActorContext,
} from "./dataset-contracts.js";

const resultSchema = z.object({
  recordId: z.string().uuid(),
  projectRecordId: z.string().uuid().nullable(),
  revision: z.number().int(),
});
type Result = z.infer<typeof resultSchema>;
type CreateInput = {
  datasetId: string;
  projectId?: string;
  projectAppId?: string;
  attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
  importSource?: { jobId: string; filename: string; externalId: string | null };
};
type PatchInput = {
  expectedRevision: number;
  attributesOverride?: Record<string, unknown>;
  projectAttributes?: Record<string, unknown>;
  geometryOverride?: GeoJsonGeometry | null;
  displayGeometryOverride?: GeoJsonGeometry | null;
  resetAttributeOverrides?: string[];
};
type RecordRow = {
  id: string;
  dataset_id: string;
  schema_version_id: string;
  attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
  revision: number;
  visibility: string;
  lifecycle: string;
  origin: Record<string, unknown>;
};
type Participation = {
  id: string;
  record_id: string;
  revision: number;
  schema_definition: unknown;
  attributes_override: Record<string, unknown>;
  project_attributes: Record<string, unknown>;
  geometry_override: GeoJsonGeometry | null;
  display_geometry_override: GeoJsonGeometry | null;
};

// JSON object order is not part of an operation's identity; array order is.
function canonicalInput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalInput);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalInput(item)]),
    );
  }
  return value;
}

export class DatasetRecordsService {
  constructor(private readonly database: TransactionalDatabase) {}

  async create(actor: ActorContext, input: CreateInput): Promise<Result> {
    geometrySchema.nullable().parse(input.geometry);
    return this.command(
      actor,
      "record.create",
      input,
      async (tx, changeset) => {
        const dataset = await tx.query<{
          app_id: string | null;
          local_project_id: string | null;
          version_id: string;
          schema_definition: unknown;
        }>(
          `SELECT d.app_id,d.local_project_id,v.id version_id,v.schema_definition FROM datasets d
        JOIN LATERAL(SELECT id,schema_definition FROM dataset_versions WHERE dataset_id=d.id ORDER BY version DESC LIMIT 1)v ON true
        WHERE d.id=$1 AND d.organization_id=$2 FOR UPDATE OF d`,
          [input.datasetId, actor.organizationId],
        );
        const owner = dataset.rows[0];
        if (!owner) throw new NotFoundException("Dataset not found.");
        if (
          owner.local_project_id &&
          (input.projectId !== owner.local_project_id || input.projectAppId)
        )
          throw new ConflictException(
            "Local dataset requires its own project context, without ProjectApp.",
          );
        if (owner.app_id && input.projectId && !input.projectAppId)
          throw new ConflictException("Select a related ProjectApp.");
        if (input.projectAppId && !input.projectId)
          throw new ConflictException("ProjectApp requires project context.");
        const schema = datasetSchema.parse(owner.schema_definition);
        validateValues(schema, input.attributes);
        const origin = {
          context: input.projectId ? "project" : "app",
          projectId: input.projectId ?? null,
          appId: owner.app_id,
          datasetId: input.datasetId,
          method: input.importSource ? "import" : "manual",
          importSource: input.importSource ?? null,
          actor: actor.actorId,
          operationId: actor.operationId,
        };
        const created = await tx.query<{ id: string }>(
          `INSERT INTO records(organization_id,dataset_id,schema_version_id,attributes,geometry,origin)
        VALUES($1,$2,$3,$4,CASE WHEN $5::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($5),4326) END,$6) RETURNING id`,
          [
            actor.organizationId,
            input.datasetId,
            owner.version_id,
            input.attributes,
            input.geometry,
            origin,
          ],
        );
        const recordId = created.rows[0]!.id;
        const projectRecordId = input.projectId
          ? await this.participate(
              tx,
              actor,
              recordId,
              input.datasetId,
              input.projectId,
              input.projectAppId ?? null,
              owner.schema_definition,
            )
          : null;
        const result = { recordId, projectRecordId, revision: 1 };
        await this.event(tx, changeset, result, "create", {
          origin,
          attributes: input.attributes,
          geometry: input.geometry,
          schemaVersionId: owner.version_id,
        });
        return result;
      },
    );
  }

  async incorporate(
    actor: ActorContext,
    recordId: string,
    projectId: string,
    projectAppId?: string,
  ) {
    const result = await this.command(
      actor,
      "record.incorporate",
      { recordId, projectId, projectAppId },
      async (tx, changeset) => {
        const record = await this.loadRecord(
          tx,
          actor.organizationId,
          recordId,
        );
        const schema = await tx.query<{ schema_definition: unknown }>(
          "SELECT schema_definition FROM dataset_versions WHERE id=$1",
          [record.schema_version_id],
        );
        const id = await this.participate(
          tx,
          actor,
          recordId,
          record.dataset_id,
          projectId,
          projectAppId ?? null,
          schema.rows[0]!.schema_definition,
        );
        const output = { recordId, projectRecordId: id, revision: 1 };
        await this.event(tx, changeset, output, "incorporate", {
          projectId,
          sourceRevision: record.revision,
        });
        return output;
      },
    );
    if (!result.projectRecordId)
      throw new Error("Missing participation identity.");
    return { ...result, projectRecordId: result.projectRecordId };
  }

  async patchProject(
    actor: ActorContext,
    projectId: string,
    projectRecordId: string,
    input: PatchInput,
  ) {
    if (input.geometryOverride !== undefined)
      geometrySchema.nullable().parse(input.geometryOverride);
    if (input.displayGeometryOverride !== undefined)
      geometrySchema.nullable().parse(input.displayGeometryOverride);
    return this.command(
      actor,
      "participation.patch",
      { projectId, projectRecordId, ...input },
      async (tx, changeset) => {
        const row = await this.loadParticipation(
          tx,
          actor.organizationId,
          projectId,
          projectRecordId,
          true,
        );
        if (row.revision !== input.expectedRevision)
          throw new ConflictException("Participation revision changed.");
        const schema = datasetSchema.parse(row.schema_definition);
        const baseline = await this.loadRecord(
          tx,
          actor.organizationId,
          row.record_id,
        );
        const baseSchema = await tx.query<{ schema_definition: unknown }>(
          "SELECT schema_definition FROM dataset_versions WHERE id=$1",
          [baseline.schema_version_id],
        );
        const inheritedIds = new Set(
          datasetSchema
            .parse(baseSchema.rows[0]!.schema_definition)
            .sections.flatMap((s) => s.fields.map((f) => f.id)),
        );
        if (
          Object.keys(input.attributesOverride ?? {}).some(
            (id) => !inheritedIds.has(id),
          ) ||
          Object.keys(input.projectAttributes ?? {}).some((id) =>
            inheritedIds.has(id),
          )
        )
          throw new UnprocessableEntityException(
            "Inherited and project-local fields must use their corresponding scope.",
          );
        validateValues(schema, input.attributesOverride ?? {}, true);
        validateValues(schema, input.projectAttributes ?? {}, true);
        const overrides = {
          ...row.attributes_override,
          ...input.attributesOverride,
        };
        for (const id of input.resetAttributeOverrides ?? [])
          delete overrides[id];
        const local = { ...row.project_attributes, ...input.projectAttributes };
        validateValues(schema, {
          ...baseline.attributes,
          ...overrides,
          ...local,
        });
        const geometry =
          input.geometryOverride === undefined
            ? row.geometry_override
            : input.geometryOverride;
        const display =
          input.displayGeometryOverride === undefined
            ? row.display_geometry_override
            : input.displayGeometryOverride;
        await tx.query(
          `UPDATE project_records SET attributes_override=$2,project_attributes=$3,
        geometry_override=CASE WHEN $4::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($4),4326) END,
        display_geometry_override=CASE WHEN $5::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($5),4326) END,
        revision=revision+1,updated_at=now() WHERE id=$1`,
          [projectRecordId, overrides, local, geometry, display],
        );
        const output = {
          recordId: row.record_id,
          projectRecordId,
          revision: row.revision + 1,
        };
        await this.event(tx, changeset, output, "patch", {
          attributesOverride: overrides,
          projectAttributes: local,
          geometryOverride: geometry,
          displayGeometryOverride: display,
          revision: output.revision,
        });
        return output;
      },
    );
  }

  async patchBaseline(
    actor: ActorContext,
    recordId: string,
    input: {
      expectedRevision: number;
      attributes: Record<string, unknown>;
      geometry?: GeoJsonGeometry | null;
    },
  ) {
    if (input.geometry !== undefined)
      geometrySchema.nullable().parse(input.geometry);
    return this.command(
      actor,
      "record.patch",
      { recordId, ...input },
      async (tx, changeset) => {
        await tx.query(
          "SELECT id FROM records WHERE id=$1 AND organization_id=$2 FOR UPDATE",
          [recordId, actor.organizationId],
        );
        const record = await this.loadRecord(
          tx,
          actor.organizationId,
          recordId,
        );
        if (record.revision !== input.expectedRevision)
          throw new ConflictException("Record revision changed.");
        const version = await tx.query<{ schema_definition: unknown }>(
          "SELECT schema_definition FROM dataset_versions WHERE id=$1",
          [record.schema_version_id],
        );
        const attributes = { ...record.attributes, ...input.attributes };
        validateValues(
          datasetSchema.parse(version.rows[0]!.schema_definition),
          attributes,
        );
        const geometry =
          input.geometry === undefined ? record.geometry : input.geometry;
        await tx.query(
          "UPDATE records SET attributes=$2,geometry=CASE WHEN $3::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($3),4326) END,revision=revision+1,updated_at=now() WHERE id=$1",
          [recordId, attributes, geometry],
        );
        const result = {
          recordId,
          projectRecordId: null,
          revision: record.revision + 1,
        };
        await this.event(tx, changeset, result, "record.patch", {
          attributes,
          geometry,
          revision: result.revision,
        });
        return result;
      },
    );
  }

  async removeProject(
    actor: ActorContext,
    projectId: string,
    projectRecordId: string,
    expectedRevision: number,
  ): Promise<Result> {
    return this.command(
      actor,
      "participation.remove",
      { projectId, projectRecordId, expectedRevision },
      async (tx, changeset) => {
        const current = await this.loadParticipation(
          tx,
          actor.organizationId,
          projectId,
          projectRecordId,
          true,
        );
        if (current.revision !== expectedRevision)
          throw new ConflictException("Participation revision has changed.");
        await tx.query(
          "UPDATE project_records SET status='removed',revision=revision+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND project_id=$3",
          [projectRecordId, actor.organizationId, projectId],
        );
        const result = {
          recordId: current.record_id,
          projectRecordId,
          revision: current.revision + 1,
        };
        await this.event(tx, changeset, result, "participation.remove", {
          ...current,
          status: "removed",
          revision: result.revision,
        });
        return result;
      },
    );
  }

  async publish(
    actor: ActorContext,
    recordId: string,
    expectedRevision: number,
  ) {
    return this.command(
      actor,
      "record.publish",
      { recordId, expectedRevision },
      async (tx, changeset) => {
        const record = await this.loadRecord(
          tx,
          actor.organizationId,
          recordId,
        );
        const updated = await tx.query<{ revision: number }>(
          "UPDATE records SET visibility='published',revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 RETURNING revision",
          [recordId, expectedRevision],
        );
        if (!updated.rows[0])
          throw new ConflictException("Record revision changed.");
        const output = {
          recordId,
          projectRecordId: null,
          revision: updated.rows[0].revision,
        };
        await this.event(tx, changeset, output, "publish", {
          ...record,
          visibility: "published",
          revision: output.revision,
        });
        return output;
      },
    );
  }

  async detail(organizationId: string, recordId: string) {
    return this.loadRecord(this.database, organizationId, recordId);
  }
  async projectDetail(
    organizationId: string,
    projectId: string,
    projectRecordId: string,
  ) {
    const pr = await this.loadParticipation(
      this.database,
      organizationId,
      projectId,
      projectRecordId,
    );
    const record = await this.loadRecord(
      this.database,
      organizationId,
      pr.record_id,
    );
    const geometry = pr.geometry_override ?? record.geometry;
    return {
      recordId: record.id,
      projectRecordId: pr.id,
      revision: pr.revision,
      attributes: {
        ...record.attributes,
        ...pr.attributes_override,
        ...pr.project_attributes,
      },
      geometry,
      displayGeometry: pr.display_geometry_override ?? geometry,
    };
  }

  private async participate(
    tx: DatabaseQuery,
    actor: ActorContext,
    recordId: string,
    datasetId: string,
    projectId: string,
    projectAppId: string | null,
    schema: unknown,
  ) {
    const dataset = await tx.query<{ app_id: string | null }>(
      "SELECT app_id FROM datasets WHERE id=$1",
      [datasetId],
    );
    if (dataset.rows[0]?.app_id && !projectAppId)
      throw new ConflictException(
        "App dataset participation requires its ProjectApp.",
      );
    if (!dataset.rows[0]?.app_id && projectAppId)
      throw new ConflictException(
        "Local dataset cannot use a placeholder ProjectApp.",
      );
    let contextual = schema;
    if (projectAppId) {
      const version = await tx.query<{ schema_definition: unknown }>(
        "SELECT schema_definition FROM project_app_versions WHERE project_app_id=$1 ORDER BY version DESC LIMIT 1",
        [projectAppId],
      );
      if (!version.rows[0])
        throw new NotFoundException("ProjectApp version not found.");
      contextual = version.rows[0].schema_definition;
    }
    const result = await tx.query<{ id: string }>(
      "INSERT INTO project_records(organization_id,project_id,project_app_id,dataset_id,record_id,schema_definition) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [
        actor.organizationId,
        projectId,
        projectAppId,
        datasetId,
        recordId,
        contextual,
      ],
    );
    return result.rows[0]!.id;
  }

  private async loadRecord(
    tx: DatabaseQuery,
    organizationId: string,
    id: string,
  ) {
    const result = await tx.query<RecordRow>(
      "SELECT id,dataset_id,schema_version_id,attributes,ST_AsGeoJSON(geometry)::jsonb geometry,revision,visibility,lifecycle,origin FROM records WHERE id=$1 AND organization_id=$2",
      [id, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException("Record not found.");
    return result.rows[0];
  }
  private async loadParticipation(
    tx: DatabaseQuery,
    organizationId: string,
    projectId: string,
    id: string,
    lock = false,
  ) {
    const result = await tx.query<Participation>(
      `SELECT id,record_id,revision,schema_definition,attributes_override,project_attributes,
      ST_AsGeoJSON(geometry_override)::jsonb geometry_override,ST_AsGeoJSON(display_geometry_override)::jsonb display_geometry_override
      FROM project_records WHERE id=$1 AND organization_id=$2 AND project_id=$3 AND status='active' ${lock ? "FOR UPDATE" : ""}`,
      [id, organizationId, projectId],
    );
    if (!result.rows[0])
      throw new NotFoundException("Participation not found in this context.");
    return result.rows[0];
  }
  private async event(
    tx: DatabaseQuery,
    changeset: string,
    result: Result,
    operation: string,
    snapshot: unknown,
  ) {
    await tx.query(
      "INSERT INTO record_events(record_id,project_record_id,changeset_id,operation,snapshot) VALUES($1,$2,$3,$4,$5)",
      [result.recordId, result.projectRecordId, changeset, operation, snapshot],
    );
  }
  private async command(
    actor: ActorContext,
    operation: string,
    input: unknown,
    action: (tx: DatabaseQuery, changeset: string) => Promise<Result>,
  ): Promise<Result> {
    z.string().uuid().parse(actor.operationId);
    z.string().uuid().parse(actor.organizationId);
    z.string().min(1).parse(actor.actorId);
    const hash = createHash("sha256")
      .update(
        JSON.stringify(
          canonicalInput({ operation, input, actor: actor.actorId }),
        ),
      )
      .digest("hex");
    return this.database.withTransaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `${actor.organizationId}:${actor.operationId}`,
      ]);
      const prior = await tx.query<{ request_hash: string; response: unknown }>(
        "SELECT request_hash,response FROM changesets WHERE organization_id=$1 AND operation_id=$2",
        [actor.organizationId, actor.operationId],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].request_hash !== hash)
          throw new ConflictException(
            "Operation ID was already used for different input.",
          );
        return resultSchema.parse(prior.rows[0].response);
      }
      const changeset = await tx.query<{ id: string }>(
        "INSERT INTO changesets(organization_id,operation_id,actor,operation,request_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [
          actor.organizationId,
          actor.operationId,
          actor.actorId,
          operation,
          hash,
        ],
      );
      const id = changeset.rows[0]!.id;
      const result = await action(tx, id);
      await tx.query("UPDATE changesets SET response=$2 WHERE id=$1", [
        id,
        result,
      ]);
      return result;
    });
  }
}
