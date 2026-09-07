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

export type BlockMemberInput = Readonly<{
  appId: string;
  appVersionId: string;
}>;
export type CreateBlockInput = Readonly<{
  code: string;
  name: string;
  description: string;
  members: readonly BlockMemberInput[];
}>;
export type AppBlock = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
  members: ReadonlyArray<
    Readonly<{
      id: string;
      appId: string;
      appVersionId?: string;
      appCode: string;
      appName: string;
    }>
  >;
}>;

type BlockRow = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
}>;
type MemberRow = Readonly<{
  id: string;
  block_id: string;
  app_version_id: string;
  app_id: string;
  code: string;
  name: string;
}>;

@Injectable()
export class BlocksService {
  constructor(
    @Inject(DatabaseService) private readonly database: TransactionalDatabase,
  ) {}

  async list(): Promise<AppBlock[]> {
    const [blocks, members] = await Promise.all([
      this.database.query<BlockRow>(
        "SELECT id, code, name, description FROM app_blocks ORDER BY name",
      ),
      this.database.query<MemberRow>(
        `SELECT member.id, member.block_id, member.app_id, member.app_version_id, app.code, app.name
         FROM block_template_members member
         JOIN app_definitions app ON app.id = member.app_id
         WHERE member.configuration->>'retired' IS DISTINCT FROM 'true'
         ORDER BY member.position, app.name`,
      ),
    ]);
    return blocks.rows.map((block) => ({
      id: block.id,
      code: block.code,
      name: block.name,
      description: block.description,
      members: members.rows
        .filter((member) => member.block_id === block.id)
        .map((member) => ({
          id: member.id,
          appId: member.app_id,
          appVersionId: member.app_version_id,
          appCode: member.code,
          appName: member.name,
        })),
    }));
  }

  async create(input: CreateBlockInput): Promise<AppBlock> {
    try {
      return await this.database.withTransaction(async (transaction) => {
        const block = await transaction.query<BlockRow>(
          `INSERT INTO app_blocks (code, name, description)
           VALUES ($1, $2, $3) RETURNING id, code, name, description`,
          [input.code, input.name, input.description],
        );
        const created = block.rows[0];
        if (!created) throw new Error("No se creó el bloque.");
        const members: Array<{
          id: string;
          appId: string;
          appCode: string;
          appName: string;
        }> = [];
        for (const [position, member] of input.members.entries()) {
          const inserted = await transaction.query<MemberRow>(
            `INSERT INTO block_template_members (
               block_id, app_id, app_version_id, position
             )
             SELECT $1, version.app_id, version.id, $4
             FROM app_versions version WHERE version.id = $2 AND version.app_id = $3
             RETURNING id, block_id, app_id,
               (SELECT code FROM app_definitions WHERE id = app_id) AS code,
               (SELECT name FROM app_definitions WHERE id = app_id) AS name`,
            [created.id, member.appVersionId, member.appId, position],
          );
          const row = inserted.rows[0];
          if (!row) {
            throw new ConflictException({
              code: "BLOCK_MEMBER_VERSION_MISMATCH",
              message:
                "La versión seleccionada no pertenece a la Plantilla Madre.",
            });
          }
          members.push({
            id: row.id,
            appId: row.app_id,
            appCode: row.code,
            appName: row.name,
          });
        }
        return { ...created, members };
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: "BLOCK_CONFLICT",
          message:
            "El código del bloque o una de sus Plantillas está repetido.",
        });
      }
      throw error;
    }
  }

  async update(blockId: string, input: CreateBlockInput): Promise<AppBlock> {
    try {
      return await this.database.withTransaction(async (transaction) => {
        const block = await transaction.query<BlockRow>(
          `UPDATE app_blocks SET code = $2, name = $3, description = $4, updated_at = now()
           WHERE id = $1 RETURNING id, code, name, description`,
          [blockId, input.code, input.name, input.description],
        );
        const updated = block.rows[0];
        if (!updated) {
          throw new NotFoundException({
            code: "BLOCK_NOT_FOUND",
            message: "El Cajón solicitado no existe.",
          });
        }
        await transaction.query(
          `UPDATE block_template_members
           SET configuration = configuration || '{"retired":true}'::jsonb
           WHERE block_id = $1`,
          [blockId],
        );
        const members: Array<{
          id: string;
          appId: string;
          appCode: string;
          appName: string;
        }> = [];
        for (const [position, member] of input.members.entries()) {
          const inserted = await transaction.query<MemberRow>(
            `INSERT INTO block_template_members (block_id, app_id, app_version_id, position)
             SELECT $1, version.app_id, version.id, $4
             FROM app_versions version WHERE version.id = $2 AND version.app_id = $3
             ON CONFLICT (block_id, app_id) DO UPDATE
             SET app_version_id = EXCLUDED.app_version_id, position = EXCLUDED.position,
                 configuration = block_template_members.configuration - 'retired'
             RETURNING id, block_id, app_id,
               (SELECT code FROM app_definitions WHERE id = app_id) AS code,
               (SELECT name FROM app_definitions WHERE id = app_id) AS name`,
            [blockId, member.appVersionId, member.appId, position],
          );
          const row = inserted.rows[0];
          if (!row) {
            throw new ConflictException({
              code: "BLOCK_MEMBER_VERSION_MISMATCH",
              message: "La versión seleccionada no pertenece a la App maestra.",
            });
          }
          members.push({
            id: row.id,
            appId: row.app_id,
            appCode: row.code,
            appName: row.name,
          });
        }
        return { ...updated, members };
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: "BLOCK_CONFLICT",
          message: "El código del Cajón o una App está repetido.",
        });
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
