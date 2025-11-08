# BoardTenZorg Frontend

Monorepo for the BoardTenZorg leaderboard UI and its Supabase edge function(s). The Next.js app lives in `boardtenzorg-app/`.

## Requirements
- Node.js 20+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (we invoke it via `npx`, so no global install is required)
- Access to a Supabase project (project ref `<SUPABASE_PROJECT_ID>` per `.env.example`)

## Local setup

```bash
cd boardtenzorg-app
cp .env.example .env.local             # add Supabase URL + anon service keys
npm install
```

### Start Supabase locally
```bash
npx supabase@latest login              # once per machine
npx supabase@latest start              # boots the local stack
npx supabase@latest db reset \
  --seed supabase/seed.sql             # optional: seed local data
```

If you are targeting the hosted project instead of the local stack, link the CLI once:
```bash
npx supabase@latest link --project-ref <SUPABASE_PROJECT_ID>
```

### Run the web app
```bash
npm run dev      # Next.js dev server on http://localhost:3000
npm run lint     # ESLint
npm run build    # Production build verification
```

### Promote a user to admin
1. Grab the `auth_user_id` for the player (from Supabase Auth → Users).
2. Run the SQL below via the Supabase SQL editor **or** the CLI:

```bash
npx supabase@latest sql --project-ref <SUPABASE_PROJECT_ID> <<'SQL'
insert into public.user_roles (auth_user_id, role)
values ('<AUTH_USER_ID>', 'admin')
on conflict (auth_user_id, role) do nothing;
SQL
```

Replace `<AUTH_USER_ID>` with the actual UUID. The next login will surface the Admin Dashboard link in the app header.

### Deploy the Elo rating function
```bash
npx supabase@latest functions deploy tournament-rate --project-ref <SUPABASE_PROJECT_ID>
```

This pushes `supabase/functions/tournament-rate` to the edge runtime so admins can trigger post-tournament rating updates.
