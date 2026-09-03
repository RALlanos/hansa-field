export type ImportRoutingProfile = Readonly<{
  code: string;
  version: number;
  classifierField: string;
  externalIdField: string;
  routes: Readonly<Record<string, string>>;
}>;

export type RoutingMatch = Readonly<{
  appCode: string;
  sourceStatus: string;
}>;

export const TIGO_HFC_FTTH_V1: ImportRoutingProfile = {
  code: "TIGO_HFC_FTTH_V1",
  version: 1,
  classifierField: "_status",
  externalIdField: "_record_id",
  routes: {
    POSTES: "POSTES",
    TAPS: "TAPS",
    "TAP SATURADO": "TAPS",
    "TAP SOBRECARGADO": "TAPS",
    DIVISORES: "DIVISORES",
    EDIFICIOS: "EDIFICIOS",
    AMPLIFICADORES: "AMPLIFICADORES",
    NODO: "NODOS",
    XBOX: "XBOX",
    MEC: "MEC",
  },
};

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function classifySourceStatus(
  profile: ImportRoutingProfile,
  value: unknown,
): RoutingMatch | null {
  const sourceStatus = normalizeStatus(value);
  const appCode = profile.routes[sourceStatus];
  return appCode ? { appCode, sourceStatus } : null;
}

export function summarizeRouting(
  profile: ImportRoutingProfile,
  statuses: readonly unknown[],
): Readonly<{
  apps: ReadonlyArray<Readonly<{ appCode: string; count: number }>>;
  unmapped: ReadonlyArray<Readonly<{ sourceStatus: string; count: number }>>;
}> {
  const apps = new Map<string, number>();
  const unmapped = new Map<string, number>();

  for (const value of statuses) {
    const match = classifySourceStatus(profile, value);
    if (match) {
      apps.set(match.appCode, (apps.get(match.appCode) ?? 0) + 1);
    } else {
      const sourceStatus = normalizeStatus(value) || "(VACÍO)";
      unmapped.set(sourceStatus, (unmapped.get(sourceStatus) ?? 0) + 1);
    }
  }

  return {
    apps: [...apps].map(([appCode, count]) => ({ appCode, count })),
    unmapped: [...unmapped].map(([sourceStatus, count]) => ({
      sourceStatus,
      count,
    })),
  };
}
