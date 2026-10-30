import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const song = "¿Qué canción sería el tráiler de tu vida?";
const quote =
  "Una de los viajes en familia: mi primer capítulo empezaría mirando por la ventana, antes de que llegue el estribillo.";
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
        stickerFavorites: ["moka-1"],
      }),
    ),
  );
  await page.reload();
}
async function openThread(page: Page, name = song) {
  await page.getByRole("button", { name, exact: true }).click();
  return page.getByRole("dialog", { name, exact: true });
}
async function inviteFromReply(page: Page, title = song, person = "Javiera") {
  const thread = await openThread(page, title);
  await thread
    .getByRole("group", { name: `Respuesta de ${person}`, exact: true })
    .getByRole("button", { name: "Seguir conversando", exact: true })
    .click();
  return page.getByRole("dialog", {
    name: `Un punto en común con ${person}`,
    exact: true,
  });
}

test("comentario a invitación: destinatario correcto, contexto, regreso con foco y encuentro sin reserva automática", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const api: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url());
  });
  await seed(page);
  const dialog = await inviteFromReply(page);
  await expect(dialog.getByText(quote, { exact: true })).toBeVisible();
  await expect(dialog.getByText(song, { exact: true })).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations.map((v) => v.id)).toEqual([]);
  await dialog
    .getByLabel("Un mensaje para empezar")
    .fill("También tengo canciones que me recuerdan viajes.");
  await dialog
    .getByRole("button", { name: "Guardar invitación de prueba", exact: true })
    .click();
  const card = page.getByRole("article", {
    name: "Invitación para Javiera",
    exact: true,
  });
  await expect(card.getByText(quote, { exact: true })).toBeVisible();
  await expect(
    card.getByText("Esperando aceptación · ejemplo", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByText("También tengo canciones que me recuerdan viajes.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Invitación para Antonia", exact: true }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: /Aceptar|Abrir chat/ }),
  ).toHaveCount(0);
  await page.reload();
  await card
    .getByRole("button", { name: "Volver al comentario", exact: true })
    .click();
  const origin = page
    .getByRole("dialog", { name: song, exact: true })
    .getByRole("group", { name: "Respuesta de Javiera", exact: true });
  await expect(origin).toBeFocused();
  await expect(origin).toHaveClass(/invitation-origin/);
  await origin
    .getByRole("button", { name: "Ver mi invitación", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Ver encuentro relacionado", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tu próximo encuentro", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).reservations,
    ),
  ).toEqual(["cafe"]);
  await page.getByRole("button", { name: "Ahora no", exact: true }).click();
  await card
    .getByRole("button", {
      name: "Retirar invitación para Javiera",
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).plaza
          .invitations,
    ),
  ).toEqual([]);
  expect(api).toEqual([]);
});

test("una invitación por persona conserva su comentario original al venir de otra publicación", async ({
  page,
}) => {
  await seed(page);
  const dialog = await inviteFromReply(
    page,
    "Tienes un local vacío. ¿Qué inventamos ahí?",
    "Antonia",
  );
  await dialog
    .getByRole("button", { name: "Guardar invitación de prueba", exact: true })
    .click();
  const card = page.getByRole("article", {
    name: "Invitación para Antonia",
    exact: true,
  });
  await expect(
    card.getByText("Desde un comentario de Antonia", { exact: true }),
  ).toBeVisible();
  await page.goto("/#plaza");
  const thread = await openThread(page);
  await thread
    .getByRole("button", { name: "Ver mi invitación", exact: true })
    .click();
  await expect(card).toHaveCount(1);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.plaza.invitations).toEqual([
    {
      personId: "antonia",
      postId: "crear-sin-prisa",
      commentId: "ejemplo-crear",
      note: "",
    },
  ]);
  await card
    .getByRole("button", { name: "Volver al comentario", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", {
        name: "Tienes un local vacío. ¿Qué inventamos ahí?",
        exact: true,
      })
      .getByRole("group", { name: "Respuesta de Antonia", exact: true }),
  ).toBeFocused();
});

