/**
 * PROPOSTA V3 CHAT 09 (04/11/2026) — NÃO EXECUTADA / NÃO INCORPORADA.
 * Uso futuro autorizado, e somente dentro do GitHub Actions:
 *   node ../orchestration/scripts/qa/remote-synthetic-p0-authenticated.mjs seed
 *   node ../orchestration/scripts/qa/remote-synthetic-p0-authenticated.mjs verify
 * Repositório de código em AA_CODE_ROOT, SHA P0 imutável; workflow em outro SHA.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const P0 = '2aa150efa105388a0a3fdb344a72ca5f6e00e1f0';
const REQUIRED_REF = 'refs/heads/work/aa-qa-remoto-isolado-20261103';
const BASE = 'http://127.0.0.1:3000';
const stage = process.argv[2];
let lastStage = 'preflight';

function preflight() {
  assert.ok(['seed', 'verify'].includes(stage));
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(process.env.GITHUB_REPOSITORY, 'arcana-academy/academiaarcana');
  assert.equal(process.env.GITHUB_ACTOR, 'arcana-academy');
  assert.equal(process.env.GITHUB_REF, REQUIRED_REF);
  assert.equal(process.env.QA_SCENARIO, 'p0-auth-ui-rls-integrado');
  assert.equal(process.env.AA_QA_REMOTE_SYNTHETIC, '1');
  assert.equal(process.env.AA_P0_CODE_SHA, P0);
  assert.match(process.env.GITHUB_SHA ?? '', /^[0-9a-f]{40}$/);
  assert.equal(process.env.GITHUB_SHA, process.env.AA_EXPECTED_ORCHESTRATION_SHA);
  const forbidden = [
    'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY',
    'SUPABASE_URL', 'DATABASE_URL', 'DIRECT_URL', 'RENDER_API_KEY',
    'RENDER_DEPLOY_HOOK_URL', 'VERCEL_TOKEN', 'AWS_ACCESS_KEY_ID',
  ];
  for (const name of forbidden) assert.ok(!process.env[name], 'prohibited environment');
  assert.ok(process.env.AA_CODE_ROOT && process.env.AA_QA_STATE_FILE);
  const codeRoot = realpathSync(process.env.AA_CODE_ROOT);
  assert.equal(execFileSync('git', ['-C', codeRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8', timeout: 20000,
  }).trim(), P0);
  assert.ok(process.env.AA_QA_STATE_FILE.startsWith(process.env.RUNNER_TEMP + '/'));
  return codeRoot;
}

function localSettings(codeRoot) {
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: codeRoot, encoding: 'utf8', timeout: 20000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const vars = Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^["']|["']$/g, '')]] : [];
  }));
  const api = new URL(vars.API_URL);
  assert.equal(api.origin, 'http://127.0.0.1:54321');
  assert.equal(api.pathname, '/');
  assert.ok(!api.search && !api.hash && !api.username && !api.password);
  assert.ok(vars.ANON_KEY && !/[\r\n]/.test(vars.ANON_KEY));
  if (stage === 'verify') {
    assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, api.toString());
    assert.equal(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, vars.ANON_KEY);
  }
  return { url: api.toString(), key: vars.ANON_KEY };
}

function dependencies(codeRoot) {
  // A proposta vive no checkout ORQUESTRADOR; as dependências vêm exclusivamente
  // de node_modules instalado a partir do package-lock do checkout P0.
  const requireFromP0 = createRequire(join(codeRoot, 'package.json'));
  return {
    createClient: requireFromP0('@supabase/supabase-js').createClient,
    playwright: stage === 'verify' ? requireFromP0('@playwright/test') : null,
  };
}

function client(createClient, settings) {
  return createClient(settings.url, settings.key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function checked(result, label) {
  assert.ok(!result.error, label + ': retorno com erro');
  return result.data;
}

function pass(label) { console.log('PASS: ' + label); }

async function seed(codeRoot, settings, createClient) {
  lastStage = 'seed-two-accounts';
  const identifier = randomUUID();
  const credentials = {
    a: { email: 'qa-owner-' + identifier + '@example.test',
      password: 'Qa-' + randomBytes(25).toString('hex') + 'Aa!1' },
    b: { email: 'qa-other-' + identifier + '@example.test',
      password: 'Qa-' + randomBytes(25).toString('hex') + 'Bb!1' },
  };
  const aClient = client(createClient, settings);
  const bClient = client(createClient, settings);
  const a = checked(await aClient.auth.signUp(credentials.a), 'signup A');
  const b = checked(await bClient.auth.signUp(credentials.b), 'signup B');
  assert.ok(a.user?.id && a.session?.access_token && b.user?.id && b.session?.access_token);
  assert.notEqual(a.user.id, b.user.id);
  credentials.a.id = a.user.id;
  credentials.b.id = b.user.id;
  // Flag wx: falha em vez de sobrescrever; 0600: apenas o runner lê.
  writeFileSync(process.env.AA_QA_STATE_FILE, JSON.stringify(credentials), {
    encoding: 'utf8', mode: 0o600, flag: 'wx',
  });
  pass('duas contas sintéticas locais criadas; ID A mantido fora dos logs');
}

async function browserNetwork(context) {
  // Barreira complementar no navegador: registrar ANTES da primeira page/navegação.
  // A política de egress do runner e o isolamento Docker continuam necessários.
  assert.equal(typeof context.routeWebSocket, 'function',
    'Playwright sem routeWebSocket: bloquear execução, não ampliar rede');
  const blocked = [];
  const allowedHttp = new Set([
    'http://127.0.0.1:3000', 'http://127.0.0.1:54321',
  ]);
  const allowedWebSockets = new Set(['ws://127.0.0.1:3000']);

  await context.route('**/*', async (route) => {
    let permitted = false;
    try {
      const url = new URL(route.request().url());
      permitted = ['http:', 'https:'].includes(url.protocol) &&
        allowedHttp.has(url.origin) &&
        !url.username && !url.password;
    } catch { /* URL inválida: deny */ }
    if (!permitted) {
      blocked.push('http'); // não registrar URL ou payload sensível
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  // WebSockets não são protegidos por route('**/*'). Interceptar ANTES de newPage.
  // Sem connectToServer, o Playwright NÃO conecta ao servidor real.
  await context.routeWebSocket('**/*', async (socket) => {
    let permitted = false;
    try {
      const url = new URL(socket.url());
      permitted = url.protocol === 'ws:' && allowedWebSockets.has(url.origin) &&
        !url.username && !url.password;
    } catch { /* URL inválida: deny */ }
    if (!permitted) {
      blocked.push('websocket');
      await socket.close({ code: 1008, reason: 'policy' });
      return;
    }
    socket.connectToServer();
  });

  return () => assert.equal(blocked.length, 0,
    'Houve tentativa de rede fora da allowlist; saída bloqueada; falha fechada');
}

