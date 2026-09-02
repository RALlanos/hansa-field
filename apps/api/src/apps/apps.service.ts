import { ConflictException, Inject, Injectable } from "@nestjs/common";

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
  createdAt: string;
}>;

type AppRow = Readonly<{
  id: string;
  code: string;
  name: string;
  allowed_geometries: AllowedGeometry[];
  created_at: Date;
}>;

function mapRow(row: AppRow): AppSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    allowedGeometries: row.allowed_geometries,
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
      SELECT id, code, name, allowed_geometries, created_at
      FROM app_definitions ORDER BY name ASC
    `);
    return result.rows.map(mapRow);
  }

  async create(input: CreateAppInput): Promise<AppSummary> {
    try {
      const result = await this.database.query<AppRow>(
        `INSERT INTO app_definitions (code, name, allowed_geometries)
         VALUES ($1, $2, $3)
         RETURNING id, code, name, allowed_geometries, created_at`,
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
}
