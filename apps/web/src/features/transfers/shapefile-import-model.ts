export type SourceTable = Readonly<{
  sourceStatus: string;
  count: number;
  suggestedAppId: string | null;
}>;
export type SourceField = Readonly<{
  sourceName: string;
  suggestedKey: string;
}>;
export type AvailableApp = Readonly<{
  id: string;
  fields: ReadonlyArray<Readonly<{ key: string }>>;
}>;

export function initialTableMappings(
  tables: readonly SourceTable[],
): Record<string, string | null> {
  return Object.fromEntries(
    tables.map((table) => [table.sourceStatus, table.suggestedAppId]),
  );
}

export function initialFieldMappings(
  fields: readonly SourceField[],
  apps: readonly AvailableApp[],
): Record<string, Record<string, string | null>> {
  return Object.fromEntries(
    apps.map((app) => [
      app.id,
      Object.fromEntries(
        fields.map((field) => [
          field.sourceName,
          app.fields.some((target) => target.key === field.suggestedKey)
            ? field.suggestedKey
            : null,
        ]),
      ),
    ]),
  );
}
