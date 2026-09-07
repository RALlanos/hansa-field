import { describe, expect, it } from "vitest";

import { resolveEffectiveRecord } from "./effective-record.js";

describe("resolveEffectiveRecord", () => {
  it("keeps canonical values immutable while applying one project context", () => {
    const canonical = { material: "Madera", empresa: "DELAPAZ" };
    const result = resolveEffectiveRecord({
      canonicalAttributes: canonical,
      attributesOverride: { material: "Pedazo de árbol" },
      projectAttributes: { luminaria: "LED" },
      canonicalGeometry: { type: "Point", coordinates: [-68.15, -16.5] },
      geometryOverride: null,
      displayGeometryOverride: null,
    });

    expect(result.attributes).toEqual({
      material: "Pedazo de árbol",
      empresa: "DELAPAZ",
      luminaria: "LED",
    });
    expect(canonical).toEqual({ material: "Madera", empresa: "DELAPAZ" });
    expect(result.geometry).toEqual({
      type: "Point",
      coordinates: [-68.15, -16.5],
    });
  });

  it("resolves geometry and display geometry independently", () => {
    const result = resolveEffectiveRecord({
      canonicalAttributes: {},
      attributesOverride: {},
      projectAttributes: {},
      canonicalGeometry: { type: "Point", coordinates: [-68.15, -16.5] },
      geometryOverride: { type: "Point", coordinates: [-68.14, -16.49] },
      displayGeometryOverride: { type: "Point", coordinates: [-68.13, -16.48] },
    });
    expect(result.geometry).toEqual({
      type: "Point",
      coordinates: [-68.14, -16.49],
    });
    expect(result.displayGeometry).toEqual({
      type: "Point",
      coordinates: [-68.13, -16.48],
    });
  });
});
