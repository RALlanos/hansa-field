import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import TemplateBuilder from "./template-builder";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("recovers all field types, symbols and geometry without record actions", async () => {
  render(<TemplateBuilder templateId="new" onBack={() => {}} />);
  await screen.findByRole("heading", { name: "Nueva plantilla", level: 1 });
  for (const name of [
    "Texto corto",
    "Texto largo",
    "Número",
    "Sí / No",
    "Fecha",
    "Hora",
    "Selección única",
    "Selección múltiple",
    "Foto",
    "Archivo",
    "Firma",
  ]) {
    expect(
      screen.getByRole("button", {
        name: new RegExp(name.replace("/", "\\/")),
      }),
    ).toBeEnabled();
  }
  expect(screen.queryByText("Ver registros")).not.toBeInTheDocument();
  expect(screen.getByText("Geometría permitida")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Texto corto/ }));
  expect(
    screen.getByRole("button", { name: "Guardar plantilla" }),
  ).toBeEnabled();
});
it("renaming a field retains its UUID in the submitted new version", async () => {
  const id = "00000000-0000-4000-8000-000000000010";
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "Postes",
          version: 1,
          schema: {
            sections: [
              {
                id: "section",
                title: "Datos",
                fields: [
                  {
                    id,
                    key: "altura",
                    label: "Altura",
                    type: "number",
                    required: false,
                  },
                ],
              },
            ],
            settings: {
              id: "template",
              name: "Postes",
              code: "POSTES",
              description: "",
              allowedGeometries: ["Point"],
              mapIcon: "pin",
              mapColor: "#123456",
            },
          },
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ version: 2 })));
  vi.stubGlobal("fetch", fetchMock);
  const back = vi.fn<() => void>();
  render(<TemplateBuilder templateId="template" onBack={back} />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Altura.*Número/ }),
  );
  fireEvent.change(screen.getByLabelText("Etiqueta"), {
    target: { value: "Altura del poste" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cerrar propiedades" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
  await waitFor(() => expect(back).toHaveBeenCalled());
  const body = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body));
  expect(body.expectedVersion).toBe(1);
  expect(body.schema.sections[0].fields[0]).toMatchObject({
    id,
    label: "Altura del poste",
  });
});
