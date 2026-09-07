export interface Migration {
  id: string;
  up: string;
  down: string;
}

export const migrations: readonly Migration[] = [
  {
    id: "0001_project_app_foundation",
    up: `
      CREATE EXTENSION IF NOT EXISTS postgis;

      CREATE TABLE app_definitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
        name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
        description text NOT NULL DEFAULT '',
        allowed_geometries text[] NOT NULL CHECK (
          cardinality(allowed_geometries) > 0
          AND allowed_geometries <@ ARRAY['Point', 'LineString', 'Polygon']::text[]
        ),
        map_icon text NOT NULL DEFAULT 'pin' CHECK (map_icon IN (
          'pin', 'square', 'triangle', 'diamond', 'hexagon', 'home', 'building',
          'tower', 'mast', 'post', 'lamp-post', 'splice', 'electric', 'generator',
          'battery', 'satellite', 'node', 'olt', 'cable', 'cable-dashed'
        )),
        map_color text NOT NULL DEFAULT '#b12029' CHECK (map_color ~ '^#[0-9A-Fa-f]{6}$'),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE app_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE CASCADE,
        version integer NOT NULL CHECK (version > 0),
        schema_definition jsonb NOT NULL DEFAULT '{"sections": []}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (app_id, version), UNIQUE (app_id, id)
      );

      CREATE TABLE template_field_definitions (
        id uuid PRIMARY KEY,
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE CASCADE,
        technical_key text NOT NULL CHECK (technical_key ~ '^[a-z][a-z0-9_]{0,63}$'),
        field_type text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (app_id, technical_key), UNIQUE (app_id, id)
      );

      CREATE TABLE app_blocks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
        name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
        description text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE block_template_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        block_id uuid NOT NULL REFERENCES app_blocks(id) ON DELETE CASCADE,
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE RESTRICT,
        app_version_id uuid NOT NULL,
        configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
        position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
        UNIQUE (block_id, app_id),
        FOREIGN KEY (app_id, app_version_id) REFERENCES app_versions(app_id, id) ON DELETE RESTRICT
      );

      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
        name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
        description text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE project_apps (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE RESTRICT,
        base_version_id uuid NOT NULL,
        block_member_id uuid REFERENCES block_template_members(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (project_id, app_id), UNIQUE (id, app_id),
        FOREIGN KEY (app_id, base_version_id) REFERENCES app_versions(app_id, id) ON DELETE RESTRICT
      );

      CREATE TABLE project_app_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_app_id uuid NOT NULL REFERENCES project_apps(id) ON DELETE CASCADE,
        version integer NOT NULL CHECK (version > 0),
        schema_definition jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (project_app_id, version), UNIQUE (project_app_id, id)
      );

      CREATE TABLE project_app_field_definitions (
        id uuid PRIMARY KEY,
        project_app_id uuid NOT NULL REFERENCES project_apps(id) ON DELETE CASCADE,
        technical_key text NOT NULL CHECK (technical_key ~ '^[a-z][a-z0-9_]{0,63}$'),
        field_type text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (project_app_id, technical_key), UNIQUE (project_app_id, id)
      );

      CREATE TABLE records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE RESTRICT,
        app_version_id uuid NOT NULL,
        canonical_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
        geometry geometry(Geometry, 4326),
        origin_project_app_id uuid REFERENCES project_apps(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (app_id, app_version_id) REFERENCES app_versions(app_id, id) ON DELETE RESTRICT,
        CHECK (geometry IS NULL OR GeometryType(geometry) IN ('POINT', 'LINESTRING', 'POLYGON')),
        CHECK (geometry IS NULL OR ST_SRID(geometry) = 4326),
        CHECK (geometry IS NULL OR ST_IsValid(geometry))
      );

      CREATE TABLE project_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_app_id uuid NOT NULL REFERENCES project_apps(id) ON DELETE RESTRICT,
        record_id uuid NOT NULL REFERENCES records(id) ON DELETE RESTRICT,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
        attributes_override jsonb NOT NULL DEFAULT '{}'::jsonb,
        project_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
        geometry_override geometry(Geometry, 4326),
        display_geometry_override geometry(Geometry, 4326),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (geometry_override IS NULL OR GeometryType(geometry_override) IN ('POINT', 'LINESTRING', 'POLYGON')),
        CHECK (display_geometry_override IS NULL OR GeometryType(display_geometry_override) IN ('POINT', 'LINESTRING', 'POLYGON')),
        CHECK (geometry_override IS NULL OR ST_SRID(geometry_override) = 4326),
        CHECK (display_geometry_override IS NULL OR ST_SRID(display_geometry_override) = 4326)
      );

      CREATE TABLE import_profiles (
        code text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
        version integer NOT NULL CHECK (version > 0),
        configuration jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (code, version)
      );

      CREATE TABLE import_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_code text NOT NULL, profile_version integer NOT NULL,
        target_project_app_id uuid NOT NULL REFERENCES project_apps(id) ON DELETE RESTRICT,
        status text NOT NULL CHECK (status IN ('inspected', 'importing', 'completed', 'failed')),
        source_file_name text NOT NULL, source_layer text NOT NULL,
        source_checksum_sha256 text NOT NULL CHECK (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
        archive_path text NOT NULL, source_crs_wkt text NOT NULL, source_epsg integer,
        feature_count integer NOT NULL CHECK (feature_count > 0),
        summary jsonb NOT NULL, result jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
        FOREIGN KEY (profile_code, profile_version) REFERENCES import_profiles(code, version)
      );

      CREATE TABLE record_import_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        record_id uuid NOT NULL REFERENCES records(id) ON DELETE RESTRICT,
        project_record_id uuid NOT NULL REFERENCES project_records(id) ON DELETE RESTRICT,
        import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE RESTRICT,
        profile_code text NOT NULL, profile_version integer NOT NULL,
        source_record_id text NOT NULL, source_status text NOT NULL,
        source_file_name text NOT NULL, source_layer text NOT NULL, source_crs_wkt text NOT NULL,
        original_attributes jsonb NOT NULL, original_geometry jsonb NOT NULL,
        imported_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (profile_code, profile_version, source_record_id, project_record_id),
        FOREIGN KEY (profile_code, profile_version) REFERENCES import_profiles(code, version)
      );

      CREATE INDEX records_geometry_gix ON records USING gist (geometry);
      CREATE INDEX records_canonical_attributes_gin ON records USING gin (canonical_attributes);
      CREATE INDEX records_app_updated_idx ON records (app_id, updated_at DESC);
      CREATE INDEX project_records_active_app_updated_idx ON project_records (project_app_id, updated_at DESC) WHERE status = 'active';
      CREATE UNIQUE INDEX project_records_one_active_participation_idx
        ON project_records (project_app_id, record_id) WHERE status = 'active';
      CREATE INDEX project_records_geometry_override_gix ON project_records USING gist (geometry_override);
      CREATE INDEX project_records_display_geometry_override_gix ON project_records USING gist (display_geometry_override);
      CREATE INDEX project_apps_project_idx ON project_apps (project_id);
      CREATE INDEX block_template_members_block_idx ON block_template_members (block_id, position);
      CREATE INDEX record_import_sources_job_idx ON record_import_sources (import_job_id);

      INSERT INTO import_profiles (code, version, configuration) VALUES (
        'TIGO_HFC_FTTH_V1', 1,
        '{"classifierField":"_status","externalIdField":"_record_id","routes":{"POSTES":"POSTES","TAPS":"TAPS","TAP SATURADO":"TAPS","TAP SOBRECARGADO":"TAPS","DIVISORES":"DIVISORES","EDIFICIOS":"EDIFICIOS","AMPLIFICADORES":"AMPLIFICADORES","NODO":"NODOS","XBOX":"XBOX","MEC":"MEC"}}'::jsonb
      );
    `,
    down: `
      DROP TABLE IF EXISTS record_import_sources;
      DROP TABLE IF EXISTS import_jobs;
      DROP TABLE IF EXISTS import_profiles;
      DROP TABLE IF EXISTS project_records;
      DROP TABLE IF EXISTS records;
      DROP TABLE IF EXISTS project_app_field_definitions;
      DROP TABLE IF EXISTS project_app_versions;
      DROP TABLE IF EXISTS project_apps;
      DROP TABLE IF EXISTS projects;
      DROP TABLE IF EXISTS block_template_members;
      DROP TABLE IF EXISTS app_blocks;
      DROP TABLE IF EXISTS template_field_definitions;
      DROP TABLE IF EXISTS app_versions;
      DROP TABLE IF EXISTS app_definitions;
    `,
  },
];
