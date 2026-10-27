import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page, alias?: string, topic?: string) {
  await page.goto("/");
  if (alias)
    await page.evaluate(
      (value) =>
        localStorage.setItem(
          "entre.prototype.v1",
          JSON.stringify({
            profile: {
              alias: value,
              interests: ["Conversar"],
              boundaries: [],
              availability: "Sin preferencia",
              adult: true,
            },
            reservations: [],
            feedback: [],
            blocked: [],
          }),
        ),
      alias,
    );
  await page.goto("/#shared");
  await page.reload();
  if (topic) await page.getByLabel("Temática compartida").selectOption(topic);
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

test("tres navegadores comparten quórum, texto, stickers, decisiones y desconexión", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const contexts = await Promise.all(
    ["Luz", "Sol", "Mar"].map(() =>
      browser.newContext({ baseURL: "http://127.0.0.1:4173" }),
    ),
  );
  const [a, b, c] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  await a.addInitScript(() => {
    window.WebSocket = new Proxy(WebSocket, {
      construct(target, args) {
        const socket = Reflect.construct(target, args) as WebSocket;
        (window as unknown as { testSocket: WebSocket }).testSocket = socket;
        return socket;
      },
    });
  });
  try {
    await enter(a, "Luz");
    await expect(
      a.getByRole("button", { name: "Iniciar encuentro compartido" }),
    ).toBeDisabled();
    await expect(a.getByLabel("Tu mensaje de prueba")).toBeDisabled();
    const tab = await contexts[0].newPage();
    await enter(tab);
    await expect(
      a.getByText("1 personas conectadas · mínimo 3, máximo 6", {
        exact: true,
      }),
    ).toBeVisible();
    await enter(b, "Sol");
    await enter(c, "Mar");
    await expect(
      a.getByText("3 personas conectadas · mínimo 3, máximo 6", {
        exact: true,
      }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Iniciar encuentro compartido" })
      .click();
    await expect(
      c.getByRole("region", { name: "Guía del encuentro" }),
    ).toBeVisible();
    await a
      .getByLabel("Tu mensaje de prueba")
      .fill("Este mensaje llega al grupo");
    await expect(
      b.getByText("Luz está escribiendo…", { exact: true }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Enviar mensaje de prueba", exact: true })
      .click();
    for (const page of [a, b, c, tab])
      await expect(
        page
          .locator(".message > div > p")
          .filter({ hasText: /^Este mensaje llega al grupo$/ }),
      ).toBeVisible();
    await expect(
      b
        .locator(".message")
        .filter({ hasText: "Este mensaje llega al grupo" })
        .getByText("Luz", { exact: true }),
    ).toBeVisible();
    const original = b.getByRole("group", {
      name: "Mensaje de Luz",
      exact: true,
    });
    await original
      .getByRole("button", { name: "Responder", exact: true })
      .click();
    await b
      .getByLabel("Tu mensaje de prueba")
      .fill("Una respuesta con contexto para el grupo");
    await b
      .getByRole("button", { name: "Enviar mensaje de prueba", exact: true })
      .click();
    const response = c
      .getByRole("group", { name: "Mensaje de Sol", exact: true })
      .filter({
        has: c
          .locator("p")
          .filter({ hasText: "Una respuesta con contexto para el grupo" }),
      });
    await expect(response.locator(".reply-quote")).toContainText(
      "Este mensaje llega al grupo",
    );
    await response
      .getByRole("button", { name: "Ver mensaje original de Luz", exact: true })
      .click();
    await expect(
      c.getByRole("group", { name: "Mensaje de Luz", exact: true }),
    ).toBeFocused();
    await original
      .getByRole("button", { name: "Responder", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Abrir stickers", exact: true })
      .click();
    const picker = b.getByRole("dialog", {
      name: "Elige un sticker",
      exact: true,
    });
    await picker
      .getByRole("button", {
        name: "Seleccionar sticker: Moka: Saludando",
        exact: true,
      })
      .click();
    await picker
      .getByRole("button", { name: "Enviar sticker", exact: true })
      .click();
    await expect(
      c.getByRole("img", { name: "Sticker: Moka: Saludando", exact: true }),
    ).toBeVisible();
    await expect(c.locator(".sticker-message .reply-quote")).toContainText(
      "Este mensaje llega al grupo",
    );
    for (const page of [a, b, c])
      await page
        .getByRole("button", { name: "Listo por ahora", exact: true })
        .click();
    await expect(
      c.getByRole("heading", { name: "Ahora hay espacio para conversar." }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Otra pregunta", exact: true }).click();
    await expect(
      tab.getByRole("button", { name: "Tu voto está registrado", exact: true }),
    ).toBeDisabled();
    await expect(
      c.getByText(
        "1 de 2 votos necesarios. Sin mayoría, seguimos conversando.",
        { exact: true },
      ),
    ).toBeVisible();
    await b.getByRole("button", { name: "Otra pregunta", exact: true }).click();
    await expect(c.getByText(/Preguntas 2\/3/)).toBeVisible();
    await a.getByLabel("Tu mensaje de prueba").fill("Mi borrador sigue aquí");
    await a.evaluate(() =>
      (window as unknown as { testSocket: WebSocket }).testSocket.close(
        4000,
        "Prueba de reconexión",
      ),
    );
    await expect(a.getByLabel("Tu mensaje de prueba")).toBeDisabled();
    await expect(a.getByLabel("Tu mensaje de prueba")).toBeEnabled();
    await expect(a.getByLabel("Tu mensaje de prueba")).toHaveValue(
      "Mi borrador sigue aquí",
    );
    await a.getByLabel("Tu mensaje de prueba").fill("");
    await tab.close();
    await expect(
      b.getByText("3 personas conectadas · mínimo 3, máximo 6", {
        exact: true,
      }),
    ).toBeVisible();
    await c
      .getByRole("button", { name: "Salir de la sala compartida", exact: true })
      .click();
    await expect(
      a.getByRole("heading", { name: "Una pausa para recuperar el grupo." }),
    ).toBeVisible();
    await expect(a.getByLabel("Tu mensaje de prueba")).toBeDisabled();
    await c
      .getByRole("button", { name: "Conectar con esta sala", exact: true })
      .click();
    await expect(
      a.getByRole("heading", { name: "Ahora hay espacio para conversar." }),
    ).toBeVisible();
    await expect(
      c
        .locator(".message > div > p")
        .filter({ hasText: /^Este mensaje llega al grupo$/ }),
    ).toBeVisible();
    const audit = await new AxeBuilder({ page: a })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await a.setViewportSize({ width: 390, height: 844 });
    expect(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await a
      .getByRole("button", { name: "Personas y seguridad", exact: true })
      .click();
    a.once("dialog", (dialog) => dialog.accept());
    await a
      .getByRole("button", { name: "Bloquear y salir", exact: true })
      .first()
      .click();
    await expect(
      a.getByText("Saliste con un bloqueo registrado", { exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("heading", { name: "Una pausa para recuperar el grupo." }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("silenciar no afecta al grupo y los mensajes nuevos no interrumpen la lectura del historial", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({ baseURL: "http://127.0.0.1:4173" }),
    ),
  );
  const [a, b, c] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  async function send(text: string) {
    await a.getByLabel("Tu mensaje de prueba").fill(text);
    await a
      .getByRole("button", { name: "Enviar mensaje de prueba", exact: true })
      .click();
    await expect(
      c.locator(".message > div > p").filter({ hasText: text }),
    ).toBeVisible();
  }
  try {
    await enter(a, "Nube", "crear");
    await enter(b, "Rio", "crear");
    await enter(c, "Valle", "crear");
    await a
      .getByRole("button", {
        name: "Iniciar encuentro compartido",
        exact: true,
      })
      .click();
    for (let i = 0; i < 10; i++)
      await send(
        `Recuerdo ${i}: ${"Una conversación que merece tiempo y atención. ".repeat(5)}`,
      );
    const viewport = b.getByLabel("Mensajes compartidos", { exact: true });
    await viewport.evaluate((e) => e.scrollTo({ top: 0, behavior: "instant" }));
    await expect
      .poll(() => viewport.evaluate((e) => e.scrollTop))
      .toBeLessThan(10);
    await b
      .getByLabel("Tu mensaje de prueba")
      .fill("Mi borrador espera mientras leo");
    const pageScroll = await b.evaluate(() => scrollY);
    await send("Un mensaje nuevo mientras Rio lee el principio");
    await expect(
      b.getByRole("button", { name: "Ver mensajes nuevos", exact: true }),
    ).toBeVisible();
    expect(await viewport.evaluate((e) => e.scrollTop)).toBeLessThan(10);
    expect(await b.evaluate(() => scrollY)).toBe(pageScroll);
    await b
      .getByRole("button", { name: "Ver mensajes nuevos", exact: true })
      .click();
    await expect(
      b
        .locator(".message > div > p")
        .filter({ hasText: "Un mensaje nuevo mientras Rio lee el principio" }),
    ).toBeInViewport();
    await b
      .getByRole("button", { name: "Personas y seguridad", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Silenciar mensajes de Nube", exact: true })
      .click();
    await b.keyboard.press("Escape");
    await expect(
      b.getByRole("group", { name: "Mensaje de Nube", exact: true }),
    ).toHaveCount(0);
    await send("Este mensaje sigue llegando a Valle");
    await expect(
      b.getByRole("group", { name: "Mensaje de Nube", exact: true }),
    ).toHaveCount(0);
    await expect(b.getByLabel("Tu mensaje de prueba")).toHaveValue(
      "Mi borrador espera mientras leo",
    );
    await expect(
      a.getByText("3 personas conectadas · mínimo 3, máximo 6", {
        exact: true,
      }),
    ).toBeVisible();
    await b
      .getByRole("button", { name: "Personas y seguridad", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Mostrar mensajes de Nube", exact: true })
      .click();
    await b.keyboard.press("Escape");
    await expect(
      b
        .locator(".message > div > p")
        .filter({ hasText: "Este mensaje sigue llegando a Valle" }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
