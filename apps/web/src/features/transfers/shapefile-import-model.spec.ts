import { describe, expect, it } from "vitest";

import {
  initialFieldMappings,
  initialTableMappings,
} from "./shapefile-import-model";

describe("Shapefile import mapping defaults", () => {
  it("suggests only Apps that already exist", () => {
    expect(
      initialTableMappings([
        { sourceStatus: "POSTES", count: 2, suggestedAppId: "app-1" },
        { sourceStatus: "DESCONOCIDO", count: 1, suggestedAppId: null },
      ]),
    ).toEqual({ POSTES: "app-1", DESCONOCIDO: null });
  });

  it("matches exact existing field keys and explicitly skips the rest", () => {
    expect(
      initialFieldMappings(
        [
          { sourceName: "hps", suggestedKey: "hps" },
          { sourceName: "marca", suggestedKey: "marca" },
        ],
        [{ id: "app-1", fields: [{ key: "hps" }] }],
      ),
    ).toEqual({ "app-1": { hps: "hps", marca: null } });
  });
});
