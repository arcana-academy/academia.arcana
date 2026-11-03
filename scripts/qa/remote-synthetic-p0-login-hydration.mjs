import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

// E2E P0 mínimo: Next.js anônimo, somente loopback; sem login real ou dados pessoais.
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch");
assert.equal(process.env.GITHUB_REPOSITORY, "arcana-academy/academiaarcana");
assert.equal(process.env.GITHUB_REF, "refs/heads/work/aa-qa-p0-composition-20261103");
assert.equal(process.env.QA_SCENARIO, "p0-login-gate-hidratacao");
assert.equal(process.env.AA_QA_REMOTE_SYNTHETIC, "1");
assert.equal(process.env.ACADEMIA_ARCANA_LOCAL_PREVIEW, "true");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "qa-only-no-secret");
for (const name of [
  "SUPABASE_ACCESS_TOKEN", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY", "RENDER_API_KEY",
]) assert.ok(!process.env[name], "Variável proibida: " + name);

const base = "http://127.0.0.1:3000";
async function rawGet(path) {
  const response = await fetch(base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
    headers: { "Cache-Control": "no-store" },
  });
  return response;
}

const index = await rawGet("/");
assert.equal(index.status, 307, "Prévia local deve redirecionar o início");
assert.equal(new URL(index.headers.get("location"), base).pathname, "/login");
console.log("PASS: / redireciona anonimamente para /login em prévia sintética");

const signup = await rawGet("/cadastro");
assert.equal(signup.status, 307, "Cadastro deve estar bloqueado na prévia");
assert.equal(new URL(signup.headers.get("location"), base).pathname, "/login");
console.log("PASS: /cadastro bloqueado por 307 no servidor");

const login = await rawGet("/login");
assert.equal(login.status, 200, "Login público esperado");
const html = await login.text();
assert.match(html, /<form[^>]*method="post"/);
assert.match(html, /Preparando formulário…/);
assert.match(html, /<button[^>]*disabled/);
assert.doesNotMatch(html, /<form[^>]*method="get"/);
console.log("PASS: HTML inicial tem POST e submit desabilitado antes da hidratação");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const response = await page.goto(base + "/login", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    assert.equal(response?.status(), 200);
    await expect(page.getByRole("heading", { name: "Entre no seu santuário de estudos" }))
      .toBeVisible({ timeout: 30_000 });
    const submit = page.getByRole("button", { name: "Entrar", exact: true });
    await expect(submit).toBeEnabled({ timeout: 45_000 });
    await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
    await expect(page.getByLabel("Senha", { exact: true })).toBeEnabled();
    await expect(page.locator("form.aa-auth-form")).toHaveAttribute("method", "post");
    await expect(page.getByRole("link", { name: "Criar conta" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toBeVisible();
    console.log("PASS: Chromium confirma hidratação, POST, recuperação acessível e cadastro oculto");

    const syntheticEmail = "aa-p0-qa@example.test";
    const syntheticPassword = "only-a-browser-draft-never-submit-123";
    await page.getByLabel("Email", { exact: true }).fill(syntheticEmail);
    await page.getByLabel("Senha", { exact: true }).fill(syntheticPassword);
    assert.ok(!page.url().includes(syntheticPassword));
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(syntheticEmail);
    await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(syntheticPassword);
    console.log("PASS: edição hidratada mantém estado local sem enviar senha por GET");

    await page.goto(base + "/cadastro", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page).toHaveURL(base + "/login");
    await expect(page.getByRole("heading", { name: "Entre no seu santuário de estudos" })).toBeVisible();
    console.log("PASS: navegação real do Chromium redireciona cadastro para login");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
console.log("LIMITE: este QA não testa autenticação real, P0 em produção, mobile ou QA assistivo");
