import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
let directory: string,
  largePhoto: string,
  rotatedPhoto: string,
  smallPhoto: string;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "afinia-photo-"));
  largePhoto = join(directory, "foto-grande.jpg");
  rotatedPhoto = join(directory, "foto-camara.jpg");
  smallPhoto = join(directory, "foto.png");
  await sharp({
    create: {
      width: 6000,
      height: 4000,
      channels: 3,
      background: "#808080",
      noise: { type: "gaussian", mean: 128, sigma: 45 },
    },
  })
    .jpeg({ quality: 90 })
    .toFile(largePhoto);
  await sharp({
    create: { width: 3200, height: 1600, channels: 3, background: "#ac7854" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toFile(rotatedPhoto);
  await sharp({
    create: { width: 1600, height: 900, channels: 3, background: "#b78468" },
  })
    .png()
    .toFile(smallPhoto);
});
test.afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function composer(page: Page) {
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
        reservations: [],
        feedback: [],
        blocked: [],
      }),
    ),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await page
    .getByLabel("Un título para tu conversación")
    .fill("Una foto de mi cámara");
  await page
    .getByLabel("¿Qué te gustaría compartir?", { exact: true })
    .fill("Quiero compartir esta foto sin prepararla antes.");
  await page
    .getByRole("button", { name: "Añadir una imagen", exact: true })
    .click();
}
async function attachAndPublish(page: Page) {
  await expect(page.getByAltText("Vista previa de tu imagen")).toBeVisible();
  await page
    .getByLabel("Descripción de la imagen")
    .fill("Foto preparada automáticamente");
  await page
    .getByRole("button", { name: "Adjuntar a mi publicación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publicar en la maqueta", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByAltText("Foto preparada automáticamente"),
  ).toBeVisible();
}
async function asset(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ size: number; type: string; data: string }>(
        (resolve, reject) => {
          const open = indexedDB.open("afinia.images.v1");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result,
              request = db.transaction("images").objectStore("images").getAll();
            request.onsuccess = () => {
              const blob = request.result[0].blob as Blob;
              db.close();
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  size: blob.size,
                  type: blob.type,
                  data: String(reader.result).split(",")[1],
                });
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            };
          };
        },
      ),
  );
}

test("una foto de 24 megapíxeles y más de 5 MB se reduce, publica y recupera automáticamente", async ({
  page,
}) => {
  test.setTimeout(60_000);
  expect((await stat(largePhoto)).size).toBeGreaterThan(5 * 1024 * 1024);
  await composer(page);
  await page.locator("input[type=file]").setInputFiles(largePhoto);
  await expect(page.getByText(/reducida automáticamente desde/)).toBeVisible({
    timeout: 30000,
  });
  await attachAndPublish(page);
  const stored = await asset(page);
  expect(stored.size).toBeLessThanOrEqual(350 * 1024);
  const metadata = await sharp(Buffer.from(stored.data, "base64")).metadata();
  expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(1280);
  expect(metadata.exif).toBeUndefined();
});

for (const decoder of ["missing", "rejects"] as const) {
  test(`sin WebP, con decodificador ${decoder}, la foto conserva orientación y se descarga como JPG`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(window, "createImageBitmap", {
        value:
          mode === "missing"
            ? undefined
            : async () => {
                throw Error("Bitmap decoding unavailable");
              },
        configurable: true,
      });
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        original.call(
          this,
          callback,
          type === "image/webp" ? "image/png" : type,
          quality,
        );
      };
    }, decoder);
    await composer(page);
    await page.locator("input[type=file]").setInputFiles(rotatedPhoto);
    await expect(page.getByAltText("Vista previa de tu imagen")).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByAltText("Vista previa de tu imagen")
          .evaluate((i: HTMLImageElement) => ({
            width: i.naturalWidth,
            height: i.naturalHeight,
          })),
      )
      .toEqual({ width: 640, height: 1280 });
    await attachAndPublish(page);
    const stored = await asset(page);
    expect(stored.type).toBe("image/jpeg");
    expect(stored.size).toBeLessThanOrEqual(350 * 1024);
    const metadata = await sharp(Buffer.from(stored.data, "base64")).metadata();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    await page
      .getByRole("button", { name: "Ampliar imagen compartida", exact: true })
      .click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Descargar imagen", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe("afinia-imagen.jpg");
  });
}

