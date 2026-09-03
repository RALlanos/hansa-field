import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Param,
  Body,
  Query,
  Req,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { InvalidShapefileArchiveError } from "./shapefile-inspector.js";
import { ShapefileImportsService } from "./shapefile-imports.service.js";

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const scopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("standalone") }).strict(),
  z
    .object({ type: z.literal("project"), projectId: z.string().uuid() })
    .strict(),
  z.object({ type: z.literal("app"), appId: z.string().uuid() }).strict(),
]);
const selectionSchema = z
  .object({
    georeferenceConfirmed: z.literal(true),
    tableMappings: z
      .array(
        z
          .object({
            sourceStatus: z.string().trim().min(1).max(250),
            targetAppId: z.string().uuid().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    fieldMappings: z
      .array(
        z
          .object({
            targetAppId: z.string().uuid(),
            sourceField: z.string().trim().min(1).max(128),
            targetFieldKey: z
              .string()
              .regex(/^[a-z][a-z0-9_]{0,63}$/)
              .nullable(),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict();
const confirmationSchema = selectionSchema.extend({ confirm: z.literal(true) });

@Controller("imports/shapefile")
export class ShapefileImportsController {
  constructor(
    @Inject(ShapefileImportsService)
    private readonly imports: ShapefileImportsService,
  ) {}

  @Post("inspect")
  @HttpCode(200)
  async inspect(
    @Req() request: FastifyRequest,
    @Query("scope") requestedScope = "standalone",
    @Query("targetId") targetId?: string,
  ) {
    try {
      const scope = scopeSchema.safeParse(
        requestedScope === "project"
          ? { type: "project", projectId: targetId }
          : requestedScope === "app"
            ? { type: "app", appId: targetId }
            : { type: requestedScope },
      );
      if (!scope.success) {
        throw new InvalidShapefileArchiveError(
          "El contexto de importación no es válido.",
        );
      }
      const file = await request.file({
        limits: { files: 1, fileSize: MAX_ARCHIVE_BYTES, fields: 0, parts: 1 },
      });
      if (!file) {
        throw new InvalidShapefileArchiveError("Selecciona un archivo ZIP.");
      }
      const fileName = file.filename.trim();
      if (
        fileName.length > 255 ||
        fileName.includes("\0") ||
        !fileName.toLowerCase().endsWith(".zip")
      ) {
        throw new InvalidShapefileArchiveError(
          "El nombre del archivo ZIP no es válido.",
        );
      }
      const archive = await file.toBuffer();
      if (
        archive.length < 4 ||
        archive[0] !== 0x50 ||
        archive[1] !== 0x4b ||
        ![0x03, 0x05, 0x07].includes(archive[2] ?? -1)
      ) {
        throw new InvalidShapefileArchiveError(
          "El contenido recibido no es un ZIP válido.",
        );
      }
      return await this.imports.inspect(fileName, archive, scope.data);
    } catch (error: unknown) {
      if (error instanceof InvalidShapefileArchiveError) {
        throw new UnprocessableEntityException({
          code: "INVALID_SHAPEFILE_ARCHIVE",
          message: error.message,
        });
      }
      throw error;
    }
  }

  @Post(":jobId/plan")
  @HttpCode(200)
  async plan(@Param("jobId") jobId: string, @Body() body: unknown) {
    this.assertJobId(jobId);
    const selection = selectionSchema.safeParse(body);
    if (!selection.success) {
      throw new UnprocessableEntityException({
        code: "INVALID_IMPORT_SELECTION",
        message: "La selección de tablas o campos está incompleta.",
        details: selection.error.flatten(),
      });
    }
    return this.imports.plan(jobId, selection.data);
  }

  @Post(":jobId/confirm")
  async confirm(@Param("jobId") jobId: string, @Body() body: unknown) {
    this.assertJobId(jobId);
    const confirmation = confirmationSchema.safeParse(body);
    if (!confirmation.success) {
      throw new UnprocessableEntityException({
        code: "IMPORT_CONFIRMATION_REQUIRED",
        message: "Confirma explícitamente la importación después de revisarla.",
      });
    }
    return this.imports.confirm(jobId, confirmation.data);
  }

  private assertJobId(jobId: string): void {
    if (!z.string().uuid().safeParse(jobId).success) {
      throw new UnprocessableEntityException({
        code: "INVALID_IMPORT_JOB_ID",
        message: "El identificador del trabajo no es válido.",
      });
    }
  }
}
