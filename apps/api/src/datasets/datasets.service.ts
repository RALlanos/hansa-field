import { ConflictException, NotFoundException } from "@nestjs/common";
import type {
  DatabaseQuery,
  TransactionalDatabase,
} from "../database/database.service.js";
import { datasetSchema, type DatasetSchema } from "./dataset-contracts.js";
import { assertFieldIdentity } from "../apps/field-identity.js";
import type { BuilderInput } from "./template-contract.js";

export class DatasetsService {
  constructor(private readonly database: TransactionalDatabase) {}

  async createTemplate(
    organizationId: string,
    name: string,
    schema: DatasetSchema,
  ) {
    const valid = datasetSchema.parse(schema);
    return this.database.withTransaction(async (tx) => {
      const result = await tx.query<{ id: string }>(
        "INSERT INTO templates(organization_id,name) VALUES($1,$2) RETURNING id",
        [organizationId, name],
      );
      const id = result.rows[0]!.id;
      const version = await tx.query<{ id: string }>(
        "INSERT INTO template_versions(template_id,version,schema_definition) VALUES($1,1,$2) RETURNING id",
        [id, valid],
      );
      return { id, versionId: version.rows[0]!.id };
    });
  }

  async createApp(
    organizationId: string,
    name: string,
    templateVersionId?: string,
  ) {
    return this.database.withTransaction(async (tx) => {
      let schema: DatasetSchema = { sections: [] };
      if (templateVersionId) {
        const template = await tx.query<{ schema_definition: unknown }>(
          "SELECT v.schema_definition FROM template_versions v JOIN templates t ON t.id=v.template_id WHERE v.id=$1 AND t.organization_id=$2",
          [templateVersionId, organizationId],
        );
        if (!template.rows[0])
          throw new NotFoundException(
            "Template version not found in organization.",
          );
        schema = datasetSchema.parse(template.rows[0].schema_definition);
      }
      const app = await tx.query<{ id: string }>(
        "INSERT INTO apps(organization_id,name,template_version_id) VALUES($1,$2,$3) RETURNING id",
        [organizationId, name, templateVersionId ?? null],
      );
      const appId = app.rows[0]!.id;
      const dataset = await this.createDataset(
        tx,
        organizationId,
        name,
        { appId },
        schema,
      );
      return { appId, ...dataset };
    });
  }

  async createProject(organizationId: string, name: string) {
    const result = await this.database.query<{ id: string }>(
      "INSERT INTO projects(organization_id,name) VALUES($1,$2) RETURNING id",
      [organizationId, name],
    );
    return { projectId: result.rows[0]!.id };
  }

  async createLocalCollection(
    organizationId: string,
    projectId: string,
    name: string,
    schema: DatasetSchema,
  ) {
    return this.database.withTransaction((tx) =>
      this.createDataset(
        tx,
        organizationId,
        name,
        { projectId },
        datasetSchema.parse(schema),
      ),
    );
  }

  async relateApp(organizationId: string, projectId: string, appId: string) {
    return this.database.withTransaction(async (tx) => {
      const dataset = await tx.query<{
        id: string;
        schema_definition: unknown;
      }>(
        `SELECT d.id,v.schema_definition FROM datasets d JOIN LATERAL
        (SELECT schema_definition FROM dataset_versions WHERE dataset_id=d.id ORDER BY version DESC LIMIT 1) v ON true
        WHERE d.app_id=$1 AND d.organization_id=$2`,
        [appId, organizationId],
      );
      if (!dataset.rows[0])
        throw new NotFoundException("App dataset not found.");
      const result = await tx.query<{ id: string }>(
        "INSERT INTO project_apps(organization_id,project_id,app_id,dataset_id) VALUES($1,$2,$3,$4) RETURNING id",
        [organizationId, projectId, appId, dataset.rows[0].id],
      );
      const id = result.rows[0]!.id;
      const schema = datasetSchema.parse(dataset.rows[0].schema_definition);
      await tx.query(
        "INSERT INTO project_app_versions(project_app_id,version,schema_definition,settings) VALUES($1,1,$2,$3)",
        [id, schema, this.projectAppMapSettings(schema)],
      );
      return { projectAppId: id };
    });
  }

