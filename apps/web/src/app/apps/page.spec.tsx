import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppsPage from "./page";

describe("AppsPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers an enabled App creation action", () => {
    render(<AppsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Apps" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva App" })).toBeEnabled();
  });

  it("shows the saved symbol and color for every App", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "app-1",
                code: "TORRES",
                name: "Torres",
                allowedGeometries: ["Point"],
                mapIcon: "tower",
                mapColor: "#245b8f",
              },
            ],
          }),
      }),
    );

    render(<AppsPage />);

    const symbol = await screen.findByRole("img", {
      name: "Símbolo de Torres",
    });
    expect(symbol).toHaveStyle({ color: "#245b8f" });
    expect(symbol.querySelector("use")).toHaveAttribute(
      "href",
      "/map-symbols.svg#map-icon-tower",
    );
  });
});
