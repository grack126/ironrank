# IronRank — Gym Challenge App (web-first MVP)

A mobile-first competitive fitness web app built from the project brief. This is
the **web-first validation build**: a single Next.js app (user-facing + admin)
backed by a local **SQLite** database via Prisma — **zero external setup**.

## Design

Visual direction is **"Forged"** — dark graphite base, ignition-orange accent, and metallic
rank tiers (bronze→diamond) as the signature. Tokens live in [src/theme/tokens.ts](src/theme/tokens.ts)
+ CSS variables; a reusable component kit in `src/components/ui/` (Button, Card, StatNumber, RankBadge,
DifficultyPill, VideoEmbed, EmptyState…) backs every screen. Fonts: Archivo (display), Inter (body),
JetBrains Mono with tabular figures for all numbers. The signature **Rank Reveal** (metallic medal +
sheen sweep + scale-in + haptics) fires on workout finish; motion respects `prefers-reduced-motion`.
Tabs: Challenges · Workouts · Leaderboard · Profile.

## What's implemented (first milestone)

- **Auth & Profiles** — email/password signup + login, sessions, onboarding,
  full profile with **kg/lb toggle** (canonical storage in kg). First account
  created becomes the **admin**.
- **Exercise Library** (admin) — CRUD with YouTube URL → video-ID extraction and
  inline embedded player. Shared by workouts (and, later, challenges).
- **Reference-lift catalogue** (admin) — full CRUD: create, rename, edit
  description/unit, archive. Deletion is **guarded** — a lift used by any workout
  or athlete is soft-archived instead of hard-deleted.
- **Workout categories / plans** — admin-managed catalogue (create/rename/
  reorder/archive) at `/admin/workout-categories`. The Workouts tab shows
  **category tiles** first; tapping one lists that plan's workouts (plus an "All"
  view). Each workout belongs to one category (required in the builder).
- **Structured Workout System** (the core "workout app"):
  - Admin **workout builder**: details + rounding increment, **category** (req),
    an optional **card background image** (uploaded, validated), an **editable,
    reorderable required-reference-lift list** (add from catalogue, remove, or
    create one inline), **multi-part sets** (drop sets / supersets / giant sets —
    each part its own exercise + reference lift + **reps** + Easy/Hard/Brutal %
    grid), **set-level points** per difficulty, duplicate-set/part helpers,
    **rank tiers**, live **max-points** calc and validation before publish.
  - Each **workout card** can show a **background image** behind the existing
    rounded box (with a scrim so text stays legible; lazy-loaded; graceful
    fallback to the solid token card when none).
  - User flow: a **single scrollable player** showing every exercise and set at
    once (grouped into nested rounded boxes — exercise container → set box →
    part card; supersets render as standalone "Advanced set" containers). A
    sticky nav lets you **re-open and edit reference weights any time** (saving
    recomputes every working weight live) and quick-jump between sections.
    Choose a **difficulty per set via a dropdown** (recomputes every part's
    auto-rounded weight); mark each set **Success/Fail** inline. A full-width
    **XP-style bottom bar** fills toward the workout's max points as you score,
    showing the running total and the next rank threshold; finish for a
    **points-based rank**.
  - **Set cards** lead with the **exercise name** (largest), a single primary
    **Weight × Reps** line (tabular), and muted notes underneath — reference
    weight and percentage are builder-side and hidden from the player.
  - **Resume** via local storage; **server-side re-scoring** (client points are
    never trusted); per-part weights + points **snapshotted** onto results for
    immutable history.
- **Weight & experience classes** — admin-managed catalogues (create / rename /
  reorder / archive) at `/admin/classes`. Each athlete picks one of each on their
  profile; classes are **snapshotted onto every challenge submission** so boards
  stay stable. Challenge leaderboards filter by **weight class and/or experience
  class** (combinable), with a clear active-filter chip.
- **Friend groups** (`/groups`) — create a crew, invite by username/email or a
  shareable code, accept/decline invites (with notifications). Each group has a
  **members-only leaderboard** scoped to its members across challenges. Group
  data is **private to members** — enforced by server-side membership gates
  (non-members get a 404).
