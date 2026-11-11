-- P0: close PostgreSQL CHECK UNKNOWN/NULL acceptance for objective evidence.
-- The earlier contract checks allow UNKNOWN, which PostgreSQL treats as passing.
-- Add independent requirements; do not drop or weaken existing constraints.
-- Existing invalid data will cause the migration to fail closed.
do $guard$
begin
  if to_regclass('public.educational_practice_items') is null
     or to_regclass('public.educational_practice_attempts') is null then
    raise exception 'Objective practice tables must exist';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.educational_practice_items'::regclass
      and c.conname = 'educational_practice_items_criterion_contract_check'
      and c.contype = 'c' and c.convalidated
  ) or not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.educational_practice_attempts'::regclass
      and c.conname = 'educational_practice_attempts_evidence_contract_check'
      and c.contype = 'c' and c.convalidated
  ) then
    raise exception 'Prior objective contracts missing or unvalidated';
  end if;

  if exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.educational_practice_items'::regclass
      and c.conname = 'educational_practice_items_objective_required_check'
  ) or exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.educational_practice_attempts'::regclass
      and c.conname = 'educational_practice_attempts_objective_required_check'
  ) then
    raise exception 'Objective required checks already exist: verify manually';
  end if;

  alter table public.educational_practice_items
    add constraint educational_practice_items_objective_required_check
    check (
      evidence_mode <> 'criterion_exact_match'
      or (criterion is not null and criterion_version is not null)
    );

  alter table public.educational_practice_attempts
    add constraint educational_practice_attempts_objective_required_check
    check (
      evidence_type <> 'criterion-referenced'
      or (criterion is not null and criterion_reference is not null)
    );
end;
$guard$;
