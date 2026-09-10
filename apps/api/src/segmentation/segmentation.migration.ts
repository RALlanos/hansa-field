export const segmentationMigration = {
  id: "0002_segmentation",
  up: `
    CREATE TABLE segmentation_schemes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      app_id uuid, project_id uuid, name text NOT NULL CHECK(length(trim(name))>0),
      description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      configuration jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK(num_nonnulls(app_id,project_id)=1),
      FOREIGN KEY(app_id,organization_id) REFERENCES apps(id,organization_id),
      FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id)
    );
    CREATE INDEX segmentation_scheme_app_idx ON segmentation_schemes(app_id);
    CREATE INDEX segmentation_scheme_project_idx ON segmentation_schemes(project_id);
    CREATE TABLE segmentation_levels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scheme_id uuid NOT NULL REFERENCES segmentation_schemes(id),
      name text NOT NULL CHECK(length(trim(name))>0), position integer NOT NULL CHECK(position>0),
      status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')), configuration jsonb NOT NULL DEFAULT '{}',
      UNIQUE(id,scheme_id), UNIQUE(scheme_id,position) DEFERRABLE INITIALLY DEFERRED
    );
    CREATE TABLE segments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scheme_id uuid NOT NULL REFERENCES segmentation_schemes(id),
      level_id uuid NOT NULL, parent_segment_id uuid, name text NOT NULL CHECK(length(trim(name))>0),
      code text, external_id text, description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      metadata jsonb NOT NULL DEFAULT '{}', geometry geometry(Geometry,4326),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(id,scheme_id), FOREIGN KEY(level_id,scheme_id) REFERENCES segmentation_levels(id,scheme_id),
      FOREIGN KEY(parent_segment_id,scheme_id) REFERENCES segments(id,scheme_id),
      CHECK(parent_segment_id IS DISTINCT FROM id), CHECK(geometry IS NULL OR ST_IsValid(geometry))
    );
    CREATE UNIQUE INDEX segment_sibling_name_unique ON segments(scheme_id,level_id,COALESCE(parent_segment_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));
    CREATE INDEX segment_parent_idx ON segments(scheme_id,parent_segment_id,id);
    CREATE INDEX segment_level_idx ON segments(level_id);
    CREATE INDEX segment_geometry_idx ON segments USING gist(geometry);
    CREATE TABLE segment_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), segment_id uuid NOT NULL REFERENCES segments(id),
      record_id uuid REFERENCES records(id), project_record_id uuid REFERENCES project_records(id),
      created_at timestamptz NOT NULL DEFAULT now(), CHECK(num_nonnulls(record_id,project_record_id)=1)
    );
    CREATE UNIQUE INDEX segment_record_unique ON segment_memberships(segment_id,record_id) WHERE record_id IS NOT NULL;
    CREATE UNIQUE INDEX segment_project_record_unique ON segment_memberships(segment_id,project_record_id) WHERE project_record_id IS NOT NULL;
    CREATE INDEX segment_membership_record_idx ON segment_memberships(record_id);
    CREATE INDEX segment_membership_project_record_idx ON segment_memberships(project_record_id);
    CREATE TABLE segment_access (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), segment_id uuid NOT NULL REFERENCES segments(id),
      principal_type text NOT NULL CHECK(principal_type IN ('user','role')), principal_id text NOT NULL CHECK(length(trim(principal_id))>0),
      permission text NOT NULL CHECK(permission IN ('view','edit','manage')), include_descendants boolean NOT NULL DEFAULT true,
      UNIQUE(segment_id,principal_type,principal_id,permission)
    );
    CREATE INDEX segment_access_principal_idx ON segment_access(principal_type,principal_id);
    CREATE FUNCTION enforce_segment_membership_scope() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE context segmentation_schemes;
    BEGIN
      SELECT s.* INTO context FROM segmentation_schemes s JOIN segments g ON g.scheme_id=s.id WHERE g.id=NEW.segment_id;
      IF context.app_id IS NOT NULL THEN
        IF NEW.project_record_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM records r JOIN datasets d ON d.id=r.dataset_id WHERE r.id=NEW.record_id AND d.app_id=context.app_id AND r.organization_id=context.organization_id) THEN
          RAISE EXCEPTION 'Membership does not belong to the App' USING ERRCODE='23514'; END IF;
      ELSE
        IF NEW.record_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM project_records pr WHERE pr.id=NEW.project_record_id AND pr.project_id=context.project_id AND pr.organization_id=context.organization_id AND pr.status='active') THEN
          RAISE EXCEPTION 'Membership does not belong to the Project' USING ERRCODE='23514'; END IF;
      END IF; RETURN NEW;
    END $$;
    CREATE TRIGGER segment_membership_scope BEFORE INSERT OR UPDATE ON segment_memberships FOR EACH ROW EXECUTE FUNCTION enforce_segment_membership_scope();
  `,
  down: `DROP TABLE segment_access,segment_memberships,segments,segmentation_levels,segmentation_schemes; DROP FUNCTION enforce_segment_membership_scope();`,
} as const;
