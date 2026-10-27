-- Initial multi-tenant schema for Dental AI Front Desk.
--
-- Access model:
--   * Every tenant-owned row carries clinic_id. Staff see only rows of clinics
--     they belong to (clinic_members), enforced by RLS.
--   * Anonymous patients never touch tables directly: the `anon` role has no
--     grants. Patient-side writes (chat, appointment requests) go through
--     server code using the service role, which resolves the clinic itself.
--   * An appointment can only be "confirmed" with a recorded human confirmer.

-- ---------------------------------------------------------------------------
-- Private helper schema (not exposed through the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'staff');
create type public.conversation_status as enum ('open', 'handoff', 'closed');
create type public.message_role as enum ('patient', 'assistant', 'staff', 'system');
create type public.appointment_status as enum ('requested', 'contacted', 'confirmed', 'cancelled');
create type public.handoff_status as enum ('pending', 'claimed', 'resolved');

-- ---------------------------------------------------------------------------
-- Plans and clinics
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,31}$'),
  name text not null,
  monthly_conversation_limit integer not null check (monthly_conversation_limit > 0),
  monthly_message_limit integer not null check (monthly_message_limit > 0),
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, monthly_conversation_limit, monthly_message_limit)
values ('pilot', 'Pilot', 500, 5000);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  name text not null check (char_length(name) between 1 and 120),
  plan_id text not null default 'pilot' references public.plans (id),
  status text not null default 'active' check (status in ('active', 'suspended')),
  default_locale text not null default 'uz' check (default_locale in ('uz', 'ru')),
  message_retention_days integer not null default 90 check (message_retention_days between 7 and 730),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clinics_plan_id_idx on public.clinics (plan_id);

create table public.clinic_members (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);
create index clinic_members_user_id_idx on public.clinic_members (user_id);

-- ---------------------------------------------------------------------------
-- RLS helpers. SECURITY DEFINER so policies on clinic_members do not recurse;
-- they only ever answer for the calling user (auth.uid()).
-- ---------------------------------------------------------------------------
create function private.user_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cm.clinic_id
  from public.clinic_members cm
  where cm.user_id = (select auth.uid());
$$;

create function private.owner_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cm.clinic_id
  from public.clinic_members cm
  where cm.user_id = (select auth.uid())
    and cm.role = 'owner';
$$;

revoke all on function private.user_clinic_ids() from public, anon;
revoke all on function private.owner_clinic_ids() from public, anon;
grant execute on function private.user_clinic_ids() to authenticated;
grant execute on function private.owner_clinic_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A row can never be moved to another clinic, even by a user who belongs to both.
create function private.prevent_clinic_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'clinic_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clinic knowledge (what the assistant is allowed to answer from)
-- ---------------------------------------------------------------------------
create table public.clinic_profiles (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  phone text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  telegram text check (char_length(telegram) <= 64),
  address_uz text check (char_length(address_uz) <= 300),
  address_ru text check (char_length(address_ru) <= 300),
  maps_url text check (maps_url ~ '^https://'),
  -- {"mon": [{"open": "09:00", "close": "18:00"}], ...}; validated in the app.
  opening_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(opening_hours) = 'object'),
  about_uz text check (char_length(about_uz) <= 2000),
  about_ru text check (char_length(about_ru) <= 2000),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name_uz text not null check (char_length(name_uz) between 1 and 120),
  name_ru text not null check (char_length(name_ru) between 1 and 120),
  description_uz text check (char_length(description_uz) <= 1000),
  description_ru text check (char_length(description_ru) <= 1000),
  -- Whole currency units (UZS has no minor unit in practice).
  price_min bigint check (price_min >= 0),
  price_max bigint check (price_max >= 0),
  currency text not null default 'UZS' check (currency ~ '^[A-Z]{3}$'),
  duration_minutes integer check (duration_minutes between 5 and 600),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  check (price_max is null or price_min is null or price_max >= price_min)
);
create index services_clinic_id_idx on public.services (clinic_id, sort_order);

