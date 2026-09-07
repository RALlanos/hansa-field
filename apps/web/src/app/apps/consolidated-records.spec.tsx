import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import RecordsPage from "./[appId]/records/page";

vi.mock("next/navigation", () => ({ useParams: () => ({ appId: "master" }) }));
vi.mock("../../../features/maps/multi-app-map", () => ({
  MultiAppMap: () => <div>Mapa consolidado</div>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows participations, distinguishes N/A from missing values and filters projects", async () => {
  const projectApps = ["A", "B"].map((id) => ({
    id,
    projectId: id,
    projectName: `Proyecto ${id}`,
    name: "Postes",
    code: "POSTES",
    mapColor: "#123456",
    mapIcon: "pin",
    allowedGeometries: ["Point"],
  }));
  const rows = ["A", "B"].map((id) => ({
    recordUuid: "shared-record",
    projectRecordUuid: `participation-${id}`,
    projectAppId: id,
    projectId: id,
    projectName: `Proyecto ${id}`,
    appName: "Postes",
    attributes:
      id === "A"
        ? { material: "Hormigón" }
        : { material: "Metal", luminaria: true },
  }));
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("metadata"))
      return {
        ok: true,
        json: async () => ({
          name: "Postes",
          projectApps,
          columns: [
            {
              id: "material",
              label: "Material",
              keys: { A: "material", B: "material" },
            },
            { id: "local", label: "Luminaria", keys: { B: "luminaria" } },
            {
              id: "height",
              label: "Altura",
              keys: { A: "altura", B: "altura" },
            },
          ],
        }),
      };
    const data = rows.filter(
      (row) =>
        !url.searchParams.get("projectId") ||
        row.projectId === url.searchParams.get("projectId"),
    );
    return {
      ok: true,
      json: async () => ({ data, totalRecords: data.length }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<RecordsPage />);
  await screen.findByText("Hormigón");
  expect(screen.getAllByText("shared-record")).toHaveLength(2);
  expect(screen.getByTitle("No aplica en este proyecto")).toHaveTextContent(
    "N/A",
  );
  expect(screen.getByText("Sí")).toBeInTheDocument();
  expect(screen.getAllByText("—")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Proyecto"), {
    target: { value: "B" },
  });
  await waitFor(() =>
    expect(
      within(screen.getByRole("table")).queryByText("Hormigón"),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Metal")).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.some(
      ([url]) => url.includes("projectAppIds=B") && url.includes("projectId=B"),
    ),
  ).toBe(true);
});
