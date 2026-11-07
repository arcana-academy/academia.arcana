import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

// Grande Atrio — QA somente da experiencia publica sintetica.
// Nao acessa contas, banco, APIs externas ou dados de estudantes.
// Capturas de desktop/mobile sao evidencias de revisao, nao aprovacao estetica.
test.use({ screenshot: "only-on-failure", trace: "retain-on-failure", video: "off" });

const DEMO_PATH = "/experiencia";
const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = "3000";

test.beforeEach(async ({ page }) => {
  // Rejeita qualquer requisicao do navegador fora do servidor local do runner.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === LOCAL_HOST && url.port === LOCAL_PORT) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
});

async function openPortal(page: Page): Promise<Locator> {
  await page.goto(DEMO_PATH);
  const atrium = page.locator("section#portal-atrio");
  await expect(atrium).toBeVisible();
  await expect(atrium.getByRole("heading", { level: 1, name: /O conhecimento abre/ })).toBeVisible();
  return atrium;
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document, "A pagina nao deve ultrapassar a largura visivel").toBeLessThanOrEqual(widths.viewport + 1);
}

async function tabUntilFocused(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("O link esperado nao foi alcancado por Tab.");
}

function timerToSeconds(text: string): number {
  const value = text.trim().match(/^(\d{2}):(\d{2})$/);
  if (!value) throw new Error("Formato inesperado de tempo: " + text);
  return Number(value[1]) * 60 + Number(value[2]);
}

async function captureSyntheticView(page: Page, testInfo: TestInfo, filename: string): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(filename),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe("Portal Visual V0.1 — desktop pessoal", () => {
  test.skip(process.env.AA_PORTAL_VISUAL_FOCAL !== "1", "Somente QA remoto focal autorizado.");
  test.use({ viewport: { width: 1440, height: 900 } });

  test("exibe o Atrio, disclosure e caminhos funcionais sem catalogo ficticio", async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const atrium = await openPortal(page);
    await expect(atrium.getByText("Academia Arcana", { exact: false }).first()).toBeVisible();
    await expect(atrium.getByText(/Ciências/)).toBeVisible();
    await expect(atrium.getByText(/Demonstração sem conta e sem banco de dados/)).toBeVisible();

    const paths = atrium.getByRole("navigation", { name: "Acessos do Portal do Conhecimento" });
    await expect(paths.getByRole("link", { name: /Entrar no Primeiro Grimório/ }))
      .toHaveAttribute("href", "#primeiro-grimorio");
    await expect(paths.getByRole("link", { name: /Explorar missões e foco/ }))
      .toHaveAttribute("href", "#demo-missions-title");

    await expect(atrium.getByText("Biblioteca de Grimórios")).toBeVisible();
    await expect(atrium.getByText(/O próximo ambiente está em preparação/)).toBeVisible();
    await expect(atrium.getByRole("link", { name: /Biblioteca/ })).toHaveCount(0);
    await expect(page.locator("#primeiro-grimorio")).toBeAttached();
    await expect(page.getByRole("timer")).toHaveText("05:00");
    await assertNoHorizontalOverflow(page);
    await captureSyntheticView(page, testInfo, "portal-atrio-1440x900.png");
    expect(pageErrors, "Nenhum erro de pagina JavaScript").toEqual([]);
  });

  test("captura o Grande Atrio no tema escuro em desktop", async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    const atrium = await openPortal(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "mago-classico");
    await expect(atrium.getByRole("link", { name: /Entrar no Primeiro Grimório/ })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureSyntheticView(page, testInfo, "portal-atrio-dark-1440x900.png");
  });

  test("permite Tab, Shift+Tab e Enter para entrar no Primeiro Grimorio", async ({ page }) => {
    const atrium = await openPortal(page);
    const open = atrium.getByRole("link", { name: /Entrar no Primeiro Grimório/ });
    const missions = atrium.getByRole("link", { name: /Explorar missões e foco/ });

    await tabUntilFocused(page, open);
    await expect(open).toBeFocused();
    await expect(open).toHaveCSS("outline-style", "solid");

    await page.keyboard.press("Tab");
    await expect(missions).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(open).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/#primeiro-grimorio$/);
    await expect(page.locator("#primeiro-grimorio")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Iniciar o Primeiro Grimório" })).toBeVisible();
  });

  test("navega por ancoras sem reiniciar o temporizador ativo", async ({ page }) => {
    const atrium = await openPortal(page);
    const timer = page.getByRole("timer");
    await page.getByRole("button", { name: "Começar foco" }).click();
    await expect(timer).not.toHaveText("05:00", { timeout: 8_000 });

    const beforeNavigation = timerToSeconds(await timer.innerText());
    await atrium.getByRole("link", { name: /Entrar no Primeiro Grimório/ }).click();
    await expect(page).toHaveURL(/#primeiro-grimorio$/);
    const afterNavigation = timerToSeconds(await timer.innerText());

    expect(afterNavigation).toBeLessThanOrEqual(beforeNavigation);
    expect(afterNavigation).toBeLessThan(300);
    await expect(page.getByRole("button", { name: "Pausar" })).toBeAttached();
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByRole("timer")).not.toHaveText("05:00");
  });

  test("respeita a preferencia de movimento reduzido", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const atrium = await openPortal(page);
    const open = atrium.getByRole("link", { name: /Entrar no Primeiro Grimório/ });
    const transitionDurationsMs = await open.evaluate((element) =>
      window.getComputedStyle(element).transitionDuration.split(",").map((value) => {
        const duration = value.trim();
        const magnitude = Number.parseFloat(duration);
        return duration.endsWith("ms") ? magnitude : magnitude * 1000;
      }),
    );
    expect(transitionDurationsMs.length).toBeGreaterThan(0);
    expect(transitionDurationsMs.every((duration) => Number.isFinite(duration) && duration <= 0.01)).toBe(true);
    await assertNoHorizontalOverflow(page);
  });
});

test.describe("Portal Visual V0.1 — mobile pessoal", () => {
  test.skip(process.env.AA_PORTAL_VISUAL_FOCAL !== "1", "Somente QA remoto focal autorizado.");
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("reorganiza o Atrio, mantem os acessos por toque e evita overflow", async ({ page }, testInfo) => {
    const atrium = await openPortal(page);
    await assertNoHorizontalOverflow(page);
    const open = atrium.getByRole("link", { name: /Entrar no Primeiro Grimório/ });
    await expect(open).toBeVisible();

    const rect = await open.boundingBox();
    expect(rect, "O acesso precisa ter uma area de toque").not.toBeNull();
    expect(rect!.width).toBeGreaterThanOrEqual(24);
    expect(rect!.height).toBeGreaterThanOrEqual(24);
    await captureSyntheticView(page, testInfo, "portal-atrio-mobile-390x844.png");

    await open.tap();
    await expect(page).toHaveURL(/#primeiro-grimorio$/);
    await expect(page.getByRole("button", { name: "Iniciar o Primeiro Grimório" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // Reflow adicional: viewport estreito, sem modificar o zoom ou a escala do SO.
    await page.setViewportSize({ width: 320, height: 720 });
    await assertNoHorizontalOverflow(page);
  });

  test("captura o Grande Atrio no tema escuro em mobile", async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    const atrium = await openPortal(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "mago-classico");
    await expect(atrium.getByRole("link", { name: /Entrar no Primeiro Grimório/ })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureSyntheticView(page, testInfo, "portal-atrio-mobile-dark-390x844.png");
  });
});
