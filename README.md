# SPEC-2-BoardTenZorg — Minimal MVP

## Background

A no-frills monthly leaderboard app that computes **MMR (simple Elo)** from completed **Challonge** tournaments. Keep the product tiny and shippable.

## Requirements (Minimum)

### ALL

0. **Leaderboard (view only)** — global monthly board sorted by MMR ↓; show rank, username, MMR, matches played. Always show signed‑in user’s row (“sticky self‑row”).

### USER

0. **Register, Login, Configure Profile** — email+password; pick unique username; get random 5‑char ID.
1. **Register for Tournament** — join a BoardTenZorg tournament (pre‑registration list).
2. **View Matches/MMR History** — per‑user page with rated matches and deltas for the current month.

### ADMIN

0. **Login** — via seeded admin email(s) in DB.
1. **Register/Create Challonge Tournament** — save Challonge URL/slug under current month.
2. **Export Registered Players / Add to Challonge** — one-click text list `id - username` (manual paste to Challonge). (API auto‑add optional later.)
3. **Finish & Calculate MMR** — fetch participants+completed matches from Challonge, validate scores, apply simple Elo per match, update board. Allow safe **Re‑run** if TO fixes scores.

**Operational defaults**

* Page size: leaderboard 50; player history 100; tournaments 50.
* Rate caps: public reads 60/min/IP; `/rate` 1/min/tournament; `/rerun` 2/hour/tournament; finalize 1/day.
* Retention: keep **current month + last 4** fully; older → keep **Top 10 snapshot** and per‑user season totals only.

## Method (Minimal Architecture)

* **Stack**: Next.js (Vercel) + Supabase (Postgres, Auth, Edge Functions, Cron). Asia/Jakarta timezone.
* **Monthly seasons**: one active season `YYYY-MM`. Admin manually **Finalize**; new season auto‑created at 00:00 on the 1st.
* **Rating**: Simple Elo (K=32). Use only matches with clear winner + valid `scores_csv`; compute deltas per match in chronological order when admin clicks **Finish & Calculate**.

### Data Model (only what we need)

```sql
-- users & roles
users(id char(5) pk, auth_user_id uuid unique, username text unique, created_at timestamptz)
user_roles(auth_user_id uuid pk, role enum('admin','player'))

-- seasons (monthly)
seasons(id text pk, status enum('active','finalized'), start_at timestamptz, end_at timestamptz, k_factor int default 32)
player_season_ratings(user_id char(5), season_id text, rating_current int default 1000, matches_played int default 0,
                      first_reached_current_rating_at timestamptz, pk(user_id, season_id))
leaderboard_snapshots(season_id text, user_id char(5), final_rank int, final_rating int, matches_played int,
                      pk(season_id, user_id))

-- tournaments & participation
tournaments(id uuid pk, season_id text, challonge_url text, challonge_slug text, name text, state enum('registered','rated'))
tournament_players(tournament_id uuid, user_id char(5), challonge_participant_id bigint, challonge_display_name text,
                   pk(tournament_id, user_id))

-- matches & rating ledger
matches(id uuid pk, tournament_id uuid, challonge_match_id bigint unique,
        p1_user_id char(5), p2_user_id char(5), winner_user_id char(5), scores_csv text,
        winner_points int, loser_points int, score_diff int, completed_at timestamptz)
rating_events(id uuid pk, season_id text, match_id uuid, user_id char(5), rating_before int, rating_after int,
              delta int, k_factor int, created_at timestamptz)
```

**Indexes (minimal)**

* `player_season_ratings(season_id, rating_current DESC, matches_played DESC, first_reached_current_rating_at ASC)`
* `rating_events(user_id, season_id, created_at)`
* `matches(tournament_id, completed_at)`

### Core Flows (concise)

```plantuml
@startuml
actor User
actor Admin
participant UI
participant API
participant "Supabase Edge" as Edge
participant "Challonge" as CH

== User ==
User -> UI: Register/Login
UI -> API: POST /api/auth/register (username)
User -> UI: Join Tournament
UI -> API: POST /api/tournaments/:id/register
User -> UI: View Leaderboard / History
UI -> API: GET /api/leaderboard, /api/players/:id

== Admin ==
Admin -> UI: Register Challonge URL
UI -> API: POST /api/tournaments
Admin -> UI: Export Participants (paste to CH)
UI -> API: GET /api/tournaments/:id/participants-list
Admin -> UI: Finish & Calculate
UI -> API: POST /api/tournaments/:id/rate
API -> Edge: start rating job
Edge -> CH: GET participants, GET matches?state=complete
Edge -> API/DB: validate scores, apply Elo, update ratings
@enduml
```

### Validation Rules (tiny)

* Username `^[a-z0-9_]{3,20}$`; password ≥ 8 chars.
* Only **completed matches** with non‑empty scores; **reject** ties/inconsistent totals.
* Sticky self‑row: API returns current user’s rank even if off‑page.

## Implementation (Minimal Steps)

1. **Supabase**: create project → run schema SQL → enable RLS policies (public read; admin/service write).
2. **Auth**: email+password; seed admin emails into `user_roles`.
3. **Next.js**: pages — `/` leaderboard, `/players/[id]` history, `/admin` controls.
4. **API routes**: `register username`, `register tournament`, `participants list`, `rate`, `finalize season`.
5. **Edge Functions**: `tournament_rate` (pull CH, parse scores, Elo K=32), `season_rollover` (cron @ 00:00 Asia/Jakarta).
6. **Retention job**: monthly prune old seasons (keep Top 10 snapshot + per‑user totals).

## Milestones

* **M1** Auth + username + 5‑char IDs
* **M2** Admin: register tournament + export list
* **M3** Finish & Calculate (rating job)
* **M4** Leaderboard + Player history UI
* **M5** Finalize + Cron rollover + Retention

## Gathering Results

* **Happy path**: Admin registers CH URL, exports list, runs **Finish & Calculate**, leaderboard updates; user sees matches & deltas.
* **Correctness**: sample 5 matches, recompute Elo offline, compare to `rating_events`.
* **Perf**: import+rate 128‑player bracket within a few seconds.

## Need Professional Help in Developing Your Architecture?

Please contact me at [sammuti.com](https://sammuti.com) :)