create table public.dentists (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  specialty_uz text check (char_length(specialty_uz) <= 120),
  specialty_ru text check (char_length(specialty_ru) <= 120),
  bio_uz text check (char_length(bio_uz) <= 1000),
  bio_ru text check (char_length(bio_ru) <= 1000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id)
);
create index dentists_clinic_id_idx on public.dentists (clinic_id, sort_order);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  question_uz text check (char_length(question_uz) <= 300),
  answer_uz text check (char_length(answer_uz) <= 2000),
  question_ru text check (char_length(question_ru) <= 300),
  answer_ru text check (char_length(answer_ru) <= 2000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (question_uz is not null or question_ru is not null)
);
create index faqs_clinic_id_idx on public.faqs (clinic_id, sort_order);

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  channel text not null default 'web' check (channel in ('web', 'hosted')),
  -- Random id kept in the patient's browser; not linked to any identity.
  visitor_id uuid not null,
  locale text check (locale in ('uz', 'ru')),
  status public.conversation_status not null default 'open',
  consent_at timestamptz not null,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (id, clinic_id)
);
create index conversations_clinic_recent_idx on public.conversations (clinic_id, last_message_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null,
  clinic_id uuid not null,
  role public.message_role not null,
  content text not null check (char_length(content) between 1 and 4000),
  author_user_id uuid references auth.users (id) on delete set null,
  model text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  created_at timestamptz not null default now(),
  -- Composite FK: a message always belongs to a conversation of the same clinic.
  foreign key (conversation_id, clinic_id)
    references public.conversations (id, clinic_id) on delete cascade
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_clinic_created_idx on public.messages (clinic_id, created_at);
create index messages_author_user_id_idx on public.messages (author_user_id);

-- ---------------------------------------------------------------------------
-- Appointment requests and handoffs
-- ---------------------------------------------------------------------------
create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  conversation_id uuid,
  service_id uuid,
  dentist_id uuid,
  patient_name text not null check (char_length(patient_name) between 1 and 120),
  patient_phone text not null check (patient_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  preferred_date date,
  preferred_time text check (char_length(preferred_time) <= 60),
  notes text check (char_length(notes) <= 1000),
  status public.appointment_status not null default 'requested',
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Related rows must belong to the same clinic.
  foreign key (conversation_id, clinic_id) references public.conversations (id, clinic_id) on delete set null (conversation_id),
  foreign key (service_id, clinic_id) references public.services (id, clinic_id) on delete set null (service_id),
  foreign key (dentist_id, clinic_id) references public.dentists (id, clinic_id) on delete set null (dentist_id),
  -- Never "confirmed" without a recorded time. confirmed_by is set by trigger
  -- from the acting staff member.
  check (status <> 'confirmed' or confirmed_at is not null)
);
create index appointment_requests_clinic_status_idx on public.appointment_requests (clinic_id, status, created_at desc);
create index appointment_requests_conversation_idx on public.appointment_requests (conversation_id);
create index appointment_requests_service_idx on public.appointment_requests (service_id);
create index appointment_requests_dentist_idx on public.appointment_requests (dentist_id);
create index appointment_requests_confirmed_by_idx on public.appointment_requests (confirmed_by);

-- Confirmation is a human action: it records who confirmed and when, and
-- cannot be performed by an unauthenticated (service/AI) code path.
create function private.stamp_appointment_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    if (select auth.uid()) is null then
      raise exception 'appointments can only be confirmed by a signed-in staff member'
        using errcode = '42501';
    end if;
    new.confirmed_at := now();
    new.confirmed_by := (select auth.uid());
  elsif new.status <> 'confirmed' then
    new.confirmed_at := null;
    new.confirmed_by := null;
  else
    -- Staying confirmed: keep the original confirmer.
    new.confirmed_at := old.confirmed_at;
    new.confirmed_by := old.confirmed_by;
  end if;
  return new;
end;
$$;

create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  conversation_id uuid not null,
  reason text check (char_length(reason) <= 500),
  status public.handoff_status not null default 'pending',
  claimed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (conversation_id, clinic_id)
    references public.conversations (id, clinic_id) on delete cascade
);
create index handoffs_clinic_status_idx on public.handoffs (clinic_id, status, created_at desc);
create index handoffs_conversation_idx on public.handoffs (conversation_id);
create index handoffs_claimed_by_idx on public.handoffs (claimed_by);

