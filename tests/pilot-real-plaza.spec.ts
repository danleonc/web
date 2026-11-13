import { test, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import AxeBuilder from "@axe-core/playwright";
import sharp from 'sharp';

test("páginas de encuentros permiten avanzar y volver", async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(context, `pages_${info.project.name}`);
    await context.route("**/api/activities?*", async route => {
      const offset = new URL(route.request().url()).searchParams.get("offset");
      const meeting = { id: offset === "200" ? "segundo" : "primero", title: offset === "200" ? "Encuentro siguiente" : "Primer encuentro", startsAt: "2030-01-01T12:00:00.000Z", minimum: 3, maximum: 4, reserved: 0, mine: false, accessible: false, bookingOpen: true, ended: false };
      await route.fulfill({ json: { activities: [meeting], nextOffset: offset === "200" ? null : 200 } });
    });
    const page = await context.newPage(); await page.goto('/#discover');
    await expect(page.getByRole('heading', { name: 'Primer encuentro' })).toBeVisible();
    await page.getByRole('button', { name: 'Más encuentros' }).click();
    await expect(page.getByRole('heading', { name: 'Encuentro siguiente' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('nav[aria-label="Páginas de encuentros"]').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath('paginas-encuentros.png'), fullPage: true });
    await page.getByRole('button', { name: 'Encuentros anteriores' }).click();
    await expect(page.getByRole('heading', { name: 'Primer encuentro' })).toBeVisible();
  } finally { await context.close(); }
});

