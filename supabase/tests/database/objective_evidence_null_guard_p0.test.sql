-- P0: verify null guards with synthetic rows in disposable local DB only.
-- NEVER execute against a hosted project. All changes are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

insert into auth.users (id, email)
values ('c1000000-0000-4000-8000-000000000001', 'p0-null-guard-owner@example.test');
insert into public.grimoires (id, owner_id, title)
values ('c2000000-0000-4000-8000-000000000001',
        'c1000000-0000-4000-8000-000000000001', 'Synthetic objective grimoire');
insert into public.notebooks (id, grimoire_id, title, position)
values ('c3000000-0000-4000-8000-000000000001',
        'c2000000-0000-4000-8000-000000000001', 'Synthetic notebook', 0);
insert into public.chapters (id, notebook_id, title, position)
values ('c4000000-0000-4000-8000-000000000001',
        'c3000000-0000-4000-8000-000000000001', 'Synthetic chapter', 0);
insert into public.pages (id, chapter_id, title, position)
values ('c5000000-0000-4000-8000-000000000001',
        'c4000000-0000-4000-8000-000000000001', 'Synthetic page', 0);

select extensions.throws_ok(
  $test$insert into public.educational_practice_items
    (owner_id, page_id, prompt, reference_answer, evidence_mode, criterion, criterion_version)
    values ('c1000000-0000-4000-8000-000000000001',
            'c5000000-0000-4000-8000-000000000001',
            'Synthetic prompt','Reference','criterion_exact_match',null,'criterion_exact_match_v1')$test$,
  '23514', null, 'Objective item rejects a NULL criterion'
);

select extensions.throws_ok(
  $test$insert into public.educational_practice_items
    (owner_id, page_id, prompt, reference_answer, evidence_mode, criterion, criterion_version)
    values ('c1000000-0000-4000-8000-000000000001',
            'c5000000-0000-4000-8000-000000000001',
            'Synthetic prompt','Reference','criterion_exact_match','Exact answer',null)$test$,
  '23514', null, 'Objective item rejects a NULL criterion version'
);

insert into public.educational_practice_items
  (id, owner_id, page_id, prompt, reference_answer, evidence_mode, criterion, criterion_version)
values ('c6000000-0000-4000-8000-000000000001',
        'c1000000-0000-4000-8000-000000000001',
        'c5000000-0000-4000-8000-000000000001',
        'Synthetic objective question','Reference','criterion_exact_match',
        'Exact answer','criterion_exact_match_v1');

select extensions.throws_ok(
  $test$insert into public.educational_practice_attempts
    (owner_id, practice_item_id, answer, outcome, evidence_score,
     confidence, feedback, evidence_type, criterion, criterion_version,
     criterion_result, criterion_scope, criterion_reference)
    values ('c1000000-0000-4000-8000-000000000001',
            'c6000000-0000-4000-8000-000000000001',
            'Reference','strong',1,'strong','Synthetic feedback',
            'criterion-referenced',null,'criterion_exact_match_v1',
            'pass','practice-item','Reference')$test$,
  '23514', null, 'Objective attempt rejects a NULL criterion'
);

select extensions.throws_ok(
  $test$insert into public.educational_practice_attempts
    (owner_id, practice_item_id, answer, outcome, evidence_score,
     confidence, feedback, evidence_type, criterion, criterion_version,
     criterion_result, criterion_scope, criterion_reference)
    values ('c1000000-0000-4000-8000-000000000001',
            'c6000000-0000-4000-8000-000000000001',
            'Reference','strong',1,'strong','Synthetic feedback',
            'criterion-referenced','Exact answer','criterion_exact_match_v1',
            'pass','practice-item',null)$test$,
  '23514', null, 'Objective attempt rejects a NULL reference'
);

insert into public.educational_practice_attempts
  (owner_id, practice_item_id, answer, outcome, evidence_score,
   confidence, feedback, evidence_type, criterion, criterion_version,
   criterion_result, criterion_scope, criterion_reference)
values ('c1000000-0000-4000-8000-000000000001',
        'c6000000-0000-4000-8000-000000000001',
        'Reference','strong',1,'strong','Synthetic feedback',
        'criterion-referenced','Exact answer','criterion_exact_match_v1',
        'pass','practice-item','Reference');

select extensions.is(
  (select count(*)::integer from public.educational_practice_attempts
    where owner_id='c1000000-0000-4000-8000-000000000001'),
  1, 'Valid objective evidence is still accepted'
);
select extensions.lives_ok(
  $test$insert into public.educational_practice_items
    (id, owner_id, page_id, prompt, reference_answer,
     evidence_mode, criterion, criterion_version)
    values ('c6000000-0000-4000-8000-000000000002',
            'c1000000-0000-4000-8000-000000000001',
            'c5000000-0000-4000-8000-000000000001',
            'Synthetic self-assessment', 'Reference',
            'self_assessment', null, null)$test$,
  'Self-assessment with optional criterion metadata NULL stays valid'
);

select extensions.is(
  (select count(*)::integer
     from public.educational_practice_items
    where id = 'c6000000-0000-4000-8000-000000000002'
      and evidence_mode = 'self_assessment'
      and criterion is null
      and criterion_version is null),
  1,
  'Self-assessment is persisted with NULL criterion metadata'
);

select extensions.lives_ok(
  $test$insert into public.educational_practice_attempts
    (id, owner_id, practice_item_id, answer, outcome, evidence_score,
     confidence, feedback, evidence_type, criterion, criterion_version,
     criterion_result, criterion_scope, criterion_reference)
    values ('c7000000-0000-4000-8000-000000000002',
            'c1000000-0000-4000-8000-000000000001',
            'c6000000-0000-4000-8000-000000000002',
            'Synthetic self-assessment answer', 'partial', 0.5,
            'partial', 'Synthetic self-assessment feedback',
            'self-assessment', null, null, null, null, null)$test$,
  'Self-assessment attempt accepts NULL criterion and reference metadata'
);

select extensions.is(
  (select count(*)::integer
     from public.educational_practice_attempts
    where id = 'c7000000-0000-4000-8000-000000000002'
      and practice_item_id = 'c6000000-0000-4000-8000-000000000002'
      and evidence_type = 'self-assessment'
      and criterion is null and criterion_version is null
      and criterion_result is null and criterion_scope is null
      and criterion_reference is null),
  1,
  'Self-assessment attempt preserves optional NULL evidence metadata'
);

select * from extensions.finish();
rollback;