async function uiLogin(page, email, password, expect) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await expect(page.getByRole('heading', { name: 'Entre no seu santuário de estudos' }))
    .toBeVisible({ timeout: 40000 });
  await expect(page.getByRole('button', { name: 'Entrar', exact: true }))
    .toBeEnabled({ timeout: 45000 });
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  const authResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === 'http://127.0.0.1:54321' &&
      url.pathname === '/auth/v1/token' &&
      response.request().method() === 'POST';
  }, { timeout:60000 });
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const authResponse = await authResponsePromise;
  assert.equal(authResponse.status(), 200, 'login UI Auth local deve retornar 200');
  const authBody = await authResponse.json();
  assert.ok(authBody.user?.id && authBody.access_token,
    'login UI deve comprovar sessão independente no Auth local');
  return authBody.user.id;
}

async function verify(codeRoot, settings, createClient, playwright) {
  const { chromium, expect } = playwright;
  const state = JSON.parse(readFileSync(process.env.AA_QA_STATE_FILE, 'utf8'));
  assert.match(state.a.id, /^[0-9a-f-]{36}$/);
  assert.match(state.b.id, /^[0-9a-f-]{36}$/);
  assert.notEqual(state.a.id, state.b.id);
  assert.equal(process.env.ACADEMIA_ARCANA_PERSONAL_MODE, 'true');
  assert.equal(process.env.ACADEMIA_ARCANA_PERSONAL_OWNER_ID, state.a.id);
  assert.notEqual(process.env.ACADEMIA_ARCANA_LOCAL_PREVIEW, 'true');
  const a = client(createClient, settings);
  const b = client(createClient, settings);
  const secondA = client(createClient, settings);
  const credentialsA = { email: state.a.email, password: state.a.password };
  const credentialsB = { email: state.b.email, password: state.b.password };
  lastStage = 'api-auth';
  assert.equal(checked(await a.auth.signInWithPassword(credentialsA), 'auth A').user.id, state.a.id);
  assert.equal(checked(await b.auth.signInWithPassword(credentialsB), 'auth B').user.id, state.b.id);
  assert.equal(checked(await secondA.auth.signInWithPassword(credentialsA), 'auth A2').user.id, state.a.id);
  pass('Auth local A, A2 e B com sessões independentes');

  const browser = await chromium.launch({ headless: true });
  const contexts = [];
  try {
    lastStage = 'anonymous';
    const anon = await browser.newContext({ serviceWorkers: 'block' }); contexts.push(anon);
    const anonNetwork = await browserNetwork(anon);
    const guest = await anon.newPage();
    for (const path of ['/santuario', '/workspace', '/grimorios']) {
      const response = await guest.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
      assert.ok(response && [200, 307, 308].includes(response.status()));
      await expect(guest).toHaveURL(BASE + '/login', { timeout: 60000 });
    }
    anonNetwork();
    pass('navegação privada anônima negada');

    lastStage = 'personal-owner-ui';
    const ctxA = await browser.newContext({ serviceWorkers: 'block' }); contexts.push(ctxA);
    const networkA = await browserNetwork(ctxA);
    const pageA = await ctxA.newPage();
    assert.equal(await uiLogin(pageA, state.a.email, state.a.password, expect), state.a.id);
    await expect(pageA).toHaveURL(BASE + '/santuario', { timeout: 90000 });
    await expect(pageA.getByRole('heading', { name: 'Seu Santuário de aprendizagem' }))
      .toBeVisible({ timeout: 90000 });
    await expect(pageA.getByText('Ainda não há dados de progresso para exibir.')).toBeVisible();
    pass('proprietária sintética A entra pelo formulário real; Santuário vazio');

    lastStage = 'personal-denied-b';
    const ctxB = await browser.newContext({ serviceWorkers: 'block' }); contexts.push(ctxB);
    const networkB = await browserNetwork(ctxB);
    const pageB = await ctxB.newPage();
    assert.equal(await uiLogin(pageB, state.b.email, state.b.password, expect), state.b.id);
    await pageB.goto(BASE + '/santuario', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(pageB).toHaveURL(BASE + '/login', { timeout: 90000 });
    await pageB.goto(BASE + '/workspace', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(pageB).toHaveURL(BASE + '/login', { timeout: 90000 });
    pass('B login Chromium comprovado pela resposta Auth local; gate pessoal nega páginas');
    await verifyNextHttp(anon,ctxA,ctxB);

    lastStage = 'rls-grimoires';
    const token = randomUUID();
    const titleA = 'Grimório QA A ' + token;
    const titleB = 'Grimório QA B ' + token;
    const grimoireA = checked(await a.from('grimoires')
      .insert({ owner_id: state.a.id, title: titleA }).select('id').single(), 'create grimoire A');
    const grimoireB = checked(await b.from('grimoires')
      .insert({ owner_id: state.b.id, title: titleB }).select('id').single(), 'create grimoire B');
    assert.deepEqual(checked(await a.from('grimoires').select('id').eq('id', grimoireB.id), 'A reads B'), []);
    assert.deepEqual(checked(await b.from('grimoires').select('id').eq('id', grimoireA.id), 'B reads A'), []);
    assert.equal(checked(await b.from('grimoires')
      .update({ title: 'FORBIDDEN' }).eq('id', grimoireA.id).select('id'), 'B update A').length, 0);
    assert.ok((await a.from('grimoires')
      .insert({ owner_id: state.b.id, title: 'FORBIDDEN' })).error, 'forged owner INSERT must fail');
    assert.equal(checked(await a.from('grimoires').select('title')
      .eq('id', grimoireA.id).single(), 'A row safe').title, titleA);
    pass('PostgreSQL/PostgREST RLS A/B, INSERT falsificado e UPDATE cruzado negados');

    lastStage = 'storage-rls';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLqUQAAAABJRU5ErkJggg==', 'base64');
    const pathA = state.a.id + '/qa-' + token + '.png';
    const pathB = state.b.id + '/qa-' + token + '.png';
    checked(await a.storage.from('grimoire-covers').upload(pathA, png, {
      contentType: 'image/png', upsert: false,
    }), 'storage A upload');
    checked(await b.storage.from('grimoire-covers').upload(pathB, png, {
      contentType: 'image/png', upsert: false,
    }), 'storage B upload');
    const own = checked(await a.storage.from('grimoire-covers').download(pathA), 'storage A download');
    assert.deepEqual(Buffer.from(await own.arrayBuffer()), png);
    assert.ok((await b.storage.from('grimoire-covers').download(pathA)).error);
    assert.ok((await a.storage.from('grimoire-covers').download(pathB)).error);
    assert.ok((await b.storage.from('grimoire-covers').upload(state.a.id + '/bad-' + token + '.png', png, {
      contentType: 'image/png', upsert: false,
    })).error);
    pass('Storage SDK privado: upload próprio e acesso cruzado negado');
    await verifyStorageHttp(settings, (await a.auth.getSession()).data.session,
      (await b.auth.getSession()).data.session, {a:state.a.id,b:state.b.id}, png,pathA,pathB);

    lastStage = 'grimoire-persistence';
    await pageA.goto(BASE + '/grimorios', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(pageA.getByText(titleA, { exact: true })).toBeVisible({ timeout: 90000 });
    await expect(pageA.getByText(titleB, { exact: true })).toHaveCount(0);
    checked(await a.from('grimoires').update({ title: titleA + ' revisto' })
      .eq('id', grimoireA.id).select('id').single(), 'persist edit A');
    const newSessionA = client(createClient, settings);
    checked(await newSessionA.auth.signInWithPassword(credentialsA), 'new A session');
    assert.equal(checked(await newSessionA.from('grimoires').select('title')
      .eq('id', grimoireA.id).single(), 'persist A in new session').title, titleA + ' revisto');
    await pageA.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(pageA.getByText(titleA + ' revisto', { exact: true })).toBeVisible({ timeout: 90000 });
    pass('Grimórios: criação/edição SDK; somente leitura/reload Chromium (UI PARCIAL)');

    lastStage = 'workspace-ui';
    const notebook = checked(await a.from('notebooks').insert({
      grimoire_id: grimoireA.id, title: 'Caderno sintético', position: 0,
    }).select('id').single(), 'notebook');
    const chapter = checked(await a.from('chapters').insert({
      notebook_id: notebook.id, title: 'Capítulo sintético', position: 0,
    }).select('id').single(), 'chapter');
    await pageA.goto(BASE + '/workspace?view=tree&chapter=' + chapter.id, {
      waitUntil: 'domcontentloaded', timeout: 90000,
    });
    await expect(pageA.locator('#workspace-new-page-title')).toBeVisible({ timeout: 60000 });
    await pageA.waitForFunction(() => {
      const input = document.querySelector('#workspace-new-page-title');
      return !!input && Object.keys(input).some(k => k.startsWith('__reactProps$'));
    }, null, { timeout: 90000 });
    const originalTitle = 'Página QA ' + token;
    const savedTitle = 'Página salva QA ' + token;
    const content = 'Conteúdo sintético persistido ' + token;
    await pageA.locator('#workspace-new-page-title').fill(originalTitle);
    await pageA.getByRole('button', { name: 'Criar página', exact: true }).click();
    const editor = pageA.locator('article[aria-label="Editor da página"]');
    await expect(editor.locator('#workspace-page-title')).toHaveValue(originalTitle, { timeout: 90000 });
    const rows = checked(await a.from('pages').select('id').eq('chapter_id', chapter.id), 'pages after create');
    assert.equal(rows.length, 1);
    await editor.locator('#workspace-page-title').fill(savedTitle);
    await editor.getByRole('button', { name: 'Adicionar bloco' }).click();
    await editor.locator('#workspace-page-block-0').fill(content);
    await editor.getByRole('button', { name: 'Salvar página', exact: true }).click();
    await expect(editor.getByText('Página salva.', { exact: true })).toBeVisible({ timeout: 90000 });
    await pageA.goto(BASE + '/workspace?view=tree&page=' + rows[0].id, {
      waitUntil: 'domcontentloaded', timeout: 90000,
    });
    await expect(pageA.locator('#workspace-page-title')).toHaveValue(savedTitle, { timeout: 90000 });
    await expect(pageA.locator('#workspace-page-block-0')).toHaveValue(content);
    const row = checked(await a.from('pages').select('title,content').eq('id', rows[0].id).single(), 'page saved');
    assert.equal(row.title, savedTitle);
    assert.equal(row.content.blocks[0].content, content);
    assert.deepEqual(checked(await b.from('pages').select('id').eq('id', rows[0].id), 'B pages'), []);
    pass('Workspace: criar, editar, salvar, reabrir na UI e negar B via RLS');

    lastStage = 'sanctuary-progress';
    const secondPage = checked(await a.from('pages').insert({
      chapter_id: chapter.id, title: 'Página dois QA', position: 1,
    }).select('id').single(), 'second page');
    checked(await a.from('page_progress').insert({
      owner_id: state.a.id, page_id: rows[0].id, status: 'completed',
      completed_at: new Date().toISOString(),
    }), 'first progress');
    await pageA.goto(BASE + '/santuario', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(pageA.getByText('1 de 2 páginas concluídas')).toBeVisible({ timeout: 90000 });
    checked(await a.from('page_progress').insert({
      owner_id: state.a.id, page_id: secondPage.id, status: 'completed',
      completed_at: new Date().toISOString(),
    }), 'second progress');
    await pageA.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(pageA.getByText('2 de 2 páginas concluídas')).toBeVisible({ timeout: 90000 });
    pass('Santuário Chromium: progresso inserido SDK refletido 50% → 100%');
    await verifyPostgrestHttp(settings, (await a.auth.getSession()).data.session,
      (await b.auth.getSession()).data.session, {a:state.a.id,b:state.b.id});

    lastStage = 'fresh-browser-ui-login';
    const ctxFresh = await browser.newContext({ serviceWorkers: 'block' }); contexts.push(ctxFresh);
    const freshNetwork = await browserNetwork(ctxFresh);
    const pageFresh = await ctxFresh.newPage();
    assert.equal(await uiLogin(pageFresh, state.a.email, state.a.password, expect), state.a.id);
    await pageFresh.goto(BASE + '/workspace?view=tree&page=' + rows[0].id, {
      waitUntil: 'domcontentloaded', timeout: 90000,
    });
    await expect(pageFresh.locator('#workspace-page-title')).toHaveValue(savedTitle, { timeout: 90000 });
    await expect(pageFresh.locator('#workspace-page-block-0')).toHaveValue(content);
    pass('novo contexto Chromium: login UI A e recuperação do Workspace');

    lastStage = 'logout-revocation';
    await pageFresh.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(pageFresh).toHaveURL(BASE + '/login', { timeout: 90000 });
    await pageFresh.goto(BASE + '/santuario', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(pageFresh).toHaveURL(BASE + '/login', { timeout: 90000 });
    assert.ok((await secondA.auth.refreshSession()).error, 'old A refresh token should be revoked');
    assert.ok(checked(await b.auth.refreshSession(), 'independent B refresh').session);
    networkA(); networkB(); freshNetwork(); anonNetwork();
    await verifyLogoutHttp(ctxFresh);
    pass('logout UI e refresh de sessão SDK; não inferir invalidação de access JWT');
    console.log('LIMITES: JWT access não demonstrado inválido antes de expirar; hospedagem/release não avaliados');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
}

// V3: API HTTP sem service_role; todas as URLs devem apontar ao Supabase local.
// Este código é apenas PROPOSTA não executada. Desvios param o job sem logs de payload.
const SAFE_LOCAL_ORIGINS = new Set([BASE, 'http://127.0.0.1:54321']);
function localUrl(origin, path) {
  assert.ok(SAFE_LOCAL_ORIGINS.has(origin));
  const url = new URL(path, origin);
  assert.equal(url.origin, origin);
  assert.ok(!url.username && !url.password && !url.hash);
  return url.toString();
}
async function httpLocal(origin, path, options = {}) {
  const url = localUrl(origin, path);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.headers ?? {},
    body: options.body,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  const contentType = response.headers.get('content-type') || '';
  let body = null;
  if (options.binary && response.ok) body = Buffer.from(await response.arrayBuffer());
  else if (contentType.includes('application/json')) body = await response.json();
  else await response.arrayBuffer(); // descartar resposta não estruturada sem exibir
  return { status: response.status, body, headers: response.headers };
}
function bearer(settings, session) {
  // A chave anon da CLI local é publicável. JWTs de A/B permanecem em memória.
  const token = session?.access_token ?? settings.key;
  assert.ok(token && !/[\r\n]/.test(token));
  return { apikey: settings.key, Authorization: `Bearer ${token}` };
}
async function rest(settings, session, table, method, query = '', payload) {
  assert.ok(['grimoires','notebooks','chapters','pages','page_progress'].includes(table));
  const path = '/rest/v1/' + table + (query ? '?' + query : '');
  const headers = {
    ...bearer(settings, session),
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  return httpLocal('http://127.0.0.1:54321', path, {
    method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
function rowsOrDenied(result, id) {
  if ([401, 403].includes(result.status)) return;
  assert.equal(result.status, 200, `${id} status SELECT diferente do contrato`);
  assert.ok(Array.isArray(result.body) && result.body.length === 0,
    `${id} vazou linha sob RLS`);
}
function mutationDenied(result, id) {
  if ([400,401,403,404,409,422].includes(result.status)) return;
  assert.ok([200,204].includes(result.status), `${id} erro HTTP não previsto`);
  assert.ok(result.body === null || (Array.isArray(result.body) && result.body.length === 0),
    `${id} mutação cruzada retornou linha`);
}
function created(result, name) {
  assert.equal(result.status, 201, `${name}: INSERT HTTP não criou`);
  assert.ok(Array.isArray(result.body) && result.body.length === 1 &&
    /^[0-9a-f-]{36}$/i.test(result.body[0].id), `${name}: representação não comprovada`);
  return result.body[0].id;
}
async function verifyPostgrestHttp(settings, aSession, bSession, ids) {
  lastStage = 'http-postgrest-five-tables';
  const random = randomUUID();
  const actors = [
    { key:'A', session:aSession, owner: ids.a },
    { key:'B', session:bSession, owner: ids.b },
  ];
  const fx = {};
  for (const actor of actors) {
    const key = actor.key;
    fx[key] = {};
    const chain = [
      ['grimoires', () => ({ owner_id:actor.owner, title:'HTTP grimório ' + key + random })],
      ['notebooks', () => ({ grimoire_id:fx[key].grimoires, title:'HTTP caderno ' + key + random, position:0 })],
      ['chapters', () => ({ notebook_id:fx[key].notebooks, title:'HTTP capítulo ' + key + random, position:0 })],
      ['pages', () => ({ chapter_id:fx[key].chapters, title:'HTTP página ' + key + random, position:0 })],
      ['page_progress', () => ({ owner_id:actor.owner, page_id:fx[key].pages, status:'in-progress' })],
    ];
    for (const [table, make] of chain) {
      const payload = make();
      fx[key][table] = created(await rest(settings, actor.session, table,
        'POST', 'select=id', payload), `${key} ${table}`);
    }
  }
  const tables = ['grimoires','notebooks','chapters','pages','page_progress'];
  for (const table of tables) {
    for (const actor of actors) {
      const other = actor.key === 'A' ? 'B' : 'A';
      const owned = await rest(settings, actor.session, table, 'GET',
        `select=id&id=eq.${fx[actor.key][table]}`);
      assert.equal(owned.status, 200);
      assert.deepEqual(owned.body.map(x => x.id), [fx[actor.key][table]]);
      rowsOrDenied(await rest(settings, actor.session, table, 'GET',
        `select=id&id=eq.${fx[other][table]}`), `${actor.key} SELECT ${other} ${table}`);
      rowsOrDenied(await rest(settings, null, table, 'GET',
        `select=id&id=eq.${fx[actor.key][table]}`), `anon SELECT ${table}`);
      const altered = table === 'page_progress' ? {status:'completed'} : {title:'HTTP own revised ' + actor.key + random};
      const crossPayload = table === 'page_progress' ? {status:'not-started'} : {title:'HTTP CROSS ' + actor.key + random};
      const ownPatch = await rest(settings, actor.session, table, 'PATCH',
        `id=eq.${fx[actor.key][table]}&select=id`, altered);
      assert.equal(ownPatch.status, 200);
      assert.deepEqual(ownPatch.body.map(x => x.id), [fx[actor.key][table]]);
      const otherPatch = await rest(settings, actor.session, table, 'PATCH',
        `id=eq.${fx[other][table]}&select=id`, crossPayload);
      mutationDenied(otherPatch, `${actor.key} UPDATE ${other} ${table}`);
      mutationDenied(await rest(settings, null, table, 'PATCH',
        `id=eq.${fx[actor.key][table]}&select=id`, altered), `anon UPDATE ${table}`);
      const stillOwned = await rest(settings, actors.find(x=>x.key===other).session,
        table, 'GET', `select=*&id=eq.${fx[other][table]}`);
      assert.equal(stillOwned.status, 200);
      assert.ok(Array.isArray(stillOwned.body) && stillOwned.body.length === 1,
        `${table}: linha do outro titular não permanece visível a ele`);
      // Não basta um erro: confirmar que a atualização cruzada não substituiu valor.
      assert.notEqual(stillOwned.body[0][table==='page_progress'?'status':'title'],
        crossPayload[table==='page_progress'?'status':'title']);
    }
  }
  for (const actor of actors) {
    const other = actor.key === 'A' ? 'B' : 'A';
    const invalidInserts = [
      ['grimoires', {owner_id: actors.find(x=>x.key===other).owner, title:'FORGED '+random}],
      ['notebooks', {grimoire_id: fx[other].grimoires, title:'FORGED '+random, position:0}],
      ['chapters', {notebook_id: fx[other].notebooks, title:'FORGED '+random, position:0}],
      ['pages', {chapter_id: fx[other].chapters, title:'FORGED '+random, position:0}],
      ['page_progress', {owner_id: actor.owner, page_id:fx[other].pages, status:'in-progress'}],
    ];
    for (const [table,payload] of invalidInserts) {
      const result = await rest(settings, actor.session, table, 'POST', 'select=id', payload);
      assert.ok(result.status >= 400 && result.status < 500,
        `${actor.key} INSERT cruzado de ${table} deveria falhar`);
      const anonInsert = await rest(settings, null, table, 'POST', 'select=id', payload);
      assert.ok(anonInsert.status >= 400 && anonInsert.status < 500,
        `anon INSERT ${table} deveria falhar`);
    }
  }
  // Não tentar mutação destrutiva cruzada. As exclusões ficam fora do P0 mínimo.
  pass('HTTP PostgREST A/B/anônimo: cinco tabelas SELECT/INSERT/UPDATE e pós-condição');
}
async function storageHttp(settings, session, path, method = 'GET', body) {
  assert.ok(/^[0-9a-f-]{36}\/qa-[a-z0-9-]+\.png$/i.test(path));
  return httpLocal('http://127.0.0.1:54321',
    '/storage/v1/object/' + (method === 'GET' ? 'authenticated/' : '') +
      'grimoire-covers/' + path, {
      method,
      headers:{...bearer(settings, session), 'Content-Type':'image/png'},
      body,
      binary: method==='GET',
    });
}
async function storageAction(settings, session, action, payload) {
  assert.ok(['list/grimoire-covers','move','copy'].includes(action));
  return httpLocal('http://127.0.0.1:54321', '/storage/v1/object/' + action, {
    method:'POST',
    headers:{...bearer(settings, session), 'Content-Type':'application/json'},
    body:JSON.stringify(payload),
  });
}
async function storageRemove(settings, session, path) {
  return httpLocal('http://127.0.0.1:54321',
    '/storage/v1/object/grimoire-covers', {
      method:'DELETE',
      headers:{...bearer(settings,session), 'Content-Type':'application/json'},
      body:JSON.stringify({prefixes:[path]}),
    });
}
function storageDeny(result, label) {
  assert.ok([400,401,403,404,409,422].includes(result.status),
    `${label}: acesso Storage não foi negado`);
}
async function verifyStorageHttp(settings, aSession, bSession, ids, png, pathA, pathB) {
  lastStage = 'http-storage-rls';
  const ownA = await storageHttp(settings, aSession, pathA);
  assert.equal(ownA.status, 200);
  assert.deepEqual(ownA.body, png);
  const ownB = await storageHttp(settings, bSession, pathB);
  assert.equal(ownB.status, 200);
  assert.deepEqual(ownB.body, png);
  for (const [session, path, label] of [
    [null,pathA,'anon/A'], [null,pathB,'anon/B'],
    [aSession,pathB,'A/B'], [bSession,pathA,'B/A'],
  ]) storageDeny(await storageHttp(settings, session, path), label);
  const tmpA = ids.a + '/qa-' + randomUUID() + '.png';
  const uploadA = await storageHttp(settings, aSession, tmpA, 'POST', png);
  assert.ok([200,201].includes(uploadA.status), 'A upload HTTP próprio');
  assert.equal((await storageHttp(settings, aSession, tmpA)).status, 200);
  storageDeny(await storageHttp(settings, bSession, ids.a + '/qa-' + randomUUID() + '.png', 'POST', png),
    'B upload na pasta A');
  storageDeny(await storageHttp(settings, null, ids.a + '/qa-' + randomUUID() + '.png', 'POST', png),
    'anon upload');
  storageDeny(await storageHttp(settings, bSession, pathA, 'PUT', png), 'B overwrite A');
  storageDeny(await storageHttp(settings, null, pathA, 'PUT', png), 'anon overwrite');
  for (const [owner, session, own, other] of [
    ['A',aSession,ids.a,ids.b],['B',bSession,ids.b,ids.a],
  ]) {
    const ownList = await storageAction(settings, session, 'list/grimoire-covers',
      {prefix:own+'/', limit:100, offset:0});
    assert.equal(ownList.status, 200, owner + ' list own');
    assert.ok(Array.isArray(ownList.body) && ownList.body.length >= 1,
      owner + ' list own: objeto não listado');
    const othersList = await storageAction(settings, session, 'list/grimoire-covers',
      {prefix:other+'/', limit:100, offset:0});
    if (othersList.status === 200) {
      assert.ok(Array.isArray(othersList.body) && othersList.body.length === 0,
        owner+' list cruzado');
    } else storageDeny(othersList, owner+' list cruzado');
  }
  const anonList = await storageAction(settings, null, 'list/grimoire-covers',
    {prefix:ids.a+'/',limit:100,offset:0});
  if (anonList.status === 200) assert.deepEqual(anonList.body, []);
  else storageDeny(anonList, 'anon list');
  storageDeny(await storageAction(settings, aSession, 'move', {
    bucketId:'grimoire-covers', sourceKey:tmpA,
    destinationKey:ids.b+'/qa-'+randomUUID()+'.png',
  }), 'MOVE own to foreign folder');
  storageDeny(await storageAction(settings, bSession, 'copy', {
    bucketId:'grimoire-covers', sourceKey:pathA,
    destinationKey:ids.b+'/qa-'+randomUUID()+'.png',
  }), 'B COPY A');
  assert.equal((await storageHttp(settings, aSession, tmpA)).status, 200,
    'MOVE indevido alterou a origem');
  for (const [session,who] of [[null,'anon'],[bSession,'B']]) {
    const deniedDelete = await storageRemove(settings,session,tmpA);
    if (deniedDelete.status >= 400 && deniedDelete.status < 500) {
      storageDeny(deniedDelete,who+' delete cruzado');
    } else {
      assert.equal(deniedDelete.status,200,who+' delete inesperado');
      assert.ok(Array.isArray(deniedDelete.body) && deniedDelete.body.length===0,
        who+' delete retornou objeto sem permissão');
    }
    assert.equal((await storageHttp(settings,aSession,tmpA)).status,200,
      who+' delete apagou objeto A');
  }
  const ownDelete = await storageRemove(settings,aSession,tmpA);
  assert.equal(ownDelete.status,200,'A delete próprio');
  const removed = await storageHttp(settings,aSession,tmpA);
  assert.ok([400,404].includes(removed.status),'DELETE próprio não removeu objeto');
  pass('Storage HTTP local: leitura/upload/update/list/copy/move/delete e isolamento');
}
function noCache(headers, label) {
  assert.match(headers.get('cache-control') ?? '', /no-store/i, label + ' sem no-store');
}
function safeNextJson(body, label) {
  assert.ok(body && typeof body === 'object' && !Array.isArray(body), label);
  const string = JSON.stringify(body).toLowerCase();
  for (const forbidden of ['access_token','refresh_token','service_role','password','private_key']) {
    assert.ok(!string.includes(forbidden), label + ' campo privado');
  }
}
async function nextGet(request, path) {
  const response = await request.get(localUrl(BASE,path), {timeout:20000,failOnStatusCode:false});
  const rawType = response.headers()['content-type'] ?? '';
  const body = rawType.includes('application/json') ? await response.json() : null;
  return {status:response.status(),headers:new Headers(response.headers()),body};
}
async function verifyNextHttp(anonContext, aContext, bContext) {
  lastStage = 'http-next-personal-mode';
  // Contrato no SHA C: handlers GET de status/ready/ia-aberta são públicos,
  // mas o proxy pessoal nega anon/B antes dos handlers. Não exigir 401 da rota.
  for (const [path, expected] of [
    ['/api/v1/status', {status:'healthy'}],
    ['/api/ready', {status:'ok',service:'academiaarcana'}],
    ['/api/ia-aberta', {integrations:null}],
  ]) {
    const owner = await nextGet(aContext.request,path);
    assert.equal(owner.status, 200, 'A GET ' + path);
    noCache(owner.headers,'A GET '+path);
    safeNextJson(owner.body,'A GET '+path);
    if (expected.status) assert.equal(owner.body.status,expected.status);
    if (expected.service) assert.equal(owner.body.service,expected.service);
    if (path==='/api/ia-aberta') assert.ok(Array.isArray(owner.body.integrations));
    for (const [label,ctx,status] of [
      ['anon',anonContext,401],['B',bContext,403],
    ]) {
      const denied = await nextGet(ctx.request,path);
      assert.equal(denied.status,status,label+' GET '+path);
      noCache(denied.headers,label+' GET '+path);
      safeNextJson(denied.body,label+' GET '+path);
    }
  }
  // GET /api/feedback não possui handler: 405 após passar pelo proxy;
  // POST com JSON inválido retorna 400 antes de qualquer persistência ou limiter.
  const feedbackA = await nextGet(aContext.request,'/api/feedback');
  assert.equal(feedbackA.status,405);
  for (const [ctx,status] of [[anonContext,401],[bContext,403]]) {
    const result = await nextGet(ctx.request,'/api/feedback');
    assert.equal(result.status,status);
    noCache(result.headers,'feedback GET bloqueado');
  }
  for (const [label,ctx] of [
    ['anon',anonContext],['A',aContext],['B',bContext],
  ]) {
    for (const path of ['/api/feedback','/api/ia-aberta','/api/v1/status']) {
      const denied = await ctx.request.post(localUrl(BASE,path), {
        headers:{ Origin:'https://invalid.example.test','Content-Type':'application/json' },
        data:'{}',failOnStatusCode:false,timeout:20000,
      });
      assert.equal(denied.status(),403,label+' cross-origin POST '+path);
      noCache(new Headers(denied.headers()),label+' cross-origin');
      const b=await denied.json(); safeNextJson(b,label+' cross-origin');
      assert.equal(b.error,'cross_origin_request_blocked');
    }
  }
  const malformed = await aContext.request.post(localUrl(BASE,'/api/feedback'),{
    headers:{Origin:BASE,'Content-Type':'application/json'},
    data:'{invalid', failOnStatusCode:false, timeout:20000,
  });
  assert.equal(malformed.status(),400);
  noCache(new Headers(malformed.headers()),'feedback inválido próprio');
  pass('HTTP Next.js: contratos pessoais A/B/anônimo, no-store e Origin cruzado');
}
async function verifyLogoutHttp(context) {
  lastStage = 'http-post-logout';
  const denied = await nextGet(context.request,'/api/v1/status');
  assert.equal(denied.status,401,'logout: navegador ainda tem acesso privado');
  noCache(denied.headers,'pós-logout');
  // Verifica apenas a remoção de sessão do navegador, NÃO a invalidação
  // criptográfica instantânea de JWT de acesso previamente emitido.
  pass('HTTP privado pós-logout negado no contexto Chromium (sem alegar JWT revogado)');
}

async function main() {
  const root = preflight();
  const settings = localSettings(root);
  const { createClient, playwright } = dependencies(root);
  if (stage === 'seed') await seed(root, settings, createClient);
  else await verify(root, settings, createClient, playwright);
}
main().catch(() => {
  // Não imprimir stack, URL, dados dos usuários, requisições, tokens ou segredos.
  console.error('FAIL: etapa sintética autenticada ' + lastStage + '; evidência detalhada restrita ao runner efêmero');
  process.exitCode = 1;
});
