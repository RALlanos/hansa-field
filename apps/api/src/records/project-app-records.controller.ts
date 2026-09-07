import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { ProjectRecordsCoreService } from "./project-records-core.service.js";
import { geometrySchema } from "./record-input.js";

const uuid = z.string().uuid();
const attributes = z.record(z.string(), z.unknown());
const geometry = geometrySchema.nullable();

@Controller("project-apps/:projectAppId/records")
export class ProjectAppRecordsController {
  constructor(
    @Inject(ProjectRecordsCoreService)
    private readonly records: ProjectRecordsCoreService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("projectAppId") projectAppId: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        canonicalAttributes: attributes,
        geometry,
        projectAttributes: attributes.optional(),
      })
      .strict()
      .safeParse(body);
    if (!uuid.safeParse(projectAppId).success || !parsed.success) {
      throw new UnprocessableEntityException({
        code: "INVALID_PROJECT_RECORD",
        message: "El registro de Proyecto no es válido.",
      });
    }
    return this.records.create(projectAppId, {
      canonicalAttributes: parsed.data.canonicalAttributes,
      geometry: parsed.data.geometry,
      ...(parsed.data.projectAttributes === undefined
        ? {}
        : { projectAttributes: parsed.data.projectAttributes }),
    });
  }

  @Post("incorporate")
  @HttpCode(HttpStatus.CREATED)
  async incorporate(
    @Param("projectAppId") projectAppId: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        recordId: uuid,
        attributesOverride: attributes.default({}),
        projectAttributes: attributes.default({}),
        geometryOverride: geometry.optional(),
        displayGeometryOverride: geometry.optional(),
      })
      .strict()
      .safeParse(body);
    if (!uuid.safeParse(projectAppId).success || !parsed.success) {
      throw new UnprocessableEntityException({
        code: "INVALID_INCORPORATION",
        message: "La incorporación no es válida.",
      });
    }
    const { recordId, geometryOverride, displayGeometryOverride, ...values } =
      parsed.data;
    return this.records.incorporate(projectAppId, recordId, {
      ...values,
      ...(geometryOverride === undefined ? {} : { geometryOverride }),
      ...(displayGeometryOverride === undefined
        ? {}
        : { displayGeometryOverride }),
    });
  }

  @Patch(":projectRecordId")
  async update(
    @Param("projectAppId") projectAppId: string,
    @Param("projectRecordId") projectRecordId: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        attributesOverride: attributes.default({}),
        projectAttributes: attributes.default({}),
        geometryOverride: geometry.optional(),
        displayGeometryOverride: geometry.optional(),
      })
      .strict()
      .safeParse(body);
    if (
      !uuid.safeParse(projectAppId).success ||
      !uuid.safeParse(projectRecordId).success ||
      !parsed.success
    )
      throw new UnprocessableEntityException({
        code: "INVALID_PROJECT_RECORD",
        message: "La edición no es válida.",
      });
    const { geometryOverride, displayGeometryOverride, ...values } =
      parsed.data;
    return this.records.update(projectAppId, projectRecordId, {
      ...values,
      ...(geometryOverride === undefined ? {} : { geometryOverride }),
      ...(displayGeometryOverride === undefined
        ? {}
        : { displayGeometryOverride }),
    });
  }

  @Delete(":projectRecordId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("projectAppId") projectAppId: string,
    @Param("projectRecordId") projectRecordId: string,
  ) {
    if (
      !uuid.safeParse(projectAppId).success ||
      !uuid.safeParse(projectRecordId).success
    ) {
      throw new UnprocessableEntityException({
        code: "INVALID_PROJECT_RECORD",
        message: "La participación no es válida.",
      });
    }
    await this.records.remove(projectAppId, projectRecordId);
  }
}
