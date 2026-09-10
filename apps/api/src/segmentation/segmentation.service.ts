import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import type { DatabaseQuery } from "../database/database.service.js";
import {
  SegmentationRepository,
  schemeColumns,
  segmentColumns,
} from "./segmentation.repository.js";
import {
  configuration,
  type SchemeInput,
  type SegmentInput,
  type SegmentPatch,
  type Scheme,
  type Level,
  type Segment,
  schemePatch,
  levelPatch,
} from "./segmentation.contracts.js";
import type { z } from "zod";

@Injectable()
export class SegmentationService {
  constructor(
    @Inject(SegmentationRepository) readonly repository: SegmentationRepository,
  ) {}
  async list(
    org: string,
    context: { appId?: string | undefined; projectId?: string | undefined },
  ) {
    return (
      await this.repository.database.query<Scheme>(
        `SELECT ${schemeColumns} FROM segmentation_schemes WHERE organization_id=$1 AND ($2::uuid IS NULL OR app_id=$2) AND ($3::uuid IS NULL OR project_id=$3) ORDER BY name,id`,
        [org, context.appId ?? null, context.projectId ?? null],
      )
    ).rows;
  }
  async create(org: string, input: SchemeInput) {
    const result = await this.repository.database.query<{ id: string }>(
      "INSERT INTO segmentation_schemes(organization_id,app_id,project_id,name,description,configuration) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [
        org,
        input.appId ?? null,
        input.projectId ?? null,
        input.name,
        input.description,
        input.configuration,
      ],
    );
    return this.get(org, result.rows[0]!.id);
  }
  async get(org: string, id: string) {
    const scheme = await this.repository.scheme(
      this.repository.database,
      org,
      id,
    );
    return {
      ...scheme,
      levels: await this.repository.levels(this.repository.database, id),
    };
  }
  async edit(org: string, id: string, input: z.infer<typeof schemePatch>) {
    return this.repository.database.withTransaction(async (tx) => {
      const current = await this.repository.scheme(tx, org, id, true);
      const next = { ...current, ...input };
      await tx.query(
        "UPDATE segmentation_schemes SET name=$2,description=$3,status=$4,configuration=$5,revision=revision+1,updated_at=now() WHERE id=$1",
        [id, next.name, next.description, next.status, next.configuration],
      );
      return this.repository.scheme(tx, org, id);
    });
  }
  async createLevel(
    org: string,
    schemeId: string,
    input: { name: string; configuration: z.infer<typeof configuration> },
  ) {
    return this.repository.database.withTransaction(async (tx) => {
      await this.activeScheme(tx, org, schemeId);
      const row = await tx.query<{ id: string }>(
        "INSERT INTO segmentation_levels(scheme_id,name,position,configuration) SELECT $1,$2,COALESCE(max(position),0)+1,$3 FROM segmentation_levels WHERE scheme_id=$1 RETURNING id",
        [schemeId, input.name, input.configuration],
      );
      await this.repository.touch(tx, schemeId);
      return { id: row.rows[0]!.id };
    });
  }
  async editLevel(
    org: string,
    schemeId: string,
    id: string,
    input: z.infer<typeof levelPatch>,
  ) {
    return this.repository.database.withTransaction(async (tx) => {
      await this.activeScheme(tx, org, schemeId);
      const level = (await this.repository.levels(tx, schemeId)).find(
        (l) => l.id === id,
      );
      if (!level) throw new BadRequestException("Nivel ajeno al esquema.");
      const next = {
        ...level,
        name: input.name ?? level.name,
        status: input.status ?? level.status,
        configuration: input.configuration ?? level.configuration,
      };
      if (
        next.status === "archived" &&
        (
          await tx.query(
            "SELECT id FROM segments WHERE level_id=$1 AND status='active' LIMIT 1",
            [id],
          )
        ).rows.length
      )
        throw new ConflictException(
          "Archiva los segmentos de este nivel antes de archivarlo.",
        );
      if (input.configuration) {
        let cursor: string | null = null;
        while (true) {
          const rows: {
            rows: { id: string; metadata: Record<string, unknown> }[];
          } = await tx.query<{
            id: string;
            metadata: Record<string, unknown>;
          }>(
            "SELECT id,metadata FROM segments WHERE level_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 500",
            [id, cursor],
          );
          for (const row of rows.rows)
            this.validateMetadata(next, row.metadata);
          if (rows.rows.length < 500) break;
          cursor = rows.rows.at(-1)!.id;
        }
      }
      await tx.query(
        "UPDATE segmentation_levels SET name=$2,status=$3,configuration=$4 WHERE id=$1",
        [id, next.name, next.status, next.configuration],
      );
      await this.repository.touch(tx, schemeId);
      return next;
    });
  }
  async orderLevels(org: string, id: string, levelIds: string[]) {
    return this.repository.database.withTransaction(async (tx) => {
      await this.activeScheme(tx, org, id);
      const levels = await this.repository.levels(tx, id);
      if (
        levelIds.length !== levels.length ||
        new Set(levelIds).size !== levelIds.length ||
        levels.some((l) => !levelIds.includes(l.id))
      )
        throw new BadRequestException(
          "Incluye cada nivel del esquema una sola vez.",
        );
      for (const [index, levelId] of levelIds.entries())
        await tx.query(
          "UPDATE segmentation_levels SET position=$2 WHERE id=$1",
          [levelId, index + 1],
        );
      const invalid = await tx.query(
        "SELECT child.id FROM segments child JOIN segments parent ON parent.id=child.parent_segment_id JOIN segmentation_levels cl ON cl.id=child.level_id JOIN segmentation_levels pl ON pl.id=parent.level_id WHERE child.scheme_id=$1 AND cl.position<=pl.position LIMIT 1",
        [id],
      );
      if (invalid.rows.length)
        throw new ConflictException(
          "El orden propuesto contradice el árbol existente.",
        );
      await this.repository.touch(tx, id);
      return this.repository.levels(tx, id);
    });
  }
  async createSegment(org: string, schemeId: string, input: SegmentInput) {
    return this.repository.database.withTransaction(async (tx) => {
      await this.activeScheme(tx, org, schemeId);
      const result = await this.insertSegment(tx, org, schemeId, input);
      await this.repository.touch(tx, schemeId);
      return result;
    });
  }
  async insertSegment(
    tx: DatabaseQuery,
    org: string,
    schemeId: string,
    input: SegmentInput,
  ) {
    const levels = await this.repository.levels(tx, schemeId);
    const level = levels.find(
      (l) => l.id === input.levelId && l.status === "active",
    );
    if (!level)
      throw new BadRequestException("Selecciona un nivel activo del esquema.");
    this.validateMetadata(level, input.metadata);
    await this.validateParent(
      tx,
      org,
      schemeId,
      input.parentSegmentId,
      level.position,
    );
    const rows = await tx.query<{ id: string }>(
      "INSERT INTO segments(scheme_id,level_id,parent_segment_id,name,code,external_id,description,status,metadata,geometry) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $10::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($10),4326) END) RETURNING id",
      [
        schemeId,
        input.levelId,
        input.parentSegmentId,
        input.name,
        input.code,
        input.externalId,
        input.description,
        input.status,
        input.metadata,
        input.geometry,
      ],
    );
    return this.repository.segment(tx, org, rows.rows[0]!.id);
  }
  async editSegment(org: string, id: string, input: SegmentPatch) {
    return this.repository.database.withTransaction(async (tx) => {
      const initial = await this.repository.segment(tx, org, id);
      await this.activeScheme(tx, org, initial.schemeId);
      const current = await this.repository.segment(tx, org, id);
      const next = {
        ...current,
        ...input,
        metadata: input.metadata ?? current.metadata,
        parentSegmentId:
          input.parentSegmentId === undefined
            ? current.parentSegmentId
            : input.parentSegmentId,
      };
      const levels = await this.repository.levels(tx, current.schemeId);
      const level = levels.find(
        (l) => l.id === next.levelId && l.status === "active",
      );
      if (!level) throw new BadRequestException("Nivel inválido.");
      if (next.parentSegmentId === id)
        throw new BadRequestException(
          "Un segmento no puede ser su propio padre.",
        );
      this.validateMetadata(level, next.metadata);
      await this.validateParent(
        tx,
        org,
        current.schemeId,
        next.parentSegmentId,
        level.position,
      );
      const children = await tx.query(
        "SELECT g.id FROM segments g JOIN segmentation_levels l ON l.id=g.level_id WHERE g.parent_segment_id=$1 AND (l.position<=$2 OR ($3='archived' AND g.status='active')) LIMIT 1",
        [id, level.position, next.status],
      );
      if (children.rows.length)
        throw new ConflictException(
          "El cambio contradice el nivel o estado de los hijos existentes.",
        );
      await tx.query(
        "UPDATE segments SET level_id=$2,parent_segment_id=$3,name=$4,code=$5,external_id=$6,description=$7,status=$8,metadata=$9,geometry=CASE WHEN $10::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($10),4326) END,updated_at=now() WHERE id=$1",
        [
          id,
          next.levelId,
          next.parentSegmentId,
          next.name,
          next.code,
          next.externalId,
          next.description,
          next.status,
          next.metadata,
          next.geometry,
        ],
      );
      await this.repository.touch(tx, current.schemeId);
      return this.repository.segment(tx, org, id);
    });
  }
  async children(
    org: string,
    schemeId: string,
    parentId: string | null,
    cursor: string | null,
    limit: number,
  ) {
    await this.repository.scheme(this.repository.database, org, schemeId);
    if (parentId) {
      const parent = await this.repository.segment(
        this.repository.database,
        org,
        parentId,
      );
      if (parent.schemeId !== schemeId)
        throw new BadRequestException("Padre de otro esquema.");
    }
    const result = await this.repository.database.query<Segment>(
      `SELECT ${segmentColumns} FROM segments g WHERE g.scheme_id=$1 AND g.parent_segment_id IS NOT DISTINCT FROM $2::uuid AND ($3::uuid IS NULL OR g.id>$3) ORDER BY g.id LIMIT $4`,
      [schemeId, parentId, cursor, limit + 1],
    );
    return {
      items: result.rows.slice(0, limit),
      nextCursor:
        result.rows.length > limit ? result.rows[limit - 1]!.id : null,
    };
  }
  async ancestors(org: string, id: string) {
    await this.repository.segment(this.repository.database, org, id);
    return (
      await this.repository.database.query<{
        id: string;
        name: string;
        levelId: string;
        depth: number;
      }>(
        `WITH RECURSIVE chain AS(SELECT id,parent_segment_id,name,level_id,0 depth FROM segments WHERE id=$1 UNION ALL SELECT s.id,s.parent_segment_id,s.name,s.level_id,c.depth+1 FROM segments s JOIN chain c ON s.id=c.parent_segment_id) SELECT id,name,level_id "levelId",depth FROM chain WHERE depth>0 ORDER BY depth DESC`,
        [id],
      )
    ).rows;
  }
  async activeScheme(tx: DatabaseQuery, org: string, id: string) {
    const scheme = await this.repository.scheme(tx, org, id, true);
    if (scheme.status !== "active")
      throw new ConflictException("El esquema está archivado.");
    return scheme;
  }
  validateMetadata(
    level: Pick<Level, "configuration">,
    metadata: Record<string, unknown>,
  ) {
    const config = configuration.parse(level.configuration);
    const fields = config.metadataFields ?? [];
    if (
      config.allowAdditional === false &&
      Object.keys(metadata).some((key) => !fields.some((f) => f.key === key))
    )
      throw new BadRequestException("Metadata no definida en el nivel.");
    for (const field of fields) {
      const value = metadata[field.key];
      if (value === undefined || value === null || value === "") {
        if (field.required)
          throw new BadRequestException(`Metadata obligatoria: ${field.label}`);
        continue;
      }
      const valid =
        field.type === "number"
          ? typeof value === "number" && Number.isFinite(value)
          : field.type === "boolean"
            ? typeof value === "boolean"
            : field.type === "date"
              ? typeof value === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(value) &&
                !Number.isNaN(Date.parse(value))
              : typeof value === "string";
      if (!valid)
        throw new BadRequestException(
          `Tipo de metadata inválido: ${field.label}`,
        );
    }
  }
  private async validateParent(
    tx: DatabaseQuery,
    org: string,
    schemeId: string,
    parentId: string | null,
    position: number,
  ) {
    if (!parentId) return;
    const parent = await this.repository.segment(tx, org, parentId);
    const parentLevel = (await this.repository.levels(tx, schemeId)).find(
      (l) => l.id === parent.levelId,
    );
    if (
      parent.schemeId !== schemeId ||
      parent.status !== "active" ||
      !parentLevel ||
      parentLevel.position >= position
    )
      throw new BadRequestException(
        "El padre debe ser un segmento activo del mismo esquema y de un nivel anterior.",
      );
  }
}
