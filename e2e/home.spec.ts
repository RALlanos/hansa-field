import { expect, test } from "@playwright/test";

test("muestra la shell de Hansa Field y dirige al único módulo disponible", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tu operación empieza en Aplicaciones",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Apps", exact: true }),
  ).toHaveAttribute("href", "/apps");
  await expect(
    page.getByTitle("Proyectos: módulo aún no implementado"),
  ).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Contraer menú" }).click();
  await expect(
    page.getByRole("button", { name: "Expandir menú" }),
  ).toBeVisible();
});