test("sin perfil se retoma el comentario después de crearlo sin guardar ni aceptar una invitación automáticamente", async ({
  page,
}) => {
  test.setTimeout(60_000);
  // Leaving an earlier booking must not reserve it when preparing a new invitation.
  await page.goto("/#discover");
  await page
    .getByRole("button", {
      name: "Ver encuentro: ¿Y si pudieras vivir otra vida?",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Preparar perfil y reservar", exact: true })
    .click();
  await expect(page.getByLabel("¿Cómo te llamamos?")).toBeVisible();
  await page.goto("/#plaza");
  const dialog = await inviteFromReply(page);
  await expect(
    dialog.getByRole("button", {
      name: "Guardar invitación de prueba",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Preparar mi perfil", exact: true })
    .click();
  await page.getByLabel("¿Cómo te llamamos?").fill("Javiera");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Declaro que soy mayor de 18 años").check();
  await page
    .getByRole("button", { name: "Guardar mi perfil", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(quote, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).plaza
          .invitations,
    ),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Ahora no", exact: true }).click();
  const thread = page.getByRole("dialog", { name: song, exact: true });
  await thread
    .getByLabel("Tu respuesta de prueba")
    .fill("Mi respuesta como Javiera");
  await thread
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(
    thread
      .getByRole("group", { name: "Respuesta de ti", exact: true })
      .getByRole("button", { name: "Seguir conversando", exact: true }),
  ).toHaveCount(0);
  await expect(
    thread
      .getByRole("group", { name: "Respuesta de Javiera", exact: true })
      .getByRole("button", { name: "Seguir conversando", exact: true }),
  ).toBeVisible();
  await thread
    .getByRole("group", { name: "Respuesta de Javiera", exact: true })
    .getByRole("button", { name: "Seguir conversando", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Ver encuentro relacionado", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tu próximo encuentro", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).plaza
          .invitations,
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).reservations,
    ),
  ).toEqual([]);
});

test("migración valida autor y comentario, respeta bloqueos y mantiene invitaciones anteriores como pendientes", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const key = "entre.prototype.v1",
      state = JSON.parse(localStorage.getItem(key)!);
    state.plaza.invitations = [
      {
        personId: "javiera",
        postId: "cancion",
        commentId: "ejemplo-cancion",
        note: "Primera",
      },
      {
        personId: "javiera",
        postId: "cancion",
        commentId: "ejemplo-cancion",
        note: "Contexto vigente",
      },
      {
        personId: "valentina",
        postId: "cancion",
        commentId: "ejemplo-cancion",
        note: "No escribió ese comentario",
      },
      {
        personId: "valentina",
        postId: "crear-sin-prisa",
        commentId: "inexistente",
        note: "Origen inválido",
      },
      {
        personId: "javiera",
        postId: "otro",
        commentId: "ejemplo-cancion",
        note: "Otra publicación",
      },
      {
        personId: "antonia",
        postId: "libro-prestado",
        note: "Invitación anterior",
        status: "accepted",
        privateChatEnabled: true,
      },
    ];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto("/#connections");
  await page.reload();
  await expect(
    page.getByRole("article", { name: /^Invitación para/ }),
  ).toHaveCount(2);
  const legacy = page.getByRole("article", {
    name: "Invitación para Antonia",
    exact: true,
  });
  await expect(
    legacy.getByText("Esperando aceptación · ejemplo", { exact: true }),
  ).toBeVisible();
  await expect(
    legacy.getByRole("button", {
      name: "Volver a la conversación",
      exact: true,
    }),
  ).toBeEnabled();
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.plaza.invitations).toHaveLength(2);
  expect(state.plaza.invitations[1]).not.toHaveProperty("status");
  expect(state.profile.alias).toBe("Luz");
  expect(state.stickerFavorites).toEqual(["moka-1"]);
  await page.evaluate(() => {
    const key = "entre.prototype.v1",
      state = JSON.parse(localStorage.getItem(key)!);
    state.blocked = ["plaza:Antonia"];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  const card = page.getByRole("article", {
    name: "Invitación para Javiera",
    exact: true,
  });
  await expect(
    card.getByText("La conversación de origen ya no está disponible.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Volver al comentario", exact: true }),
  ).toBeDisabled();
  await expect(card.getByText(quote, { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const key = "entre.prototype.v1",
      state = JSON.parse(localStorage.getItem(key)!);
    state.blocked.push("plaza:Javiera");
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.plaza.invitations).toEqual([]);
  expect(state.reservations).toEqual(["cafe"]);
});
