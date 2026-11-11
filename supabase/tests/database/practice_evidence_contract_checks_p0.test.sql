-- P0 educational evidence contracts: disposable LOCAL Supabase only.
-- Do not execute this file on hosted projects.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

-- Compare server-normalized definitions against equivalent synthetic CHECKs.
-- Literal pg_get_constraintdef output can vary across PostgreSQL versions.
create temporary table aa_c117_expected_item (
  evidence_mode text,
  criterion text,
  criterion_version text,
  constraint aa_c117_expected_item_check check (
    evidence_mode = 'self_assessment'::text
    and criterion is null and criterion_version is null
    or evidence_mode = 'criterion_exact_match'::text
    and pg_catalog.char_length(pg_catalog.btrim(criterion)) >= 1
    and pg_catalog.char_length(pg_catalog.btrim(criterion)) <= 1000
    and criterion_version = 'criterion_exact_match_v1'::text
  )
);

create temporary table aa_c117_expected_attempt (
  evidence_type text,
  criterion text,
  criterion_version text,
  criterion_result text,
  criterion_scope text,
  criterion_reference text,
  constraint aa_c117_expected_attempt_check check (
    evidence_type = 'self-assessment'::text
    and criterion is null and criterion_version is null
    and criterion_result is null and criterion_scope is null
    and criterion_reference is null
    or evidence_type = 'criterion-referenced'::text
    and pg_catalog.char_length(pg_catalog.btrim(criterion)) >= 1
    and pg_catalog.char_length(pg_catalog.btrim(criterion)) <= 1000
    and criterion_version is not null and criterion_result is not null
    and criterion_scope = 'practice-item'::text
    and pg_catalog.char_length(pg_catalog.btrim(criterion_reference)) >= 1
    and pg_catalog.char_length(pg_catalog.btrim(criterion_reference)) <= 5000
  )
);

select extensions.is(
  (select pg_catalog.pg_get_constraintdef(c.oid, true)
     from pg_catalog.pg_constraint c
    where c.conrelid = 'public.educational_practice_items'::regclass
      and c.conname = 'educational_practice_items_criterion_contract_check'),
  (select pg_catalog.pg_get_constraintdef(c.oid, true)
     from pg_catalog.pg_constraint c
    where c.conrelid = 'pg_temp.aa_c117_expected_item'::regclass
      and c.conname = 'aa_c117_expected_item_check'),
  'Practice item criterion check matches the hosted contract'
);

select extensions.is(
  (select pg_catalog.pg_get_constraintdef(c.oid, true)
     from pg_catalog.pg_constraint c
    where c.conrelid = 'public.educational_practice_attempts'::regclass
      and c.conname = 'educational_practice_attempts_evidence_contract_check'),
  (select pg_catalog.pg_get_constraintdef(c.oid, true)
     from pg_catalog.pg_constraint c
    where c.conrelid = 'pg_temp.aa_c117_expected_attempt'::regclass
      and c.conname = 'aa_c117_expected_attempt_check'),
  'Practice attempt evidence check matches the hosted contract'
);

select extensions.is(
  (select count(*)::integer from pg_catalog.pg_constraint
    where convalidated and (
      (conrelid = 'public.educational_practice_items'::regclass
           and conname = 'educational_practice_items_criterion_contract_check')
       or (conrelid = 'public.educational_practice_attempts'::regclass
           and conname = 'educational_practice_attempts_evidence_contract_check')
    )),
  2,
  'Both objective evidence constraints are present and validated'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.educational_practice_items', 'INSERT'),
  'Students can create their own practice items under RLS'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.educational_practice_attempts', 'INSERT'),
  'Direct evidence inserts remain denied'
);
select extensions.ok(
  exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.educational_practice_items'::regclass
      and tgname = 'educational_practice_items_protect_criterion'
      and not tgisinternal and tgenabled <> 'D'),
  'Criterion integrity trigger remains enabled'
);

select * from extensions.finish();
rollback;
