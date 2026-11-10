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

test("bloquear y desbloquear una persona actualiza La Plaza", async ({ browser }, info) => {
  const author = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const viewer = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(author, `bloq_autor_${info.project.name}`); await register(viewer, `bloq_lector_${info.project.name}`);
    const title = `Tema para bloquear ${info.project.name}`;
    await author.request.post("/api/plaza/posts", { headers: { Origin: "http://127.0.0.1:4190" }, data: { topic: "crear", title, body: "Contenido compartido" } });
    const page = await viewer.newPage(); page.on("dialog", (d) => void d.accept()); await page.goto("/#plaza");
    await page.getByRole("article").filter({ hasText: title }).getByRole("button", { name: "Bloquear persona" }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.getByText("Personas bloqueadas", { exact: true }).click();
    await expect(page.getByText(`bloq_autor_${info.project.name}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Desbloquear bloq_autor_${info.project.name}` }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  } finally { await author.close(); await viewer.close(); }
});

test("la autora apela una retirada y otra moderadora puede revisarla", async ({ browser }, info) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use })));
  const [author, reporter, modA, modB] = contexts;
  try {
    await register(author, `apel_autora_${info.project.name}`); await register(reporter, `apel_lector_${info.project.name}`);
    const headers = { Origin: "http://127.0.0.1:4190" };
    for (const [ctx, username] of [[modA, "moderator_fixture"], [modB, "moderator_fixture_second"]] as const)
      expect((await ctx.request.post("/api/auth/login", { headers, data: { username, password: "Una clave exclusiva del fixture 123" } })).status()).toBe(200);
    const title = `Contenido apelado ${info.project.name}`;
    const post = await (await author.request.post("/api/plaza/posts", { headers, data: { topic: "crear", title, body: "Texto original" } })).json();
    const report = await (await reporter.request.post("/api/plaza/reports", { headers, data: { kind: "post", contentId: post.post.id, reason: "spam", note: "Observación privada" } })).json();
    expect((await modA.request.post("/api/plaza/moderation/actions", { headers, data: { reportId: report.id, action: "hide", reason: "Revisión inicial" } })).status()).toBe(200);
    const page = await author.newPage(); await page.goto("/#plaza");
    await page.getByText("Mis contenidos retirados", { exact: true }).click();
    const action = page.getByRole("article").filter({ hasText: title });
    await action.getByLabel("Por qué solicitas una revisión").fill("Solicito otra revisión del contenido");
    await action.getByRole("button", { name: "Enviar apelación" }).click();
    await expect(action.getByText("Apelación pendiente", { exact: true })).toBeVisible();
    const review = await modB.newPage(); await review.goto("/#plaza");
    await review.getByText("Apelaciones de Plaza · moderación", { exact: true }).click();
    const item = review.getByRole("article").filter({ hasText: title });
    await item.getByLabel("Resultado de la revisión").selectOption("restore");
    await item.getByLabel("Justificación de la revisión").fill("Revisado por otra moderadora");
    await item.getByRole("button", { name: "Guardar revisión" }).click();
    await expect(item.getByText("Apelación aceptada", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  } finally { for (const context of contexts) await context.close(); }
});

