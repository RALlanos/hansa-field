import { describe, expect, it } from "vitest";

import {
  TIGO_HFC_FTTH_V1,
  classifySourceStatus,
  summarizeRouting,
} from "./routing-profile.js";

describe("TIGO_HFC_FTTH_V1", () => {
  it("routes overloaded and saturated taps to TAPS without changing the source status", () => {
    expect(classifySourceStatus(TIGO_HFC_FTTH_V1, "TAP SATURADO")).toEqual({
      appCode: "TAPS",
      sourceStatus: "TAP SATURADO",
    });
    expect(classifySourceStatus(TIGO_HFC_FTTH_V1, "TAP SOBRECARGADO")).toEqual({
      appCode: "TAPS",
      sourceStatus: "TAP SOBRECARGADO",
    });
  });

  it("normalizes NODO to the NODOS App", () => {
    expect(classifySourceStatus(TIGO_HFC_FTTH_V1, "NODO")).toEqual({
      appCode: "NODOS",
      sourceStatus: "NODO",
    });
  });

  it("reports unknown and empty classifier values instead of discarding them", () => {
    const summary = summarizeRouting(TIGO_HFC_FTTH_V1, [
      "POSTES",
      "desconocido",
      "",
    ]);

    expect(summary.apps).toEqual([{ appCode: "POSTES", count: 1 }]);
    expect(summary.unmapped).toEqual([
      { sourceStatus: "DESCONOCIDO", count: 1 },
      { sourceStatus: "(VACÍO)", count: 1 },
    ]);
  });
});
