import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "entre.prototype.v1",
      JSON.stringify({
        profile: {
          alias: "Luz",
          interests: ["Música"],
          boundaries: [],
          availability: "Sin preferencia",
          adult: true,
        },
        reservations: ["cafe"],
        feedback: [],
        blocked: [],
      }),
    ),
  );
  await page.reload();
}
async function attach(page: Page, label = "Adjuntar a mi publicación") {
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "dibujo.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 1400, height: 800, channels: 3, background: "#b78468" },
    })
      .png()
      .toBuffer(),
  });
  await page
    .getByLabel("Descripción de la imagen")
    .fill("Mi primer dibujo de un paisaje");
  await page.getByRole("button", { name: label, exact: true }).click();
}
test("imagen en Plaza: vista previa, rechazo de SVG, publicación persistente, ocultar, reporte local y eliminación del archivo", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await page
    .getByLabel("Un título para tu conversación")
    .fill("Un dibujo para abrir una conversación");
  await page
    .getByLabel("¿Qué te gustaría compartir?", { exact: true })
    .fill("Estoy volviendo a dibujar por puro gusto.");
  await page
    .getByRole("button", { name: "Añadir una imagen", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "invalido.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await expect(page.getByRole("alert")).toContainText("JPG, PNG o WebP");
  await attach(page);
  await expect(
    page.getByRole("dialog").getByAltText("Mi primer dibujo de un paisaje"),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Ampliar imagen compartida", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Imagen compartida", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).plaza?.posts
          .length || 0,
    ),
  ).toBe(0);
  await page
    .getByRole("dialog", { name: "Imagen compartida", exact: true })
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publicar en la maqueta", exact: true })
    .click();
  await page.reload();
  const card = page
    .locator(".plaza-post")
    .filter({ hasText: "Un dibujo para abrir una conversación" });
  await expect(
    card.getByAltText("Mi primer dibujo de un paisaje"),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Ampliar imagen compartida", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Descargar imagen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar ventana" })
    .click();
  await card
    .getByRole("button", { name: "Ocultar imagen", exact: true })
    .click();
  await expect(card.getByText("Ocultaste esta imagen.")).toBeVisible();
  await page.reload();
  await expect(card.getByText("Ocultaste esta imagen.")).toBeVisible();
  await card
    .getByRole("button", { name: "Volver a mostrar", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Reportar imagen", exact: true })
    .click();
  await page.getByLabel("Motivo", { exact: true }).selectOption("contenido");
  await page.getByLabel("Qué ocurrió").fill("Prueba de reporte de imagen.");
  await page
    .getByRole("button", { name: "Guardar reporte de prueba", exact: true })
    .click();
  await expect(page.getByText(/No se envió a un equipo/)).toBeVisible();
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("afinia.reports.v1")!).length,
    ),
  ).toBe(1);
  await card.getByRole("heading").getByRole("button").click();
  await page
    .getByRole("button", { name: "Eliminar publicación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sí, eliminar publicación", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const r = indexedDB.open("afinia.images.v1");
            r.onsuccess = () => {
              const db = r.result,
                c = db.transaction("images").objectStore("images").count();
              c.onsuccess = () => {
                resolve(c.result);
                db.close();
              };
              c.onerror = () => reject(c.error);
            };
          }),
      ),
    )
    .toBe(0);
});

test("Plaza: reportar no sanciona ni oculta automáticamente; bloquear retira publicaciones y respuestas del personaje", async ({
  page,
}) => {
  await seed(page);
  page.on("dialog", (d) => void d.accept());
  await page
    .getByRole("heading", {
      name: "¿Qué canción sería el tráiler de tu vida?",
      exact: true,
    })
    .getByRole("button")
    .click();
  await page
    .getByRole("button", { name: "Reportar publicación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar reporte de prueba", exact: true })
    .click();
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Antonia", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bloquear a Antonia", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "¿Qué canción sería el tráiler de tu vida?",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "¿Qué canción sería el tráiler de tu vida?",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/#agenda");
  await page
    .getByRole("button", { name: "Entrar a la sala de prueba", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Antonia", exact: true }),
  ).toHaveCount(0);
});

test("sala local: adjuntar imagen y simular mayoría retira solo del encuentro, sin permitir su regreso", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/#agenda");
  await page
    .getByRole("button", { name: "Entrar a la sala de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adjuntar imagen", exact: true })
    .click();
  await attach(page, "Compartir imagen");
  await expect(
    page.getByAltText("Mi primer dibujo de un paisaje"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Personas y seguridad", exact: true }).click();
  await page.getByText("Cuidar este encuentro", { exact: true }).click();
  await page
    .getByLabel("Participante", { exact: true })
    .selectOption({ label: "Antonia" });
  await page
    .getByRole("button", {
      name: "Solicitar expulsión por votación",
      exact: true,
    })
    .click();
  await expect(page.getByText(/Se requieren 2 a favor/)).toBeVisible();
  await page
    .getByText("Simular votos de personajes ficticios", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simular voto de Nicolás", exact: true })
    .click();
  await expect(
    page.getByText(/Se alcanzó la mayoría para retirar/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("entre.prototype.v1")!).blocked,
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.locator(".room-aside .demo-people > summary").click();
  await expect(
    page.getByRole("checkbox", { name: "Antonia", exact: true }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
