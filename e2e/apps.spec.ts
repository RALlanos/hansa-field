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
