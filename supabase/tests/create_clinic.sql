-- public.create_clinic: self-service clinic creation. Rolled back at the end.

begin;

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('cccccccc-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'creator@test.invalid', now(), now());

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_id uuid;
begin
  -- 1. Creating a clinic makes the caller its owner, with an empty profile.
  v_id := public.create_clinic('  Smile Dental  ', 'Smile-Test', 'ru');
  if not exists (
    select 1 from public.clinics
    where id = v_id and name = 'Smile Dental' and slug = 'smile-test' and default_locale = 'ru'
  ) then
    raise exception 'FAIL 1: clinic not visible to its creator, or name/slug not normalised';
  end if;
  if not exists (
    select 1 from public.clinic_members
    where clinic_id = v_id and user_id = 'cccccccc-0000-4000-8000-000000000001' and role = 'owner'
  ) then
    raise exception 'FAIL 1: creator is not the owner';
  end if;
  if not exists (select 1 from public.clinic_profiles where clinic_id = v_id) then
    raise exception 'FAIL 1: profile row was not created';
  end if;

  -- 2. Slugs are unique.
  begin
    perform public.create_clinic('Other', 'smile-test');
    raise exception 'FAIL 2: duplicate slug accepted';
  exception when unique_violation then null;
  end;

  -- 3. Invalid slugs are rejected.
  begin
    perform public.create_clinic('Other', 'bad slug!');
    raise exception 'FAIL 3: invalid slug accepted';
  exception when check_violation then null;
  end;

  -- 4. At most 3 owned clinics per account.
  perform public.create_clinic('Second', 'smile-test-2');
  perform public.create_clinic('Third', 'smile-test-3');
  begin
    perform public.create_clinic('Fourth', 'smile-test-4');
    raise exception 'FAIL 4: fourth clinic allowed';
  exception when raise_exception then
    if sqlerrm <> 'clinic limit reached' then raise; end if;
  end;
end $$;

-- 5. Anonymous visitors cannot call it.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  begin
    perform public.create_clinic('Anon', 'anon-clinic');
    raise exception 'FAIL 5: anon created a clinic';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 6. Server code without a signed-in user cannot call it either.
reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  begin
    perform public.create_clinic('Server', 'server-clinic');
    raise exception 'FAIL 6: clinic created without a user';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'create_clinic: all 6 checks passed' as result;

rollback;
