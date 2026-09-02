import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldWorkspace } from "./field-workspace";

describe("FieldWorkspace", () => {
  it("provides the master user with navigation, filters, map and record list", () => {
    render(<FieldWorkspace />);

    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Registros" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nuevo registro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Mapa de registros" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Lista de registros" }),
    ).toBeInTheDocument();
  });
});
