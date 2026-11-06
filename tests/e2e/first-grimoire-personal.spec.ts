import { expect, test, type Locator, type Page } from "@playwright/test";

// SHA alvo: 72d23fdc0db4bbdc2cb83475e0b5042f5dbedab6.
// QA exclusivamente sintetico: sem login, contas reais ou dados pessoais.
// Os artefatos visuais ficam restritos a falhas no executor descartavel.
test.use({ screenshot: "only-on-failure", trace: "retain-on-failure", video: "off" });

const DEMO_PATH = "/experiencia";
const wrongFirstAnswer = "Ler sem definir o que procuro.";
const secondAnswer = "Tentar recordar a ideia com minhas palavras e revisar o que faltar.";
const thirdAnswer = "Registrar o que aprendi e uma dúvida para continuar depois.";

async function openSyntheticJourney(page: Page): Promise<Locator> {
  // Evita conexoes do navegador a endpoints externos durante a demonstracao.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "3000") {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.goto(DEMO_PATH);
  const journey = page.locator('section[aria-labelledby="first-grimoire-title"]');
  await expect(journey.getByRole("heading", { name: /Primeiro Grimório/ })).toBeVisible();
  await expect(journey.getByText(/sem conta, banco ou sincronização/i)).toBeVisible();
  return journey;
}

async function completeReading(journey: Locator): Promise<void> {
  await journey.getByRole("button", { name: "Iniciar o Primeiro Grimório" }).click();
  await expect(journey.getByText("Página 1 de 3")).toBeVisible();
  await journey.getByRole("button", { name: /Próxima página/ }).click();
  await journey.getByRole("button", { name: /Próxima página/ }).click();
  await expect(journey.getByText("Página 3 de 3")).toBeVisible();
  await journey.getByRole("button", { name: /Concluir leitura/ }).click();
  await expect(journey.getByRole("heading", { name: "Três perguntas para recordar" })).toBeVisible();
}

async function answerAllQuestions(journey: Locator): Promise<void> {
  const focusStep = journey.getByRole("navigation", { name: "Etapas do Primeiro Grimório" })
    .getByRole("button", { name: /Foco/ });
  await expect(focusStep).toBeDisabled();
  const answers = [wrongFirstAnswer, secondAnswer, thirdAnswer];
  for (const [index, answer] of answers.entries()) {
    await journey.getByRole("radio", { name: answer }).check();
    await journey.getByRole("button", { name: "Enviar resposta" }).click();
    if (index === 0) {
      await expect(journey.getByText(/Vamos revisar/)).toBeVisible();
      await expect(focusStep).toBeDisabled();
    }
    if (index < answers.length - 1) {
      await journey.getByRole("button", { name: /Próxima pergunta/ }).click();
    }
  }
  await expect(journey.getByText(/As três respostas foram enviadas/)).toBeVisible();
  await expect(focusStep).toBeEnabled();
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document, "A pagina nao deve extrapolar a largura do viewport").toBeLessThanOrEqual(widths.viewport + 1);
}

async function tabUntilFocused(page: Page, target: Locator, limit = 90): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Controle esperado nao foi alcançado por Tab");
}

test.describe("Primeiro Grimório — desktop sintetico", () => {
  // O Quality Gate global descobre este arquivo, mas nao executa seus cenarios.
  test.skip(process.env.AA_FIRST_GRIMOIRE_BROWSER_FOCAL !== "1", "Somente QA remoto focal autorizado.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("conclui a jornada com uma resposta incorreta, foco breve e sintese local", async ({ page }) => {
    const journey = await openSyntheticJourney(page);
    await completeReading(journey);
    await answerAllQuestions(journey);
    await journey.getByRole("button", { name: /Continuar para foco/ }).click();
    await expect(journey.getByRole("heading", { name: "Um momento de concentração" })).toBeVisible();

    await page.getByRole("button", { name: "Começar foco" }).click();
    const recordSession = page.getByRole("button", { name: "Registrar esta sessão" });
    await expect(recordSession).toBeEnabled({ timeout: 7_000 });
    await recordSession.click();
    await expect(journey.getByRole("heading", { name: "Sua síntese de aprendizagem" })).toBeVisible();
    await journey.getByRole("textbox", { name: "O que levo desta leitura?" })
      .fill("Uma pergunta ajuda a orientar a leitura. Quero revisar minhas ideias.");
    await journey.getByRole("button", { name: /Salvar síntese localmente/ }).click();
    await journey.getByRole("button", { name: /Concluir jornada/ }).click();
    await expect(journey.getByRole("heading", { name: "Primeira Jornada conquistada!" })).toBeVisible();
    await expect(journey.getByText(/não adiciona pontos/i)).toBeVisible();
    await page.getByRole("button", { name: "Reiniciar demonstração" }).click();
    await expect(journey.getByRole("button", { name: "Iniciar o Primeiro Grimório" })).toBeVisible();
  });

  test("restaura tres respostas enviadas apos recarga sem exigir todos os acertos", async ({ page }) => {
    const journey = await openSyntheticJourney(page);
    await completeReading(journey);
    await answerAllQuestions(journey);
    await page.reload();
    const restored = page.locator('section[aria-labelledby="first-grimoire-title"]');
    const focusStep = restored.getByRole("navigation", { name: "Etapas do Primeiro Grimório" })
      .getByRole("button", { name: /Foco/ });
    await expect(focusStep).toBeEnabled();
    await focusStep.click();
    await expect(restored.getByRole("heading", { name: "Um momento de concentração" })).toBeVisible();
    await expect(restored.getByText(/Respostas enviadas \(3 de 3\)/)).toBeVisible();
  });

  test("usa Tab, Shift+Tab e Enter com foco visivel na leitura", async ({ page }) => {
    const journey = await openSyntheticJourney(page);
    const start = journey.getByRole("button", { name: "Iniciar o Primeiro Grimório" });
    await tabUntilFocused(page, start);
    await expect(start).toBeFocused();
    await expect(start).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(journey.getByText("Página 1 de 3")).toBeVisible();
    const next = journey.getByRole("button", { name: /Próxima página/ });
    await tabUntilFocused(page, next);
    await page.keyboard.press("Enter");
    await expect(journey.getByText("Página 2 de 3")).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await expect(journey.getByRole("button", { name: /Página anterior/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(journey.getByText("Página 3 de 3")).toBeVisible();
  });
});

test.describe("Primeiro Grimorio — mobile sintetico", () => {
  // O runner focal habilita este grupo; a suite global permanece sem executa-lo.
  test.skip(process.env.AA_FIRST_GRIMOIRE_BROWSER_FOCAL !== "1", "Somente QA remoto focal autorizado.");
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("mantem leitura, respostas e controles utilizaveis por toque sem rolagem horizontal", async ({ page }) => {
    const journey = await openSyntheticJourney(page);
    await assertNoHorizontalOverflow(page);
    const start = journey.getByRole("button", { name: "Iniciar o Primeiro Grimório" });
    const rect = await start.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.width).toBeGreaterThanOrEqual(24);
    expect(rect!.height).toBeGreaterThanOrEqual(24);
    await start.tap();
    await assertNoHorizontalOverflow(page);
    await journey.getByRole("button", { name: /Próxima página/ }).tap();
    await journey.getByRole("button", { name: /Próxima página/ }).tap();
    await journey.getByRole("button", { name: /Concluir leitura/ }).tap();
    await assertNoHorizontalOverflow(page);
    await answerAllQuestions(journey);
    await journey.getByRole("button", { name: /Continuar para foco/ }).tap();
    await expect(journey.getByRole("heading", { name: "Um momento de concentração" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
