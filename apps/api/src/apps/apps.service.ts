import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";

export type AllowedGeometry = "Point" | "LineString" | "Polygon";

export type CreateAppInput = Readonly<{
  code: string;
  name: string;
  allowedGeometries: AllowedGeometry[];
}>;

export type AppSummary = Readonly<{
  id: string;
  code: string;
  name: string;
  allowedGeometries: AllowedGeometry[];
  description: string;
  mapIcon: "pin" | "post" | "cable" | "node" | "building";
  mapColor: string;
  createdAt: string;
}>;
export type UpdateAppSettingsInput = Readonly<{
  description: string;
  mapIcon: AppSummary["mapIcon"];
  mapColor: string;
}>;

export type AppSchema = Readonly<{ sections: unknown[] }>;
export type AppVersion = Readonly<{
  id: string;
  version: number;
  schema: AppSchema;
  createdAt: string;
}>;

type AppRow = Readonly<{
  id: string;
  code: string;
  name: string;
  allowed_geometries: AllowedGeometry[];
  description: string;
  map_icon: AppSummary["mapIcon"];
  map_color: string;
  created_at: Date;
}>;

function mapRow(row: AppRow): AppSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    allowedGeometries: row.allowed_geometries,
    description: row.description,
    mapIcon: row.map_icon,
    mapColor: row.map_color,
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class AppsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseQuery,
  ) {}

  async list(): Promise<AppSummary[]> {
    const result = await this.database.query<AppRow>(`
      SELECT id, code, name, allowed_geometries, description, map_icon, map_color, created_at
      FROM app_definitions ORDER BY name ASC
    `);
    return result.rows.map(mapRow);
  }

  async get(appId: string): Promise<AppSummary> {
    const result = await this.database.query<AppRow>(
      `SELECT id, code, name, allowed_geometries, description, map_icon, map_color, created_at
       FROM app_definitions WHERE id = $1`,
      [appId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "APP_NOT_FOUND",
        message: "La App solicitada no existe.",
      });
    }
    return mapRow(row);
  }

  async create(input: CreateAppInput): Promise<AppSummary> {
    try {
      const result = await this.database.query<AppRow>(
        `WITH created_app AS (
           INSERT INTO app_definitions (code, name, allowed_geometries)
           VALUES ($1, $2, $3)
           RETURNING id, code, name, allowed_geometries, description, map_icon, map_color, created_at
         ), created_version AS (
           INSERT INTO app_versions (app_id, version, schema_definition)
           SELECT id, 1, '{"sections": []}'::jsonb FROM created_app
         )
         SELECT id, code, name, allowed_geometries, description, map_icon, map_color, created_at
         FROM created_app`,
        [input.code, input.name, input.allowedGeometries],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Database did not return the created App.");
      return mapRow(row);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ConflictException({
          code: "APP_CODE_CONFLICT",
          message: "El código de App ya existe.",
        });
      }
      throw error;
    }
  }

  async updateSettings(
    appId: string,
    input: UpdateAppSettingsInput,
  ): Promise<AppSummary> {
    const result = await this.database.query<AppRow>(
      `UPDATE app_definitions
       SET description = $2, map_icon = $3, map_color = $4, updated_at = now()
       WHERE id = $1
       RETURNING id, code, name, allowed_geometries, description, map_icon, map_color, created_at`,
      [appId, input.description, input.mapIcon, input.mapColor],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "APP_NOT_FOUND",
        message: "La App solicitada no existe.",
      });
    }
    return mapRow(row);
  }

  async createVersion(appId: string, schema: AppSchema): Promise<AppVersion> {
    const result = await this.database.query<{
      id: string;
      version: number;
      schema_definition: AppSchema;
      created_at: Date;
    }>(
      `INSERT INTO app_versions (app_id, version, schema_definition)
       VALUES ($1, COALESCE((SELECT MAX(version) + 1 FROM app_versions WHERE app_id = $1), 1), $2)
       RETURNING id, version, schema_definition, created_at`,
      [appId, schema],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Database did not return the App version.");
    return {
      id: row.id,
      version: row.version,
      schema: row.schema_definition,
      createdAt: row.created_at.toISOString(),
    };
  }

  async latestVersion(appId: string): Promise<AppVersion | null> {
    const result = await this.database.query<{
      id: string;
      version: number;
      schema_definition: AppSchema;
      created_at: Date;
    }>(
      `SELECT id, version, schema_definition, created_at
       FROM app_versions WHERE app_id = $1
       ORDER BY version DESC LIMIT 1`,
      [appId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      version: row.version,
      schema: row.schema_definition,
      createdAt: row.created_at.toISOString(),
    };
  }
}
