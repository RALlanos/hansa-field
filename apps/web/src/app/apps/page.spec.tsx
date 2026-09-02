import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppsPage from "./page";

describe("AppsPage", () => {
  it("explains the empty state and offers the creation action", () => {
    render(<AppsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Apps" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay Apps")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear primera App" }),
    ).toBeDisabled();
  });
});
