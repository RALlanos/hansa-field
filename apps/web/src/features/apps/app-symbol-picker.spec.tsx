import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppSymbolPicker } from "./app-symbol-picker";

describe("AppSymbolPicker", () => {
  it("selects a visual symbol and updates the App color", () => {
    const onIconChange = vi.fn();
    const onColorChange = vi.fn();
    render(
      <AppSymbolPicker
        color="#b12029"
        icon="pin"
        onColorChange={onColorChange}
        onIconChange={onIconChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Torre de telecomunicaciones" }),
    );
    fireEvent.change(screen.getByLabelText("Seleccionar color de la App"), {
      target: { value: "#245b8f" },
    });

    expect(onIconChange).toHaveBeenCalledWith("tower");
    expect(onColorChange).toHaveBeenCalledWith("#245b8f");
    expect(screen.getAllByRole("button")).toHaveLength(20);
  });
});
