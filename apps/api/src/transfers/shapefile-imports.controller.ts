import {
  Controller,
  HttpCode,
  Inject,
  Post,
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
      if (!fileName.toLowerCase().endsWith(".zip")) {
        throw new InvalidShapefileArchiveError(
          "El archivo debe tener extensión .zip.",
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
}
