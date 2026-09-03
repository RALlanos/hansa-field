export interface Migration {
  id: string;
  up: string;
  down: string;
}

export const migrations: readonly Migration[] = [
  {
    id: "0001_foundation",
    up: `
      CREATE EXTENSION IF NOT EXISTS postgis;

      CREATE TABLE app_definitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
        name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
        allowed_geometries text[] NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT app_definitions_allowed_geometries_check CHECK (
          cardinality(allowed_geometries) > 0
          AND allowed_geometries <@ ARRAY['Point', 'LineString', 'Polygon']::text[]
        )
      );

      CREATE TABLE app_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE CASCADE,
        version integer NOT NULL CHECK (version > 0),
        schema_definition jsonb NOT NULL DEFAULT '{"fields": []}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (app_id, version),
        UNIQUE (app_id, id)
      );

      CREATE TABLE records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE CASCADE,
        app_version_id uuid NOT NULL,
        attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
        geometry geometry(Geometry, 4326) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT records_app_version_fk FOREIGN KEY (app_id, app_version_id)
          REFERENCES app_versions(app_id, id),
        CONSTRAINT records_geometry_type_check CHECK (
          GeometryType(geometry) IN ('POINT', 'LINESTRING', 'POLYGON')
        ),
        CONSTRAINT records_geometry_srid_check CHECK (ST_SRID(geometry) = 4326),
        CONSTRAINT records_geometry_valid_check CHECK (ST_IsValid(geometry))
      );

      CREATE INDEX records_geometry_gix ON records USING gist (geometry);
      CREATE INDEX records_attributes_gin ON records USING gin (attributes);
      CREATE INDEX records_app_id_idx ON records (app_id);
    `,
    down: `
      DROP TABLE IF EXISTS records;
      DROP TABLE IF EXISTS app_versions;
      DROP TABLE IF EXISTS app_definitions;
    `,
  },
  {
    id: "0002_app_visual_settings",
    up: `
      ALTER TABLE app_definitions
        ADD COLUMN description text NOT NULL DEFAULT '',
        ADD COLUMN map_icon text NOT NULL DEFAULT 'pin',
        ADD COLUMN map_color text NOT NULL DEFAULT '#b12029',
        ADD CONSTRAINT app_definitions_map_icon_check
          CHECK (map_icon IN ('pin', 'post', 'cable', 'node', 'building')),
        ADD CONSTRAINT app_definitions_map_color_check
          CHECK (map_color ~ '^#[0-9A-Fa-f]{6}$');
    `,
    down: `
      ALTER TABLE app_definitions
        DROP CONSTRAINT IF EXISTS app_definitions_map_color_check,
        DROP CONSTRAINT IF EXISTS app_definitions_map_icon_check,
        DROP COLUMN IF EXISTS map_color,
        DROP COLUMN IF EXISTS map_icon,
        DROP COLUMN IF EXISTS description;
    `,
  },
  {
    id: "0003_optional_record_geometry",
    up: `ALTER TABLE records ALTER COLUMN geometry DROP NOT NULL;`,
    down: `
      DELETE FROM records WHERE geometry IS NULL;
      ALTER TABLE records ALTER COLUMN geometry SET NOT NULL;
    `,
  },
  {
    id: "0004_projects",
    up: `
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
        name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
        description text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE project_apps (
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        app_id uuid NOT NULL REFERENCES app_definitions(id) ON DELETE RESTRICT,
        PRIMARY KEY (project_id, app_id)
      );
      CREATE INDEX project_apps_app_id_idx ON project_apps (app_id);
    `,
    down: `
      DROP TABLE IF EXISTS project_apps;
      DROP TABLE IF EXISTS projects;
    `,
  },
  {
    id: "0005_initial_app_versions",
    up: `
      INSERT INTO app_versions (app_id, version, schema_definition)
      SELECT app.id, 1, '{"sections": []}'::jsonb
      FROM app_definitions app
      WHERE NOT EXISTS (
        SELECT 1 FROM app_versions version WHERE version.app_id = app.id
      );
    `,
    down: `
      DELETE FROM app_versions version
      WHERE version.version = 1
        AND version.schema_definition = '{"sections": []}'::jsonb
        AND NOT EXISTS (
          SELECT 1 FROM records record WHERE record.app_version_id = version.id
        );
    `,
  },
  {
    id: "0006_gis_import_jobs",
    up: `
      CREATE TABLE import_profiles (
        code text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
        version integer NOT NULL CHECK (version > 0),
        configuration jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (code, version)
      );

      INSERT INTO import_profiles (code, version, configuration) VALUES (
        'TIGO_HFC_FTTH_V1',
        1,
        '{
          "classifierField": "_status",
          "externalIdField": "_record_id",
          "routes": {
            "POSTES": "POSTES",
            "TAPS": "TAPS",
            "TAP SATURADO": "TAPS",
            "TAP SOBRECARGADO": "TAPS",
            "DIVISORES": "DIVISORES",
            "EDIFICIOS": "EDIFICIOS",
            "AMPLIFICADORES": "AMPLIFICADORES",
            "NODO": "NODOS",
            "XBOX": "XBOX",
            "MEC": "MEC"
          }
        }'::jsonb
      );

      CREATE TABLE import_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_code text NOT NULL,
        profile_version integer NOT NULL,
        project_id uuid REFERENCES projects(id) ON DELETE RESTRICT,
        status text NOT NULL CHECK (status IN ('inspected', 'importing', 'completed', 'failed')),
        source_file_name text NOT NULL,
        source_layer text NOT NULL,
        source_checksum_sha256 text NOT NULL CHECK (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
        archive_path text NOT NULL,
        source_crs_wkt text NOT NULL,
        source_epsg integer,
        feature_count integer NOT NULL CHECK (feature_count > 0),
        summary jsonb NOT NULL,
        result jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        FOREIGN KEY (profile_code, profile_version)
          REFERENCES import_profiles(code, version)
      );

      CREATE TABLE record_import_sources (
        record_id uuid PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,
        profile_code text NOT NULL,
        profile_version integer NOT NULL,
        source_record_id text NOT NULL,
        source_status text NOT NULL,
        import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE RESTRICT,
        source_file_name text NOT NULL,
        source_layer text NOT NULL,
        source_crs_wkt text NOT NULL,
        original_attributes jsonb NOT NULL,
        original_geometry jsonb NOT NULL,
        imported_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (profile_code, profile_version, source_record_id),
        FOREIGN KEY (profile_code, profile_version)
          REFERENCES import_profiles(code, version)
      );

      CREATE INDEX import_jobs_project_idx ON import_jobs (project_id, created_at DESC);
      CREATE INDEX record_import_sources_job_idx ON record_import_sources (import_job_id);
    `,
    down: `
      DROP TABLE IF EXISTS record_import_sources;
      DROP TABLE IF EXISTS import_jobs;
      DROP TABLE IF EXISTS import_profiles;
    `,
  },
  {
    id: "0007_import_job_scope",
    up: `
      ALTER TABLE import_jobs
        ADD COLUMN IF NOT EXISTS import_scope text NOT NULL DEFAULT 'standalone',
        ADD COLUMN IF NOT EXISTS target_app_id uuid REFERENCES app_definitions(id) ON DELETE RESTRICT;

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'import_jobs'::regclass
            AND conname = 'import_jobs_import_scope_value_check'
        ) THEN
          ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_import_scope_value_check
            CHECK (import_scope IN ('standalone', 'project', 'app'));
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'import_jobs'::regclass
            AND conname = 'import_jobs_scope_target_check'
        ) THEN
          ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_scope_target_check CHECK (
            (import_scope = 'standalone' AND project_id IS NULL AND target_app_id IS NULL)
            OR (import_scope = 'project' AND project_id IS NOT NULL AND target_app_id IS NULL)
            OR (import_scope = 'app' AND project_id IS NULL AND target_app_id IS NOT NULL)
          );
        END IF;
      END $$;
    `,
    down: `
      ALTER TABLE import_jobs
        DROP CONSTRAINT IF EXISTS import_jobs_scope_target_check,
        DROP CONSTRAINT IF EXISTS import_jobs_import_scope_value_check,
        DROP COLUMN IF EXISTS target_app_id,
        DROP COLUMN IF EXISTS import_scope;
    `,
  },
  {
    id: "0008_app_map_symbol_catalog",
    up: `
      ALTER TABLE app_definitions
        DROP CONSTRAINT IF EXISTS app_definitions_map_icon_check,
        ADD CONSTRAINT app_definitions_map_icon_check CHECK (
          map_icon IN (
            'pin', 'square', 'triangle', 'diamond', 'hexagon',
            'home', 'building', 'tower', 'mast', 'post',
            'lamp-post', 'splice', 'electric', 'generator', 'battery',
            'satellite', 'node', 'olt', 'cable', 'cable-dashed'
          )
        );
    `,
    down: `
      UPDATE app_definitions
      SET map_icon = 'pin'
      WHERE map_icon NOT IN ('pin', 'post', 'cable', 'node', 'building');

      ALTER TABLE app_definitions
        DROP CONSTRAINT IF EXISTS app_definitions_map_icon_check,
        ADD CONSTRAINT app_definitions_map_icon_check
          CHECK (map_icon IN ('pin', 'post', 'cable', 'node', 'building'));
    `,
  },
];