test("si bajar calidad no basta, se reduce también la resolución sin pedir otra foto", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      const tooLarge = Math.max(this.width, this.height) > 800;
      original.call(
        this,
        (blob) =>
          callback(
            blob && tooLarge
              ? new Blob([new Uint8Array(400 * 1024)], { type: blob.type })
              : blob,
          ),
        type,
        quality,
      );
    };
  });
  await composer(page);
  await page.locator("input[type=file]").setInputFiles(smallPhoto);
  await attachAndPublish(page);
  const stored = await asset(page);
  expect(stored.size).toBeLessThanOrEqual(350 * 1024);
  const metadata = await sharp(Buffer.from(stored.data, "base64")).metadata();
  expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(800);
});

test("los fallos de codificadores alternativos terminan en un PNG válido en lugar de rechazar la foto", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (type === "image/webp") {
        callback(null);
        return;
      }
      if (type === "image/jpeg") throw Error("Encoder unavailable");
      original.call(this, callback, type, quality);
    };
  });
  await composer(page);
  await page.locator("input[type=file]").setInputFiles(smallPhoto);
  await attachAndPublish(page);
  const stored = await asset(page);
  expect(stored.type).toBe("image/png");
  expect(stored.size).toBeLessThanOrEqual(350 * 1024);
  await expect(
    page.getByAltText("Foto preparada automáticamente"),
  ).toBeVisible();
});

test("se reconoce la foto por su contenido cuando la cámara no informa MIME, y se rechaza un SVG disfrazado", async ({
  page,
}) => {
  await composer(page);
  const photo = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: "#758963" },
  })
    .jpeg()
    .toBuffer();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "camera", mimeType: "", buffer: photo });
  await expect(page.getByAltText("Vista previa de tu imagen")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "camera.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await expect(page.getByRole("alert")).toContainText("JPG, PNG o WebP");
  await expect(
    page.getByRole("button", {
      name: "Adjuntar a mi publicación",
      exact: true,
    }),
  ).toBeDisabled();
  await page.locator("input[type=file]").setInputFiles(smallPhoto);
  await attachAndPublish(page);
});

test("la reducción nativa respeta una foto de cámara con orientación EXIF", async ({
  page,
}) => {
  await composer(page);
  await page.locator("input[type=file]").setInputFiles(rotatedPhoto);
  await expect(page.getByAltText("Vista previa de tu imagen")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Vista previa de tu imagen")
        .evaluate((image: HTMLImageElement) => ({
          width: image.naturalWidth,
          height: image.naturalHeight,
        })),
    )
    .toEqual({ width: 640, height: 1280 });
  await attachAndPublish(page);
  expect((await asset(page)).size).toBeLessThanOrEqual(350 * 1024);
});

test("se conserva un límite amplio del original y se puede elegir otra foto sin perder el editor", async ({
  page,
}) => {
  await composer(page);
  await page.locator("input[type=file]").evaluate((input: HTMLInputElement) => {
    const files = new DataTransfer();
    files.items.add(
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], "foto-excesiva.jpg", {
        type: "image/jpeg",
      }),
    );
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("alert")).toContainText("supera los 20 MB");
  await expect(
    page.getByRole("button", {
      name: "Adjuntar a mi publicación",
      exact: true,
    }),
  ).toBeDisabled();
  // A valid original exactly at the advertised limit is still accepted.
  const jpeg = await sharp({
    create: { width: 640, height: 480, channels: 3, background: "#b78468" },
  })
    .jpeg()
    .toBuffer();
  await page
    .locator("input[type=file]")
    .evaluate((input: HTMLInputElement, bytes: number[]) => {
      const files = new DataTransfer();
      files.items.add(
        new File(
          [
            new Uint8Array(bytes),
            new Uint8Array(20 * 1024 * 1024 - bytes.length),
          ],
          "foto-en-el-limite.jpg",
          { type: "image/jpeg" },
        ),
      );
      input.files = files.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, Array.from(jpeg));
  await attachAndPublish(page);
});
