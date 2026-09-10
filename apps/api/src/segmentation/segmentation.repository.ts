import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  DatabaseService,
  type DatabaseQuery,
  type TransactionalDatabase,
} from "../database/database.service.js";
import type { Scheme, Level, Segment } from "./segmentation.contracts.js";
export const schemeColumns = `id,app_id "appId",project_id "projectId",name,description,status,configuration,revision`;
export const levelColumns = `id,scheme_id "schemeId",name,position,status,configuration`;
export const segmentColumns = `g.id,g.scheme_id "schemeId",g.level_id "levelId",g.parent_segment_id "parentSegmentId",g.name,g.code,g.external_id "externalId",g.description,g.status,g.metadata,ST_AsGeoJSON(g.geometry)::jsonb geometry,EXISTS(SELECT 1 FROM segments child WHERE child.parent_segment_id=g.id) "hasChildren"`;
@Injectable()
export class SegmentationRepository {
  constructor(
    @Inject(DatabaseService) readonly database: TransactionalDatabase,
  ) {}
  async scheme(
    tx: DatabaseQuery,
    org: string,
    id: string,
    lock = false,
  ): Promise<Scheme> {
    const result = await tx.query<Scheme>(
      `SELECT ${schemeColumns} FROM segmentation_schemes WHERE id=$1 AND organization_id=$2 ${lock ? "FOR UPDATE" : ""}`,
      [id, org],
    );
    if (!result.rows[0])
      throw new NotFoundException("Esquema de Segmentación inexistente.");
    return result.rows[0];
  }
  async levels(tx: DatabaseQuery, id: string): Promise<Level[]> {
    return (
      await tx.query<Level>(
        `SELECT ${levelColumns} FROM segmentation_levels WHERE scheme_id=$1 ORDER BY position`,
        [id],
      )
    ).rows;
  }
  async segment(tx: DatabaseQuery, org: string, id: string): Promise<Segment> {
    const rows = await tx.query<Segment>(
      `SELECT ${segmentColumns} FROM segments g JOIN segmentation_schemes s ON s.id=g.scheme_id WHERE g.id=$1 AND s.organization_id=$2`,
      [id, org],
    );
    if (!rows.rows[0]) throw new NotFoundException("Segmento inexistente.");
    return rows.rows[0];
  }
  async touch(tx: DatabaseQuery, id: string) {
    await tx.query(
      "UPDATE segmentation_schemes SET revision=revision+1,updated_at=now() WHERE id=$1",
      [id],
    );
  }
}
