import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function lobby(page: Page) {
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
  await page.goto("/#agenda");
  await page.reload();
  await page
    .getByRole("button", { name: "Entrar a la sala de prueba", exact: true })
    .click();
}
async function start(page: Page) {
  await lobby(page);
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
}
async function openControls(page: Page) {
  await page.locator(".room-aside .demo-people > summary").click();
}
test("minimum gates the start and missing quorum never changes a reservation", async ({
  page,
}) => {
  await lobby(page);
  await expect(
    page.getByText("Un grupo pequeño, espacio para cada persona."),
  ).toBeVisible();
  for (const name of ["Antonia", "Nicolás", "Camila"])
    await page.getByRole("checkbox", { name, exact: true }).uncheck();
  await expect(
    page.getByRole("button", {
      name: "Comenzar encuentro de prueba",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Simular fin de espera", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Esta vez no alcanzamos el mínimo." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).reservations,
    ),
  ).toEqual(["cafe"]);
  await page
    .getByRole("button", { name: "Volver a probar la recepción", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Antonia", exact: true }).check();
  await expect(
    page.getByRole("button", {
      name: "Comenzar encuentro de prueba",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "Nicolás", exact: true }).check();
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Guía del encuentro", exact: true }),
  ).toBeVisible();
});
test("rounds have a shared time cap; typing is ephemeral and another question needs explicit majority", async ({
  page,
}) => {
  await page.clock.install();
  await start(page);
  await openControls(page);
  const guide = page.getByRole("region", {
    name: "Guía del encuentro",
    exact: true,
  });
  await page
    .getByRole("button", { name: "Simular escritura: Antonia", exact: true })
    .click();
  await expect(
    page.getByText("Antonia está escribiendo…", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward("00:05");
  await expect(
    page.getByText("Antonia está escribiendo…", { exact: true }),
  ).toHaveCount(0);
  await guide.getByText("Cómo funciona la guía", { exact: true }).click();
  await guide
    .getByRole("button", { name: "+30 s para responder", exact: true })
    .click();
  await expect(
    guide.getByRole("button", { name: "Extensión ya utilizada", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward("01:56");
  await expect(
    guide.getByRole("heading", { name: "Ahora hay espacio para conversar." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Personas y seguridad", exact: true })
    .click();
  await expect(
    page.getByText("Sin respuesta en esta ronda", { exact: true }),
  ).toHaveCount(4);
  await page.keyboard.press("Escape");
  await page.clock.fastForward("00:20");
  await expect(
    guide.getByRole("heading", { name: "Ahora hay espacio para conversar." }),
  ).toBeVisible();
  await guide
    .getByRole("button", { name: "Otra pregunta", exact: true })
    .click();
  await expect(
    guide.getByText(
      "1 de 3 votos necesarios. Sin mayoría, seguimos conversando.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Votar otra pregunta: Antonia", exact: true })
    .click();
  await expect(
    guide.getByRole("heading", { name: "Ahora hay espacio para conversar." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Votar otra pregunta: Nicolás", exact: true })
    .click();
  await expect(
    page.getByText("¿Qué canción, película o libro tendría un lugar en esa vida?", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(guide.getByText(/Preguntas 2\/3/)).toBeVisible();
});
test("loss of quorum pauses messaging, recovers once and closes when reconnection expires", async ({
  page,
}) => {
  await page.clock.install();
  await start(page);
  await openControls(page);
  await page.getByRole("checkbox", { name: "Nicolás", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Camila", exact: true }).uncheck();
  await expect(
    page.getByRole("heading", { name: "Una pausa para recuperar el grupo." }),
  ).toBeVisible();
  await expect(page.getByLabel("Tu mensaje de prueba")).toBeDisabled();
  await page.getByRole("checkbox", { name: "Nicolás", exact: true }).check();
  await expect(
    page.getByRole("heading", { name: "Ahora hay espacio para conversar." }),
  ).toBeVisible();
  await expect(page.getByLabel("Tu mensaje de prueba")).toBeEnabled();
  await page.getByRole("checkbox", { name: "Nicolás", exact: true }).uncheck();
  await page.clock.fastForward("01:01");
  await expect(
    page.getByRole("heading", { name: "Esta vez no alcanzamos el mínimo." }),
  ).toBeVisible();
  await expect(
    page.getByText(/No recuperamos el mínimo durante el minuto/),
  ).toBeVisible();
});
test("participation choices finish a round without forcing answers and group continuity is optional", async ({
  page,
}) => {
  await start(page);
  await openControls(page);
  await page.getByRole("button", { name: "Solo escucho", exact: true }).click();
  for (const name of ["Antonia", "Nicolás", "Camila"])
    await page
      .getByRole("button", { name: `Listo: ${name}`, exact: true })
      .click();
  await expect(
    page.getByRole("heading", { name: "Ahora hay espacio para conversar." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finalizar encuentro", exact: true })
    .click();
  await page.locator('input[name="comfort"][value="4"]').check();
  await page
    .getByRole("checkbox", {
      name: /Me gustaría repetir una experiencia con este grupo/,
    })
    .check();
  await page
    .getByRole("button", { name: "Guardar y continuar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Un próximo momento, si el grupo también quiere.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).feedback[0]
          .repeatGroup,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("entre.prototype.v1")!).reservations,
    ),
  ).toEqual(["cafe"]);
  await page
    .getByRole("button", { name: "Retirar interés grupal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Un próximo momento, si el grupo también quiere.",
    }),
  ).toHaveCount(0);
});
test("reception and guided controls are accessible and the page fits a small screen", async ({
  page,
}) => {
  await lobby(page);
  async function audit() {
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      r.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await audit();
  await page
    .getByRole("button", { name: "Comenzar encuentro de prueba", exact: true })
    .click();
  await audit();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("plegar la guía conserva pregunta, plazo y borrador; otra pregunta sigue necesitando mayoría", async ({
  page,
}) => {
  await page.clock.install();
  await start(page);
  const input = page.getByLabel("Tu mensaje de prueba");
  await input.fill("Un borrador mientras escucho al grupo");
  await page.getByRole("button", { name: "Plegar guía", exact: true }).click();
  await expect(page.locator(".guide-question")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Paso esta pregunta", exact: true }),
  ).toBeHidden();
  await page.clock.fastForward("01:31");
  await expect(
    page.getByRole("heading", {
      name: "Ahora hay espacio para conversar.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(input).toHaveValue("Un borrador mientras escucho al grupo");
  await page
    .getByRole("button", { name: "Mostrar controles", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Otra pregunta", exact: true })
    .click();
  await expect(
    page.getByText(
      "1 de 3 votos necesarios. Sin mayoría, seguimos conversando.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.clock.fastForward("00:30");
  await expect(page.getByText(/Preguntas 1\/3/)).toBeVisible();
});

test("silenciar es reversible y personal; citas, borrador, reportes anidados y foco se conservan", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", {
      name: "Mostrar una respuesta ficticia de ejemplo",
      exact: true,
    })
    .click();
  const source = page.getByRole("group", {
    name: "Mensaje de Antonia",
    exact: true,
  });
  await source.getByRole("button", { name: "Responder", exact: true }).click();
  const input = page.getByLabel("Tu mensaje de prueba");
  await input.fill("Queda el contexto de nuestra conversación");
  await page
    .getByRole("button", { name: "Enviar mensaje de prueba", exact: true })
    .click();
  await input.fill("Este borrador sigue aquí");
  const careButton = page.getByRole("button", {
    name: "Personas y seguridad",
    exact: true,
  });
  await careButton.click();
  const care = page.getByRole("dialog", {
    name: "Personas y seguridad",
    exact: true,
  });
  await care
    .getByRole("button", { name: "Silenciar mensajes de Antonia", exact: true })
    .click();
  await expect(care.getByText(/4 presentes de ejemplo/)).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await care
    .getByRole("button", { name: "Reportar a Antonia", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Reportar una conducta o contenido",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    care.getByRole("button", { name: "Reportar a Antonia", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(careButton).toBeFocused();
  await expect(source).toHaveCount(0);
  await expect(
    page.getByText("Mensaje original no disponible", { exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("Este borrador sigue aquí");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("entre.prototype.v1")!).blocked,
    ),
  ).toEqual([]);
  await careButton.click();
  await care
    .getByRole("button", { name: "Mostrar mensajes de Antonia", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(source).toBeVisible();
  await page
    .getByRole("button", {
      name: "Ver mensaje original de Antonia",
      exact: true,
    })
    .click();
  await expect(source).toBeFocused();
});
