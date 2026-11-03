import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, expect } from "@playwright/test";

// Somente runner descartável, branch de QA e dados sintéticos em loopback.
// Sem sign-in pela UI, deleções ou credenciais de ambientes hospedados.
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch");
assert.equal(process.env.GITHUB_REF, "refs/heads/work/aa-qa-remoto-isolado-20261103");
assert.equal(process.env.AA_QA_REMOTE_SYNTHETIC, "1");
assert.equal(process.env.QA_SCENARIO, "workspace-criar-salvar-recuperar");
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
const password = "QA-" + randomBytes(24).toString("hex") + "Aa1!";
const emailA = "aa-workspace-owner-" + token + "@example.test";
const emailB = "aa-workspace-other-" + token + "@example.test";
const pageTitle = "Página remota " + token;
const savedTitle = "Página salva " + token;
const contentText = "Trecho original e persistido " + token;

function apiClient() {
  return createClient(origin.toString(), vars.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
function checked(result) {
  assert.ifError(result.error);
  return result.data;
}
const owner = apiClient();
const other = apiClient();
const a = checked(await owner.auth.signUp({ email: emailA, password }));
const b = checked(await other.auth.signUp({ email: emailB, password }));
assert.ok(a.user?.id && a.session && b.user?.id && b.session);
assert.notEqual(a.user.id, b.user.id);
const grimoire = checked(await owner.from("grimoires").insert({
  owner_id: a.user.id, title: "Grimório Workspace " + token,
}).select("id").single());
const notebook = checked(await owner.from("notebooks").insert({
  grimoire_id: grimoire.id, title: "Caderno Workspace", position: 0,
}).select("id").single());
const chapter = checked(await owner.from("chapters").insert({
  notebook_id: notebook.id, title: "Capítulo Workspace", position: 0,
}).select("id").single());

async function browserContextFor(browser, email) {
  const jar = new Map();
  const server = createServerClient(origin.toString(), vars.ANON_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
    cookies: {
      getAll() { return [...jar].map(([name, value]) => ({ name, value })); },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          if (options?.maxAge === 0 || value === "") jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
  });
  assert.ok(checked(await server.auth.signInWithPassword({ email, password })).session);
  assert.ok(jar.size > 0, "O SSR não produziu cookies");
  const ctx = await browser.newContext();
  await ctx.addCookies([...jar].map(([name, value]) => ({
    name, value, url: appUrl, httpOnly: false, secure: false, sameSite: "Lax",
  })));
  return ctx;
}

const browser = await chromium.launch({ headless: true });
const contexts = [];
try {
  const ctxA = await browserContextFor(browser, emailA);
  contexts.push(ctxA);
  const page = await ctxA.newPage();
  const targetChapter = appUrl + "/workspace?view=tree&chapter=" + chapter.id;
  const response = await page.goto(targetChapter, {
    waitUntil: "domcontentloaded", timeout: 90_000,
  });
  assert.equal(response?.status(), 200, "Workspace autenticado deve retornar HTTP 200");
  await expect(page.getByRole("heading", { name: "Área de trabalho" })).toBeVisible();
  await expect(page.locator("#workspace-new-page-title")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Não foi possível carregar seu Workspace")).toHaveCount(0);

  // Sincronize com a hidratação do React: o HTML SSR pode estar visível
  // antes dos onChange/submit handlers estarem ativos no Next.js dev.
  // Não forçar cliques em botões disabled nem alterar o produto para o teste.
  await page.waitForFunction(() => {
    const input = document.querySelector("#workspace-new-page-title");
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactProps$"));
  }, null, { timeout: 90_000 });
  console.log("PASS: formulário de criação hidratado antes de receber edição");

  // Criação real pelo formulário conectado à Server Action, sem semear a página por API.
  await page.locator("#workspace-new-page-title").fill(pageTitle);
  const createButton = page.getByRole("button", { name: "Criar página", exact: true });
  await expect(createButton).toBeEnabled({ timeout: 20_000 });
  await createButton.click();
  const editor = page.locator('article[aria-label="Editor da página"]');
  await expect(editor).toBeVisible({ timeout: 75_000 });
  await expect(editor.locator("#workspace-page-title")).toHaveValue(pageTitle);
  const rows = checked(await owner.from("pages")
    .select("id,chapter_id,title,content").eq("chapter_id", chapter.id));
  assert.equal(rows.length, 1, "A ação de criar deve persistir uma única página");
  const created = rows[0];
  assert.equal(created.title, pageTitle);
  assert.equal(created.chapter_id, chapter.id);
  assert.deepEqual(created.content.blocks, []);
  console.log("PASS: criação da página pelo Workspace e persistência inicial no PostgreSQL");

  // Edição real de título e bloco no browser, seguida de salvar manual.
  await editor.locator("#workspace-page-title").fill(savedTitle);
  await editor.getByRole("button", { name: "Adicionar bloco" }).click();
  await editor.locator("#workspace-page-block-0").fill(contentText);
  await editor.getByRole("button", { name: "Salvar página", exact: true }).click();
  await expect(editor.getByText("Página salva.", { exact: true })).toBeVisible({ timeout: 75_000 });
  const saved = checked(await owner.from("pages")
    .select("id,title,content").eq("id", created.id).single());
  assert.equal(saved.title, savedTitle);
  assert.equal(saved.content?.type, "document");
  assert.equal(saved.content?.blocks?.[0]?.content, contentText);
  console.log("PASS: título e bloco foram salvos por Server Action e lidos do PostgreSQL");

  // Nova consulta SSR e nova página após reload devem recuperar os mesmos dados.
  const reload = await page.goto(appUrl + "/workspace?view=tree&page=" + created.id, {
    waitUntil: "domcontentloaded", timeout: 90_000,
  });
  assert.equal(reload?.status(), 200);
  const reopened = page.locator('article[aria-label="Editor da página"]');
  await expect(reopened.locator("#workspace-page-title")).toHaveValue(savedTitle, { timeout: 60_000 });
  await expect(reopened.locator("#workspace-page-block-0")).toHaveValue(contentText);
  console.log("PASS: recuperação por navegação completa mantém título e bloco persistidos");

  // Novo contexto e sessão Auth/SSR independente: não reutilizar o contexto anterior.
  const freshCtx = await browserContextFor(browser, emailA);
  contexts.push(freshCtx);
  const freshPage = await freshCtx.newPage();
  const freshResponse = await freshPage.goto(appUrl + "/workspace?view=tree&page=" + created.id, {
    waitUntil: "domcontentloaded", timeout: 90_000,
  });
  assert.equal(freshResponse?.status(), 200);
  const freshEditor = freshPage.locator('article[aria-label="Editor da página"]');
  await expect(freshEditor.locator("#workspace-page-title")).toHaveValue(savedTitle, { timeout: 60_000 });
  await expect(freshEditor.locator("#workspace-page-block-0")).toHaveValue(contentText);
  console.log("PASS: nova sessão sintética recupera página salva no Workspace");

  // Isolamento entre proprietários: tanto banco RLS quanto resposta da UI.
  assert.deepEqual(checked(await other.from("pages").select("id").eq("id", created.id)), []);
  const otherCtx = await browserContextFor(browser, emailB);
  contexts.push(otherCtx);
  const otherPage = await otherCtx.newPage();
  const otherResponse = await otherPage.goto(appUrl + "/workspace?view=tree&page=" + created.id, {
    waitUntil: "domcontentloaded", timeout: 90_000,
  });
  assert.equal(otherResponse?.status(), 200);
  await expect(otherPage.getByText("Seu Workspace ainda não tem grimórios.")).toBeVisible({ timeout: 60_000 });
  await expect(otherPage.locator('article[aria-label="Editor da página"]')).toHaveCount(0);
  await expect(otherPage.getByText(contentText, { exact: false })).toHaveCount(0);
  console.log("PASS: conta estrangeira não lê página via RLS nem por deep link do Workspace");
} finally {
  for (const ctx of contexts) await ctx.close();
  await browser.close();
}
console.log("LIMITE: não valida sincronização P0 local, autosave, mobile, QA assistivo nem publicação");
