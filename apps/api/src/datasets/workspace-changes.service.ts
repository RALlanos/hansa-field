import { Inject, Injectable } from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";

export type WorkspaceChangesScope = Readonly<{
  mode: "app" | "project";
  appIds: readonly string[];
  projectIds: readonly string[];
  datasetIds: readonly string[];
}>;

export type WorkspaceChangesCursor = Readonly<{
  createdAt: string;
  eventId: string;
}>;

export type WorkspaceChange = Readonly<{
  entityType: "record" | "projectRecord";
  entityId: string;
  recordId: string;
  projectRecordId: string | null;
  revision: number;
  operation: "created" | "updated" | "archived";
  updatedAt: string;
}>;

type ChangeRow = Readonly<{
  event_id: string;
  created_at: string;
  source_operation: string;
  record_id: string;
  project_record_id: string | null;
  record_revision: number;
  project_revision: number | null;
}>;

function encodeCursor(cursor: WorkspaceChangesCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function eventOperation(source: string): WorkspaceChange["operation"] {
  if (source === "create" || source === "incorporate") return "created";
  if (source === "participation.remove") return "archived";
  return "updated";
}

/**
 * Small invalidation feed for a workspace scope. It deliberately returns
 * identities and revisions only: full records continue through their normal
 * scope/detail endpoints.
 */
@Injectable()
export class WorkspaceChangesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseQuery,
  ) {}

  async list(
    organizationId: string,
    scope: WorkspaceChangesScope,
    cursor: WorkspaceChangesCursor | null,
    limit: number,
  ): Promise<{
    changes: WorkspaceChange[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!cursor) {
      const latest = await this.latestCursor(organizationId, scope);
      return { changes: [], nextCursor: latest ? encodeCursor(latest) : null, hasMore: false };
    }

    const result = await this.database.query<ChangeRow>(
      this.sql(scope),
      [
        organizationId,
        scope.appIds.length ? scope.appIds : null,
        scope.projectIds.length ? scope.projectIds : null,
        scope.datasetIds.length ? scope.datasetIds : null,
        cursor.createdAt,
        cursor.eventId,
        limit + 1,
      ],
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    const last = rows.at(-1);
    return {
      changes: rows.map((row) => ({
        entityType: row.project_record_id ? "projectRecord" : "record",
        entityId: row.project_record_id ?? row.record_id,
        recordId: row.record_id,
        projectRecordId: row.project_record_id,
        revision: row.project_record_id
          ? (row.project_revision ?? row.record_revision)
          : row.record_revision,
        operation: eventOperation(row.source_operation),
        updatedAt: row.created_at,
      })),
      nextCursor: last
        ? encodeCursor({ createdAt: last.created_at, eventId: last.event_id })
        : encodeCursor(cursor),
      hasMore,
    };
  }

  private async latestCursor(
    organizationId: string,
    scope: WorkspaceChangesScope,
  ): Promise<WorkspaceChangesCursor | null> {
    const result = await this.database.query<Pick<ChangeRow, "event_id" | "created_at">>(
      `${this.scopeSql(scope)} ORDER BY e.created_at DESC,e.id DESC LIMIT 1`,
      [
        organizationId,
        scope.appIds.length ? scope.appIds : null,
        scope.projectIds.length ? scope.projectIds : null,
        scope.datasetIds.length ? scope.datasetIds : null,
      ],
    );
    const row = result.rows[0];
    return row ? { createdAt: row.created_at, eventId: row.event_id } : null;
  }

  private sql(scope: WorkspaceChangesScope): string {
    return `${this.scopeSql(scope)}
      AND (e.created_at,e.id) > ($5::timestamptz,$6::uuid)
      ORDER BY e.created_at,e.id LIMIT $7`;
  }

  private scopeSql(scope: WorkspaceChangesScope): string {
    const isProject = scope.mode === "project";
    return `SELECT e.id event_id,e.created_at,e.operation source_operation,e.record_id,e.project_record_id,
      r.revision record_revision,pr.revision project_revision
      FROM record_events e
      JOIN records r ON r.id=e.record_id AND r.organization_id=$1
      ${isProject ? "JOIN project_records pr ON pr.id=e.project_record_id AND pr.organization_id=$1" : "LEFT JOIN project_records pr ON pr.id=e.project_record_id AND pr.organization_id=$1"}
      JOIN datasets d ON d.id=r.dataset_id AND d.organization_id=$1
      WHERE r.organization_id=$1
        AND ($2::uuid[] IS NULL OR d.app_id=ANY($2))
        AND ($4::uuid[] IS NULL OR d.id=ANY($4))
        ${isProject
          ? "AND ($3::uuid[] IS NOT NULL AND pr.project_id=ANY($3))"
          : "AND e.project_record_id IS NULL AND ($3::uuid[] IS NULL OR $3::uuid[] IS NOT NULL)"}`;
  }
}
