import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Inject,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";
import { DatabaseService } from "../database/database.service.js";
import type { TransactionalDatabase } from "../database/database.service.js";
import { LOCAL_ORGANIZATION } from "./operational.controller.js";
import { templateInput } from "./template-contract.js";
import { assertFieldIdentity } from "../apps/field-identity.js";
@Controller("workspace/templates")
export class TemplatesController {
  constructor(
    @Inject(DatabaseService) private readonly db: TransactionalDatabase,
  ) {}
  @Get(":id") async get(@Param("id") id: string) {
    z.string().uuid().parse(id);
    const rows = await this.db.query(
      "SELECT t.id,t.name,v.version,v.schema_definition schema FROM templates t JOIN LATERAL(SELECT * FROM template_versions WHERE template_id=t.id ORDER BY version DESC LIMIT 1)v ON true WHERE t.id=$1 AND t.organization_id=$2",
      [id, LOCAL_ORGANIZATION],
    );
    if (!rows.rows[0]) throw new NotFoundException("Plantilla inexistente.");
    return rows.rows[0];
  }
  @Post() create(@Body() body: unknown) {
    return this.save(null, body);
  }
  @Post(":id/versions") version(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.save(z.string().uuid().parse(id), body);
  }
  private async save(id: string | null, body: unknown) {
    const input = templateInput.parse(body);
    const fields = input.schema.sections.flatMap((s) => s.fields);
    for (const field of fields) {
      if (
        field.visibility?.conditions.some(
          (c) =>
            c.fieldId === field.id || !fields.some((f) => f.id === c.fieldId),
        )
      )
        throw new UnprocessableEntityException(
          "Una regla referencia un campo inexistente o a sí mismo.",
        );
      if (
        (field.type === "singleChoice" || field.type === "multipleChoice") &&
        !field.options?.length
      )
        throw new UnprocessableEntityException(
          "Una selección necesita opciones.",
        );
    }
    return this.db.withTransaction(async (tx) => {
      let templateId = id;
      let version = 1;
      if (templateId) {
        const current = await tx.query(
          "SELECT id FROM templates WHERE id=$1 AND organization_id=$2 FOR UPDATE",
          [id, LOCAL_ORGANIZATION],
        );
        if (!current.rows.length) throw new NotFoundException();
        const history = await tx.query<{
          version: number;
          schema_definition: unknown;
        }>(
          "SELECT version,schema_definition FROM template_versions WHERE template_id=$1 ORDER BY version DESC",
          [id],
        );
        if (history.rows[0]?.version !== input.expectedVersion)
          throw new ConflictException("La plantilla cambió. Vuelve a abrirla.");
        assertFieldIdentity(
          history.rows.map((v) => v.schema_definition),
          input.schema,
        );
        version = history.rows[0]!.version + 1;
        await tx.query("UPDATE templates SET name=$2 WHERE id=$1", [
          id,
          input.name,
        ]);
      } else {
        assertFieldIdentity([], input.schema);
        const created = await tx.query<{ id: string }>(
          "INSERT INTO templates(organization_id,name) VALUES($1,$2) RETURNING id",
          [LOCAL_ORGANIZATION, input.name],
        );
        templateId = created.rows[0]!.id;
      }
      const result = await tx.query(
        "INSERT INTO template_versions(template_id,version,schema_definition) VALUES($1,$2,$3) RETURNING id",
        [templateId, version, input.schema],
      );
      return { id: templateId, version, versionId: result.rows[0]!.id };
    });
  }
}
