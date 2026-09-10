/** Clean pilot baseline. Activated by cutover only after HTTP consumers use Dataset contracts. */
export const pilotBaseline = {
  id: "0001_neutral_dataset_pilot",
  up: `
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE TABLE organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
    CREATE TABLE templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL);
    CREATE TABLE template_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES templates(id), version integer NOT NULL CHECK(version>0), schema_definition jsonb NOT NULL, UNIQUE(template_id,version), UNIQUE(template_id,id));
    CREATE TABLE apps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL, template_version_id uuid REFERENCES template_versions(id), UNIQUE(id,organization_id));
    CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL, UNIQUE(id,organization_id));
    CREATE TABLE datasets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL,
      app_id uuid UNIQUE, local_project_id uuid,
      CHECK((app_id IS NOT NULL)::int + (local_project_id IS NOT NULL)::int = 1),
      FOREIGN KEY(app_id,organization_id) REFERENCES apps(id,organization_id),
      FOREIGN KEY(local_project_id,organization_id) REFERENCES projects(id,organization_id),
      UNIQUE(id,organization_id), UNIQUE(id,app_id));
    CREATE TABLE dataset_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dataset_id uuid NOT NULL REFERENCES datasets(id), version integer NOT NULL CHECK(version>0), schema_definition jsonb NOT NULL, UNIQUE(dataset_id,version), UNIQUE(dataset_id,id));
    CREATE TABLE project_apps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL, app_id uuid NOT NULL, dataset_id uuid NOT NULL,
      FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id),
      FOREIGN KEY(dataset_id,organization_id) REFERENCES datasets(id,organization_id),
      FOREIGN KEY(dataset_id,app_id) REFERENCES datasets(id,app_id),
      UNIQUE(project_id,app_id), UNIQUE(id,project_id,dataset_id));
    CREATE TABLE project_app_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_app_id uuid NOT NULL REFERENCES project_apps(id), version integer NOT NULL CHECK(version>0), schema_definition jsonb NOT NULL, settings jsonb NOT NULL DEFAULT '{}', UNIQUE(project_app_id,version));
    CREATE TABLE app_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL);
    CREATE TABLE block_members(block_id uuid NOT NULL REFERENCES app_blocks(id), app_id uuid NOT NULL REFERENCES apps(id), dataset_version_id uuid NOT NULL REFERENCES dataset_versions(id), PRIMARY KEY(block_id,app_id));
    CREATE TABLE changesets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), operation_id uuid NOT NULL, actor text NOT NULL CHECK(length(actor)>0), operation text NOT NULL, request_hash text NOT NULL, response jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,operation_id));
    CREATE TABLE records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, dataset_id uuid NOT NULL, schema_version_id uuid NOT NULL,
      attributes jsonb NOT NULL DEFAULT '{}', geometry geometry(Geometry,4326), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
      visibility text NOT NULL DEFAULT 'restricted' CHECK(visibility IN ('restricted','published')), lifecycle text NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','archived')),
      origin jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY(dataset_id,organization_id) REFERENCES datasets(id,organization_id), FOREIGN KEY(dataset_id,schema_version_id) REFERENCES dataset_versions(dataset_id,id),
      CHECK(geometry IS NULL OR (GeometryType(geometry) IN ('POINT','LINESTRING','POLYGON') AND ST_IsValid(geometry))), UNIQUE(id,dataset_id), UNIQUE(id,organization_id));
    CREATE TABLE project_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL, project_app_id uuid, dataset_id uuid NOT NULL, record_id uuid NOT NULL,
      schema_definition jsonb NOT NULL, attributes_override jsonb NOT NULL DEFAULT '{}', project_attributes jsonb NOT NULL DEFAULT '{}', geometry_override geometry(Geometry,4326), display_geometry_override geometry(Geometry,4326),
      revision integer NOT NULL DEFAULT 1 CHECK(revision>0), status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')), updated_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id), FOREIGN KEY(record_id,organization_id) REFERENCES records(id,organization_id),
      FOREIGN KEY(record_id,dataset_id) REFERENCES records(id,dataset_id), FOREIGN KEY(project_app_id,project_id,dataset_id) REFERENCES project_apps(id,project_id,dataset_id),
      CHECK(geometry_override IS NULL OR (GeometryType(geometry_override) IN ('POINT','LINESTRING','POLYGON') AND ST_IsValid(geometry_override))),
      CHECK(display_geometry_override IS NULL OR (GeometryType(display_geometry_override) IN ('POINT','LINESTRING','POLYGON') AND ST_IsValid(display_geometry_override))));
    CREATE UNIQUE INDEX participation_active_unique ON project_records(project_id,record_id) WHERE status='active';
    CREATE TABLE record_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_id uuid NOT NULL REFERENCES records(id), project_record_id uuid REFERENCES project_records(id), changeset_id uuid NOT NULL REFERENCES changesets(id), operation text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE FUNCTION protect_record_origin() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.origin IS DISTINCT FROM OLD.origin THEN RAISE EXCEPTION 'Record origin is immutable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER immutable_origin BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION protect_record_origin();
    CREATE FUNCTION protect_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'History is append only'; END $$;
    CREATE TRIGGER append_only_events BEFORE UPDATE OR DELETE ON record_events FOR EACH ROW EXECUTE FUNCTION protect_history();
    CREATE INDEX record_geometry_gix ON records USING gist(geometry);
    CREATE INDEX record_dataset_cursor_idx ON records(dataset_id,updated_at,id);
    CREATE INDEX participation_project_cursor_idx ON project_records(project_id,updated_at,id) WHERE status='active';
    CREATE INDEX participation_record_idx ON project_records(record_id);
    CREATE INDEX participation_geometry_gix ON project_records USING gist(geometry_override);
    CREATE INDEX participation_display_gix ON project_records USING gist(display_geometry_override);
    CREATE INDEX record_events_record_idx ON record_events(record_id,created_at,id);
    CREATE TABLE import_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), filename text NOT NULL, checksum text NOT NULL, rows jsonb NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE import_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES import_jobs(id), record_id uuid NOT NULL REFERENCES records(id), project_record_id uuid REFERENCES project_records(id), external_id text, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TRIGGER append_only_import_sources BEFORE UPDATE OR DELETE ON import_sources FOR EACH ROW EXECUTE FUNCTION protect_history();
  `,
  down: `DROP TABLE IF EXISTS import_sources,import_jobs,record_events,project_records,records,changesets,block_members,app_blocks,project_app_versions,project_apps,dataset_versions,datasets,projects,apps,template_versions,templates,organizations;
    DROP FUNCTION IF EXISTS protect_record_origin(); DROP FUNCTION IF EXISTS protect_history();`,
} as const;