-- ---------------------------------------------------------------------------
-- Usage and audit
-- ---------------------------------------------------------------------------
create table public.usage_monthly (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  conversations integer not null default 0 check (conversations >= 0),
  messages integer not null default 0 check (messages >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  primary key (clinic_id, month)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 64),
  entity text not null check (char_length(entity) <= 64),
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_clinic_created_idx on public.audit_log (clinic_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.clinics
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.clinic_profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.dentists
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.faqs
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.appointment_requests
  for each row execute function private.set_updated_at();

create trigger prevent_clinic_change before update on public.clinic_members
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.clinic_profiles
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.services
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.dentists
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.faqs
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.conversations
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.messages
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.appointment_requests
  for each row execute function private.prevent_clinic_change();
create trigger prevent_clinic_change before update on public.handoffs
  for each row execute function private.prevent_clinic_change();

create trigger stamp_confirmation before insert or update on public.appointment_requests
  for each row execute function private.stamp_appointment_confirmation();

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, then grant only what policies need.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.plans to authenticated;
grant select, update on public.clinics to authenticated;
grant select on public.clinic_members to authenticated;
grant select, insert, update, delete on public.clinic_profiles to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.dentists to authenticated;
grant select, insert, update, delete on public.faqs to authenticated;
grant select, update on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select, insert, update on public.appointment_requests to authenticated;
grant select, update on public.handoffs to authenticated;
grant select on public.usage_monthly to authenticated;
grant select on public.audit_log to authenticated;

-- Column-level limits on what staff may change through the API.
revoke update on public.clinics from authenticated;
grant update (name, default_locale) on public.clinics to authenticated;
revoke update on public.conversations from authenticated;
grant update (status, closed_at) on public.conversations to authenticated;
revoke update on public.handoffs from authenticated;
grant update (status, claimed_by, resolved_at) on public.handoffs to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.clinic_profiles enable row level security;
alter table public.services enable row level security;
alter table public.dentists enable row level security;
alter table public.faqs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.handoffs enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.audit_log enable row level security;

create policy "plans are readable by signed-in users" on public.plans
  for select to authenticated using (true);

create policy "members read their clinics" on public.clinics
  for select to authenticated
  using (id in (select private.user_clinic_ids()));
create policy "owners update their clinics" on public.clinics
  for update to authenticated
  using (id in (select private.owner_clinic_ids()))
  with check (id in (select private.owner_clinic_ids()));

create policy "members read their clinic's members" on public.clinic_members
  for select to authenticated
  using (clinic_id in (select private.user_clinic_ids()));

-- Clinic knowledge: any member may manage it.
create policy "members read profile" on public.clinic_profiles
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));
create policy "members insert profile" on public.clinic_profiles
  for insert to authenticated with check (clinic_id in (select private.user_clinic_ids()));
create policy "members update profile" on public.clinic_profiles
  for update to authenticated
  using (clinic_id in (select private.user_clinic_ids()))
  with check (clinic_id in (select private.user_clinic_ids()));
create policy "members delete profile" on public.clinic_profiles
  for delete to authenticated using (clinic_id in (select private.user_clinic_ids()));

create policy "members read services" on public.services
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));
create policy "members insert services" on public.services
  for insert to authenticated with check (clinic_id in (select private.user_clinic_ids()));
create policy "members update services" on public.services
  for update to authenticated
  using (clinic_id in (select private.user_clinic_ids()))
  with check (clinic_id in (select private.user_clinic_ids()));
create policy "members delete services" on public.services
  for delete to authenticated using (clinic_id in (select private.user_clinic_ids()));

create policy "members read dentists" on public.dentists
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));
create policy "members insert dentists" on public.dentists
  for insert to authenticated with check (clinic_id in (select private.user_clinic_ids()));
create policy "members update dentists" on public.dentists
  for update to authenticated
  using (clinic_id in (select private.user_clinic_ids()))
  with check (clinic_id in (select private.user_clinic_ids()));
create policy "members delete dentists" on public.dentists
  for delete to authenticated using (clinic_id in (select private.user_clinic_ids()));

create policy "members read faqs" on public.faqs
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));
create policy "members insert faqs" on public.faqs
  for insert to authenticated with check (clinic_id in (select private.user_clinic_ids()));
create policy "members update faqs" on public.faqs
  for update to authenticated
  using (clinic_id in (select private.user_clinic_ids()))
  with check (clinic_id in (select private.user_clinic_ids()));
create policy "members delete faqs" on public.faqs
  for delete to authenticated using (clinic_id in (select private.user_clinic_ids()));

-- Patient-facing data: staff read and triage; creation happens server-side.
create policy "members read conversations" on public.conversations
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));
create policy "members update conversations" on public.conversations
  for update to authenticated
  using (clinic_id in (select private.user_clinic_ids()))
  with check (clinic_id in (select private.user_clinic_ids()));

create policy "members read messages" on public.messages
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));

create policy "members read appointment requests" on public.appointment_requests
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));
create policy "members create appointment requests" on public.appointment_requests
  for insert to authenticated with check (clinic_id in (select private.user_clinic_ids()));
create policy "members update appointment requests" on public.appointment_requests
  for update to authenticated
  using (clinic_id in (select private.user_clinic_ids()))
  with check (clinic_id in (select private.user_clinic_ids()));

create policy "members read handoffs" on public.handoffs
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));
create policy "members update handoffs" on public.handoffs
  for update to authenticated
  using (clinic_id in (select private.user_clinic_ids()))
  with check (clinic_id in (select private.user_clinic_ids()));

create policy "members read usage" on public.usage_monthly
  for select to authenticated using (clinic_id in (select private.user_clinic_ids()));

create policy "owners read audit log" on public.audit_log
  for select to authenticated using (clinic_id in (select private.owner_clinic_ids()));
