import { test, expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
const title = "¿Qué canción sería el tráiler de tu vida?";
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
async function openThread(page: Page, name = title) {
  await page.getByRole("button", { name, exact: true }).click();
  return page.getByRole("dialog", { name, exact: true });
}
async function attach(page: Page, thread: Locator, description: string) {
  await thread
    .getByRole("button", { name: /^(Añadir una imagen|Cambiar imagen)$/ })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: "#b78468" },
    })
      .jpeg()
      .toBuffer(),
  });
  await expect(page.getByAltText("Vista previa de tu imagen")).toBeVisible();
  await page.getByLabel("Descripción de la imagen").fill(description);
  await page
    .getByRole("button", { name: "Adjuntar a mi respuesta", exact: true })
    .click();
}
async function assets(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ id: string; size: number }[]>((resolve, reject) => {
        const r = indexedDB.open("afinia.images.v1", 1);
        r.onupgradeneeded = () =>
          r.result.createObjectStore("images", { keyPath: "id" });
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("images").objectStore("images").getAll();
          q.onsuccess = () => {
            db.close();
            resolve(q.result.map(({ id, size }) => ({ id, size })));
          };
          q.onerror = () => {
            db.close();
            reject(q.error);
          };
        };
        r.onerror = () => reject(r.error);
      }),
  );
}

