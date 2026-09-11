import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";
import RecordsPage from "./records/page";
import MapPage from "./map/page";
import ImportPage from "./import/page";
import SegmentationPage from "./segmentation/page";
import AppsPage from "./apps/page";
import ProjectsPage from "./projects/page";
import BlocksPage from "./blocks/page";
import TemplatesPage from "./templates/page";

describe("HomePage", () => {
  it("opens the Hansa Field home workspace", () => {
    render(<HomePage />);

    expect(screen.getByText("Hansa Field")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apps" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Templates" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Proyectos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registros" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Apps" }),
    ).toBeInTheDocument();
  });

  it("navigates to different sections when clicking sidebar buttons", async () => {
    render(<HomePage />);

    const btnProyectos = screen.getByRole("button", { name: "Proyectos" });
    fireEvent.click(btnProyectos);
    expect(
      screen.getByRole("heading", { level: 1, name: "Proyectos" }),
    ).toBeInTheDocument();

    const btnCajones = screen.getByRole("button", { name: "Cajones" });
    fireEvent.click(btnCajones);
    expect(
      screen.getByRole("heading", { level: 1, name: "Cajones" }),
    ).toBeInTheDocument();

    const btnTemplates = screen.getByRole("button", { name: "Templates" });
    fireEvent.click(btnTemplates);
    expect(
      screen.getByRole("heading", { level: 1, name: "Templates" }),
    ).toBeInTheDocument();

    const btnRegistros = screen.getByRole("button", { name: "Registros" });
    fireEvent.click(btnRegistros);
    expect(screen.getByText("Registros en el área")).toBeInTheDocument();

    const btnImportar = screen.getAllByRole("button", { name: "Importar" })[0];
    fireEvent.click(btnImportar);
    expect(
      screen.getByRole("heading", { level: 1, name: "Importar Datos GIS" }),
    ).toBeInTheDocument();

    const btnMapa = screen.getByRole("button", { name: "Mapa Universal" });
    fireEvent.click(btnMapa);
    expect(
      screen.getByRole("heading", { level: 1, name: "Mapa Universal" }),
    ).toBeInTheDocument();

    const btnApps = screen.getByRole("button", { name: "Apps" });
    fireEvent.click(btnApps);
    expect(
      screen.getByRole("heading", { level: 1, name: "Apps" }),
    ).toBeInTheDocument();
  });

  it("handles in-page button clicks: view modes, create modals, and navigation", async () => {
    render(<HomePage />);

    // Go to Registros
    const btnRegistros = screen.getByRole("button", { name: "Registros" });
    fireEvent.click(btnRegistros);

    // Click View mode buttons
    const btnTabla = screen.getByRole("button", { name: "Tabla" });
    fireEvent.click(btnTabla);

    const btnDividido = screen.getByRole("button", { name: "Dividido" });
    fireEvent.click(btnDividido);

    const btnMapaView = screen.getByRole("button", { name: "Mapa" });
    fireEvent.click(btnMapaView);

    // Open New Record Modal
    const btnNuevo = screen.getByRole("button", { name: /Nuevo registro/i });
    fireEvent.click(btnNuevo);
    expect(
      screen.getByRole("heading", { name: /Crear Nuevo Registro/i }),
    ).toBeInTheDocument();

    // Close Modal
    const btnCerrar = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(btnCerrar);
    expect(
      screen.queryByRole("heading", { name: /Crear Nuevo Registro/i }),
    ).not.toBeInTheDocument();
  });

  it("renders dedicated route pages directly with their initial section", () => {
    const { unmount: u1 } = render(<RecordsPage />);
    expect(screen.getByText("Registros en el área")).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<MapPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Mapa Universal" }),
    ).toBeInTheDocument();
    u2();

    const { unmount: u3 } = render(<ImportPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Importar Datos GIS" }),
    ).toBeInTheDocument();
    u3();

    const { unmount: u4 } = render(<SegmentationPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Segmentación" }),
    ).toBeInTheDocument();
    u4();

    const { unmount: u5 } = render(<AppsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Apps" }),
    ).toBeInTheDocument();
    u5();

    const { unmount: u6 } = render(<ProjectsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Proyectos" }),
    ).toBeInTheDocument();
    u6();

    const { unmount: u7 } = render(<BlocksPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Cajones" }),
    ).toBeInTheDocument();
    u7();

    const { unmount: u8 } = render(<TemplatesPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Templates" }),
    ).toBeInTheDocument();
    u8();
  });
});
