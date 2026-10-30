import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { confirmTestEmail } from "./pilot-email";
test("exploración abierta, cuenta pendiente, correo confirmado y retorno a La Plaza sin identidad verificada", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  const name = `acceso_${info.project.name.replaceAll("-", "_")}`;
  await page.goto("/#plaza");
  await expect(
    page.getByRole("heading", {
      name: "Las buenas conexiones empiezan compartiendo.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  const access = page.getByRole("dialog", {
    name: "Tu cuenta en Nexafia",
    exact: true,
  });
  await expect(access).toBeVisible();
  await access
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await access.getByLabel("Usuario", { exact: true }).fill(name);
  await access.getByLabel("Nombre en la sala", { exact: true }).fill("Luz");
  await access
    .getByLabel("Contraseña", { exact: true })
    .fill("Una frase larga para acceder 123");
  await access
    .getByRole("checkbox", { name: /Declaro que soy mayor de 18 años/ })
    .check();
  await access
    .getByRole("button", { name: "Guardar mi cuenta", exact: true })
    .click();
  await expect(
    access.getByRole("heading", {
      name: "Confirma tu correo para participar.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await page.request.post("/api/reservations/cafe", { data: {} })).status(),
  ).toBe(403);
  await expect(
    access.getByRole("button", { name: "Continuar en Nexafia", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  if (info.project.name === "pilot-mobile")
    for (const field of [access.getByLabel("Correo para confirmar")])
      expect(
        await field.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      ).toBeGreaterThanOrEqual(16);
  await confirmTestEmail(page, name);
  await access
    .getByRole("button", { name: "Continuar en Nexafia", exact: true })
    .click();
  await expect(access).toHaveCount(0);
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await expect(page.getByLabel("Un título para tu conversación")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/#connections");
  await page
    .getByRole("article", { name: "Afinidad de ejemplo: Antonia", exact: true })
    .getByRole("button", { name: "Invitar a conversar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar invitación de prueba", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Invitación para Antonia", exact: true }),
  ).toBeVisible();
  await page.goto("/#plaza");
  await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vuelve a tu espacio.", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
