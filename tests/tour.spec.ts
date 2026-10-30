import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const guide = (page: Page) => page.getByRole("dialog", { name: "Conoce Nexafia", exact: true });
function nav(page: Page, name: string) {
  return page.getByRole("navigation", { name: (page.viewportSize()?.width || 0) <= 700 ? "Espacios de Nexafia" : "Navegación principal", exact: true }).getByRole("button", { name, exact: true });
}
async function openFromMenu(page: Page) {
  if ((page.viewportSize()?.width || 0) <= 700)
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page.getByRole("button", { name: "Conoce Nexafia", exact: true }).click();
}
test("los accesos reales llevan por Plaza, Conexiones y Encuentros sin reservar", async ({ page }) => {
  await page.goto("/#connections");
  const before = await page.evaluate(() => localStorage.getItem("entre.prototype.v1"));
  const history = await page.evaluate(() => window.history.length);
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  await expect(nav(page, "La Plaza")).toBeFocused();
  await nav(page, "La Plaza").click();
  await expect(page).toHaveURL(/#plaza$/);
  const affinity = page.locator(".ecosystem-paths").getByRole("button", { name: /Conexiones/ });
  await expect(affinity).toBeFocused();
  await affinity.click();
  await expect(page).toHaveURL(/#connections$/);
  const invitations = page.getByRole("button", { name: /^Tus invitaciones/ });
  await expect(invitations).toBeFocused();
  await invitations.click();
  await expect(invitations).toHaveAttribute("aria-pressed", "true");
  await expect(nav(page, "Encuentros")).toBeFocused();
  await nav(page, "Encuentros").click();
  await expect(page).toHaveURL(/#discover$/);
  const detail = page.getByRole("button", { name: /^Ver encuentro:/ }).first();
  await expect(detail).toBeFocused();
  await detail.click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Tu próximo encuentro", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("entre.prototype.v1"))).toBe(before);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
});
test("omitir se recuerda, salir vuelve al origen y el menú móvil se cierra al iniciar", async ({ page }) => {
  await page.goto("/#agenda");
  await page.goto("/#plaza");
  await page.getByRole("button", { name: "Ahora no, omitir recorrido", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver recorrido", exact: true })).toHaveCount(0);
  await page.goto("/#agenda");
  await openFromMenu(page);
  if ((page.viewportSize()?.width || 0) <= 700)
    await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toHaveAttribute("aria-expanded", "false");
  await nav(page, "La Plaza").click();
  await page.keyboard.press("Escape");
  await expect(guide(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#agenda$/);
  if ((page.viewportSize()?.width || 0) <= 700) await expect(page.locator("#main-content")).toBeFocused();
  else await expect(page.getByRole("button", { name: "Conoce Nexafia", exact: true })).toBeFocused();
});
test("visitar secciones y salir conserva borrador, reservas y favoritos", async ({ page }) => {
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
  await nav(page, "La Plaza").click();
  await page.locator(".ecosystem-paths").getByRole("button", { name: /Conexiones/ }).click();
  await guide(page).getByRole("button", { name: "Salir del recorrido", exact: true }).click();
  await expect(page).toHaveURL(/#plaza$/);
  await page.getByRole("button", { name: "Compartir algo", exact: true }).click();
  await expect(page.getByLabel("Un título para tu conversación")).toHaveValue("Mi borrador sigue aquí");
  expect(await page.evaluate(() => localStorage.getItem("entre.prototype.v1"))).toBe(original);
});
test("Siguiente activa el componente real y Anterior regresa sin almacenamiento", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("blocked"); };
    Storage.prototype.setItem = () => { throw new Error("blocked"); };
  });
  await page.goto("/#discover");
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  await guide(page).getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/#plaza$/);
  await guide(page).getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/#connections$/);
  await guide(page).getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(page).toHaveURL(/#plaza$/);
  for (let i = 0; i < 3; i++) await guide(page).getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/#discover$/);
  await guide(page).getByRole("button", { name: "Terminar", exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#discover$/);
});
test("a 320 px la explicación no tapa el objetivo y se puede activar con teclado", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    const target = i === 0 ? nav(page, "La Plaza") : i === 1 ? page.locator(".ecosystem-paths").getByRole("button", { name: /Conexiones/ }) : i === 2 ? page.getByRole("button", { name: /^Tus invitaciones/ }) : i === 3 ? nav(page, "Encuentros") : page.getByRole("button", { name: /^Ver encuentro:/ }).first();
    await expect(target).toBeFocused();
    await expect(target).toBeInViewport({ ratio: 1 });
    await expect(guide(page)).toBeInViewport({ ratio: 1 });
    const a = (await target.boundingBox())!, b = (await guide(page).boundingBox())!;
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.keyboard.press("Enter");
  }
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Tu próximo encuentro", exact: true })).toBeVisible();
});
test("el foco se adapta al pasar de navegación móvil a escritorio", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ver recorrido", exact: true }).click();
  await expect(nav(page, "La Plaza")).toBeFocused();
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(nav(page, "La Plaza")).toBeFocused();
  await nav(page, "La Plaza").click();
  await expect(page.locator(".ecosystem-paths").getByRole("button", { name: /Conexiones/ })).toBeFocused();
});
