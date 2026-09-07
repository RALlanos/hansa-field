import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  DatabaseService,
  type TransactionalDatabase,
} from "../database/database.service.js";

export type Project = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
  projectApps: ReadonlyArray<
    Readonly<{ id: string; templateId: string; code: string; name: string }>
  >;
  createdAt: string;
}>;
type ProjectRow = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
  project_apps: Array<{
    id: string;
    templateId: string;
    code: string;
    name: string;
  }>;
  created_at: Date;
}>;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService) private readonly database: TransactionalDatabase,
  ) {}

  async list(): Promise<Project[]> {
    const result = await this.database.query<ProjectRow>(`
      SELECT project.id, project.code, project.name, project.description,
        COALESCE(jsonb_agg(jsonb_build_object(
          'id', link.id, 'templateId', app.id, 'code', app.code, 'name', app.name
        ) ORDER BY app.name) FILTER (WHERE link.id IS NOT NULL), '[]'::jsonb) AS project_apps,
        project.created_at
      FROM projects project
      LEFT JOIN project_apps link ON link.project_id = project.id
      LEFT JOIN app_definitions app ON app.id = link.app_id
      GROUP BY project.id ORDER BY project.name
    `);
    return result.rows.map(mapRow);
  }

  async create(input: {
    code: string;
    name: string;
    description: string;
    blockIds: string[];
  }) {
    try {
      return await this.database.withTransaction(async (transaction) => {
        const project = await transaction.query<ProjectRow>(
          `INSERT INTO projects (code, name, description) VALUES ($1, $2, $3)
           RETURNING id, code, name, description, '[]'::jsonb AS project_apps, created_at`,
          [input.code, input.name, input.description],
        );
        const row = project.rows[0];
        if (!row)
          throw new Error("Database did not return the created project.");
        if (input.blockIds.length) {
          const members = await transaction.query<{
            id: string;
            app_id: string;
            app_version_id: string;
          }>(
            `SELECT id, app_id, app_version_id FROM block_template_members
             WHERE block_id = ANY($1::uuid[])
               AND configuration->>'retired' IS DISTINCT FROM 'true' ORDER BY position`,
            [input.blockIds],
          );
          for (const member of members.rows) {
            const projectApp = await transaction.query<{ id: string }>(
              `INSERT INTO project_apps (
                 project_id, app_id, base_version_id, block_member_id
               ) VALUES ($1, $2, $3, $4)
               ON CONFLICT (project_id, app_id) DO NOTHING
               RETURNING id`,
              [row.id, member.app_id, member.app_version_id, member.id],
            );
            const projectAppId = projectApp.rows[0]?.id;
            if (!projectAppId) continue;
            await transaction.query(
              `INSERT INTO project_app_versions (
                 project_app_id, version, schema_definition
               )
               SELECT $1, 1, schema_definition FROM app_versions WHERE id = $2`,
              [projectAppId, member.app_version_id],
            );
          }
        }
        const projectApps = await transaction.query<ProjectRow>(
          `SELECT project.id, project.code, project.name, project.description,
             COALESCE(jsonb_agg(jsonb_build_object(
               'id', link.id, 'templateId', app.id, 'code', app.code, 'name', app.name
             ) ORDER BY app.name) FILTER (WHERE link.id IS NOT NULL), '[]'::jsonb) AS project_apps,
             project.created_at
           FROM projects project
           LEFT JOIN project_apps link ON link.project_id = project.id
           LEFT JOIN app_definitions app ON app.id = link.app_id
           WHERE project.id = $1 GROUP BY project.id`,
          [row.id],
        );
        const created = projectApps.rows[0];
        if (!created) throw new Error("No se crearon las Apps de Proyecto.");
        return mapRow(created);
      });
    } catch (error: unknown) {
      if (isDatabaseCode(error, "23505")) {
        throw new ConflictException({
          code: "PROJECT_CODE_CONFLICT",
          message: "El código de proyecto ya existe.",
        });
      }
      if (isDatabaseCode(error, "23503")) {
        throw new ConflictException({
          code: "PROJECT_BLOCK_NOT_FOUND",
          message: "Un Bloque seleccionado ya no existe.",
        });
      }
      throw error;
    }
  }

  async latestProjectAppVersion(projectAppId: string) {
    const result = await this.database.query<{
      id: string;
      version: number;
      schema_definition: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT id, version, schema_definition, created_at
       FROM project_app_versions WHERE project_app_id = $1
       ORDER BY version DESC LIMIT 1`,
      [projectAppId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "PROJECT_APP_NOT_FOUND",
        message: "La App de Proyecto no existe.",
      });
    }
    return {
      id: row.id,
      version: row.version,
      schema: row.schema_definition,
      createdAt: row.created_at.toISOString(),
    };
  }

  async createProjectAppVersion(
    projectAppId: string,
    schema: Record<string, unknown>,
  ) {
    return this.database.withTransaction(async (transaction) => {
      const app = await transaction.query<{ id: string }>(
        "SELECT id FROM project_apps WHERE id = $1 FOR UPDATE",
        [projectAppId],
      );
      if (!app.rows[0])
        throw new NotFoundException("La App de Proyecto no existe.");
      const result = await transaction.query<{
        id: string;
        version: number;
        schema_definition: Record<string, unknown>;
        created_at: Date;
      }>(
        `INSERT INTO project_app_versions (project_app_id, version, schema_definition)
       SELECT $1, COALESCE(MAX(version) + 1, 1), $2
       FROM project_app_versions WHERE project_app_id = $1
       RETURNING id, version, schema_definition, created_at`,
        [projectAppId, schema],
      );
      const row = result.rows[0];
      if (!row) {
        throw new NotFoundException({
          code: "PROJECT_APP_NOT_FOUND",
          message: "La App de Proyecto no existe.",
        });
      }
      return {
        id: row.id,
        version: row.version,
        schema: row.schema_definition,
        createdAt: row.created_at.toISOString(),
      };
    });
  }
}

function mapRow(row: ProjectRow): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    projectApps: row.project_apps,
    createdAt: row.created_at.toISOString(),
  };
}
function isDatabaseCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
