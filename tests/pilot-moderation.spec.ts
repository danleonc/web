import { confirmTestEmail } from "./pilot-email";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
async function register(page: Page, name: string, topic: string) {
  await page.goto("/#shared");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Usuario", { exact: true }).fill(name);
  await page.getByLabel("Nombre en la sala", { exact: true }).fill(name);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Una frase larga solo para pruebas 123");
  await page.getByLabel(/Declaro que soy mayor de 18/).check();
  await page
    .getByRole("button", { name: "Guardar mi cuenta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Tu cuenta: ${name}`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ya guardé mi clave", exact: true })
    .click();
  await confirmTestEmail(page, name);
  await page
    .getByRole("button", { name: `Reservar ${topic}`, exact: true })
    .click();
  await page.getByLabel("Temática compartida").selectOption({ label: topic });
  await connect(page);
}
async function connect(page: Page) {
  await page.getByLabel(/Entiendo que esta prueba comparte/).check();
  await page
    .getByRole("button", { name: "Conectar con esta sala", exact: true })
    .click();
  await expect(
    page.getByText("Conectado al servidor", { exact: true }),
  ).toBeVisible();
}
async function report(page: Page, button: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await page
    .getByLabel("Qué ocurrió")
    .fill("Caso ficticio para comprobar una revisión.");
  await page
    .getByRole("button", { name: "Registrar reporte", exact: true })
    .click();
  await expect(page.getByText(/quedó en la cola de revisión/)).toBeVisible();
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
}
async function decision(mod: Page, target: string, action: string) {
  await mod
    .getByRole("button", { name: "Actualizar cola de revisión", exact: true })
    .click();
  await mod
    .getByRole("button", { name: new RegExp(`^${target} .*pendiente$`) })
    .click();
  await mod.getByLabel("Decisión", { exact: true }).selectOption(action);
  await mod
    .getByLabel("Justificación de la decisión", { exact: true })
    .fill("Decisión de prueba después de revisar el contexto.");
  await mod
    .getByRole("button", {
      name: "Guardar decisión de moderación",
      exact: true,
    })
    .click();
  await expect(mod.getByText(/Resolución:/)).toBeVisible();
}
test("piloto: imagen compartida, reporte, revisión, baneo apelable y expulsión por mayoría desde la interfaz", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90_000);
  const mobile = info.project.name.includes("mobile"),
    topic = mobile ? "Vida cotidiana y pequeños planes" : "Crear y descubrir",
    suffix = mobile ? "movil" : "pc";
  const contexts = await Promise.all(
    [1, 2, 3].map(() =>
      browser.newContext({ baseURL: "http://127.0.0.1:4190" }),
    ),
  );
  const peers = await Promise.all(contexts.map((c) => c.newPage()));
  const pages = [page, peers[0], peers[1]],
    mod = peers[2],
    names = [0, 1, 2].map((i) => `convivencia_${suffix}_${i}`);
  for (const p of [...pages, mod]) p.on("dialog", (d) => void d.accept());
  try {
    for (let i = 0; i < 3; i++) await register(pages[i], names[i], topic);
    await page
      .getByRole("button", {
        name: "Iniciar encuentro compartido",
        exact: true,
      })
      .click();
    await mod.goto("/#shared");
    await mod.getByLabel("Usuario", { exact: true }).fill("moderator_fixture");
    await mod
      .getByLabel("Contraseña", { exact: true })
      .fill("Una clave exclusiva del fixture 123");
    await mod
      .getByRole("button", { name: "Entrar a mi cuenta", exact: true })
      .click();
    await mod
      .getByText("Revisión de convivencia · moderación", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Adjuntar imagen", exact: true })
      .click();
    // Reproduce mobile browsers that decode ordinary photos but cannot export WebP.
    if (mobile)
      await page.evaluate(() => {
        Object.defineProperty(window, "createImageBitmap", {
          value: undefined,
          configurable: true,
        });
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (
          callback,
          type,
          quality,
        ) {
          original.call(
            this,
            callback,
            type === "image/webp" ? "image/png" : type,
            quality,
          );
        };
      });
    await page.locator("input[type=file]").setInputFiles({
      name: "foto-prueba.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: {
          width: 1200,
          height: 800,
          channels: 3,
          background: "#718b65",
        },
      })
        .png()
        .toBuffer(),
    });
    await page
      .getByLabel("Descripción de la imagen")
      .fill("Un paisaje de prueba");
    await page
      .getByRole("button", { name: "Compartir imagen", exact: true })
      .click();
    await expect(pages[1].getByAltText("Un paisaje de prueba")).toBeVisible();
    await report(pages[1], "Reportar imagen");
    await decision(mod, names[0], "hide-image");
    await expect(
      pages[2].getByText("Imagen retirada de la conversación.", {
        exact: true,
      }),
    ).toBeVisible();
    await pages[1].getByRole("button", { name: "Personas y seguridad", exact: true }).click();
    await report(pages[1], `Reportar conducta de ${names[0]}`);
    await pages[1].keyboard.press("Escape");
    await decision(mod, names[0], "ban");
    await expect(
      page.getByRole("heading", {
        name: "Tu cuenta está baneada.",
        exact: true,
      }),
    ).toBeVisible({ timeout: 8000 });
    await page
      .getByLabel("Explica tu apelación")
      .fill("Solicito revisar esta decisión de prueba.");
    await page
      .getByRole("button", { name: "Enviar apelación", exact: true })
      .click();
    await expect(
      page.getByText("Apelación en revisión", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await mod
      .getByRole("button", { name: "Actualizar cola de revisión", exact: true })
      .click();
    await mod
      .getByLabel("Justificación de la revisión")
      .fill("Se revisaron los antecedentes y se levanta la restricción.");
    await mod
      .getByRole("button", { name: "Levantar la restricción", exact: true })
      .click();
    await expect(
      mod.getByText("No hay apelaciones pendientes.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Tu cuenta está baneada.",
        exact: true,
      }),
    ).toHaveCount(0, { timeout: 8000 });
    await connect(page);
    await pages[1].getByRole("button", { name: "Personas y seguridad", exact: true }).click();
    await pages[1].getByText("Cuidar este encuentro", { exact: true }).click();
    await pages[1]
      .getByLabel("Participante", { exact: true })
      .selectOption({ label: names[2] });
    await pages[1]
      .getByRole("button", {
        name: "Solicitar expulsión por votación",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Hay una votación de convivencia. Revisar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "A favor de retirar", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "A favor de retirar", exact: true })
      .click();
    await expect(pages[2].getByRole("alert")).toContainText("Fuiste retirado");
    await expect(
      pages[2].getByRole("button", {
        name: "Intentar reconectar",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page: mod })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