test("foto sin texto: vista completa, persistencia, ocultar, reportar y borrar el archivo", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await seed(page);
  let thread = await openThread(page);
  await expect(
    thread.getByRole("button", { name: "Guardar respuesta", exact: true }),
  ).toBeDisabled();
  await attach(page, thread, "Mi foto de un paisaje");
  expect(await assets(page)).toEqual([]);
  await thread
    .getByRole("button", {
      name: "Ver foto completa de mi respuesta",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Tu foto completa", exact: true })
      .getByAltText("Mi foto de un paisaje"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    thread.getByRole("button", {
      name: "Ver foto completa de mi respuesta",
      exact: true,
    }),
  ).toBeFocused();
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  const reply = thread
    .locator(".plaza-reply")
    .filter({ has: page.getByAltText("Mi foto de un paisaje") });
  await expect(reply.getByAltText("Mi foto de un paisaje")).toBeVisible();
  const files = await assets(page);
  expect(files).toHaveLength(1);
  expect(files[0].size).toBeLessThanOrEqual(350 * 1024);
  await page.reload();
  thread = await openThread(page);
  await thread
    .getByRole("button", { name: "Ampliar imagen compartida", exact: true })
    .click();
  const full = page.getByRole("dialog", {
    name: "Imagen compartida",
    exact: true,
  });
  await expect(full.getByAltText("Mi foto de un paisaje")).toBeVisible();
  await expect(
    full.getByRole("link", { name: "Descargar imagen" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await thread
    .getByRole("button", { name: "Ocultar imagen", exact: true })
    .click();
  await page.reload();
  thread = await openThread(page);
  await expect(thread.getByText("Ocultaste esta imagen.")).toBeVisible();
  await thread
    .getByRole("button", { name: "Volver a mostrar", exact: true })
    .click();
  await thread
    .getByRole("button", { name: "Reportar imagen", exact: true })
    .click();
  await page.getByLabel("Motivo", { exact: true }).selectOption("contenido");
  await page
    .getByRole("button", { name: "Guardar reporte de prueba", exact: true })
    .click();
  await expect(
    page.getByText(/No se envió a un equipo de moderación/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await thread
    .getByRole("button", { name: "Eliminar mi respuesta", exact: true })
    .click();
  await expect(thread.getByAltText("Mi foto de un paisaje")).toHaveCount(0);
  await expect.poll(() => assets(page)).toEqual([]);
  const comments = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("entre.prototype.v1")!).plaza.comments,
  );
  expect(comments).toEqual([]);
});

test("borrador: cambiar, quitar y cancelar no guarda archivos; enviar sticker conserva texto y foto", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await seed(page);
  let thread = await openThread(page);
  await thread
    .getByLabel("Tu respuesta de prueba")
    .fill("La historia de mi fotografía");
  await attach(page, thread, "Primera foto");
  await attach(page, thread, "Foto elegida");
  await expect(thread.getByAltText("Primera foto")).toHaveCount(0);
  expect(await assets(page)).toEqual([]);
  await thread
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
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
    thread.getByRole("img", { name: "Sticker: Moka: Saludando", exact: true }),
  ).toBeVisible();
  await expect(thread.getByLabel("Tu respuesta de prueba")).toHaveValue(
    "La historia de mi fotografía",
  );
  await expect(thread.getByAltText("Foto elegida")).toBeVisible();
  await thread
    .getByRole("button", { name: "Quitar imagen", exact: true })
    .click();
  await expect(thread.locator(".reply-image-draft")).toHaveCount(0);
  await attach(page, thread, "Foto para cancelar");
  await page.keyboard.press("Escape");
  thread = await openThread(page);
  await expect(thread.locator(".reply-image-draft")).toHaveCount(0);
  expect(await assets(page)).toEqual([]);
  await thread
    .getByLabel("Tu respuesta de prueba")
    .fill("Texto que acompaña a mi imagen");
  await attach(page, thread, "Mi imagen final");
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  const reply = thread
    .locator(".plaza-reply")
    .filter({ has: page.getByAltText("Mi imagen final") });
  await expect(
    reply.getByText("Texto que acompaña a mi imagen", { exact: true }),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations.map((v) => v.id)).toEqual([]);
  expect(await thread.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(
    true,
  );
});

test("quitar publicaciones y superar cien respuestas limpia solo las imágenes afectadas", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await seed(page);
  let thread = await openThread(page);
  await attach(page, thread, "Primera respuesta para desplazar");
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(
    thread.getByAltText("Primera respuesta para desplazar"),
  ).toBeVisible();
  const original = (await assets(page))[0].id;
  await page.evaluate(() => {
    const key = "entre.prototype.v1",
      state = JSON.parse(localStorage.getItem(key)!);
    state.plaza.comments.push(
      ...Array.from({ length: 99 }, (_, i) => ({
        id: `reply-${i}`,
        postId: "libro-prestado",
        body: "Comentario anterior",
        author: "Luz",
        own: true,
      })),
    );
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  thread = await openThread(page);
  await thread
    .getByLabel("Tu respuesta de prueba")
    .fill("Nueva respuesta después del límite");
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect.poll(() => assets(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await page
    .getByLabel("Un título para tu conversación")
    .fill("Mi conversación con imágenes");
  await page
    .getByLabel("¿Qué te gustaría compartir?", { exact: true })
    .fill("Un espacio de prueba para compartir nuestras fotos.");
  await page
    .getByRole("button", { name: "Publicar en la maqueta", exact: true })
    .click();
  thread = await openThread(page, "Mi conversación con imágenes");
  await attach(page, thread, "Imagen de una respuesta propia");
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(
    thread.getByAltText("Imagen de una respuesta propia"),
  ).toBeVisible();
  const own = (await assets(page))[0].id;
  expect(own).not.toBe(original);
  await page.keyboard.press("Escape");
  thread = await openThread(page);
  await attach(page, thread, "Imagen en otra conversación");
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(
    thread.getByAltText("Imagen en otra conversación"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  thread = await openThread(page, "Mi conversación con imágenes");
  await thread
    .getByRole("button", { name: "Eliminar publicación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sí, eliminar publicación", exact: true })
    .click();
  await expect
    .poll(async () => (await assets(page)).map((a) => a.id))
    .not.toContain(own);
  expect(await assets(page)).toHaveLength(1);
  thread = await openThread(page);
  await expect(
    thread.getByAltText("Imagen en otra conversación"),
  ).toBeVisible();
});

test("fallo de almacenamiento conserva el borrador para reintentar; referencias inválidas no dañan el perfil", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name: string, version?: number) {
      if (
        name === "afinia.images.v1" &&
        (window as unknown as { denyPhotos: boolean }).denyPhotos
      )
        throw Error("No se pudo guardar la imagen de prueba.");
      return version === undefined
        ? original.call(this, name)
        : original.call(this, name, version);
    };
  });
  await seed(page);
  let thread = await openThread(page);
  await thread
    .getByLabel("Tu respuesta de prueba")
    .fill("Mi texto no debe perderse");
  await attach(page, thread, "Foto para reintentar");
  await page.evaluate(() => {
    (window as unknown as { denyPhotos: boolean }).denyPhotos = true;
  });
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(thread.getByRole("alert")).toHaveText(
    "No se pudo guardar la imagen de prueba.",
  );
  await expect(thread.getByLabel("Tu respuesta de prueba")).toHaveValue(
    "Mi texto no debe perderse",
  );
  await expect(thread.getByAltText("Foto para reintentar")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { denyPhotos: boolean }).denyPhotos = false;
  });
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(
    thread
      .locator(".plaza-reply")
      .filter({ has: page.getByAltText("Foto para reintentar") }),
  ).toHaveCount(1);
  await page.evaluate(() => {
    const key = "entre.prototype.v1",
      state = JSON.parse(localStorage.getItem(key)!);
    state.plaza.comments.push({
      id: "malformed",
      postId: "cancion",
      body: "",
      author: "Luz",
      own: true,
      image: {
        id: "https://example.invalid/photo.png",
        description: "Referencia inválida",
      },
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  thread = await openThread(page);
  await expect(thread.getByAltText("Foto para reintentar")).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.plaza.comments).toHaveLength(1);
  expect(state.profile.alias).toBe("Luz");
  expect(state.reservations).toEqual(["cafe"]);
});
