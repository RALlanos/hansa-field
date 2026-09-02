import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppsPage from "./page";

describe("AppsPage", () => {
  it("offers an enabled App creation action", () => {
    render(<AppsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Apps" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva App" })).toBeEnabled();
  });
});
