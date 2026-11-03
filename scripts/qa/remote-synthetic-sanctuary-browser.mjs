import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, expect } from "@playwright/test";

// Prova SOMENTE para runner efêmero, SHA da branch isolada e Supabase loopback.
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch");
assert.equal(process.env.GITHUB_REF, "refs/heads/work/aa-qa-remoto-isolado-20261103");
assert.equal(process.env.AA_QA_REMOTE_SYNTHETIC, "1");
assert.equal(process.env.QA_SCENARIO, "santuario-estados-progresso");
for (const name of [
  "SUPABASE_ACCESS_TOKEN", "DATABASE_URL", "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "RENDER_API_KEY",
]) assert.ok(!process.env[name], "Variável remota proibida: " + name);

const raw = execFileSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"],
});
const vars = Object.fromEntries(raw.split(/\r?\n/).flatMap((line) => {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  return m ? [[m[1], m[2].replace(/^["']|["']$/g, "")]] : [];
}));
const origin = new URL(vars.API_URL);
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
assert.equal(origin.port, "54321");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, origin.toString());
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, vars.ANON_KEY);
assert.ok(vars.ANON_KEY);

const appUrl = "http://127.0.0.1:3000";
const token = randomUUID();
const pass = "QA-" + randomBytes(22).toString("hex") + "Aa1!";
const emptyEmail = "aa-sanctuary-empty-" + token + "@example.test";
const filledEmail = "aa-sanctuary-filled-" + token + "@example.test";
const title = "Estudo sintetico Santuário " + token;

function apiClient() {
  return createClient(origin.toString(), vars.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
function checked(result) {
  assert.ifError(result.error);
  return result.data;
}
const empty = apiClient();
const filled = apiClient();
const emptySignup = checked(await empty.auth.signUp({ email: emptyEmail, password: pass }));
const filledSignup = checked(await filled.auth.signUp({ email: filledEmail, password: pass }));
assert.ok(emptySignup.user && emptySignup.session);
assert.ok(filledSignup.user && filledSignup.session);
assert.notEqual(emptySignup.user.id, filledSignup.user.id);

const grimoire = checked(await filled.from("grimoires").insert({
  owner_id: filledSignup.user.id, title,
}).select("id").single());
const notebook = checked(await filled.from("notebooks").insert({
  grimoire_id: grimoire.id, title: "Caderno sintético", position: 0,
}).select("id").single());
const chapter = checked(await filled.from("chapters").insert({
  notebook_id: notebook.id, title: "Capítulo sintético", position: 0,
}).select("id").single());
const pages = checked(await filled.from("pages").insert([
  { chapter_id: chapter.id, title: "Página sintética um", position: 0 },
  { chapter_id: chapter.id, title: "Página sintética dois", position: 1 },
]).select("id,position"));
assert.equal(pages.length, 2);
const first = pages.find(p => p.position === 0);
const second = pages.find(p => p.position === 1);
assert.ok(first && second && first.id !== second.id);
checked(await filled.from("page_progress").insert({
  owner_id: filledSignup.user.id,
  page_id: first.id, status: "completed",
  completed_at: new Date().toISOString(),
}));

// Não visitar formulário de login: criar cookies SSR com nova sessão via SDK.
async function browserContextFor(browser, email) {
  const jar = new Map();
  const server = createServerClient(origin.toString(), vars.ANON_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
    cookies: {
      getAll() { return [...jar.entries()].map(([name, value]) => ({ name, value })); },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          if (options?.maxAge === 0 || value === "") jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
  });
  assert.ok(checked(await server.auth.signInWithPassword({ email, password: pass })).session);
  assert.ok(jar.size > 0, "Auth SSR não gerou cookies");
  const context = await browser.newContext();
  await context.addCookies([...jar.entries()].map(([name, value]) => ({
    name, value, url: appUrl, httpOnly: false, secure: false, sameSite: "Lax",
  })));
  return context;
}
async function navigate(page) {
  const response = await page.goto(appUrl + "/santuario", {
    waitUntil: "domcontentloaded", timeout: 90_000,
  });
  assert.equal(response?.status(), 200, "Santuário precisa responder 200 autenticado");
  await expect(page).toHaveURL(/\/santuario$/);
  await expect(page.getByRole("heading", { name: "Seu Santuário de aprendizagem" })).toBeVisible();
}

const browser = await chromium.launch({ headless: true });
try {
  const emptyContext = await browserContextFor(browser, emptyEmail);
  const filledContext = await browserContextFor(browser, filledEmail);
  try {
    const emptyPage = await emptyContext.newPage();
    await navigate(emptyPage);
    await expect(emptyPage.getByText("Nenhum conteúdo disponível para abrir no Santuário ainda.", { exact: false })).toBeVisible();
    await expect(emptyPage.getByText("Ainda não há dados de progresso para exibir.")).toBeVisible();
    await expect(emptyPage.getByText("Ainda não há missões disponíveis.")).toBeVisible();
    await expect(emptyPage.getByText("Ainda não há itens na agenda.")).toBeVisible();
    await expect(emptyPage.getByText(title)).toHaveCount(0);
    await expect(emptyPage.locator(".aa-progress-copy .aa-status")).toHaveCount(0);
    console.log("PASS: Santuário vazio real não fabrica percentual nem mostra conteúdo de outro usuário");

    const filledPage = await filledContext.newPage();
    await navigate(filledPage);
    await expect(filledPage.getByText(title, { exact: true })).toBeVisible();
    await expect(filledPage.getByText("1 de 2 páginas concluídas")).toBeVisible();
    await expect(filledPage.locator(".aa-progress-copy .aa-status")).toHaveText("50%");
    console.log("PASS: Santuário lê 50% calculados de duas páginas persistidas");

    checked(await filled.from("page_progress").insert({
      owner_id: filledSignup.user.id,
      page_id: second.id, status: "completed",
      completed_at: new Date().toISOString(),
    }));
    await filledPage.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(filledPage.getByText("2 de 2 páginas concluídas")).toBeVisible();
    await expect(filledPage.locator(".aa-progress-copy .aa-status")).toHaveText("100%");
    console.log("PASS: recarregamento do Santuário reflete 100% persistidos em PostgreSQL");

    await emptyPage.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(emptyPage.getByText("Ainda não há dados de progresso para exibir.")).toBeVisible();
    await expect(emptyPage.getByText(title)).toHaveCount(0);
    console.log("PASS: outro usuário mantém estado vazio após atualização de progresso");
  } finally {
    await emptyContext.close();
    await filledContext.close();
  }
} finally {
  await browser.close();
}
console.log("LIMITE: não valida P0 local, mobile, QA assistivo nem produção");
