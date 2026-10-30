import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function nav(page: Page, name: string) {
  if ((page.viewportSize()?.width || 0) <= 700)
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function privacy(page: Page) {
  await page
    .getByRole("button", { name: "Cómo funciona", exact: true })
    .click();
}
async function createProfile(page: Page) {
  await page.getByLabel("¿Cómo te llamamos?").fill("Alex");
  await page.getByRole("button", { name: "Conversar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Sin insinuaciones románticas").check();
  await page.getByLabel("Declaro que soy mayor de 18 años").check();
  await page
    .getByRole("button", { name: /Guardar (mi perfil|perfil y reservar)/ })
    .click();
}
async function book(page: Page) {
  await page
    .getByRole("button", {
      name: "Ver encuentro: ¿Y si pudieras vivir otra vida?",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Preparar perfil y reservar" })
    .click();
  await createProfile(page);
}

test("complete journey: profile, reservation, local chat, feedback and private reconnection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#discover");
  await expect(
    page.getByRole("heading", { name: "Hay mucho por compartir." }),
  ).toBeVisible();
  await book(page);
  await expect(
    page.getByRole("heading", { name: "Tu agenda, a tu ritmo." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Entrar a la sala de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
  await page.getByText("Cómo funciona la guía", { exact: true }).click();
  await expect(page.getByText(/No hay IA leyendo esta conversación/)).toBeVisible();
  await page.getByRole("switch").click();
  await expect(
    page.getByText(/No hay IA leyendo esta conversación/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Activar guía", exact: true }).click();
  await page
    .getByLabel("Tu mensaje de prueba")
    .fill("Me alegra probar este espacio.");
  await page.getByRole("button", { name: "Enviar mensaje de prueba" }).click();
  await expect(
    page.getByText("Me alegra probar este espacio.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mostrar una respuesta ficticia de ejemplo" })
    .click();
  await expect(
    page.getByText(/Respuesta de ejemplo escrita de antemano/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finalizar encuentro" }).click();
  await page.locator('input[name="comfort"][value="4"]').check();
  await page
    .locator(".reconnect-people label")
    .filter({ hasText: "Antonia" })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Antonia", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Tu interés está guardado")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Antonia", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retirar mi interés" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Las buenas conexiones llevan su tiempo",
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("filters and normalized search have meaningful empty and recovery states", async ({
  page,
}) => {
  await page.goto("/#discover");
  await page.getByRole("button", { name: "Bienestar", exact: true }).click();
  await expect(page.locator(".activity-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page.getByLabel("Buscar encuentros").fill("pelicula");
  await expect(page.locator(".activity-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "¿Y si pudieras vivir otra vida?", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Buscar encuentros").fill("inexistente");
  await expect(
    page.getByRole("heading", {
      name: "Todavía no hay un plan con esa búsqueda",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver todos los encuentros", exact: true })
    .click();
  await expect(page.locator(".activity-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("blocking hides messages and excludes participant from reconnection", async ({
  page,
}) => {
  await page.goto("/#discover");
  await book(page);
  await page
    .getByRole("button", { name: "Entrar a la sala de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mostrar una respuesta ficticia de ejemplo" })
    .click();
  await page.getByRole("button", { name: "Personas y seguridad", exact: true }).click();
  await page.getByRole("button", { name: "Bloquear a Antonia", exact: true }).click();
  await page
    .getByRole("button", { name: "Bloquear participante de prueba" })
    .click();
  await expect(
    page.getByText("Antonia: bloqueo activado en esta prueba local."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simular denuncia" }).click();
  await expect(page.getByText(/No fue enviada ni guardada/)).toBeVisible();
  await page.getByRole("dialog", { name: "Tu seguridad va primero", exact: true }).getByRole("button", { name: "Cerrar ventana" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText(/Respuesta de ejemplo escrita de antemano/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Finalizar encuentro" }).click();
  await expect(
    page.locator(".reconnect-people label").filter({ hasText: "Antonia" }),
  ).toHaveCount(0);
  await expect(page.locator(".reconnect-people label")).toHaveCount(2);
});

test("cancellation, export and complete local reset work", async ({ page }) => {
  await page.goto("/#discover");
  await book(page);
  await page
    .getByRole("button", { name: "Cancelar reserva", exact: true })
    .click();
  await page.getByRole("button", { name: "Sí, cancelar reserva" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Todavía tienes espacio para un buen plan",
    }),
  ).toBeVisible();
  await privacy(page);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar mis datos de prueba" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("nexafia-datos-de-prueba.json");
  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  expect(JSON.parse(content).profile.alias).toBe("Alex");
  expect(JSON.parse(content).reservations).toEqual([]);
  await page
    .getByRole("button", { name: "Borrar todos mis datos de prueba" })
    .click();
  await page.getByRole("button", { name: "Sí, borrar datos" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Las buenas conexiones/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("entre.prototype.v1")!).profile,
    ),
  ).toBeNull();
});

test("optional interests and alias can be skipped, adulthood remains required", async ({
  page,
}) => {
  await page.goto("/#discover");
  await page.getByRole("button", { name: "Preparar mi perfil" }).click();
  await page.getByRole("button", { name: "Omitir intereses" }).click();
  await page.getByRole("button", { name: "Guardar mi perfil" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu comodidad va primero." }),
  ).toBeVisible();
  await page.getByLabel("Declaro que soy mayor de 18 años").check();
  await page.getByRole("button", { name: "Guardar mi perfil" }).click();
  await expect(
    page.getByRole("heading", { name: "Qué bueno verte, Explorador." }),
  ).toBeVisible();
  await nav(page, "Mi perfil");
  await expect(page.getByLabel("¿Cómo te llamamos?")).toHaveValue("Explorador");
});

test("room cannot be reached without a reservation; corrupt storage is recoverable", async ({
  page,
}) => {
  await page.goto("/#discover");
  await page.evaluate(() =>
    localStorage.setItem("entre.prototype.v1", "{broken"),
  );
  await page.goto("/#room");
  await expect(
    page.getByRole("heading", {
      name: "Esta sala es parte de una reserva de prueba",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ir a mi agenda" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Todavía tienes espacio para un buen plan",
    }),
  ).toBeVisible();
});

test("modal keeps focus and Escape closes it", async ({ page }) => {
  await page.goto("/#discover");
  await page
    .getByRole("button", {
      name: "Ver encuentro: ¿Y si pudieras vivir otra vida?",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("core screens have no automatically detected WCAG A/AA violations", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  async function audit() {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.goto("/#discover");
  await audit();
  await page
    .getByRole("button", {
      name: "Ver encuentro: ¿Y si pudieras vivir otra vida?",
      exact: true,
    })
    .click();
  await audit();
  await page
    .getByRole("button", { name: "Preparar perfil y reservar" })
    .click();
  await audit();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await audit();
  await page.getByLabel("Declaro que soy mayor de 18 años").check();
  await page.getByRole("button", { name: "Guardar perfil y reservar" }).click();
  await audit();
  await page
    .getByRole("button", { name: "Entrar a la sala de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
  await audit();
  await page.getByRole("button", { name: "Finalizar encuentro" }).click();
  await audit();
});
