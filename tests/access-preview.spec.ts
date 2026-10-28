import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("la demo explica el acceso sin simular correo confirmado ni enviar solicitudes a una API", async ({
  page,
}) => {
  const api: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) api.push(r.url());
  });
  await page.goto("/#plaza");
  const button = page.getByRole("button", { name: "Acceso", exact: true });
  await button.click();
  const dialog = page.getByRole("dialog", {
    name: "Explorar y participar",
    exact: true,
  });
  await expect(
    dialog.getByText(/No crea cuentas reales ni envía correos/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "Explora primero, participa con tu cuenta.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  expect(api).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
