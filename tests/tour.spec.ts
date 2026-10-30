import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function openFromMenu(page: Page) {
  if ((page.viewportSize()?.width || 0) <= 700)
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Conoce Nexafia", exact: true });
  await trigger.click();
  return trigger;
}
test("tres espacios sin navegar ni crear actividad; termina donde la persona elige", async ({ page }) => {
  await page.goto("/#connections");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Conoce Nexafia", exact: true });
  const before = await page.evaluate(() => localStorage.getItem("entre.prototype.v1"));
  for (const title of ["La Plaza", "Conexiones", "Encuentros"]) {
    await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#connections$/);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    if (title !== "Encuentros") await dialog.getByRole("button", { name: "Siguiente", exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Conexiones", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Siguiente", exact: true }).click();
  await dialog.getByRole("button", { name: "Ver encuentros", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/#discover$/);
  expect(await page.evaluate(() => localStorage.getItem("entre.prototype.v1"))).toBe(before);
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver recorrido", exact: true })).toHaveCount(0);
});
test("descartar la invitación se recuerda y el menú permite volver con Escape y foco", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ahora no, omitir recorrido", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver recorrido", exact: true })).toHaveCount(0);
  const trigger = await openFromMenu(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Conoce Nexafia", exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole("heading", { name: "La Plaza", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salir del recorrido", exact: true }).click();
  await expect(trigger).toBeFocused();
});
test("abrir y cerrar conserva el borrador, las reservas y favoritos existentes", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("entre.prototype.v1", JSON.stringify({
    profile: { alias: "Luz", interests: ["Música"], boundaries: [], availability: "Sin preferencia", adult: true },
    reservations: ["cafe"], feedback: [], blocked: [], stickerFavorites: ["moka-1"], stickerRecent: [],
  })));
  await page.reload();
  const original = await page.evaluate(() => localStorage.getItem("entre.prototype.v1"));
  await page.getByRole("button", { name: "Compartir algo", exact: true }).click();
  await page.getByLabel("Un título para tu conversación").fill("Mi borrador sigue aquí");
  await page.keyboard.press("Escape");
  await openFromMenu(page);
  await page.keyboard.press("Escape");
  if ((page.viewportSize()?.width || 0) <= 700)
    await page.getByRole("button", { name: "Cerrar menú de navegación", exact: true }).click();
  await page.getByRole("button", { name: "Compartir algo", exact: true }).click();
  await expect(page.getByLabel("Un título para tu conversación")).toHaveValue("Mi borrador sigue aquí");
  expect(await page.evaluate(() => localStorage.getItem("entre.prototype.v1"))).toBe(original);
});
test("el recorrido funciona sin almacenamiento y permite elegir La Plaza", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("blocked"); };
    Storage.prototype.setItem = () => { throw new Error("blocked"); };
  });
  await page.goto("/#discover");
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Conoce Nexafia", exact: true });
  await dialog.getByRole("button", { name: "Siguiente", exact: true }).click();
  await dialog.getByRole("button", { name: "Siguiente", exact: true }).click();
  await dialog.getByRole("button", { name: "Explorar La Plaza", exact: true }).click();
  await expect(page).toHaveURL(/#plaza$/);
  await expect(page.getByRole("heading", { name: /Las buenas conexiones/ })).toBeVisible();
});

test("cerrar desde la invitación inicial devuelve el foco al contenido", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Conoce Nexafia", exact: true })).toHaveCount(0);
  await expect(page.locator("#main-content")).toBeFocused();
});
test("en una pantalla pequeña cada paso comienza con su título visible", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Conoce Nexafia", exact: true });
  await dialog.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Conexiones", exact: true })).toBeInViewport();
  await dialog.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Encuentros", exact: true })).toBeInViewport();
});
