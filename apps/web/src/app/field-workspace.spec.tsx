import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldWorkspace } from "./field-workspace";

describe("FieldWorkspace", () => {
  it("provides a consistent Hansa Field home shell with Apps as the available module", () => {
    render(<FieldWorkspace />);

    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Gestiona tus aplicaciones de campo",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Apps/ })[0]).toHaveAttribute(
      "href",
      "/apps",
    );
    expect(screen.getByText("Proyectos").parentElement).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
