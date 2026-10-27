-- Tenant isolation and confirmation-rule checks.
--
-- Runs entirely inside one transaction and rolls back, so it leaves no data
-- behind. Any failed check raises an exception that names it. Run with
-- `npm run test:db` (needs SUPABASE_DB_URL) or paste into the SQL editor.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the table owner, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@test.invalid', now(), now()),
  ('aaaaaaaa-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff-a@test.invalid', now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@test.invalid', now(), now());

insert into public.clinics (id, slug, name) values
  ('aaaaaaaa-1111-4000-8000-000000000000', 'test-clinic-a', 'Test Clinic A'),
  ('bbbbbbbb-1111-4000-8000-000000000000', 'test-clinic-b', 'Test Clinic B');

insert into public.clinic_members (clinic_id, user_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner'),
  ('aaaaaaaa-1111-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002', 'staff'),
  ('bbbbbbbb-1111-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000001', 'owner');

insert into public.services (id, clinic_id, name_uz, name_ru, price_min, price_max) values
  ('aaaaaaaa-2222-4000-8000-000000000000', 'aaaaaaaa-1111-4000-8000-000000000000', 'Tish tozalash', 'Чистка зубов', 200000, 300000),
  ('bbbbbbbb-2222-4000-8000-000000000000', 'bbbbbbbb-1111-4000-8000-000000000000', 'Plomba', 'Пломба', 250000, 400000);

insert into public.faqs (clinic_id, question_uz, answer_uz) values
  ('aaaaaaaa-1111-4000-8000-000000000000', 'Parkovka bormi?', 'Ha'),
  ('bbbbbbbb-1111-4000-8000-000000000000', 'Parkovka bormi?', 'Yo''q');

insert into public.conversations (id, clinic_id, visitor_id, consent_at) values
  ('aaaaaaaa-3333-4000-8000-000000000000', 'aaaaaaaa-1111-4000-8000-000000000000', gen_random_uuid(), now()),
  ('bbbbbbbb-3333-4000-8000-000000000000', 'bbbbbbbb-1111-4000-8000-000000000000', gen_random_uuid(), now());

insert into public.messages (conversation_id, clinic_id, role, content) values
  ('aaaaaaaa-3333-4000-8000-000000000000', 'aaaaaaaa-1111-4000-8000-000000000000', 'patient', 'Salom'),
  ('bbbbbbbb-3333-4000-8000-000000000000', 'bbbbbbbb-1111-4000-8000-000000000000', 'patient', 'Здравствуйте');

insert into public.appointment_requests (id, clinic_id, conversation_id, patient_name, patient_phone) values
  ('aaaaaaaa-4444-4000-8000-000000000000', 'aaaaaaaa-1111-4000-8000-000000000000', 'aaaaaaaa-3333-4000-8000-000000000000', 'Test Patient A', '+998 90 000 00 01'),
  ('bbbbbbbb-4444-4000-8000-000000000000', 'bbbbbbbb-1111-4000-8000-000000000000', 'bbbbbbbb-3333-4000-8000-000000000000', 'Test Patient B', '+998 90 000 00 02');

insert into public.handoffs (clinic_id, conversation_id) values
  ('bbbbbbbb-1111-4000-8000-000000000000', 'bbbbbbbb-3333-4000-8000-000000000000');

insert into public.usage_monthly (clinic_id, month, messages) values
  ('bbbbbbbb-1111-4000-8000-000000000000', date_trunc('month', now())::date, 10);

insert into public.audit_log (clinic_id, action, entity) values
  ('aaaaaaaa-1111-4000-8000-000000000000', 'test', 'clinic');

-- ---------------------------------------------------------------------------
-- Owner of clinic A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n integer;
begin
  -- 1. Sees only their own clinic.
  select count(*) into n from public.clinics;
  if n <> 1 or not exists (select 1 from public.clinics where slug = 'test-clinic-a') then
    raise exception 'FAIL 1: owner A sees % clinics', n;
  end if;

  -- 2. Sees only their own clinic's knowledge.
  select count(*) into n from public.services where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000';
  if n <> 0 then raise exception 'FAIL 2: owner A sees clinic B services'; end if;
  select count(*) into n from public.services;
  if n <> 1 then raise exception 'FAIL 2: owner A sees % services, expected 1', n; end if;

  -- 3. Sees none of clinic B's patient data.
  select (select count(*) from public.conversations where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000')
       + (select count(*) from public.messages where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000')
       + (select count(*) from public.appointment_requests where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000')
       + (select count(*) from public.handoffs)
       + (select count(*) from public.usage_monthly)
       + (select count(*) from public.clinic_members where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000')
    into n;
  if n <> 0 then raise exception 'FAIL 3: owner A sees % rows of clinic B patient data', n; end if;

  -- 4. Cannot update clinic B's rows.
  update public.services set price_min = 1 where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 4: owner A updated clinic B services'; end if;
  update public.appointment_requests set status = 'cancelled' where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 4: owner A updated clinic B appointments'; end if;

  -- 5. Cannot delete clinic B's rows.
  delete from public.faqs where clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 5: owner A deleted clinic B faqs'; end if;

  -- 6. Cannot insert into clinic B.
  begin
    insert into public.services (clinic_id, name_uz, name_ru)
    values ('bbbbbbbb-1111-4000-8000-000000000000', 'x', 'x');
    raise exception 'FAIL 6: owner A inserted a service into clinic B';
  exception when insufficient_privilege then null;
  end;

  -- 7. Cannot move own row into clinic B.
  begin
    update public.services set clinic_id = 'bbbbbbbb-1111-4000-8000-000000000000'
    where id = 'aaaaaaaa-2222-4000-8000-000000000000';
    raise exception 'FAIL 7: owner A moved a service into clinic B';
  exception when insufficient_privilege then null;
  end;

  -- 8. Cannot grant themselves membership of clinic B.
  begin
    insert into public.clinic_members (clinic_id, user_id, role)
    values ('bbbbbbbb-1111-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner');
    raise exception 'FAIL 8: owner A joined clinic B';
  exception when insufficient_privilege then null;
  end;

  -- 9. Cannot link their appointment to clinic B's service.
  begin
    insert into public.appointment_requests (clinic_id, service_id, patient_name, patient_phone)
    values ('aaaaaaaa-1111-4000-8000-000000000000', 'bbbbbbbb-2222-4000-8000-000000000000', 'X', '+998900000000');
    raise exception 'FAIL 9: appointment in A referenced a service of B';
  exception when foreign_key_violation then null;
  end;

  -- 10. Confirming records who confirmed and when.
  update public.appointment_requests set status = 'confirmed'
  where id = 'aaaaaaaa-4444-4000-8000-000000000000';
  if not exists (
    select 1 from public.appointment_requests
    where id = 'aaaaaaaa-4444-4000-8000-000000000000'
      and confirmed_by = 'aaaaaaaa-0000-4000-8000-000000000001'
      and confirmed_at is not null
  ) then
    raise exception 'FAIL 10: confirmation was not stamped with the confirming user';
  end if;

  -- 11. Cannot change their own plan (billing-controlled column).
  begin
    update public.clinics set plan_id = 'pilot' where slug = 'test-clinic-a';
    raise exception 'FAIL 11: owner changed plan_id';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Staff (non-owner) of clinic A
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n integer;
begin
  -- 12. Staff can read their clinic but not rename it.
  if not exists (select 1 from public.clinics where slug = 'test-clinic-a') then
    raise exception 'FAIL 12: staff A cannot see clinic A';
  end if;
  update public.clinics set name = 'Renamed' where slug = 'test-clinic-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 12: staff renamed the clinic'; end if;

  -- 13. Staff cannot read the audit log.
  select count(*) into n from public.audit_log;
  if n <> 0 then raise exception 'FAIL 13: staff can read the audit log'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Anonymous visitor (public API key, no session)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  -- 14/15. Anonymous users have no table access at all.
  begin
    perform 1 from public.clinics;
    raise exception 'FAIL 14: anon can read clinics';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.messages;
    raise exception 'FAIL 15: anon can read messages';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Server code path (no signed-in user), e.g. the AI chat
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  -- 16. Server/AI code can never create a confirmed appointment.
  begin
    insert into public.appointment_requests (clinic_id, patient_name, patient_phone, status)
    values ('aaaaaaaa-1111-4000-8000-000000000000', 'X', '+998900000000', 'confirmed');
    raise exception 'FAIL 16: confirmed appointment created without a staff member';
  exception when insufficient_privilege then null;
  end;

  -- 17. A message cannot point at another clinic's conversation.
  begin
    insert into public.messages (conversation_id, clinic_id, role, content)
    values ('aaaaaaaa-3333-4000-8000-000000000000', 'bbbbbbbb-1111-4000-8000-000000000000', 'patient', 'x');
    raise exception 'FAIL 17: message crossed clinics';
  exception when foreign_key_violation then null;
  end;
end $$;

select 'tenant isolation: all 17 checks passed' as result;

rollback;
