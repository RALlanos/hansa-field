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

test("muestra varias Apps en un mapa agrupado sin descargar todos los registros", async ({
  page,
}) => {
  let mapRequestUrl = "";
  await page.route(/\/api\/apps$/, (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            code: "POSTES",
            name: "Postes",
            mapColor: "#d92d20",
            mapIcon: "post",
            allowedGeometries: ["Point"],
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            code: "NODOS",
            name: "Nodos",
            mapColor: "#2970ff",
            mapIcon: "node",
            allowedGeometries: ["Point"],
          },
        ],
      },
    }),
  );
  await page.route(/\/api\/map\/records(?:\?.*)?$/, (route) => {
    mapRequestUrl = route.request().url();
    return route.fulfill({
      json: {
        clustered: true,
        totalRecords: 10_000,
        truncated: false,
        data: [
          {
            id: "postes-cluster",
            appId: "11111111-1111-4111-8111-111111111111",
            appName: "Postes",
            mapIcon: "post",
            mapColor: "#d92d20",
            count: 6_200,
            geometry: { type: "Point", coordinates: [-68.15, -16.5] },
          },
          {
            id: "nodos-cluster",
            appId: "22222222-2222-4222-8222-222222222222",
            appName: "Nodos",
            mapIcon: "node",
            mapColor: "#2970ff",
            count: 3_800,
            geometry: { type: "Point", coordinates: [-63.2, -17.8] },
          },
        ],
      },
    });
  });
  await page.route(/tile\.openstreetmap\.org\//, (route) => route.abort());

  await page.goto("/apps/layers");
  await expect(
    page.getByRole("heading", { name: "Capas de Apps" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Capas disponibles").getByRole("checkbox"),
  ).toHaveCount(2);
  await expect(
    page.getByLabel("Capas disponibles").getByRole("checkbox").first(),
  ).toBeChecked();
  await expect(page.getByText("10.000")).toBeVisible();
  await expect(page.getByText("2 grupos visibles")).toBeVisible();
  expect(mapRequestUrl).toContain("bbox=");
  expect(mapRequestUrl).toContain("zoom=");
  expect(mapRequestUrl).toContain(
    "appIds=11111111-1111-4111-8111-111111111111%2C22222222-2222-4222-8222-222222222222",
  );
});

test("usa la misma visualización en proyectos sin mezclar registros independientes", async ({
  page,
}) => {
  const projectId = "33333333-3333-4333-8333-333333333333";
  const appId = "11111111-1111-4111-8111-111111111111";
  let projectUpdate: unknown;
  await page.route(/\/api\/apps$/, (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: appId,
            code: "POSTES",
            name: "Postes",
            mapColor: "#d92d20",
            mapIcon: "post",
            allowedGeometries: ["Point"],
          },
        ],
      },
    }),
  );
  await page.route(/\/api\/projects$/, (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: projectId,
            code: "LPZ_FTTH",
            name: "La Paz FTTH",
            description: "Proyecto operativo",
            appIds: [appId],
          },
        ],
      },
    }),
  );
  await page.route(/\/api\/projects\/.*\/records\/.*$/, (route) => {
    projectUpdate = route.request().postDataJSON();
    return route.fulfill({
      json: {
        id: "44444444-4444-4444-8444-444444444444",
        appId,
        projectId,
        attributes: { codigo: "P-002" },
        geometry: { type: "Point", coordinates: [-68.15, -16.5] },
        updatedAt: "2026-09-03T13:00:00.000Z",
      },
    });
  });
  await page.route(/\/api\/projects\/.*\/records(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            appId,
            appVersionId: "55555555-5555-4555-8555-555555555555",
            appName: "Postes",
            projectId,
            attributes: { codigo: "P-001" },
            geometry: { type: "Point", coordinates: [-68.15, -16.5] },
            updatedAt: "2026-09-03T12:00:00.000Z",
          },
        ],
        page: 1,
        pageSize: 50,
        totalRecords: 1,
        totalPages: 1,
      },
    }),
  );
  await page.route(/\/api\/apps\/.*\/versions\/latest$/, (route) =>
    route.fulfill({
      json: {
        schema: {
          sections: [
            {
              id: "main",
              title: "Datos",
              fields: [
                {
                  id: "codigo",
                  key: "codigo",
                  label: "Código",
                  type: "shortText",
                  required: true,
                },
              ],
            },
          ],
        },
      },
    }),
  );
  await page.route(/\/api\/map\/records(?:\?.*)?$/, (route) => {
    expect(route.request().url()).toContain(`projectId=${projectId}`);
    return route.fulfill({
      json: {
        data: [],
        clustered: true,
        totalRecords: 0,
        truncated: false,
      },
    });
  });
  await page.route(/tile\.openstreetmap\.org\//, (route) => route.abort());

  await page.goto(`/apps/projects/${projectId}/records`);
  await expect(
    page.getByRole("heading", { name: "La Paz FTTH" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mapa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mitad" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Tabla" })).toBeVisible();
  await expect(page.getByLabel("Filtros por aplicación")).toContainText(
    "Postes",
  );
  await expect(page.getByText("P-001")).toBeVisible();
  await page.getByRole("button", { name: "Editar" }).click();
  const editor = page.getByRole("form", { name: "Editor de registro" });
  await expect(editor.getByLabel("Código *")).toHaveValue("P-001");
  await editor.getByLabel("Código *").fill("P-002");
  await editor.getByRole("button", { name: "Guardar registro" }).click();
  await expect
    .poll(() => projectUpdate)
    .toEqual({
      appId,
      attributes: { codigo: "P-002" },
      geometry: { type: "Point", coordinates: [-68.15, -16.5] },
    });
  await page.getByRole("button", { name: "Tabla" }).click();
  await expect(page.locator(".records-map")).toBeHidden();
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
    .click({ position: { x: 120, y: 180 } });
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