test("dos personas aceptan una solicitud antes de conversar en privado", async ({ browser }, info) => {
  const ana = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const bea = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(ana, `conexion_ana_${info.project.name}`); await register(bea, `conexion_bea_${info.project.name}`);
    const title = `Una conversación para conectar ${info.project.name}`;
    await bea.request.post("/api/plaza/posts", { headers: { Origin: "http://127.0.0.1:4190" }, data: { topic: "crear", title, body: "Una idea compartida" } });
    const first = await ana.newPage(); await first.goto("/#plaza");
    await first.getByRole("article").filter({ hasText: title }).getByRole("button", { name: "Seguir conversando" }).click();
    await first.getByLabel("Mensaje de invitación").fill("Me gustaría conversar sobre tu idea");
    await first.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(first.getByText(/Solicitud enviada/)).toBeVisible();
    await first.goto("/#connections");
    await expect(first.getByText("Esperando respuesta", { exact: true })).toBeVisible();
    await expect(first.getByRole("button", { name: "Abrir conversación" })).toHaveCount(0);
    const second = await bea.newPage(); await second.goto("/#connections");
    await second.getByRole("button", { name: "Aceptar solicitud" }).click();
    await second.getByRole("button", { name: "Abrir conversación" }).click();
    await second.getByLabel("Mensaje privado").fill("Hola, conversemos");
    await second.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(first.getByText("Conexión aceptada", { exact: true })).toBeVisible({ timeout: 12000 });
    await first.getByRole("button", { name: "Abrir conversación" }).click();
    await second.getByLabel("Mensaje privado").fill("Mensaje nuevo sin actualizar la página");
    await second.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(first.getByText("Mensaje nuevo sin actualizar la página", { exact: true })).toBeVisible({ timeout: 12000 });
    expect((await new AxeBuilder({ page: first }).include(".real-plaza").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    await first.screenshot({ path: info.outputPath("conexiones.png"), fullPage: true });
    await first.getByRole("article").filter({ hasText: "Hola, conversemos" }).getByRole("button", { name: "Reportar mensaje" }).click();
    await first.getByRole("button", { name: "Registrar reporte" }).click();
    await expect(first.getByText(/quedó en la cola de revisión/)).toBeVisible();
    await first.getByRole("button", { name: "Entendido" }).click();
    first.on("dialog", (dialog) => void dialog.accept());
    await first.getByRole("button", { name: "Bloquear persona" }).click();
    await expect(first.getByText("Hola, conversemos", { exact: true })).toHaveCount(0);
    await expect(second.getByRole("button", { name: "Abrir conversación" })).toHaveCount(0, { timeout: 12000 });
    await expect(second.getByText("Mensaje nuevo sin actualizar la página", { exact: true })).toHaveCount(0, { timeout: 12000 });
    expect(await first.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await ana.close(); await bea.close(); }
});

test("una convocatoria programada se puede reservar y abrir como encuentro compartido", async ({ browser }, info) => {
  const mod = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const user = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    const headers = { Origin: "http://127.0.0.1:4190" };
    expect((await mod.request.post("/api/auth/login", { headers, data: { username: "moderator_fixture", password: "Una clave exclusiva del fixture 123" } })).status()).toBe(200);
    await register(user, `encuentro_${info.project.name}`);
    const moderator = await mod.newPage(); await moderator.goto("/#discover");
    await moderator.getByText("Programar un encuentro", { exact: true }).click();
    const time = await moderator.evaluate(() => { const d = new Date(Date.now() + 2 * 60 * 60_000); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; });
    await moderator.getByLabel("Fecha y hora del encuentro").fill(time);
    await moderator.getByRole("button", { name: "Crear convocatoria" }).click();
    await expect(moderator.getByText("Convocatoria creada.", { exact: true })).toBeVisible();
    const participant = await user.newPage(); await participant.goto("/#discover");
    await expect(participant.getByText(/Lo que compartes se guarda solo en este navegador/)).toHaveCount(0);
    expect((await new AxeBuilder({ page: participant }).include(".real-plaza").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    await participant.screenshot({ path: info.outputPath("encuentros.png"), fullPage: true });
    await participant.getByRole("button", { name: "Reservar encuentro" }).click();
    await expect(participant.getByText("Reserva confirmada", { exact: true })).toBeVisible();
    await participant.getByRole("button", { name: "Entrar al encuentro" }).click();
    await participant.getByLabel(/Entiendo que esta prueba comparte/).check();
    await participant.getByRole("button", { name: "Conectar con esta sala" }).click();
    await expect(participant.getByText("Conectado al servidor", { exact: true })).toBeVisible();
    expect(await participant.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await mod.close(); await user.close(); }
});

test("tres cuentas comparten una convocatoria programada", async ({ browser }, info) => {
  const mod = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const people = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use })));
  try {
    const headers = { Origin: "http://127.0.0.1:4190" };
    expect((await mod.request.post("/api/auth/login", { headers, data: { username: "moderator_fixture", password: "Una clave exclusiva del fixture 123" } })).status()).toBe(200);
    const meeting = await mod.request.post("/api/meetings", { headers, data: { themeId: "crear", startsAt: Date.now() + 7200_000, capacity: 3 } });
    expect(meeting.status()).toBe(201);
    for (let i = 0; i < people.length; i++) await register(people[i], `reunion_web_${info.project.name}_${i}`);
    const pages = await Promise.all(people.map((context) => context.newPage()));
    for (const page of pages) {
      await page.goto("/#discover");
      const card = page.getByRole("article").filter({ hasText: "Ideas tan locas que podrían funcionar" });
      await card.getByRole("button", { name: "Reservar encuentro" }).click();
      await card.getByRole("button", { name: "Entrar al encuentro" }).click();
      await page.getByLabel(/Entiendo que esta prueba comparte/).check(); await page.getByRole("button", { name: "Conectar con esta sala" }).click();
      await expect(page.getByText("Conectado al servidor", { exact: true })).toBeVisible();
    }
    await expect(pages[0].getByRole("button", { name: "Iniciar encuentro compartido" })).toBeEnabled();
    await pages[0].getByRole("button", { name: "Iniciar encuentro compartido" }).click();
    await pages[0].getByLabel("Tu mensaje de prueba").fill("Una conversación entre tres personas");
    await pages[0].getByRole("button", { name: "Enviar mensaje de prueba" }).click();
    await expect(pages[2].getByText("Una conversación entre tres personas", { exact: true })).toBeVisible();
  } finally { await mod.close(); for (const context of people) await context.close(); }
});

test("una cancelación muestra el motivo a la persona con reserva", async ({ browser }, info) => {
  const mod = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const user = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    const headers = { Origin: "http://127.0.0.1:4190" };
    expect((await mod.request.post("/api/auth/login", { headers, data: { username: "moderator_fixture", password: "Una clave exclusiva del fixture 123" } })).status()).toBe(200);
    await register(user, `cancelacion_${info.project.name}`);
    const created = await mod.request.post("/api/meetings", { headers, data: { themeId: "cafe", startsAt: Date.now() + 7200_000, capacity: 4 } });
    const id = (await created.json()).meeting.id;
    expect((await user.request.post(`/api/reservations/${id}`, { headers })).status()).toBe(200);
    const moderator = await mod.newPage(); await moderator.goto("/#discover");
    const card = moderator.getByRole("article").filter({ hasText: "¿Y si pudieras vivir otra vida?" }).last();
    await card.getByText("Cancelar convocatoria", { exact: true }).click();
    await card.getByLabel("Motivo de cancelación").fill("La persona anfitriona no podrá asistir");
    await card.getByRole("button", { name: "Confirmar cancelación" }).click();
    const participant = await user.newPage(); await participant.goto("/#discover");
    await expect(participant.getByText(/Encuentro cancelado. La persona anfitriona no podrá asistir/)).toBeVisible();
    await expect(participant.getByRole("button", { name: "Entrar al encuentro" })).toHaveCount(0);
    await participant.getByRole("button", { name: "Quitar aviso" }).click();
    await expect(participant.getByText(/Encuentro cancelado/)).toHaveCount(0);
  } finally { await mod.close(); await user.close(); }
});
