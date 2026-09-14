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
    expect(screen.getByRole("link", { name: "Apps" })).toHaveAttribute(
      "href",
      "/apps",
    );
    expect(screen.getByRole("link", { name: "Templates" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proyectos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Registros" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Apps" }),
    ).toBeInTheDocument();
  });

  it("exposes direct navigation to each workspace section", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByRole("link", { name: "Cajones" })).toHaveAttribute(
      "href",
      "/blocks",
    );
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(screen.getByRole("link", { name: "Registros" })).toHaveAttribute(
      "href",
      "/records",
    );
    expect(screen.getByRole("link", { name: "Importar" })).toHaveAttribute(
      "href",
      "/import",
    );
    expect(
      screen.getByRole("link", { name: "Mapa Universal" }),
    ).toHaveAttribute("href", "/map");
  });

  it("keeps record controls on the dedicated records route", () => {
    render(<RecordsPage />);

    const btnTabla = screen.getByRole("button", { name: "Tabla" });
    fireEvent.click(btnTabla);

    const btnDividido = screen.getByRole("button", { name: "Dividido" });
    fireEvent.click(btnDividido);

    const btnMapaView = screen.getByRole("button", { name: "Mapa" });
    fireEvent.click(btnMapaView);

    const btnNuevo = screen.getByRole("button", { name: /Nuevo registro/i });
    fireEvent.click(btnNuevo);
    expect(
      screen.getByRole("heading", { name: /Crear Nuevo Registro/i }),
    ).toBeInTheDocument();

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
