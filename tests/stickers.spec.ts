import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Legacy state intentionally has no sticker fields: existing profiles must survive migration.
async function seedProfile(page: Page) {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "entre.prototype.v1",
      JSON.stringify({
        profile: {
          alias: "Luz",
          interests: ["Conversar"],
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
async function enterRoom(page: Page) {
  await seedProfile(page);
  await page.goto("/#agenda");
  await page
    .getByRole("button", { name: "Entrar a la sala de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
}

test("catalog supports search, categories, preview, favorites and sending without losing draft", async ({
  page,
}) => {
  await enterRoom(page);
  await page.getByLabel("Tu mensaje de prueba").fill("Este texto sigue aquí");
  await page
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Elige un sticker",
    exact: true,
  });
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).toHaveCount(60);
  await picker.getByRole("button", { name: "Michi Rosa", exact: true }).click();
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).toHaveCount(6);
  await picker.getByLabel("Buscar stickers").fill("abrazo");
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).toHaveCount(1);
  await picker
    .getByRole("button", {
      name: "Agregar a favoritos: Michi Rosa: Abrazo con cariño",
      exact: true,
    })
    .click();
  await picker
    .getByRole("button", {
      name: "Seleccionar sticker: Michi Rosa: Abrazo con cariño",
      exact: true,
    })
    .click();
  await expect(
    picker.getByRole("img", {
      name: "Vista previa: Michi Rosa: Abrazo con cariño",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".sent-sticker")).toHaveCount(0);
  await picker
    .getByRole("button", { name: "Enviar sticker", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "Sticker: Michi Rosa: Abrazo con cariño",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Tu mensaje de prueba")).toHaveValue(
    "Este texto sigue aquí",
  );
  await page.getByRole("button", { name: "Enviar mensaje de prueba" }).click();
  await expect(
    page.getByText("Este texto sigue aquí", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  await picker.getByRole("button", { name: "Recientes", exact: true }).click();
  await expect(
    picker.getByRole("button", {
      name: "Seleccionar sticker: Michi Rosa: Abrazo con cariño",
      exact: true,
    }),
  ).toBeVisible();
  await picker.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Abrir stickers", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => {
      const v = JSON.parse(localStorage.getItem("entre.prototype.v1")!);
      return [v.stickerFavorites, v.stickerRecent];
    }),
  ).toEqual([["michi-rosa-3"], ["michi-rosa-3"]]);
});

test("private demo reuses preferences, nested picker closes independently and chat is ephemeral", async ({
  page,
}) => {
  await enterRoom(page);
  await page
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Agregar a favoritos: Moka: Saludando",
      exact: true,
    })
    .click();
  await page.keyboard.press("Escape");
  await page.goto("/#connections");
  await page
    .getByRole("button", { name: "Probar chat privado", exact: true })
    .click();
  const chat = page.getByRole("dialog", {
    name: "Chat privado de prueba",
    exact: true,
  });
  await expect(chat.getByText(/No hay otra persona conectada/)).toBeVisible();
  await chat
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  let picker = page.getByRole("dialog", {
    name: "Elige un sticker",
    exact: true,
  });
  await picker.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(
    picker.getByRole("button", {
      name: "Seleccionar sticker: Moka: Saludando",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(chat).toBeVisible();
  await chat
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  picker = page.getByRole("dialog", { name: "Elige un sticker", exact: true });
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
    chat.getByRole("img", { name: "Sticker: Moka: Saludando", exact: true }),
  ).toBeVisible();
  await chat.getByLabel("Tu mensaje de prueba").fill("Mensaje privado local");
  await chat.getByRole("button", { name: "Enviar mensaje de prueba" }).click();
  await expect(
    chat.getByText("Mensaje privado local", { exact: true }),
  ).toBeVisible();
  await chat
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Probar chat privado", exact: true })
    .click();
  await expect(
    chat.getByText("Mensaje privado local", { exact: true }),
  ).toHaveCount(0);
  await expect(chat.locator(".sent-sticker")).toHaveCount(0);
  await chat
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cómo funciona", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar mis datos de prueba" })
    .click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  const data = JSON.parse(content);
  expect(data.stickerFavorites).toEqual(["moka-1"]);
  expect(data.stickerRecent).toEqual(["moka-1"]);
  expect(data.stickerUsage).toEqual({ "moka-1": 1 });
  expect(data.stickerFavoritePacks).toEqual([]);
  expect(content).not.toContain("Mensaje privado local");
  await page
    .getByRole("button", { name: "Borrar todos mis datos de prueba" })
    .click();
  await page.getByRole("button", { name: "Sí, borrar datos" }).click();
  await page.reload();
  expect(
    await page.evaluate(() => {
      const v = JSON.parse(localStorage.getItem("entre.prototype.v1")!);
      return [
        v.profile,
        v.stickerFavorites,
        v.stickerRecent,
        v.stickerUsage,
        v.stickerFavoritePacks,
      ];
    }),
  ).toEqual([null, [], [], {}, []]);
});

