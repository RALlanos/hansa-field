import { ConflictException, NotFoundException } from "@nestjs/common";
import type {
  DatabaseQuery,
  TransactionalDatabase,
} from "../database/database.service.js";
import { datasetSchema, type DatasetSchema } from "./dataset-contracts.js";
import { assertFieldIdentity } from "../apps/field-identity.js";

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
      await tx.query(
        "INSERT INTO project_app_versions(project_app_id,version,schema_definition) VALUES($1,1,$2)",
        [id, dataset.rows[0].schema_definition],
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
}
