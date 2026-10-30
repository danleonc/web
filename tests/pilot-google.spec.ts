import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockGoogleCode } from "./server/mock-google.mjs";
import { confirmTestEmail } from "./pilot-email";
async function provider(page: Page, overrides: Record<string, unknown>) {
  await page.route(
    "https://accounts.google.com/o/oauth2/v2/auth?**",
    async (route) => {
      const auth = new URL(route.request().url());
      const args = new URLSearchParams({
        state: auth.searchParams.get("state")!,
      });
      if (overrides.cancel) args.set("error", "access_denied");
      else args.set("code", mockGoogleCode(auth.href, overrides));
      await route.fulfill({
        status: 302,
        headers: {
          Location: "http://127.0.0.1:4190/api/auth/google-callback?" + args,
        },
        body: "",
      });
    },
  );
}
test("Google vuelve al espacio elegido y exige alias/18+ antes de participar, sin contraseña local ni verificación de identidad", async ({
  page,
}, info) => {
  const tag = info.project.name.replaceAll("-", "_");
  await provider(page, { sub: "new_" + tag, email: `new_${tag}@gmail.com` });
  await page.goto("/#plaza");
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continuar con Google", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Tu cuenta en Nexafia",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", {
      name: "Elige cómo te conocerán.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await page.request.post("/api/reservations/cafe", { data: {} })).status(),
  ).toBe(403);
  await expect(
    dialog.getByRole("button", { name: "Continuar en Nexafia", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Tu alias público", { exact: true })
    .fill("Luz Google");
  if (info.project.name === "pilot-mobile")
    expect(
      await dialog
        .getByLabel("Tu alias público")
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
  await dialog
    .getByRole("checkbox", { name: /Declaro que soy mayor de 18 años/ })
    .check();
  await dialog
    .getByRole("button", { name: "Guardar alias y continuar", exact: true })
    .click();
  await expect(
    dialog.getByText("Correo confirmado", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(/no se ha creado una contraseña local/),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Continuar en Nexafia", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await expect(page.getByLabel("Un título para tu conversación")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("#plaza");
});
test("vincular Google conserva la cuenta y el borrador; permite entrar luego con el mismo sujeto", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  const name = "link_" + info.project.name.replaceAll("-", "_"),
    email = `${name}@example.test`;
  await provider(page, { sub: "linked_" + name, email });
  await page.goto("/#shared");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Usuario", { exact: true }).fill(name);
  await page.getByLabel("Nombre en la sala", { exact: true }).fill("Luz");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Una contraseña de enlace para Google 123");
  await page
    .getByRole("checkbox", { name: /Declaro que soy mayor de 18 años/ })
    .check();
  await page
    .getByRole("button", { name: "Guardar mi cuenta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ya guardé mi clave", exact: true })
    .click();
  await confirmTestEmail(page, name);
  const prior = (await (await page.request.get("/api/session")).json()).id;
  await page.goto("/#plaza");
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await page
    .getByLabel("Un título para tu conversación")
    .fill("Una conversación para retomar");
  await page
    .getByLabel("¿Qué te gustaría compartir?", { exact: true })
    .fill("Este texto debe volver después de vincular Google.");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
  await page
    .getByRole("button", { name: "Vincular cuenta de Google", exact: true })
    .click();
  const d = page.getByRole("dialog", {
    name: "Tu cuenta en Nexafia",
    exact: true,
  });
  await expect(d.getByText(/Cuenta de Google vinculada/)).toBeVisible();
  expect((await (await page.request.get("/api/session")).json()).id).toBe(
    prior,
  );
  await d
    .getByRole("button", { name: "Continuar en Nexafia", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await expect(page.getByLabel("Un título para tu conversación")).toHaveValue(
    "Una conversación para retomar",
  );
  await expect(
    page.getByLabel("¿Qué te gustaría compartir?", { exact: true }),
  ).toHaveValue("Este texto debe volver después de vincular Google.");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continuar con Google", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(/Cuenta de Google vinculada/),
  ).toBeVisible();
  expect((await (await page.request.get("/api/session")).json()).id).toBe(
    prior,
  );
});
test("cancelar Google permite volver a intentar sin crear cuenta y un nonce alterado no inicia sesión", async ({
  page,
}) => {
  await provider(page, { cancel: true });
  await page.goto("/#connections");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Continuar con Google", exact: true })
    .click();
  await expect(
    page.getByRole("alert").getByText(/Cancelaste el acceso con Google/),
  ).toBeVisible();
  expect((await page.request.get("/api/session")).status()).toBe(401);
  expect(new URL(page.url()).hash).toBe("#connections");
  await page.unroute("https://accounts.google.com/o/oauth2/v2/auth?**");
  await provider(page, { nonce: "altered" });
  await page
    .getByRole("button", { name: "Continuar con Google", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "La respuesta de Google no se pudo validar",
  );
  expect((await page.request.get("/api/session")).status()).toBe(401);
});