test("empty states, accents and favorite removal work and picker is accessible", async ({
  page,
}) => {
  // Two complete axe scans cover the larger catalog and the nested dialog.
  test.setTimeout(60_000);
  await enterRoom(page);
  await page
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Elige un sticker",
    exact: true,
  });
  await picker.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(
    picker.getByRole("heading", { name: "Tus favoritos empiezan aquí" }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "Explorar todos los stickers", exact: true })
    .click();
  await picker.getByLabel("Buscar stickers").fill("carino");
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).not.toHaveCount(0);
  await picker.getByLabel("Buscar stickers").fill("ninguno-inexistente");
  await expect(
    picker.getByRole("heading", { name: "No encontramos esa expresión" }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "Explorar todos los stickers", exact: true })
    .click();
  await picker
    .getByRole("button", {
      name: "Agregar a favoritos: Moka: Saludando",
      exact: true,
    })
    .click();
  await picker.getByRole("button", { name: "Favoritos", exact: true }).click();
  await picker
    .getByRole("button", {
      name: "Quitar de favoritos: Moka: Saludando",
      exact: true,
    })
    .click();
  await expect(
    picker.getByRole("heading", { name: "Tus favoritos empiezan aquí" }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "Explorar todos los stickers", exact: true })
    .click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.goto("/#connections");
  await page
    .getByRole("button", { name: "Probar chat privado", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Chat privado de prueba", exact: true })
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  const nested = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(nested.violations.map((v) => v.id)).toEqual([]);
});

