# Dental AI Front Desk

AI front desk for dental clinics: answers patient questions from clinic-approved
information (Uzbek and Russian), collects appointment **requests**, and hands
conversations to staff. Multi-tenant SaaS.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Vitest

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Open http://localhost:3000. Staff accounts are created by an administrator
(there is no public sign-up); see "Creating a staff account" below.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Tenant-isolation SQL tests against `SUPABASE_DB_URL` (rolled back, leave no data) |
| `npm run build` | Production build |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and build on
every push and pull request. Database tests are not in CI yet because they need
database credentials.

## Database

- Migrations live in `supabase/migrations/` and are the source of truth.
  Create new ones with `npx supabase migration new <name>`; never edit an
  applied migration.
- After a migration, regenerate `src/lib/supabase/database.types.ts`.
- `supabase/tests/tenant_isolation.sql` proves that a clinic's staff cannot
  read or change another clinic's data, that anonymous visitors have no table
  access, and that only a signed-in staff member can confirm an appointment.

### Security model

- Every tenant row has `clinic_id`; row level security limits staff to the
  clinics in `clinic_members`. Same-clinic foreign keys are composite
  (`x_id, clinic_id`), so rows can't reference another clinic's data.
- The `anon` role has no grants. Patient-facing writes will go through server
  code (Phase 3), never directly from the browser.
- An appointment request is never "confirmed" by the system: the database
  rejects confirmation without a signed-in staff member and records who
  confirmed it.

### Creating a staff account (development)

1. Supabase dashboard → Authentication → Users → Add user (email + password).
2. Link the user to a clinic in the SQL editor:

```sql
insert into public.clinics (slug, name) values ('demo-clinic', 'Demo Clinic') returning id;
insert into public.clinic_members (clinic_id, user_id, role)
values ('<clinic id>', '<user id>', 'owner');
```

## Rules for working on this repo

- Never commit secrets. `.env.local` is ignored; `.env.example` lists names only.
- Never put real patient data in development or tests.
- Client code may only use the publishable key. The secret/service key is server-only.
