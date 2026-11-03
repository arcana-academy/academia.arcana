import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// Sempre executar apenas no runner GitHub, em Auth/PG/Storage descartáveis.
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.AA_QA_REMOTE_SYNTHETIC, '1');
assert.equal(process.env.QA_SCENARIO, 'grimorios-persistencia-nova-sessao');
assert.equal(process.env.GITHUB_REF, 'refs/heads/work/aa-qa-remoto-isolado-20261103');
for (const name of [
  'SUPABASE_ACCESS_TOKEN', 'DATABASE_URL', 'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'RENDER_API_KEY',
]) {
  assert.ok(!process.env[name], name + ' proibida neste teste');
}

const raw = execFileSync('supabase', ['status', '-o', 'env'], {
  encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
});
const settings = Object.fromEntries(raw.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  return match ? [[match[1], match[2].replace(/^["']|["']$/g, '')]] : [];
}));
const api = new URL(settings.API_URL);
assert.equal(api.protocol, 'http:');
assert.equal(api.hostname, '127.0.0.1');
assert.equal(api.port, '54321');
assert.ok(settings.ANON_KEY);

function newClient() {
  return createClient(api.toString(), settings.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
function checked(result) {
  assert.ifError(result.error);
  return result.data;
}

const unique = randomUUID();
const password = 'Qa-' + randomBytes(24).toString('hex') + '!aA1';
const emailA = 'qa-a-' + unique + '@example.test';
const emailB = 'qa-b-' + unique + '@example.test';
const titleA = 'QA Grimorio A ' + unique;
const titleB = 'QA Grimorio B ' + unique;
const ownerAClient = newClient();
const ownerBClient = newClient();

const accountA = checked(await ownerAClient.auth.signUp({ email: emailA, password }));
const accountB = checked(await ownerBClient.auth.signUp({ email: emailB, password }));
assert.ok(accountA.user?.id && accountA.session);
assert.ok(accountB.user?.id && accountB.session);
assert.notEqual(accountA.user.id, accountB.user.id);

const grimoireA = checked(await ownerAClient.from('grimoires').insert({
  owner_id: accountA.user.id, title: titleA,
}).select('id,title').single());
const grimoireB = checked(await ownerBClient.from('grimoires').insert({
  owner_id: accountB.user.id, title: titleB,
}).select('id,title').single());
assert.notEqual(grimoireA.id, grimoireB.id);
checked(await ownerAClient.auth.signOut());

// Novo objeto cliente e nova sessão, sem reaproveitar cookies nem JWT anterior.
const reopenedA = newClient();
assert.ok(checked(await reopenedA.auth.signInWithPassword({
  email: emailA, password,
})).session);
const persistedA = checked(await reopenedA.from('grimoires')
  .select('id,title').eq('id', grimoireA.id).single());
assert.equal(persistedA.title, titleA);
assert.deepEqual(checked(await reopenedA.from('grimoires')
  .select('id').eq('id', grimoireB.id)), []);

const changedTitle = 'QA Grimorio atualizado ' + unique;
const changed = checked(await reopenedA.from('grimoires').update({
  title: changedTitle,
}).eq('id', grimoireA.id).select('id,title').single());
assert.equal(changed.title, changedTitle);

const reopenedAAgain = newClient();
assert.ok(checked(await reopenedAAgain.auth.signInWithPassword({
  email: emailA, password,
})).session);
assert.equal(checked(await reopenedAAgain.from('grimoires')
  .select('title').eq('id', grimoireA.id).single()).title, changedTitle);

const reopenedB = newClient();
assert.ok(checked(await reopenedB.auth.signInWithPassword({
  email: emailB, password,
})).session);
assert.deepEqual(checked(await reopenedB.from('grimoires')
  .select('id').eq('id', grimoireA.id)), []);
assert.equal(checked(await reopenedB.from('grimoires')
  .select('title').eq('id', grimoireB.id).single()).title, titleB);

console.log('PASS: PostgreSQL local manteve Grimório A após nova sessão');
console.log('PASS: atualização persistiu após nova sessão independente');
console.log('PASS: duas identidades sintéticas não leem linhas entre si');
console.log('LIMITE: não testa Santuário visual, login E2E ou release protegido');