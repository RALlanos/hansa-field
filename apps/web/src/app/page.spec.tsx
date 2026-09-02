import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("presents the product and the first available workspace", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Hansa Field" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Apps" })).toHaveAttribute(
      "href",
      "/apps",
    );
    expect(screen.getByText("Proyectos")).toBeInTheDocument();
  });
});
