import { ConflictException, Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";

export type Project = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
  appIds: string[];
  createdAt: string;
}>;
type ProjectRow = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
  app_ids: string[];
  created_at: Date;
}>;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(): Promise<Project[]> {
    const result = await this.database.query<ProjectRow>(`
      SELECT project.id, project.code, project.name, project.description,
        COALESCE(array_agg(link.app_id) FILTER (WHERE link.app_id IS NOT NULL), '{}') AS app_ids,
        project.created_at
      FROM projects project
      LEFT JOIN project_apps link ON link.project_id = project.id
      GROUP BY project.id ORDER BY project.name
    `);
    return result.rows.map(mapRow);
  }

  async create(input: {
    code: string;
    name: string;
    description: string;
    appIds: string[];
  }) {
    try {
      return await this.database.withTransaction(async (transaction) => {
        const project = await transaction.query<ProjectRow>(
          `INSERT INTO projects (code, name, description) VALUES ($1, $2, $3)
           RETURNING id, code, name, description, '{}'::uuid[] AS app_ids, created_at`,
          [input.code, input.name, input.description],
        );
        const row = project.rows[0];
        if (!row)
          throw new Error("Database did not return the created project.");
        if (input.appIds.length) {
          await transaction.query(
            `INSERT INTO project_apps (project_id, app_id)
             SELECT $1, unnest($2::uuid[])`,
            [row.id, input.appIds],
          );
        }
        return mapRow({ ...row, app_ids: input.appIds });
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
          code: "PROJECT_APP_NOT_FOUND",
          message: "Una App seleccionada ya no existe.",
        });
      }
      throw error;
    }
  }
}

function mapRow(row: ProjectRow): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    appIds: row.app_ids,
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
