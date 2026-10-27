import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const song = "¿Qué canción te lleva de vuelta a un lugar?";
async function seed(page: Page) {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "entre.prototype.v1",
      JSON.stringify({
        profile: {
          alias: "Luz",
          interests: ["Música", "Lectura"],
          boundaries: ["Sin insinuaciones románticas"],
          availability: "Sin preferencia",
          adult: true,
        },
        reservations: ["cafe"],
        feedback: [],
        blocked: [],
        stickerFavorites: ["moka-1"],
        stickerRecent: [],
      }),
    ),
  );
  await page.reload();
}
async function space(page: Page, name: string) {
  if ((page.viewportSize()?.width || 0) <= 700)
    await page
      .getByRole("navigation", { name: "Espacios de Afinia", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
  else
    await page
      .getByRole("navigation", { name: "Navegación principal", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
}
async function thread(page: Page, title = song) {
  await page
    .getByRole("heading", { name: title, exact: true })
    .getByRole("button")
    .click();
}
test("La Plaza permite explorar sin perfil: filtros, guardados, paginación y ocultar/restaurar", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Las buenas conexiones/ }),
  ).toBeVisible();
  await expect(page.locator(".plaza-post")).toHaveCount(4);
  await page
    .getByRole("button", { name: `Guardar conversación: ${song}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Guardadas", exact: true }).click();
  await expect(page.locator(".plaza-post")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Guardadas", exact: true }).click();
  await expect(page.locator(".plaza-post")).toHaveCount(1);
  await page.getByRole("button", { name: "Ver todas", exact: true }).click();
  await page.getByLabel("Buscar conversaciones").fill("cancion");
  await expect(page.locator(".plaza-post")).toHaveCount(1);
  await page.getByLabel("Buscar conversaciones").fill("no-existe-este-interes");
  await expect(
    page.getByRole("heading", {
      name: "Todavía no hay una conversación con esa búsqueda.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explorar conversaciones", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Más conversaciones", exact: true })
    .click();
  await expect(page.locator(".plaza-post")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Más conversaciones", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Conversaciones anteriores", exact: true })
    .click();
  await thread(page);
  await page
    .getByRole("button", { name: "Ocultar conversación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: song, exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /Restaurar conversaciones ocultas/ })
    .click();
  await expect(
    page.getByRole("heading", { name: song, exact: true }),
  ).toBeVisible();
  await space(page, "Conexiones");
  await expect(
    page.getByRole("heading", { name: /Algo en común/ }),
  ).toBeVisible();
  await space(page, "Encuentros");
  await expect(page.getByLabel("Buscar encuentros")).toBeVisible();
  await page
    .getByRole("button", { name: "Visitar La Plaza", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Las buenas conexiones/ }),
  ).toBeVisible();
});
test("compartir requiere perfil y vuelve a La Plaza sin obligar a reservar", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Preparar mi perfil", exact: true })
    .click();
  await page.getByLabel("¿Cómo te llamamos?").fill("Sol");
  await page
    .getByRole("button", { name: "Omitir intereses", exact: true })
    .click();
  await page.getByLabel("Declaro que soy mayor de 18 años").check();
  await page
    .getByRole("button", { name: "Guardar mi perfil", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Las buenas conexiones/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).reservations,
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await expect(page.getByLabel("Un título para tu conversación")).toBeFocused();
});
test("publicar, responder, editar y eliminar conserva los datos anteriores y el borrador", async ({
  page,
}) => {
  await seed(page);
  const title = "Una canción para compartir en otoño";
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await page.getByLabel("Un título para tu conversación").fill(title);
  await page
    .getByLabel("¿Qué te gustaría compartir?", { exact: true })
    .fill("Mi ejemplo se muestra como texto: <img src=x onerror=alert(1)>");
  await page
    .getByRole("button", { name: "Volver sin publicar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await expect(page.getByLabel("Un título para tu conversación")).toHaveValue(
    title,
  );
  await page
    .getByRole("button", { name: "Publicar en la maqueta", exact: true })
    .click();
  await page.reload();
  await thread(page, title);
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
  await page
    .getByLabel("Tu respuesta de prueba")
    .fill("Una respuesta que puedo retomar después.");
  await page
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(
    page.getByText("Una respuesta que puedo retomar después.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar publicación", exact: true })
    .click();
  await page
    .getByLabel("Un título para tu conversación")
    .fill("La canción que quería recomendar");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await page.reload();
  await thread(page, "La canción que quería recomendar");
  await expect(
    page.getByText("Una respuesta que puedo retomar después.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Eliminar publicación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conservar publicación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "La canción que quería recomendar",
      exact: true,
    }),
  ).toBeVisible();
  await thread(page, "La canción que quería recomendar");
  await page
    .getByRole("button", { name: "Eliminar publicación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sí, eliminar publicación", exact: true })
    .click();
  await page.reload();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.plaza.posts).toEqual([]);
  expect(state.plaza.comments).toEqual([]);
  expect(state.profile.alias).toBe("Luz");
  expect(state.reservations).toEqual(["cafe"]);
  expect(state.stickerFavorites).toEqual(["moka-1"]);
});
test("una conversación lleva a invitaciones y encuentros sin fabricar aceptación", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) requests.push(r.url());
  });
  await seed(page);
  await thread(page);
  await page
    .getByRole("button", { name: "Invitar a conversar", exact: true })
    .click();
  await page
    .getByLabel("Un mensaje para empezar", { exact: false })
    .fill("También me gustan las historias detrás de las canciones.");
  await page
    .getByRole("button", { name: "Guardar invitación de prueba", exact: true })
    .click();
  const invitation = page.getByRole("article", {
    name: "Invitación para Antonia",
    exact: true,
  });
  await expect(
    invitation.getByText("Esperando aceptación · ejemplo", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Invitación para Antonia", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a la conversación", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: song, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver encuentro relacionado", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tu próximo encuentro", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ahora no", exact: true }).click();
  await space(page, "Conexiones");
  await page.getByRole("button", { name: /Tus invitaciones/ }).click();
  await page
    .getByRole("button", {
      name: "Retirar invitación para Antonia",
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
  expect(requests).toEqual([]);
});
test("los tres espacios y sus diálogos son accesibles y caben en la pantalla", async ({
  page,
}) => {
  await seed(page);
  async function audit() {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await audit();
  await thread(page);
  await audit();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Compartir algo", exact: true })
    .click();
  await audit();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Compartir algo", exact: true }),
  ).toBeFocused();
  await space(page, "Conexiones");
  await audit();
  await page
    .getByRole("article", { name: "Afinidad de ejemplo: Antonia", exact: true })
    .getByRole("button", { name: "Invitar a conversar", exact: true })
    .click();
  await audit();
  await page.keyboard.press("Escape");
  await space(page, "Encuentros");
  await audit();
});

test("los perfiles anteriores conservan sus datos y los bloqueos se respetan entre espacios", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("entre.prototype.v1")!);
    state.blocked = ["cafe:Antonia"];
    state.plaza = {
      posts: [{ id: "invalido" }],
      comments: "invalidas",
      saved: ["cancion"],
      invitations: [
        { personId: "antonia", postId: "cancion", note: "Anterior" },
        { personId: "desconocida", postId: "cancion", note: "Inválida" },
      ],
    };
    localStorage.setItem("entre.prototype.v1", JSON.stringify(state));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: song, exact: true }),
  ).toHaveCount(0);
  await thread(page, "Crear algo, aunque no salga perfecto.");
  await expect(
    page.getByText(
      "Me pasa con escribir. A veces una página sin corregir nada ya es un buen comienzo.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await space(page, "Conexiones");
  await expect(
    page.getByRole("article", {
      name: "Afinidad de ejemplo: Antonia",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".affinity-card")).toHaveCount(2);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("entre.prototype.v1")!),
  );
  expect(state.profile.alias).toBe("Luz");
  expect(state.reservations).toEqual(["cafe"]);
  expect(state.stickerFavorites).toEqual(["moka-1"]);
  expect(state.plaza.posts).toEqual([]);
  expect(state.plaza.invitations).toEqual([]);
});
