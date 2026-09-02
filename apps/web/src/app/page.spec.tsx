import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("opens the master record workspace", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Registros" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nuevo registro" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Usuario maestro")).toBeInTheDocument();
  });
});