  async publishSchema(
    organizationId: string,
    datasetId: string,
    expectedVersion: number,
    schema: DatasetSchema,
  ) {
    const valid = datasetSchema.parse(schema);
    return this.database.withTransaction(async (tx) => {
      const dataset = await tx.query<{ id: string }>(
        "SELECT id FROM datasets WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [datasetId, organizationId],
      );
      if (!dataset.rows[0]) throw new NotFoundException("Dataset not found.");
      const versions = await tx.query<{
        version: number;
        schema_definition: unknown;
      }>(
        "SELECT version,schema_definition FROM dataset_versions WHERE dataset_id=$1 ORDER BY version DESC",
        [datasetId],
      );
      if (versions.rows[0]?.version !== expectedVersion)
        throw new ConflictException("Schema version changed.");
      assertFieldIdentity(
        versions.rows.map((row) => row.schema_definition),
        valid,
      );
      const result = await tx.query<{ id: string; version: number }>(
        "INSERT INTO dataset_versions(dataset_id,version,schema_definition) VALUES($1,$2,$3) RETURNING id,version",
        [datasetId, expectedVersion + 1, valid],
      );
      return result.rows[0]!;
    });
  }

  /**
   * An App owns its Dataset versions. Updating it never changes the template
   * that seeded it, nor Project Apps already derived from it.
   */
  async getAppBuilder(organizationId: string, appId: string) {
    const result = await this.database.query<{
      id: string;
      name: string;
      version: number;
      schema: unknown;
      template_id: string | null;
      template_name: string | null;
      template_version: number | null;
    }>(
      `SELECT a.id,a.name,dv.version,dv.schema_definition schema,
              t.id template_id,t.name template_name,tv.version template_version
       FROM apps a
       JOIN datasets d ON d.app_id=a.id
       JOIN LATERAL (
         SELECT version,schema_definition FROM dataset_versions
         WHERE dataset_id=d.id ORDER BY version DESC LIMIT 1
       ) dv ON true
       LEFT JOIN template_versions tv ON tv.id=a.template_version_id
       LEFT JOIN templates t ON t.id=tv.template_id
       WHERE a.id=$1 AND a.organization_id=$2`,
      [appId, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException("App inexistente.");
    const row = result.rows[0];
    return {
      name: row.name,
      version: row.version,
      schema: row.schema,
      baseTemplate: row.template_id
        ? {
            id: row.template_id,
            name: row.template_name ?? "Plantilla",
            version: row.template_version,
          }
        : null,
    };
  }

  async publishAppBuilder(
    organizationId: string,
    appId: string,
    input: BuilderInput,
  ) {
    const valid = datasetSchema.parse(input.schema);
    if (input.expectedVersion === undefined)
      throw new ConflictException("Falta la versión actual de la App.");
    const expectedVersion = input.expectedVersion;
    return this.database.withTransaction(async (tx) => {
      const app = await tx.query<{ dataset_id: string }>(
        `SELECT d.id dataset_id FROM apps a JOIN datasets d ON d.app_id=a.id
         WHERE a.id=$1 AND a.organization_id=$2 FOR UPDATE`,
        [appId, organizationId],
      );
      if (!app.rows[0]) throw new NotFoundException("App inexistente.");
      const versions = await tx.query<{
        version: number;
        schema_definition: unknown;
      }>(
        "SELECT version,schema_definition FROM dataset_versions WHERE dataset_id=$1 ORDER BY version DESC",
        [app.rows[0].dataset_id],
      );
      if (versions.rows[0]?.version !== expectedVersion)
        throw new ConflictException("La App cambió. Vuelve a abrirla.");
      assertFieldIdentity(
        versions.rows.map((row) => row.schema_definition),
        valid,
      );
      await tx.query("UPDATE apps SET name=$2 WHERE id=$1", [
        appId,
        input.name,
      ]);
      await tx.query("UPDATE datasets SET name=$2 WHERE id=$1", [
        app.rows[0].dataset_id,
        input.name,
      ]);
      const created = await tx.query<{ id: string; version: number }>(
        `INSERT INTO dataset_versions(dataset_id,version,schema_definition)
         VALUES($1,$2,$3) RETURNING id,version`,
        [app.rows[0].dataset_id, expectedVersion + 1, valid],
      );
      return created.rows[0]!;
    });
  }

  async getProjectAppBuilder(organizationId: string, projectAppId: string) {
    const result = await this.database.query<{
      app_name: string;
      project_name: string;
      version: number;
      schema: unknown;
      template_id: string | null;
      template_name: string | null;
      template_version: number | null;
    }>(
      `SELECT a.name app_name,p.name project_name,pav.version,
              pav.schema_definition schema,t.id template_id,t.name template_name,
              tv.version template_version
       FROM project_apps pa
       JOIN apps a ON a.id=pa.app_id
       JOIN projects p ON p.id=pa.project_id
       JOIN LATERAL (
         SELECT version,schema_definition FROM project_app_versions
         WHERE project_app_id=pa.id ORDER BY version DESC LIMIT 1
       ) pav ON true
       LEFT JOIN template_versions tv ON tv.id=a.template_version_id
       LEFT JOIN templates t ON t.id=tv.template_id
       WHERE pa.id=$1 AND pa.organization_id=$2`,
      [projectAppId, organizationId],
    );
    if (!result.rows[0])
      throw new NotFoundException("App de Proyecto inexistente.");
    const row = result.rows[0];
    return {
      name: row.app_name,
      projectName: row.project_name,
      version: row.version,
      schema: row.schema,
      baseTemplate: row.template_id
        ? {
            id: row.template_id,
            name: row.template_name ?? "Plantilla",
            version: row.template_version,
          }
        : null,
    };
  }

  async publishProjectAppBuilder(
    organizationId: string,
    projectAppId: string,
    input: BuilderInput,
  ) {
    const valid = datasetSchema.parse(input.schema);
    if (input.expectedVersion === undefined)
      throw new ConflictException(
        "Falta la versión actual de la App de Proyecto.",
      );
    const expectedVersion = input.expectedVersion;
    return this.database.withTransaction(async (tx) => {
      const current = await tx.query<{ id: string }>(
        "SELECT id FROM project_apps WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [projectAppId, organizationId],
      );
      if (!current.rows[0])
        throw new NotFoundException("App de Proyecto inexistente.");
      const versions = await tx.query<{
        version: number;
        schema_definition: unknown;
      }>(
        "SELECT version,schema_definition FROM project_app_versions WHERE project_app_id=$1 ORDER BY version DESC",
        [projectAppId],
      );
      if (versions.rows[0]?.version !== expectedVersion)
        throw new ConflictException(
          "La App de Proyecto cambió. Vuelve a abrirla.",
        );
      assertFieldIdentity(
        versions.rows.map((row) => row.schema_definition),
        valid,
      );
      const created = await tx.query<{ id: string; version: number }>(
        `INSERT INTO project_app_versions(project_app_id,version,schema_definition,settings)
         VALUES($1,$2,$3,$4) RETURNING id,version`,
        [
          projectAppId,
          expectedVersion + 1,
          valid,
          {
            symbol: {
              icon: input.schema.settings.mapIcon,
              color: input.schema.settings.mapColor,
              label: input.schema.settings.name,
            },
          },
        ],
      );
      return created.rows[0]!;
    });
  }

  private async createDataset(
    tx: DatabaseQuery,
    organizationId: string,
    name: string,
    owner: { appId: string } | { projectId: string },
    schema: DatasetSchema,
  ) {
    const result = await tx.query<{ id: string }>(
      "INSERT INTO datasets(organization_id,name,app_id,local_project_id) VALUES($1,$2,$3,$4) RETURNING id",
      [
        organizationId,
        name,
        "appId" in owner ? owner.appId : null,
        "projectId" in owner ? owner.projectId : null,
      ],
    );
    const datasetId = result.rows[0]!.id;
    const version = await tx.query<{ id: string }>(
      "INSERT INTO dataset_versions(dataset_id,version,schema_definition) VALUES($1,1,$2) RETURNING id",
      [datasetId, schema],
    );
    return { datasetId, schemaVersionId: version.rows[0]!.id };
  }

  private projectAppMapSettings(schema: DatasetSchema) {
    const settings = schema.settings;
    if (!settings || typeof settings !== "object") return {};
    const candidate = settings as {
      mapIcon?: unknown;
      mapColor?: unknown;
      name?: unknown;
    };
    if (
      typeof candidate.mapIcon !== "string" ||
      typeof candidate.mapColor !== "string"
    )
      return {};
    return {
      symbol: {
        icon: candidate.mapIcon,
        color: candidate.mapColor,
        ...(typeof candidate.name === "string"
          ? { label: candidate.name }
          : {}),
      },
    };
  }
}
