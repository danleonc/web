import { confirmTestEmail } from "./pilot-email";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function register(page: Page, username: string) {
  await page.goto("/#shared");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page.getByLabel("Nombre en la sala", { exact: true }).fill(username);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Una contraseña de prueba larga 123");
  await page
    .getByRole("checkbox", { name: /Declaro que soy mayor de 18 años/ })
    .check();
  await page
    .getByRole("button", { name: "Guardar mi cuenta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Tu cuenta: ${username}`, exact: true }),
  ).toBeVisible();
  const code = await page
    .getByLabel("Tu clave de recuperación", { exact: true })
    .inputValue();
  expect(code.length).toBeGreaterThan(50);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar clave", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "entre-clave-de-recuperacion.txt",
  );
  await page
    .getByRole("button", { name: "Ya guardé mi clave", exact: true })
    .click();
  await confirmTestEmail(page, username);
  return code;
}
async function reserve(page: Page) {
  await page
    .getByRole("button", { name: "Reservar Historias y cultura", exact: true })
    .click();
  await expect(
    page.getByText("Tu reserva está guardada.", { exact: true }),
  ).toBeVisible();
}

test("registro, reserva, cierre, recuperación y acceso desde otro contexto", async ({
  page,
  browser,
}, info) => {
  const username = `luz_${info.project.name.replaceAll("-", "_")}`;
  const recovery = await register(page, username);
  await reserve(page);
  await page.reload();
  await expect(
    page.getByText("Tu reserva está guardada.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recuperar acceso", exact: true })
    .click();
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Una contraseña recuperada para pruebas 456");
  await page
    .getByLabel("Clave de recuperación", { exact: true })
    .fill(recovery);
  await page
    .getByRole("button", { name: "Cambiar contraseña y entrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Tu cuenta: ${username}`, exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByLabel("Tu clave de recuperación", { exact: true })
      .inputValue(),
  ).not.toBe(recovery);
  await page
    .getByRole("button", { name: "Ya guardé mi clave", exact: true })
    .click();
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4190",
  });
  try {
    const other = await context.newPage();
    await other.goto("/#shared");
    await other.getByLabel("Usuario", { exact: true }).fill(username);
    await other
      .getByLabel("Contraseña", { exact: true })
      .fill("Una contraseña recuperada para pruebas 456");
    await other
      .getByRole("button", { name: "Entrar a mi cuenta", exact: true })
      .click();
    await expect(
      other.getByText("Tu reserva está guardada.", { exact: true }),
    ).toBeVisible();
    await other
      .getByRole("button", {
        name: "Cancelar reserva de Historias y cultura",
        exact: true,
      })
      .click();
    await expect(
      other.getByRole("button", {
        name: "Reservar Historias y cultura",
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    await context.close();
  }
  await expect(
    page.getByRole("button", {
      name: "Reservar Historias y cultura",
      exact: true,
    }),
  ).toBeEnabled({ timeout: 8000 });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
