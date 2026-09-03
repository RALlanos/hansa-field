import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MAP_ICON_OPTIONS,
  MapSymbol,
  mapIconMarkerHtml,
  mapLineDashArray,
} from "./map-symbols";

describe("map symbol catalog", () => {
  it("offers exactly 20 distinct visual symbols and preserves legacy values", () => {
    const ids = MAP_ICON_OPTIONS.map(({ id }) => id);

    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    expect(ids).toEqual(
      expect.arrayContaining(["pin", "post", "cable", "node", "building"]),
    );
  });

  it("renders the selected monochrome symbol with its App color", () => {
    const { container } = render(
      <MapSymbol color="#245b8f" icon="tower" label="Símbolo seleccionado" />,
    );

    expect(container.querySelector("svg")).toHaveStyle({ color: "#245b8f" });
    expect(container.querySelector("use")).toHaveAttribute(
      "href",
      "/map-symbols.svg#map-icon-tower",
    );
  });

  it("builds safe Leaflet markers and only dashes the dashed-line symbol", () => {
    expect(mapIconMarkerHtml("tower", "#245b8f")).toContain(
      "/map-symbols.svg#map-icon-tower",
    );
    expect(mapIconMarkerHtml("not-valid", "red;display:none")).toContain(
      "/map-symbols.svg#map-icon-pin",
    );
    expect(mapIconMarkerHtml("not-valid", "red;display:none")).not.toContain(
      "display:none",
    );
    expect(mapLineDashArray("cable-dashed")).toBe("8 6");
    expect(mapLineDashArray("cable")).toBeUndefined();
  });
});
