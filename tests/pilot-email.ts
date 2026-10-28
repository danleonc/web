import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
// Codes exist only in the isolated fixture's mailbox, never in production HTTP.
export async function confirmTestEmail(page: Page, name: string) {
  const email = `${name}@example.test`;
  await page.getByLabel("Correo para confirmar", { exact: true }).fill(email);
  await page
    .getByRole("checkbox", { name: /Confirmo que soy mayor de 18 años/ })
    .check();
  await page
    .getByRole("button", { name: "Enviar código de confirmación", exact: true })
    .click();
  await expect(
    page.getByText(`Código enviado a ${email}.`, { exact: false }),
  ).toBeVisible();
  const { code } = JSON.parse(
    await readFile(
      join(
        tmpdir(),
        "afinia-test-pilot-mailbox",
        createHash("sha256").update(email).digest("hex") + ".json",
      ),
      "utf8",
    ),
  );
  await page.getByLabel("Código de confirmación", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "Confirmar correo", exact: true })
    .click();
  await expect(
    page.getByText("Correo confirmado", { exact: true }),
  ).toBeVisible();
}
