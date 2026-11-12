-- P0: version the validated objective-evidence contracts already present
-- in the hosted database. Additive, idempotent, and fail-closed on drift.
-- Do not apply to production without the protected release approvals.
do $reconcile$
declare
  v_items text;
  v_attempts text;
  v_items_created boolean := false;
  v_attempts_created boolean := false;
begin
  if to_regclass('public.educational_practice_items') is null
     or to_regclass('public.educational_practice_attempts') is null then
    raise exception 'Practice evidence tables must exist before contract reconciliation';
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid, true) into v_items
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.educational_practice_items'::regclass
    and c.conname = 'educational_practice_items_criterion_contract_check';

  if v_items is null then
    alter table public.educational_practice_items
      add constraint educational_practice_items_criterion_contract_check
      check (
        evidence_mode = 'self_assessment'::text
        and criterion is null and criterion_version is null
        or evidence_mode = 'criterion_exact_match'::text
        and pg_catalog.char_length(pg_catalog.btrim(criterion)) >= 1
        and pg_catalog.char_length(pg_catalog.btrim(criterion)) <= 1000
        and criterion_version = 'criterion_exact_match_v1'::text
      );
    v_items_created := true;
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid, true) into v_items
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.educational_practice_items'::regclass
    and c.conname = 'educational_practice_items_criterion_contract_check'
    and c.contype = 'c' and c.convalidated;

  if v_items is null or (not v_items_created and v_items is distinct from $want_items$CHECK (evidence_mode = 'self_assessment'::text AND criterion IS NULL AND criterion_version IS NULL OR evidence_mode = 'criterion_exact_match'::text AND char_length(TRIM(BOTH FROM criterion)) >= 1 AND char_length(TRIM(BOTH FROM criterion)) <= 1000 AND criterion_version = 'criterion_exact_match_v1'::text)$want_items$) then
    raise exception 'Unexpected practice item criterion contract; manual review required';
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid, true) into v_attempts
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.educational_practice_attempts'::regclass
    and c.conname = 'educational_practice_attempts_evidence_contract_check';

  if v_attempts is null then
    alter table public.educational_practice_attempts
      add constraint educational_practice_attempts_evidence_contract_check
      check (
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
      );
    v_attempts_created := true;
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid, true) into v_attempts
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.educational_practice_attempts'::regclass
    and c.conname = 'educational_practice_attempts_evidence_contract_check'
    and c.contype = 'c' and c.convalidated;

  if v_attempts is null or (not v_attempts_created and v_attempts is distinct from $want_attempts$CHECK (evidence_type = 'self-assessment'::text AND criterion IS NULL AND criterion_version IS NULL AND criterion_result IS NULL AND criterion_scope IS NULL AND criterion_reference IS NULL OR evidence_type = 'criterion-referenced'::text AND char_length(TRIM(BOTH FROM criterion)) >= 1 AND char_length(TRIM(BOTH FROM criterion)) <= 1000 AND criterion_version IS NOT NULL AND criterion_result IS NOT NULL AND criterion_scope = 'practice-item'::text AND char_length(TRIM(BOTH FROM criterion_reference)) >= 1 AND char_length(TRIM(BOTH FROM criterion_reference)) <= 5000)$want_attempts$) then
    raise exception 'Unexpected practice attempt evidence contract; manual review required';
  end if;
end;
$reconcile$;
