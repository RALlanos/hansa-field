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
];