test("character collections and frequent favorites persist across Plaza and chats", async ({
  page,
}) => {
  await seedProfile(page);
  await page
    .getByRole("button", {
      name: "¿Qué canción sería el tráiler de tu vida?",
      exact: true,
    })
    .click();
  const thread = page.getByRole("dialog", {
    name: "¿Qué canción sería el tráiler de tu vida?",
    exact: true,
  });
  await thread
    .getByLabel("Tu respuesta de prueba")
    .fill("Mi respuesta pendiente");
  await thread
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  let picker = page.getByRole("dialog", {
    name: "Elige un sticker",
    exact: true,
  });
  await picker.getByRole("button", { name: "Moka", exact: true }).click();
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).toHaveCount(6);
  await picker.getByLabel("Buscar stickers").fill("abrazo");
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).toHaveCount(1);
  await expect(
    picker.getByRole("button", {
      name: "Seleccionar sticker: Moka: Abrazo con cariño",
      exact: true,
    }),
  ).toBeVisible();
  await picker.getByLabel("Buscar stickers").fill("");
  await picker
    .getByRole("button", {
      name: "Guardar colección favorita: Moka",
      exact: true,
    })
    .click();
  await picker
    .getByRole("button", {
      name: "Seleccionar sticker: Moka: Saludando",
      exact: true,
    })
    .click();
  await expect(thread.locator(".sent-sticker")).toHaveCount(0);
  await picker
    .getByRole("button", { name: "Enviar sticker", exact: true })
    .click();
  await expect(
    thread.getByRole("img", { name: "Sticker: Moka: Saludando", exact: true }),
  ).toBeVisible();
  await expect(thread.getByLabel("Tu respuesta de prueba")).toHaveValue(
    "Mi respuesta pendiente",
  );
  await page.reload();
  await page
    .getByRole("button", {
      name: "¿Qué canción sería el tráiler de tu vida?",
      exact: true,
    })
    .click();
  await expect(
    thread.getByRole("img", { name: "Sticker: Moka: Saludando", exact: true }),
  ).toBeVisible();
  await thread
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  picker = page.getByRole("dialog", { name: "Elige un sticker", exact: true });
  await expect(
    picker.getByRole("button", { name: "Favoritos", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    picker.getByRole("button", {
      name: "Seleccionar sticker: Moka: Saludando",
      exact: true,
    }),
  ).toBeVisible();
  await picker.getByRole("button", { name: "Moka", exact: true }).click();
  await expect(
    picker.getByRole("button", {
      name: "Quitar colección favorita: Moka",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker
    .getByRole("button", {
      name: "Quitar colección favorita: Moka",
      exact: true,
    })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    thread.getByRole("button", { name: "Abrir stickers", exact: true }),
  ).toBeFocused();
  await thread
    .getByRole("button", { name: "Eliminar mi respuesta", exact: true })
    .click();
  await expect(thread.locator(".sent-sticker")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/#connections");
  await page
    .getByRole("button", { name: "Probar chat privado", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Chat privado de prueba", exact: true })
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  picker = page.getByRole("dialog", { name: "Elige un sticker", exact: true });
  await expect(
    picker.getByRole("button", {
      name: "Seleccionar sticker: Moka: Saludando",
      exact: true,
    }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.stickerUsage).toEqual({ "moka-1": 1 });
  expect(state.stickerFavoritePacks).toEqual([]);
  expect(state.profile.alias).toBe("Luz");
});

test("favorites rank by use with explicit pins first and ignore invalid saved IDs", async ({
  page,
}) => {
  await seedProfile(page);
  await page.evaluate(() => {
    const key = "entre.prototype.v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(
      key,
      JSON.stringify({
        ...state,
        stickerFavorites: ["pipo-2", "conversar-1"],
        stickerRecent: ["moka-1", "orbita-3", "michis-12"],
        stickerUsage: {
          "moka-1": 2,
          "orbita-3": 6,
          "unknown-9": 99,
          "conversar-1": 100,
          "pipo-1": -1,
          "babu-1": "bad",
        },
        stickerFavoritePacks: ["orbita", "unknown", "michis"],
      }),
    );
  });
  await page.reload();
  await page.goto("/#connections");
  await page
    .getByRole("button", { name: "Probar chat privado", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Chat privado de prueba", exact: true })
    .getByRole("button", { name: "Abrir stickers", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Elige un sticker",
    exact: true,
  });
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }),
  ).toHaveCount(3);
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }).first(),
  ).toHaveAccessibleName("Seleccionar sticker: Pipo: Muerto de risa");
  await expect(
    picker.getByRole("button", { name: /^Seleccionar sticker:/ }).nth(1),
  ).toHaveAccessibleName("Seleccionar sticker: Órbita: Abrazo con cariño");
  await expect(
    picker.locator(".sticker-pack-shelf > button").first(),
  ).toHaveAccessibleName("Órbita");
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.stickerUsage).toEqual({ "moka-1": 2, "orbita-3": 6 });
  expect(state.stickerFavoritePacks).toEqual(["orbita"]);
  expect(state.stickerFavorites).toEqual(["pipo-2"]);
  expect(state.stickerRecent).toEqual(["moka-1", "orbita-3"]);
  expect(state.reservations).toEqual(["cafe"]);
  expect(state.profile.alias).toBe("Luz");
});