async function register(context: BrowserContext, name: string) {
  const origin = "http://127.0.0.1:4190";
  const headers = { Origin: origin };
  expect((await context.request.post(`${origin}/api/auth/register`, { headers, data: { username: name, alias: name, adult: true, password: "Una contraseña larga de prueba 123" } })).status()).toBe(201);
  const email = `${name}@example.test`;
  expect((await context.request.post(`${origin}/api/auth/email-code`, { headers, data: { email, adult: true } })).status()).toBe(200);
  const { code } = JSON.parse(await readFile(join(tmpdir(), "afinia-test-pilot-mailbox", createHash("sha256").update(email).digest("hex") + ".json"), "utf8"));
  expect((await context.request.post(`${origin}/api/auth/confirm-email`, { headers, data: { code } })).status()).toBe(200);
}
test('el perfil se guarda en la cuenta y no se mezcla al cambiar de persona', async ({ browser }, info) => {
  const a = await browser.newContext({ baseURL: 'http://127.0.0.1:4190', ...info.project.use });
  const b = await browser.newContext({ baseURL: 'http://127.0.0.1:4190', ...info.project.use });
  try {
    await register(a, `perfil_ui_a_${info.project.name}`); await register(b, `perfil_ui_b_${info.project.name}`);
    const page = await a.newPage(); await page.goto('/#profile');
    await expect(page.getByText('Tu perfil y tu foto de Conexiones se guardan en tu cuenta de pruebas.')).toBeVisible();
    await page.getByRole('button', { name: 'Lectura', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: false }).click();
    await page.getByLabel('Prefiero evitar temas íntimos').check();
    await page.getByRole('button', { name: 'Guardar mi perfil' }).click();
    await expect(page.getByText('Tu perfil quedó guardado en tu cuenta.')).toBeVisible();
    await page.goto('/#profile'); await expect(page.getByRole('button', { name: 'Lectura', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const other = await b.newPage(); await other.goto('/#profile');
    await expect(other.getByRole('button', { name: 'Lectura', exact: true })).toHaveAttribute('aria-pressed', 'false');
  } finally { await a.close(); await b.close(); }
});
test('foto de Conexiones requiere declaración y se puede quitar', async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4190', ...info.project.use });
  try {
    await register(context, `foto_ui_${info.project.name}`);
    const page = await context.newPage(); await page.goto('/#profile');
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=', 'base64');
    await page.getByLabel('Elegir foto de galería').setInputFiles({ name:'foto.png', mimeType:'image/png', buffer:image });
    await expect(page.getByAltText('Vista previa de tu foto')).toBeVisible();
    await expect(page.getByRole('button', {name:'Guardar mi foto'})).toBeDisabled();
    await page.getByLabel('Declaro que aparezco en esta foto.').check();
    await page.getByRole('button', {name:'Guardar mi foto'}).click();
    await expect(page.getByText('Tu foto quedó guardada de forma privada.')).toBeVisible();
    page.once('dialog', dialog => void dialog.accept()); await page.getByRole('button', {name:'Quitar mi foto'}).click();
    await expect(page.getByText('Quitaste tu foto de Conexiones.')).toBeVisible();
  } finally { await context.close(); }
});
test('cada persona controla si revela su foto en una conexión', async ({ browser }, info) => {
  const a = await browser.newContext({ baseURL:'http://127.0.0.1:4190', ...info.project.use });
  const b = await browser.newContext({ baseURL:'http://127.0.0.1:4190', ...info.project.use });
  try {
    const nameA=`revela_a_${info.project.name}`, nameB=`revela_b_${info.project.name}`;
    await register(a,nameA); await register(b,nameB);
    const origin='http://127.0.0.1:4190', image=await sharp({create:{width:40,height:40,channels:3,background:'#285d4c'}}).png().toBuffer();
    for (const c of [a,b]) expect((await c.request.post('/api/account/profile/photo',{headers:{Origin:origin,'Content-Type':'image/png','X-Photo-Declaration':'yes'},data:image})).status()).toBe(201);
    const post=await (await a.request.post('/api/plaza/posts',{headers:{Origin:origin},data:{topic:'crear',title:'Tema de prueba',body:'Hola'}})).json();
    const invite=await (await b.request.post('/api/plaza/invitations',{headers:{Origin:origin},data:{kind:'post',contentId:post.post.id,note:''}})).json();
    expect((await a.request.post(`/api/plaza/invitations/${invite.invitation.id}/decision`,{headers:{Origin:origin},data:{action:'accept'}})).status()).toBe(200);
    const pa=await a.newPage(), pb=await b.newPage(); await pa.goto('/#connections'); await pb.goto('/#connections');
    await pa.getByRole('button',{name:'Abrir conversación'}).click(); await pb.getByRole('button',{name:'Abrir conversación'}).click();
    await expect(pb.getByText(`${nameA} aún no ha compartido su foto contigo.`)).toBeVisible();
    pa.once('dialog',dialog=>void dialog.accept()); await pa.getByRole('button',{name:'Compartir mi foto'}).click();
    await expect(pb.getByAltText(`Foto compartida por ${nameA}`)).toBeVisible({timeout:10000});
    await pb.getByRole('button',{name:'Reportar foto'}).click();
    await pb.getByRole('button',{name:'Registrar reporte'}).click();
    await expect(pb.getByRole('heading',{name:'Reporte registrado.'})).toBeVisible();
    await pb.getByRole('button',{name:'Entendido'}).click();
    await pa.getByRole('button',{name:'Dejar de compartir mi foto'}).click();
    await expect(pb.getByAltText(`Foto compartida por ${nameA}`)).toHaveCount(0,{timeout:10000});
  } finally { await a.close(); await b.close(); }
});
test("borrado limitado de una cuenta sin actividad en la base de pruebas", async ({ browser }, info) => {
  test.skip(process.env.NEXAFIA_TEST_ERASURE !== "1", "Función de borrado limitada a fixture explícito");
  const person = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const operator = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(person, `erase_ui_${info.project.name}`); const headers = { Origin: "http://127.0.0.1:4190" };
    expect((await person.request.post("/api/privacy/request", { headers, data: { action: "submit" } })).status()).toBe(200);
    expect((await operator.request.post("/api/auth/login", { headers, data: { username: "moderator_fixture", password: "Una clave exclusiva del fixture 123" } })).status()).toBe(200);
    const page = await operator.newPage(); await page.goto("/#plaza"); await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
    await page.getByText("Cola de privacidad", { exact: true }).click(); const item = page.getByRole("article").filter({ hasText: `erase_ui_${info.project.name}` });
    await item.getByRole("button", { name: "Acusar recibo" }).click(); await expect(item.getByText("Recibida para revisión", { exact: true })).toBeVisible();
    await item.getByText("Borrado limitado de cuenta", { exact: true }).click({ timeout: 5000 });
    if (info.project.name === "mobile") expect(await item.getByLabel("Confirmación de borrado").evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
    expect((await new AxeBuilder({ page }).include('[aria-label="Cuenta y reservas"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath("borrado-limitado.png"), fullPage: true });
    await item.getByLabel("Confirmación de borrado").fill("BORRAR CUENTA"); page.once("dialog", (dialog) => void dialog.accept());
    await item.getByRole("button", { name: "Borrar cuenta de base activa" }).click();
    await expect(page.getByText(/Cuenta retirada de la base activa/)).toBeVisible();
    expect((await person.request.get("/api/session")).status()).toBe(401);
  } finally { await person.close(); await operator.close(); }
});
test("borrado limitado se detiene si la cuenta tiene actividad", async ({ browser }, info) => {
  test.skip(process.env.NEXAFIA_TEST_ERASURE !== "1", "Función de borrado limitada a fixture explícito");
  const person = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use }); const operator = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(person, `erase_busy_${info.project.name}`); const headers = { Origin: "http://127.0.0.1:4190" };
    expect((await person.request.post("/api/plaza/posts", { headers, data: { topic: "crear", title: "Mi publicación", body: "No debe borrarse" } })).status()).toBe(201);
    await person.request.post("/api/privacy/request", { headers, data: { action: "submit" } });
    await operator.request.post("/api/auth/login", { headers, data: { username: "moderator_fixture", password: "Una clave exclusiva del fixture 123" } });
    const page=await operator.newPage(); await page.goto("/#plaza"); await page.getByRole("button", { name: "Mi cuenta", exact: true }).click(); await page.getByText("Cola de privacidad", { exact: true }).click();
    const item=page.getByRole("article").filter({ hasText: `erase_busy_${info.project.name}` }); await item.getByRole("button", { name: "Acusar recibo" }).click();
    await item.getByText("Borrado limitado de cuenta", { exact: true }).click(); await item.getByLabel("Confirmación de borrado").fill("BORRAR CUENTA"); page.once("dialog", dialog=>void dialog.accept());
    await item.getByRole("button", { name: "Borrar cuenta de base activa" }).click(); await expect(item.getByText(/requiere revisión manual; no se borró/)).toBeVisible();
    expect((await person.request.get("/api/session")).status()).toBe(200);
  } finally { await person.close(); await operator.close(); }
});
test("solicitud de eliminación se registra y acusa recibo sin borrar la cuenta", async ({ browser }, info) => {
  const person = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const operator = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(person, `privacy_ui_${info.project.name}`);
    const headers = { Origin: "http://127.0.0.1:4190" };
    expect((await operator.request.post("/api/auth/login", { headers, data: { username: "moderator_fixture", password: "Una clave exclusiva del fixture 123" } })).status()).toBe(200);
    const first = await person.newPage(); await first.goto("/#plaza"); await first.getByRole("button", { name: "Mi cuenta", exact: true }).click();
    await first.getByText("Solicitud de eliminación de cuenta", { exact: true }).click({ timeout: 5000 });
    await first.getByRole("button", { name: "Registrar solicitud" }).click();
    await expect(first.getByText(/Solicitud registrada.*no se ha eliminado/i)).toBeVisible();
    expect((await new AxeBuilder({ page: first }).include('[aria-label="Cuenta y reservas"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    await first.screenshot({ path: info.outputPath("solicitud-privacidad.png"), fullPage: true });
    const second = await operator.newPage(); await second.goto("/#plaza"); await second.getByRole("button", { name: "Mi cuenta", exact: true }).click();
    await second.getByText("Cola de privacidad", { exact: true }).click();
    await expect(second.getByText("Página 1", { exact: true })).toBeVisible();
    const item = second.getByRole("article").filter({ hasText: `privacy_ui_${info.project.name}` });
    await item.getByRole("button", { name: "Ver inventario de datos" }).click({ timeout: 5000 });
    await expect(item.getByText("Cuentas: 1", { exact: true })).toBeVisible();
    await expect(item.getByText(/No examina respaldos/)).toBeVisible();
    expect((await new AxeBuilder({ page: second }).include('[aria-label="Cuenta y reservas"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    await second.screenshot({ path: info.outputPath("inventario-privacidad.png"), fullPage: true });
    await item.getByRole("button", { name: "Acusar recibo" }).click();
    await expect(item.getByText("Recibida para revisión", { exact: true })).toBeVisible();
    await first.getByRole("button", { name: "Actualizar estado de solicitud" }).click();
    await expect(first.getByText(/Recibida para revisión.*no se ha eliminado/i)).toBeVisible();
    await first.getByRole("button", { name: "Cancelar solicitud" }).click();
    await expect(first.getByText(/Solicitud cancelada/)).toBeVisible();
    expect((await person.request.get("/api/session")).status()).toBe(200);
  } finally { await person.close(); await operator.close(); }
});
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
    await expect(bea.getByLabel("Título de la conversación")).not.toBeVisible();
    await expect(bea.getByRole("button", { name: "Volver a La Plaza" })).toBeVisible();
    await bea.goBack();
    await expect(bea.getByLabel("Título de la conversación")).toBeVisible();
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
    await ana.getByRole("button", { name: "Volver a La Plaza" }).click();
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
    await page.getByRole("button", { name: "Volver a La Plaza" }).click();
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
    await expect(second.getByRole("heading", { name: "Tus solicitudes y conexiones" })).not.toBeVisible();
    await second.getByRole("button", { name: "Volver a Conexiones" }).click();
    await expect(second.getByRole("heading", { name: "Tus solicitudes y conexiones" })).toBeVisible();
    await second.getByRole("button", { name: "Abrir conversación" }).click();
    await second.getByLabel("Mensaje privado").fill("Hola, conversemos");
    await second.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(first.getByText("Conexión aceptada", { exact: true })).toBeVisible({ timeout: 12000 });
    await Promise.all([first.waitForResponse((response) => response.url().endsWith("/seen") && response.status() === 200, { timeout: 8000 }), first.getByRole("button", { name: "Abrir conversación" }).click()]);
    const seenNewMessage = first.waitForResponse((response) => response.url().endsWith("/seen") && response.status() === 200, { timeout: 12000 });
    await second.getByLabel("Mensaje privado").fill("Mensaje nuevo sin actualizar la página");
    await second.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(first.getByText("Mensaje nuevo sin actualizar la página", { exact: true })).toBeVisible({ timeout: 12000 });
    await seenNewMessage;
    second.once("dialog", (dialog) => void dialog.accept());
    await second.getByRole("article").filter({ hasText: "Mensaje nuevo sin actualizar la página" }).getByRole("button", { name: "Retirar mensaje" }).click();
    await expect(first.getByText("Mensaje nuevo sin actualizar la página", { exact: true })).toHaveCount(0, { timeout: 12000 });
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

test("la campana muestra respuestas reales y permite silenciar", async ({ browser }, info) => {
  const a = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  const b = await browser.newContext({ baseURL: "http://127.0.0.1:4190", ...info.project.use });
  try {
    await register(a, `bell_a_${info.project.name}`); await register(b, `bell_b_${info.project.name}`);
    const headers = { Origin: "http://127.0.0.1:4190" };
    const created = await a.request.post("/api/plaza/posts", { headers, data: { topic: "cultura", title: `Aviso ${info.project.name}`, body: "Hola" } });
    const { post } = await created.json();
    expect((await b.request.post(`/api/plaza/posts/${post.id}/replies`, { headers, data: { body: "Una respuesta" } })).status()).toBe(201);
    const page = await a.newPage(); await page.goto('/#plaza');
    const bell = page.getByRole('button', { name: /Notificaciones, 1 aviso sin leer/ }); await expect(bell).toBeVisible(); await bell.click();
    await expect(page.getByText('Nueva respuesta', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Silenciar/ }).click();
    await expect(page.getByRole('button', { name: /Reactivar/ })).toBeVisible();
    await page.getByRole('button', { name: /Nueva respuesta/ }).click();
    await expect(page.getByRole('heading', { name: `Aviso ${info.project.name}` })).toBeVisible();
    await expect(page.getByText('Una respuesta', { exact: true })).toBeVisible();
  } finally { await a.close(); await b.close(); }
});

test("La Plaza comparte imágenes y stickers entre cuentas", async ({browser}, info) => {
 const a=await browser.newContext({baseURL:"http://127.0.0.1:4190",...info.project.use});
 const b=await browser.newContext({baseURL:"http://127.0.0.1:4190",...info.project.use});
 try {
  await register(a,`media_a_${info.project.name}`); await register(b,`media_b_${info.project.name}`);
  const pa=await a.newPage(); await pa.goto('/#plaza');
  await pa.getByLabel('Título de la conversación').fill(`Imágenes ${info.project.name}`);
  await pa.getByLabel('Tu publicación').fill('Una foto para compartir'); await pa.getByRole('button',{name:'Publicar',exact:true}).click();
  const card=pa.getByRole('article').filter({hasText:`Imágenes ${info.project.name}`}); await card.getByRole('button',{name:'Agregar imagen'}).click();
  const sharp=(await import('sharp')).default; const buffer=await sharp({create:{width:100,height:100,channels:3,background:'#285d4c'}}).png().toBuffer();
  await pa.locator('input[type=file]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer});
  await pa.getByRole('button',{name:'Compartir imagen',exact:true}).click();
  await expect(card.getByRole('button',{name:'Ampliar imagen compartida'})).toBeVisible();
  const pb=await b.newPage(); await pb.goto('/#plaza'); const other=pb.getByRole('article').filter({hasText:`Imágenes ${info.project.name}`});
  await expect(other.getByRole('button',{name:'Ampliar imagen compartida'})).toBeVisible();
  await other.getByRole('button',{name:'Ver conversación'}).click(); await pb.getByRole('button',{name:'Enviar sticker'}).click();
  await pb.getByRole('button',{name:'Seleccionar sticker: Moka: Saludando'}).click(); await pb.getByRole('button',{name:'Enviar sticker',exact:true}).last().click();
  await expect(pb.getByAltText('Sticker: Moka: Saludando')).toBeVisible();
  await pa.reload(); await pa.getByRole('article').filter({hasText:`Imágenes ${info.project.name}`}).getByRole('button',{name:'Ver conversación'}).click();
  await expect(pa.getByAltText('Sticker: Moka: Saludando')).toBeVisible();
 } finally {await a.close(); await b.close();}
});

test("Conexiones comparte stickers e imágenes en el chat aceptado", async ({browser},info)=>{
 const a=await browser.newContext({baseURL:"http://127.0.0.1:4190",...info.project.use}); const b=await browser.newContext({baseURL:"http://127.0.0.1:4190",...info.project.use});
 try {
  await register(a,`pm_a_${info.project.name}`); await register(b,`pm_b_${info.project.name}`);
  const headers={Origin:"http://127.0.0.1:4190"};
  const p=await (await a.request.post('/api/plaza/posts',{headers,data:{topic:'crear',title:'Conexión imagen',body:'Hola'}})).json();
  const invite=await (await b.request.post('/api/plaza/invitations',{headers,data:{kind:'post',contentId:p.post.id,note:''}})).json();
  await a.request.post(`/api/plaza/invitations/${invite.invitation.id}/decision`,{headers,data:{action:'accept'}});
  const pa=await a.newPage(); await pa.goto('/#connections');
  const person=pa.getByRole('article').filter({hasText:`pm_b_${info.project.name}`}); await person.getByRole('button',{name:'Abrir conversación'}).click();
  await pa.getByLabel('Mensaje privado').fill('Para ti'); await pa.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
  const msg=pa.getByRole('article').filter({hasText:'Para ti'}); await msg.getByRole('button',{name:'Agregar imagen'}).click();
  const sharp=(await import('sharp')).default; const buffer=await sharp({create:{width:80,height:80,channels:3,background:'#285d4c'}}).png().toBuffer();
  await pa.locator('input[type=file]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer}); await pa.getByRole('button',{name:'Compartir imagen',exact:true}).click();
  await expect(msg.getByRole('button',{name:'Ampliar imagen compartida'})).toBeVisible();
  await pa.getByRole('button',{name:'Enviar sticker',exact:true}).click(); await pa.getByRole('button',{name:'Seleccionar sticker: Moka: Saludando'}).click(); await pa.getByRole('button',{name:'Enviar sticker',exact:true}).last().click();
  const pb=await b.newPage(); await pb.goto('/#connections'); await pb.getByRole('article').filter({hasText:`pm_a_${info.project.name}`}).getByRole('button',{name:'Abrir conversación'}).click();
  await expect(pb.getByRole('button',{name:'Ampliar imagen compartida'})).toBeVisible(); await expect(pb.getByAltText('Sticker: Moka: Saludando')).toBeVisible();
 } finally {await a.close();await b.close();}
});

test('La Plaza responde a un comentario con cita y acciones compactas', async ({browser},info)=>{
 const a=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use}); const b=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use});
 try {
  await register(a,`quote_a_${info.project.name}`); await register(b,`quote_b_${info.project.name}`); const h={Origin:'http://127.0.0.1:4190'};
  const p=await (await a.request.post('/api/plaza/posts',{headers:h,data:{topic:'cultura',title:`Cita ${info.project.name}`,body:'Hola'}})).json();
  await b.request.post(`/api/plaza/posts/${p.post.id}/replies`,{headers:h,data:{body:'Me encanta caminar'}});
  const page=await a.newPage();await page.goto('/#plaza');await page.getByRole('article').filter({hasText:`Cita ${info.project.name}`}).getByRole('button',{name:'Ver conversación'}).click();
  await page.getByRole('article').filter({hasText:'Me encanta caminar'}).getByRole('button',{name:'Responder a este comentario'}).click();
  await expect(page.getByRole('group',{name:`Respondiendo a quote_b_${info.project.name}`})).toBeVisible();
  await page.getByLabel('Tu respuesta').fill('Vamos al parque');await page.getByRole('button',{name:'Responder',exact:true}).click();
  const answer=page.getByRole('article').filter({hasText:'Vamos al parque'});await expect(answer.getByRole('button',{name:`Ver mensaje original de quote_b_${info.project.name}`})).toBeVisible();
  await expect(page.getByRole('button',{name:'Adjuntar imagen'})).toBeVisible();await expect(page.getByRole('button',{name:'Enviar sticker',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('respuesta-citada.png'),fullPage:true});
 } finally {await a.close();await b.close();}
});

test('adjuntar imagen desde el compositor crea una respuesta visible',async ({browser},info)=>{
 const a=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use});const b=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use});
 try {await register(a,`compose_a_${info.project.name}`);await register(b,`compose_b_${info.project.name}`);const h={Origin:'http://127.0.0.1:4190'};
 const p=await (await a.request.post('/api/plaza/posts',{headers:h,data:{topic:'cultura',title:`Foto directa ${info.project.name}`,body:'Hola'}})).json();
 const pa=await a.newPage();await pa.goto('/#plaza');await pa.getByRole('article').filter({hasText:`Foto directa ${info.project.name}`}).getByRole('button',{name:'Ver conversación'}).click();
 await pa.getByRole('button',{name:'Adjuntar imagen'}).click();const sharp=(await import('sharp')).default;const buffer=await sharp({create:{width:80,height:80,channels:3,background:'#285d4c'}}).png().toBuffer();
 await pa.locator('input[type=file]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer});await pa.getByRole('button',{name:'Compartir imagen',exact:true}).click();
 await expect(pa.getByRole('button',{name:'Ampliar imagen compartida'})).toBeVisible();
 const replies=await (await b.request.get(`/api/plaza/posts/${p.post.id}/replies`)).json();expect(replies.replies[0].imageId).toBeTruthy();
 } finally {await a.close();await b.close();}
});

test('adjuntar imagen desde Conexiones envía un mensaje a la otra cuenta',async ({browser},info)=>{
 const a=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use});const b=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use});
 try {await register(a,`direct_a_${info.project.name}`);await register(b,`direct_b_${info.project.name}`);const h={Origin:'http://127.0.0.1:4190'};
 const post=await (await a.request.post('/api/plaza/posts',{headers:h,data:{topic:'crear',title:'Directo',body:'Hola'}})).json();const inv=await (await b.request.post('/api/plaza/invitations',{headers:h,data:{kind:'post',contentId:post.post.id,note:''}})).json();await a.request.post(`/api/plaza/invitations/${inv.invitation.id}/decision`,{headers:h,data:{action:'accept'}});
 const pa=await a.newPage();await pa.goto('/#connections');await pa.getByRole('article').filter({hasText:`direct_b_${info.project.name}`}).getByRole('button',{name:'Abrir conversación'}).click();await pa.getByRole('button',{name:'Adjuntar imagen'}).click();
 const sharp=(await import('sharp')).default;const buffer=await sharp({create:{width:80,height:80,channels:3,background:'#285d4c'}}).png().toBuffer();await pa.locator('input[type=file]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer});await pa.getByRole('button',{name:'Compartir imagen',exact:true}).click();await expect(pa.getByRole('button',{name:'Ampliar imagen compartida'})).toBeVisible();
 const messages=await (await b.request.get(`/api/plaza/connections/${inv.invitation.id}/messages`)).json();expect(messages.messages[0].imageId).toBeTruthy();
 } finally {await a.close();await b.close();}
});

