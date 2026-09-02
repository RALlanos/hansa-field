import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";
import type { GeoJsonGeometry } from "../records/records.service.js";

export type TransferFeature = Readonly<{
  id?: string | undefined;
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown>;
}>;
export type ImportPreview = Readonly<{
  total: number;
  creates: number;
  updates: number;
  errors: ReadonlyArray<Readonly<{ index: number; message: string }>>;
  features: TransferFeature[];
}>;

type AppContractRow = Readonly<{
  version_id: string;
  allowed_geometries: string[];
}>;

@Injectable()
export class TransfersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async preview(
    appId: string,
    features: TransferFeature[],
  ): Promise<ImportPreview> {
    const contract = await this.loadContract(this.database, appId);
    const suppliedIds = features.flatMap((feature) =>
      feature.id ? [feature.id] : [],
    );
    const existing = suppliedIds.length
      ? await this.database.query<{ id: string }>(
          `SELECT id FROM records WHERE app_id = $1 AND id = ANY($2::uuid[])`,
          [appId, suppliedIds],
        )
      : { rows: [] };
    const existingIds = new Set(existing.rows.map((row) => row.id));
    const errors: Array<{ index: number; message: string }> = [];
    const seen = new Set<string>();

    features.forEach((feature, index) => {
      if (feature.id && seen.has(feature.id)) {
        errors.push({ index, message: "El UUID está repetido en el archivo." });
      }
      if (feature.id) seen.add(feature.id);
      if (feature.id && !existingIds.has(feature.id)) {
        errors.push({
          index,
          message: "El UUID suministrado no existe en esta App.",
        });
      }
      if (
        feature.geometry &&
        !contract.allowed_geometries.includes(feature.geometry.type)
      ) {
        errors.push({
          index,
          message: `La geometría ${feature.geometry.type} no está habilitada en la App.`,
        });
      }
    });

    return {
      total: features.length,
      creates: features.filter((feature) => !feature.id).length,
      updates: features.filter(
        (feature) => feature.id && existingIds.has(feature.id),
      ).length,
      errors,
      features,
    };
  }

  async confirm(appId: string, features: TransferFeature[]) {
    const preview = await this.preview(appId, features);
    if (preview.errors.length) {
      throw new UnprocessableEntityException({
        code: "IMPORT_HAS_ERRORS",
        message: "Corrige los errores antes de confirmar la importación.",
        details: preview.errors,
      });
    }

    return this.database.withTransaction(async (transaction) => {
      const contract = await this.loadContract(transaction, appId);
      for (const feature of features) {
        if (feature.id) {
          await transaction.query(
            `UPDATE records SET attributes = $3,
               geometry = CASE WHEN $4::jsonb IS NULL THEN NULL
                 ELSE ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) END,
               updated_at = now()
             WHERE app_id = $1 AND id = $2`,
            [appId, feature.id, feature.properties, feature.geometry],
          );
        } else {
          await transaction.query(
            `INSERT INTO records (app_id, app_version_id, attributes, geometry)
             VALUES ($1, $2, $3, CASE WHEN $4::jsonb IS NULL THEN NULL
               ELSE ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) END)`,
            [appId, contract.version_id, feature.properties, feature.geometry],
          );
        }
      }
      return {
        created: preview.creates,
        updated: preview.updates,
        failed: 0,
      };
    });
  }

  async exportGeoJson(appId: string, limit: number) {
    const app = await this.database.query<{ id: string }>(
      `SELECT id FROM app_definitions WHERE id = $1`,
      [appId],
    );
    if (!app.rows[0]) {
      throw new NotFoundException({
        code: "APP_NOT_FOUND",
        message: "La App solicitada no existe.",
      });
    }
    const result = await this.database.query<{
      id: string;
      geometry: GeoJsonGeometry | null;
      attributes: Record<string, unknown>;
      updated_at: Date;
    }>(
      `SELECT id, ST_AsGeoJSON(geometry)::jsonb AS geometry, attributes, updated_at
       FROM records WHERE app_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [appId, limit],
    );
    return {
      type: "FeatureCollection" as const,
      features: result.rows.map((row) => ({
        type: "Feature" as const,
        id: row.id,
        geometry: row.geometry,
        properties: {
          ...row.attributes,
          _updatedAt: row.updated_at.toISOString(),
        },
      })),
    };
  }

  private async loadContract(database: DatabaseQuery, appId: string) {
    const result = await database.query<AppContractRow>(
      `SELECT version.id AS version_id, app.allowed_geometries
       FROM app_definitions app
       JOIN LATERAL (
         SELECT id FROM app_versions WHERE app_id = app.id
         ORDER BY version DESC LIMIT 1
       ) version ON true
       WHERE app.id = $1`,
      [appId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "APP_VERSION_NOT_FOUND",
        message: "La App no existe o todavía no tiene un formulario guardado.",
      });
    }
    return row;
  }
}
