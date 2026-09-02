import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldWorkspace } from "./field-workspace";

describe("FieldWorkspace", () => {
  it("provides a consistent Hansa Field home shell with Apps as the available module", () => {
    render(<FieldWorkspace />);

    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Tu operación empieza en Aplicaciones",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir aplicaciones" }),
    ).toHaveAttribute("href", "/apps");
    expect(screen.getByText("Proyectos").parentElement).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
