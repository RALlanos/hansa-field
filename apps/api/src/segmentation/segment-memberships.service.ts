import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import type { z } from "zod";
import { SegmentationService } from "./segmentation.service.js";
import type { membershipInput, accessInput } from "./segmentation.contracts.js";
@Injectable()
export class SegmentMembershipsService {
  constructor(
    @Inject(SegmentationService)
    private readonly segmentation: SegmentationService,
  ) {}
  async assign(
    org: string,
    segmentId: string,
    input: z.infer<typeof membershipInput>,
  ) {
    const repo = this.segmentation.repository;
    return repo.database.withTransaction(async (tx) => {
      const segment = await repo.segment(tx, org, segmentId);
      const scheme = await this.segmentation.activeScheme(
        tx,
        org,
        segment.schemeId,
      );
      const current = await repo.segment(tx, org, segmentId);
      if (current.status !== "active")
        throw new BadRequestException("Segmento archivado.");
      if (scheme.appId) {
        if (!input.recordId || input.projectRecordId)
          throw new BadRequestException(
            "Este esquema clasifica Records de App.",
          );
        const record = await tx.query(
          "SELECT r.id FROM records r JOIN datasets d ON d.id=r.dataset_id WHERE r.id=$1 AND d.app_id=$2 AND r.organization_id=$3 AND r.lifecycle='active'",
          [input.recordId, scheme.appId, org],
        );
        if (!record.rows.length)
          throw new BadRequestException("El Record no pertenece a esta App.");
      } else {
        if (!input.projectRecordId || input.recordId)
          throw new BadRequestException(
            "Este esquema clasifica participaciones del Proyecto.",
          );
        const participation = await tx.query(
          "SELECT id FROM project_records WHERE id=$1 AND project_id=$2 AND organization_id=$3 AND status='active' FOR SHARE",
          [input.projectRecordId, scheme.projectId, org],
        );
        if (!participation.rows.length)
          throw new BadRequestException(
            "La participación no está activa en este Proyecto.",
          );
      }
      await tx.query(
        "INSERT INTO segment_memberships(segment_id,record_id,project_record_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [segmentId, input.recordId ?? null, input.projectRecordId ?? null],
      );
      return { assigned: true };
    });
  }
  async remove(org: string, segmentId: string, id: string) {
    const repo = this.segmentation.repository;
    await repo.segment(repo.database, org, segmentId);
    await repo.database.query(
      "DELETE FROM segment_memberships WHERE id=$1 AND segment_id=$2",
      [id, segmentId],
    );
    return { removed: true };
  }
  async members(
    org: string,
    segmentId: string,
    descendants: boolean,
    cursor: string | null,
    limit: number,
  ) {
    const repo = this.segmentation.repository;
    await repo.segment(repo.database, org, segmentId);
    const result = await repo.database.query<{
      id: string;
      recordId: string | null;
      projectRecordId: string | null;
      segmentId: string;
      segmentName: string;
    }>(
      `WITH RECURSIVE branch AS(SELECT id FROM segments WHERE id=$1 AND status='active' UNION ALL SELECT child.id FROM segments child JOIN branch p ON child.parent_segment_id=p.id WHERE $2 AND child.status='active')
 SELECT m.id,m.record_id "recordId",m.project_record_id "projectRecordId",m.segment_id "segmentId",g.name "segmentName" FROM segment_memberships m JOIN branch b ON b.id=m.segment_id JOIN segments g ON g.id=m.segment_id JOIN segmentation_schemes s ON s.id=g.scheme_id
 LEFT JOIN records r ON r.id=m.record_id LEFT JOIN project_records pr ON pr.id=m.project_record_id
 WHERE s.status='active' AND (r.lifecycle='active' OR pr.status='active') AND ($3::uuid IS NULL OR m.id>$3) ORDER BY m.id LIMIT $4`,
      [segmentId, descendants, cursor, limit + 1],
    );
    return {
      items: result.rows.slice(0, limit),
      nextCursor:
        result.rows.length > limit ? result.rows[limit - 1]!.id : null,
    };
  }
  async forEntity(org: string, input: z.infer<typeof membershipInput>) {
    const repo = this.segmentation.repository;
    return (
      await repo.database.query(
        `WITH RECURSIVE chain AS (
 SELECT g.id,g.parent_segment_id,g.name,g.scheme_id,g.level_id,true direct FROM segment_memberships m JOIN segments g ON g.id=m.segment_id JOIN segmentation_schemes s ON s.id=g.scheme_id
 LEFT JOIN project_records pr ON pr.id=m.project_record_id
 WHERE s.organization_id=$1 AND s.status='active' AND g.status='active' AND (($2::uuid IS NOT NULL AND m.record_id=$2) OR ($3::uuid IS NOT NULL AND m.project_record_id=$3 AND pr.status='active'))
 UNION SELECT g.id,g.parent_segment_id,g.name,g.scheme_id,g.level_id,false FROM segments g JOIN chain c ON c.parent_segment_id=g.id WHERE g.status='active')
 SELECT id,parent_segment_id "parentSegmentId",name,scheme_id "schemeId",level_id "levelId",bool_or(direct) direct FROM chain GROUP BY id,parent_segment_id,name,scheme_id,level_id`,
        [org, input.recordId ?? null, input.projectRecordId ?? null],
      )
    ).rows;
  }
  async access(org: string, id: string) {
    const repo = this.segmentation.repository;
    await repo.segment(repo.database, org, id);
    return (
      await repo.database.query(
        `SELECT id,principal_type "principalType",principal_id "principalId",permission,include_descendants "includeDescendants" FROM segment_access WHERE segment_id=$1 ORDER BY principal_type,principal_id`,
        [id],
      )
    ).rows;
  }
  async grant(org: string, id: string, input: z.infer<typeof accessInput>) {
    const repo = this.segmentation.repository;
    return repo.database.withTransaction(async (tx) => {
      const segment = await repo.segment(tx, org, id);
      await this.segmentation.activeScheme(tx, org, segment.schemeId);
      await tx.query(
        "INSERT INTO segment_access(segment_id,principal_type,principal_id,permission,include_descendants) VALUES($1,$2,$3,$4,$5) ON CONFLICT(segment_id,principal_type,principal_id,permission) DO UPDATE SET include_descendants=EXCLUDED.include_descendants",
        [
          id,
          input.principalType,
          input.principalId,
          input.permission,
          input.includeDescendants,
        ],
      );
      return { saved: true };
    });
  }
  async revoke(org: string, id: string, accessId: string) {
    const repo = this.segmentation.repository;
    await repo.segment(repo.database, org, id);
    await repo.database.query(
      "DELETE FROM segment_access WHERE id=$1 AND segment_id=$2",
      [accessId, id],
    );
    return { removed: true };
  }
  async effectiveAccess(
    org: string,
    id: string,
    principalType: string,
    principalId: string,
  ) {
    const repo = this.segmentation.repository;
    await repo.segment(repo.database, org, id);
    return (
      await repo.database.query(
        `WITH RECURSIVE chain AS(SELECT id,parent_segment_id,0 depth FROM segments WHERE id=$1 UNION ALL SELECT s.id,s.parent_segment_id,c.depth+1 FROM segments s JOIN chain c ON s.id=c.parent_segment_id)
 SELECT a.permission,a.segment_id "segmentId",c.depth FROM segment_access a JOIN chain c ON c.id=a.segment_id WHERE a.principal_type=$2 AND a.principal_id=$3 AND (c.depth=0 OR a.include_descendants)`,
        [id, principalType, principalId],
      )
    ).rows;
  }
}
