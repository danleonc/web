import { confirmTestEmail } from "./pilot-email";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
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
    "nexafia-clave-de-recuperacion.txt",
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
async function connect(page: Page) {
  await page
    .getByRole("checkbox", { name: /Entiendo que esta prueba comparte/ })
    .check();
  await page
    .getByRole("button", { name: "Conectar con esta sala", exact: true })
    .click();
  await expect(
    page.getByText("Conectado al servidor", { exact: true }),
  ).toBeVisible();
}
test("cuentas distintas comparten sala y recuperan el historial al volver a entrar", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const contexts = await Promise.all(
    ["sol", "mar", "cielo"].map(() =>
      browser.newContext({ baseURL: "http://127.0.0.1:4190" }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    for (let i = 0; i < 3; i++) {
      await register(pages[i], `grupo_${i}`);
      await reserve(pages[i]);
      await connect(pages[i]);
    }
    await pages[0]
      .getByRole("button", {
        name: "Iniciar encuentro compartido",
        exact: true,
      })
      .click();
    await pages[0]
      .getByLabel("Tu mensaje de prueba")
      .fill("Este mensaje queda guardado para el grupo");
    await pages[0]
      .getByRole("button", { name: "Enviar mensaje de prueba", exact: true })
      .click();
    await expect(
      pages[1].getByText("Este mensaje queda guardado para el grupo", {
        exact: true,
      }),
    ).toBeVisible();
    await pages[1].getByRole("group", { name: "Mensaje de grupo_0", exact: true }).getByRole("button", { name: "Responder", exact: true }).click();
    await pages[1].getByLabel("Tu mensaje de prueba").fill("Respuesta guardada con referencia al original");
    await pages[1].getByRole("button", { name: "Enviar mensaje de prueba", exact: true }).click();
    await expect(pages[2].getByRole("group", { name: "Mensaje de grupo_1", exact: true }).locator(".reply-quote")).toContainText("Este mensaje queda guardado para el grupo");
    await pages[2]
      .getByRole("button", { name: "Salir de la sala compartida", exact: true })
      .click();
    await pages[2]
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await pages[2].getByLabel("Usuario", { exact: true }).fill("grupo_2");
    await pages[2]
      .getByLabel("Contraseña", { exact: true })
      .fill("Una contraseña de prueba larga 123");
    await pages[2]
      .getByRole("button", { name: "Entrar a mi cuenta", exact: true })
      .click();
    await pages[2].getByText("Historial de mis salas", { exact: true }).click();
    await pages[2]
      .getByRole("button", {
        name: "Ver mensajes de Historias y cultura",
        exact: true,
      })
      .click();
    await expect(
      pages[2]
        .getByLabel("Historial guardado")
        .locator("p").filter({ hasText: /^Este mensaje queda guardado para el grupo$/ }),
    ).toBeVisible();
    const history = pages[2].getByLabel("Historial guardado");
    await expect(history.getByRole("button", { name: "Ver mensaje original de grupo_0" })).toBeVisible();
    await history.getByRole("button", { name: "Ver mensaje original de grupo_0" }).click();
    await expect(history.getByRole("group", { name: "Mensaje de grupo_0", exact: true })).toBeFocused();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