- **Progression** (on the profile):
  - **XP & levels** accrue from workouts, verified challenges, PRs and streak
    milestones, with a level-progress bar.
  - **Avatars** — a catalogue unlocked by level; pick any unlocked one.
  - **Badges** — **placement badges** (podium + per weight/experience-class
    wins) are awarded **only when a challenge is finalized** (not on submission),
    from **verified** entries only; **level**/**streak** milestones and
    **personal bests** are immediate. Recipients get notifications.
  - **Streaks** with **freeze tokens** that bridge rest-day gaps so a deliberate
    rest doesn't break the streak (milestones grant a badge + bonus freeze).
  - **Personal records** tracked per movement and **celebrated** on submission
    (a "New personal best" moment with haptics).
- **Competitive Challenges** (the **Challenges** tab):
  - Admin **challenge builder**: pick a library exercise, format (max weight /
    reps / tonnage / for time / AMRAP), scoring (absolute or **relative DOTS**),
    a **demo video** (prefilled from the linked exercise, overridable — the
    challenge video wins, else it falls back to the exercise's),
    open/close window, season, daily flag, draft/published.
  - User flow: browse the **daily** + live challenges → log an attempt (result +
    **bodyweight snapshot** + optional **video link**), **offline-logged** and
    auto-synced → appear on the leaderboard.
  - **Leaderboards** with segmented views: **Official (verified)** vs all entries,
    **Absolute** vs **Relative (DOTS, bodyweight-fair)**, and **Overall** vs
    **your weight class**; your row is pinned and highlighted.
  - **Verification:** video-link submissions enter a **pending** state and an
    **admin review queue** (open video → verify/reject with notes). Verifying
    counts toward the official board and **awards XP** (clawed back on reject).
  - **Finalization:** when a challenge's window closes it is finalized (admin
    "Run now", or a scheduled job in production) — final rankings are computed
    from **verified** entries only and **placement badges** are awarded; boards
    show a **provisional** banner until then, and a **final** one after.
- **Shared calculators** in `src/lib/shared` with **Vitest** unit tests: unit
  conversion, working-weight + rounding, points→rank resolver, rank-tier
  validation, **DOTS** scoring, and challenge scoring / weight-category resolution.

Deferred (later phases): community verifiers + reputation, flag-abuse tracking,
automated season close, shareable result cards, social feed (follows/reactions/
comments), rivals, private competitions. Challenge finalization runs via an admin
trigger locally; in production it maps to pg_cron + a Supabase Edge/Postgres function.

## Run it locally

```bash
npm install
npm run db:reset   # create SQLite db + seed demo data (drops existing data)
npm run dev        # http://localhost:3000
```

Already set up in this workspace — just `npm run dev`.

### Demo logins (from the seed)

| Role  | Email                  | Password    |
|-------|------------------------|-------------|
| Admin | admin@ironrank.test    | password123 |
| User  | lifter@ironrank.test   | password123 |

The lifter already has reference numbers, so you can run the seeded
**"Push / Pull / Legs Gauntlet"** workout immediately. Or sign up a fresh
account (the very first account in an empty DB becomes admin).

## Scripts

- `npm run dev` — dev server
- `npm test` — run the shared-calculator unit tests
- `npm run db:reset` — reset + reseed the database
- `npm run db:seed` — seed without dropping
- `npm run build` / `npm start` — production build/run

## Tech & structure

Next.js 15 (App Router) · React 19 · TypeScript · Prisma + SQLite · Zod ·
server actions for all writes.

```
src/
  app/            routes (auth, onboarding, profile, workouts, challenges, admin) + server actions
  components/     client components (forms, workout runner, workout builder, tab bar…)
  lib/
    shared/       pure calculators + unit tests (units, workout, dots)
    auth.ts db.ts youtube.ts
prisma/
  schema.prisma   data model (string fields stand in for Postgres enums)
  seed.ts         demo content
```

## Mapping to the brief's stack

The brief's default is an Expo mobile app + Next.js admin + Supabase/Postgres with
RLS. This build takes the brief's sanctioned **"fastest validation"** fork: one
Next.js web app + local SQLite. The schema, the canonical-kg unit handling, and
the `lib/shared` calculator split are all structured so a later move to
Supabase/Postgres (and a separate Expo client) is a clean swap rather than a
rewrite. Server actions already enforce auth/admin checks and **re-validate every
write server-side** — the equivalent of the RLS posture the brief requires.
