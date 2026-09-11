export const localOrganizationMigration = {
  id: "0003_local_organization",
  up: `
    INSERT INTO organizations(id,name)
    VALUES ('00000000-0000-4000-8000-000000000001','Hansa Field Local')
    ON CONFLICT (id) DO NOTHING;
  `,
  down: `
    DELETE FROM organizations
    WHERE id='00000000-0000-4000-8000-000000000001';
  `,
} as const;
