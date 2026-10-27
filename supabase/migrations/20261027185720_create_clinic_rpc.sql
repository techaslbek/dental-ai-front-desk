-- Self-service clinic creation for signed-in staff accounts.
--
-- Accounts are created by an administrator (no public sign-up), so any
-- signed-in user may create a clinic. The function makes the caller its
-- owner and creates the empty profile row in the same transaction.
-- SECURITY DEFINER because authenticated users have no INSERT grant on
-- clinics or clinic_members; it acts only for auth.uid().

create function public.create_clinic(p_name text, p_slug text, p_default_locale text default 'uz')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owned integer;
  v_clinic_id uuid;
begin
  if v_user_id is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  -- Cap self-service creation; more clinics per account goes through support.
  select count(*) into v_owned
  from public.clinic_members
  where user_id = v_user_id and role = 'owner';
  if v_owned >= 3 then
    raise exception 'clinic limit reached' using errcode = 'P0001', hint = 'clinic_limit';
  end if;

  insert into public.clinics (name, slug, default_locale)
  values (btrim(p_name), lower(btrim(p_slug)), p_default_locale)
  returning id into v_clinic_id;

  insert into public.clinic_members (clinic_id, user_id, role)
  values (v_clinic_id, v_user_id, 'owner');

  insert into public.clinic_profiles (clinic_id)
  values (v_clinic_id);

  return v_clinic_id;
end;
$$;

revoke all on function public.create_clinic(text, text, text) from public, anon;
grant execute on function public.create_clinic(text, text, text) to authenticated;
