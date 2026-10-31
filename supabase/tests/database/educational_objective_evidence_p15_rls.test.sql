begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(11);

insert into auth.users (id, email)
values
  ('97000000-0000-4000-8000-000000000001', 'objective-owner-1@example.test'),
  ('97000000-0000-4000-8000-000000000002', 'objective-owner-2@example.test');

insert into public.grimoires (id, owner_id, title)
values (
  '98000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001',
  'Objective Grimoire'
);

insert into public.notebooks (id, grimoire_id, title, position)
values (
  '99000000-0000-4000-8000-000000000001',
  '98000000-0000-4000-8000-000000000001',
  'Objective Notebook',
  0
);

insert into public.chapters (id, notebook_id, title, position)
values (
  '9a000000-0000-4000-8000-000000000001',
  '99000000-0000-4000-8000-000000000001',
  'Objective Chapter',
  0
);

insert into public.pages (id, chapter_id, title, position)
values (
  '9b000000-0000-4000-8000-000000000001',
  '9a000000-0000-4000-8000-000000000001',
  'Objective Page',
  0
);

insert into public.educational_practice_items (
  id,
  owner_id,
  page_id,
  prompt,
  reference_answer,
  difficulty,
  evidence_mode,
  criterion,
  criterion_version,
  minimum_evidence
)
values (
  '9c000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001',
  '9b000000-0000-4000-8000-000000000001',
  'Qual é a resposta objetiva?',
  'Resposta correta',
  3,
  'criterion_exact_match',
  'A resposta deve corresponder à resposta de referência após normalização de caixa e espaços.',
  'criterion_exact_match_v1',
  2
);

select set_config(
  'request.jwt.claim.sub',
  '97000000-0000-4000-8000-000000000001',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

set local role authenticated;

select extensions.is(
  (select count(*)::integer
     from public.educational_practice_items
    where evidence_mode = 'criterion_exact_match'),
  1,
  'owner enxerga sua atividade objetiva'
);

select extensions.is(
  (select evidence_mode
     from public.educational_practice_items
    where id = '9c000000-0000-4000-8000-000000000001'),
  'criterion_exact_match',
  'atividade objetiva usa o modo canônico'
);

select extensions.is(
  (select (public.record_criterion_referenced_practice_attempt(
    '9c000000-0000-4000-8000-000000000001',
    '  RESPOSTA   CORRETA '
  )).outcome),
  'strong',
  'RPC aprova correspondência exata normalizada'
);

select extensions.is(
  (select (public.record_criterion_referenced_practice_attempt(
    '9c000000-0000-4000-8000-000000000001',
    '  RESPOSTA   CORRETA '
  )).criterion_result),
  'pass',
  'RPC registra resultado objetivo pass'
);

select extensions.is(
  (select (public.record_criterion_referenced_practice_attempt(
    '9c000000-0000-4000-8000-000000000001',
    'Outra resposta'
  )).evidence_type),
  'criterion-referenced',
  'RPC registra a proveniência como criterion-referenced'
);

select extensions.is(
  (select (public.record_criterion_referenced_practice_attempt(
    '9c000000-0000-4000-8000-000000000001',
    'Outra resposta'
  )).criterion_result),
  'fail',
  'RPC registra resultado objetivo fail'
);

select extensions.is(
  (select count(*)::integer
     from public.educational_practice_attempts
    where practice_item_id = '9c000000-0000-4000-8000-000000000001'
      and evidence_type = 'criterion-referenced'),
  4,
  'tentativas objetivas são persistidas na tabela canônica'
);

select set_config(
  'request.jwt.claim.sub',
  '97000000-0000-4000-8000-000000000002',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select extensions.is(
  (select count(*)::integer
     from public.educational_practice_items
    where evidence_mode = 'criterion_exact_match'),
  0,
  'outro owner não enxerga atividade objetiva alheia'
);

select extensions.throws_ok(
  $$select public.record_criterion_referenced_practice_attempt(
    '9c000000-0000-4000-8000-000000000001',
    'Tentativa indevida'
  )$$,
  'P0002',
  'Atividade de prática não encontrada.',
  'outro owner não pode registrar evidência objetiva alheia'
);

select extensions.is(
  (select count(*)::integer
     from public.educational_practice_attempts
    where evidence_type = 'criterion-referenced'),
  0,
  'outro owner não enxerga evidência objetiva alheia'
);

select set_config(
  'request.jwt.claim.sub',
  '97000000-0000-4000-8000-000000000001',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.throws_ok(
  $$update public.educational_practice_items
      set reference_answer = 'Outra referência'
    where id = '9c000000-0000-4000-8000-000000000001'$$,
  '55000',
  'O critério objetivo não pode ser alterado depois que já houver evidência objetiva registrada.',
  'critério e resposta de referência ficam protegidos após evidência objetiva'
);

select extensions.finish();

rollback;
