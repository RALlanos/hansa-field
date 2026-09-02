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
  await expect(page.getByText("Seleccionar archivo GeoJSON")).toBeVisible();
});
