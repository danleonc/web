import { test, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import AxeBuilder from "@axe-core/playwright";

async function register(context: BrowserContext, name: string) {
  const origin = "http://127.0.0.1:4190";
  const headers = { Origin: origin };
  expect((await context.request.post(`${origin}/api/auth/register`, { headers, data: { username: name, alias: name, adult: true, password: "Una contraseña larga de prueba 123" } })).status()).toBe(201);
  const email = `${name}@example.test`;
  expect((await context.request.post(`${origin}/api/auth/email-code`, { headers, data: { email, adult: true } })).status()).toBe(200);
  const { code } = JSON.parse(await readFile(join(tmpdir(), "afinia-test-pilot-mailbox", createHash("sha256").update(email).digest("hex") + ".json"), "utf8"));
  expect((await context.request.post(`${origin}/api/auth/confirm-email`, { headers, data: { code } })).status()).toBe(200);
}
test("dos cuentas comparten publicaciones y respuestas tras recargar", async ({ browser }, info) => {
  const a = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const b = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(a, `ana_${info.project.name}`); await register(b, `bea_${info.project.name}`);
    const ana: Page = await a.newPage(); const bea: Page = await b.newPage();
    const title = `Una idea para compartir ${info.project.name}`;
    await ana.goto("/#plaza");
    await expect(ana.getByText(/Lo que compartes se guarda solo en este navegador/)).toHaveCount(0);
    await ana.getByLabel("Título de la conversación").fill(title);
    await ana.getByLabel("Tu publicación").fill("¿Qué actividad les gustaría explorar?");
    await ana.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(ana.getByText(title, { exact: true })).toBeVisible();
    await bea.goto("/#plaza");
    await expect(bea.getByText(title, { exact: true })).toBeVisible();
    await bea.getByRole("article").filter({ hasText: title }).getByRole("button", { name: "Ver conversación", exact: true }).click();
    await bea.getByLabel("Tu respuesta").fill("Una caminata tranquila");
    await bea.getByRole("button", { name: "Responder", exact: true }).click();
    await ana.reload();
    await ana.getByRole("article").filter({ hasText: title }).getByRole("button", { name: "Ver conversación", exact: true }).click();
    await expect(ana.getByText("Una caminata tranquila", { exact: true })).toBeVisible();
    expect(await ana.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ana.screenshot({ path: info.outputPath("plaza.png"), fullPage: true });
    await bea.getByRole("button", { name: "Editar respuesta", exact: true }).click();
    await bea.getByLabel("Tu respuesta").fill("Una caminata junto al mar");
    await bea.getByRole("button", { name: "Guardar respuesta", exact: true }).click();
    await expect(bea.getByText("Una caminata junto al mar", { exact: true })).toBeVisible();
    await ana.getByRole("article").filter({ hasText: title }).getByRole("button", { name: "Editar publicación", exact: true }).click();
    await ana.getByLabel("Tu publicación").fill("Una pregunta actualizada para compartir");
    await ana.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await bea.reload();
    await expect(bea.getByRole("article").filter({ hasText: title }).getByText("Una pregunta actualizada para compartir", { exact: true })).toBeVisible();
  } finally { await a.close(); await b.close(); }
});

test("al cambiar de conversación una respuesta tardía no mezcla los hilos", async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(context, `hilos_${info.project.name}`);
    const page = await context.newPage();
    const headers = { Origin: "http://127.0.0.1:4190" };
    const first = await (await context.request.post("/api/plaza/posts", { headers, data: { topic: "crear", title: `Primera ${info.project.name}`, body: "Primera conversación" } })).json();
    const second = await (await context.request.post("/api/plaza/posts", { headers, data: { topic: "crear", title: `Segunda ${info.project.name}`, body: "Segunda conversación" } })).json();
    await context.request.post(`/api/plaza/posts/${first.post.id}/replies`, { headers, data: { body: "Respuesta de primera" } });
    await context.request.post(`/api/plaza/posts/${second.post.id}/replies`, { headers, data: { body: "Respuesta de segunda" } });
    let release: () => void = () => {};
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`**/api/plaza/posts/${first.post.id}/replies`, async (route) => { await delayed; await route.continue(); });
    await page.goto("/#plaza");
    await page.getByRole("article").filter({ hasText: `Primera ${info.project.name}` }).getByRole("button", { name: "Ver conversación" }).click();
    await page.getByRole("article").filter({ hasText: `Segunda ${info.project.name}` }).getByRole("button", { name: "Ver conversación" }).click();
    await expect(page.getByText("Respuesta de segunda", { exact: true })).toBeVisible();
    const firstResponse = page.waitForResponse((r) => r.url().includes(`/posts/${first.post.id}/replies`));
    release(); await firstResponse; await page.waitForTimeout(250);
    await expect(page.getByText("Respuesta de primera", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Respuesta de segunda", { exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test("si se guarda una publicación pero falla la actualización, no invita a duplicarla", async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(context, `fallo_${info.project.name}`);
    const page = await context.newPage();
    await page.goto("/#plaza");
    await page.getByLabel("Título de la conversación").fill(`Una vez ${info.project.name}`);
    await page.getByLabel("Tu publicación").fill("No quiero duplicar esta publicación");
    await page.route("**/api/plaza/posts", async (route) => {
      if (route.request().method() === "GET") await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Tu publicación se guardó");
    await expect(page.getByLabel("Título de la conversación")).toHaveValue("");
  } finally { await context.close(); }
});

test("un reporte de Plaza se revisa y puede retirar el contenido", async ({ browser }, info) => {
  const author = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const reporter = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const moderator = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(author, `autor_${info.project.name}`); await register(reporter, `lector_${info.project.name}`);
    const headers = { Origin: "http://127.0.0.1:4190" };
    expect((await moderator.request.post("/api/auth/login", { headers, data: { username: "moderator_fixture", password: "Una clave exclusiva del fixture 123" } })).status()).toBe(200);
    const title = `Caso de revisión ${info.project.name}`;
    expect((await author.request.post("/api/plaza/posts", { headers, data: { topic: "crear", title, body: "Contenido para revisar" } })).status()).toBe(201);
    const reader = await reporter.newPage();
    await reader.goto("/#plaza");
    await reader.getByRole("article").filter({ hasText: title }).getByRole("button", { name: "Reportar publicación" }).click();
    await reader.getByLabel("Qué ocurrió").fill("Una explicación de prueba");
    await reader.getByRole("button", { name: "Registrar reporte" }).click();
    await expect(reader.getByText(/quedó en la cola de revisión/)).toBeVisible();
    await reader.getByRole("button", { name: "Entendido" }).click();
    await expect(reader.getByText(title, { exact: true })).toBeVisible();
    const review = await moderator.newPage();
    await review.goto("/#plaza");
    await review.getByText("Revisión de Plaza · moderación", { exact: true }).click();
    const caseRow = review.getByRole("article").filter({ hasText: title }).filter({ has: review.getByLabel("Decisión de Plaza") });
    await expect(caseRow.getByText("Contenido para revisar", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page: review }).include(".real-plaza").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    expect(await review.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await review.screenshot({ path: info.outputPath("revision-plaza.png"), fullPage: true });
    await caseRow.getByLabel("Decisión de Plaza").selectOption("hide");
    await caseRow.getByLabel("Justificación de Plaza").fill("Revisión de prueba realizada");
    await caseRow.getByRole("button", { name: "Guardar decisión de Plaza" }).click();
    await expect(review.getByRole("article").filter({ hasText: title }).getByText("Revisado", { exact: true })).toBeVisible();
    await reader.reload();
    await expect(reader.getByText(title, { exact: true })).toHaveCount(0);
  } finally { await author.close(); await reporter.close(); await moderator.close(); }
});

test("una persona puede reportar una respuesta compartida", async ({ browser }, info) => {
  const author = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const reader = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(author, `resp_autor_${info.project.name}`); await register(reader, `resp_lector_${info.project.name}`);
    const headers = { Origin: "http://127.0.0.1:4190" };
    const title = `Respuesta revisable ${info.project.name}`;
    const post = await (await author.request.post("/api/plaza/posts", { headers, data: { topic: "crear", title, body: "Inicio de la conversación" } })).json();
    await author.request.post(`/api/plaza/posts/${post.post.id}/replies`, { headers, data: { body: "Respuesta para revisión" } });
    const page = await reader.newPage(); await page.goto("/#plaza");
    await page.getByRole("article").filter({ hasText: title }).getByRole("button", { name: "Ver conversación" }).click();
    await page.getByRole("article").filter({ hasText: "Respuesta para revisión" }).getByRole("button", { name: "Reportar respuesta" }).click();
    await page.getByRole("button", { name: "Registrar reporte" }).click();
    await expect(page.getByText(/quedó en la cola de revisión/)).toBeVisible();
  } finally { await author.close(); await reader.close(); }
});