test('Conexiones responde a un mensaje y conserva la cita',async ({browser},info)=>{
 const a=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use});const b=await browser.newContext({baseURL:'http://127.0.0.1:4190',...info.project.use});
 try {await register(a,`cq_a_${info.project.name}`);await register(b,`cq_b_${info.project.name}`);const h={Origin:'http://127.0.0.1:4190'};
 const post=await (await a.request.post('/api/plaza/posts',{headers:h,data:{topic:'crear',title:'Cita privada',body:'Hola'}})).json();const inv=await (await b.request.post('/api/plaza/invitations',{headers:h,data:{kind:'post',contentId:post.post.id,note:''}})).json();const id=inv.invitation.id;await a.request.post(`/api/plaza/invitations/${id}/decision`,{headers:h,data:{action:'accept'}});
 await b.request.post(`/api/plaza/connections/${id}/messages`,{headers:h,data:{clientId:'cita-original-01',body:'Me encanta leer'}});
 const page=await a.newPage();await page.goto('/#connections');await page.getByRole('article').filter({hasText:`cq_b_${info.project.name}`}).getByRole('button',{name:'Abrir conversación'}).click();
 await page.getByRole('article').filter({hasText:'Me encanta leer'}).getByRole('button',{name:'Responder a este mensaje'}).click();await expect(page.getByRole('group',{name:`Respondiendo a cq_b_${info.project.name}`})).toBeVisible();
 await page.getByLabel('Mensaje privado').fill('Yo también');await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
 await expect(page.getByRole('article').filter({hasText:'Yo también'}).getByRole('button',{name:`Ver mensaje original de cq_b_${info.project.name}`})).toBeVisible();
 const messages=await (await b.request.get(`/api/plaza/connections/${id}/messages`)).json();expect(messages.messages[1].replyTo).toBe(messages.messages[0].id);
 } finally {await a.close();await b.close();}
});
