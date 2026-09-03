import { expect, test } from "@playwright/test";

test("muestra el catálogo de Apps sin requerir datos de muestra", async ({
  page,
}) => {
  await page.goto("/apps");
  await expect(
    page.getByRole("heading", { name: "Apps", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva App" })).toBeEnabled();
  await expect(
    page.getByRole("navigation", { name: "Navegación de Hansa Field" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Contraer menú" }).click();
  await expect(
    page.getByRole("button", { name: "Expandir menú" }),
  ).toBeVisible();
});

test("navega al flujo básico de importación", async ({ page }) => {
  await page.goto("/apps");
  await page.getByRole("link", { name: "Importaciones" }).click();
  await expect(
    page.getByRole("heading", { name: "Nueva importación" }),
  ).toBeVisible();
  await expect(page.getByText("Seleccionar Shapefile ZIP")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Progreso de importación" }),
  ).toContainText("Seleccionar tablas");
  await expect(
    page.getByRole("list", { name: "Progreso de importación" }),
  ).toContainText("Mapear campos");
});

test("ubica un registro nuevo haciendo clic en el mapa y muestra sus atributos", async ({
  page,
}) => {
  let submitted: unknown;
  await page.route(/\/api\/apps\/test-app$/, (route) =>
    route.fulfill({
      json: {
        name: "Postes",
        code: "POSTES",
        mapColor: "#3d7398",
        mapIcon: "post",
      },
    }),
  );
  await page.route(/\/api\/apps\/test-app\/versions\/latest$/, (route) =>
    route.fulfill({
      json: {
        schema: {
          sections: [
            {
              id: "7663f93a-6b7e-4f24-b825-b68a866969c5",
              title: "Datos del poste",
              fields: [
                {
                  id: "07d31956-e00f-48ca-aad0-3edec408bd89",
                  key: "nombre",
                  label: "Nombre del poste",
                  type: "shortText",
                  required: true,
                },
                {
                  id: "2ab5c229-5ff0-43d4-97c8-20d40cdfb49e",
                  key: "activo",
                  label: "Poste activo",
                  type: "boolean",
                  required: false,
                },
              ],
            },
          ],
        },
      },
    }),
  );
  await page.route(/\/api\/apps\/test-app\/records(?:\?.*)?$/, (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      return route.fulfill({
        json: {
          id: "2c42a9a8-279d-45ca-8eb5-670255f6f29e",
          attributes: { nombre: "P-001", activo: true },
          geometry: {
            type: "Point",
            coordinates: [-68.15, -16.5],
          },
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
      });
    }
    return route.fulfill({ json: { data: [] } });
  });

  await page.goto("/apps/test-app/records");
  await page.getByRole("button", { name: "+ Nuevo registro" }).click();
  await expect(page.getByLabel("Nombre del poste")).toBeVisible();
  await expect(page.getByLabel("Poste activo")).toBeVisible();
  await expect(
    page.getByText("Haz clic en el mapa para ubicar el punto."),
  ).toBeVisible();

  await page
    .locator(".leaflet-records-map")
    .click({ position: { x: 420, y: 180 } });
  await expect(page.getByLabel("Longitud")).not.toHaveValue("");
  await expect(page.getByLabel("Latitud")).not.toHaveValue("");
  await page.getByLabel("Nombre del poste").fill("P-001");
  await page.getByLabel("Poste activo").check();
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await expect(page.getByText("Registro creado.")).toBeVisible();
  expect(submitted).toMatchObject({
    attributes: { nombre: "P-001", activo: true },
    geometry: { type: "Point" },
  });
});
