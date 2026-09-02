import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("opens the Hansa Field home workspace", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Tu operación empieza en Aplicaciones",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir aplicaciones" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Usuario maestro")).toBeInTheDocument();
  });
});
