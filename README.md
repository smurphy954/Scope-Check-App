# Scope Check

Job site submittal & compliance assistant. Mobile-first PWA built with Next.js 14, Supabase, and Anthropic Claude. Deploys to **Render** (web service + background worker).

## Status — Phase 1: Foundation (✅ ready to test)

What's wired up:

- Magic-link sign-in (Supabase Auth, email OTP)
- Auto-open last project on the root route
- Project list — create / select / archive / unarchive
- Project home with quick action tiles (Camera, Rooms, Upload Docs, Chat) — tiles route to clearly-labeled "Phase X" placeholders for now
- Settings screen with profile + sign-out
- Auth-protected routes via middleware
- PWA manifest + minimal service worker (install-to-homescreen works)
- SQL migrations with row-level security (`profiles`, `projects`, `jobs`)
- Background worker (`pnpm worker`) that polls a Postgres-backed jobs queue. No-op in Phase 1; real handlers (e.g. `extract_document`) land in Phase 2.
- `render.yaml` Blueprint that deploys both the web service and the worker on Render Pro.

Phases 2–6 will come on top of this foundation — folder structure and queue infrastructure already accommodate them.

---

## 1. Prereqs

- Node 20+ (you have 22.x ✅)
- `pnpm` (you have 10.x ✅) — `corepack enable` if missing
- A Supabase account (free tier is fine for dev)
- A Render account (Pro plan, since deploys use it)
- An Anthropic API key (needed in Phase 2; can skip for Phase 1)

## 2. Create the Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Name: `scope-check` (or whatever). Pick a region close to where Render runs your app (the `render.yaml` defaults to `oregon`). Save the database password somewhere safe.
3. Wait ~2 minutes for provisioning.

### 2a. Grab API keys

Sidebar → **Project Settings** → **API**. You'll need three values:

| Value | Used by |
| --- | --- |
| **Project URL** | web + worker |
| **anon / public key** | web only |
| **service_role key** | web + worker (server-only — never ship to the browser) |

### 2b. Configure auth (magic links)

- Sidebar → **Authentication** → **URL Configuration**
  - **Site URL**: `http://localhost:3000` while developing locally; change to your Render URL after deploy
  - **Redirect URLs**: add all of
    - `http://localhost:3000/auth/callback`
    - `https://scope-check-web.onrender.com/auth/callback` (or whatever Render assigns)
    - `https://*.onrender.com/auth/callback` (so PR previews work if you enable them)
- Sidebar → **Authentication** → **Providers** → make sure **Email** is enabled.
- (Optional) **Email templates** → **Magic Link** — Supabase ships a working default.

### 2c. Run the database migrations

- Sidebar → **SQL editor** → **New query**.
- Paste `supabase/migrations/0001_phase1_init.sql`, run.
- New query, paste `supabase/migrations/0002_jobs.sql`, run.
- Verify in **Table Editor**: you should see `profiles`, `projects`, `jobs`. RLS should be enabled on all three.

> Why this matters: row-level security is what makes users only see their own projects. Don't skip it.

## 3. Anthropic API key (optional in Phase 1)

- Go to <https://console.anthropic.com> → **API Keys** → **Create key**.
- Name it `scope-check-dev`. Copy the value into `ANTHROPIC_API_KEY` (see step 4).

You don't need a working key to test Phase 1, but the env var must be present (even blank) for the build to succeed.

## 4. Local env vars

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the values from steps 2a and 3:

| Var | Where to get it | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | web + worker |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key | web |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key | web + worker |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | worker (Phase 2+) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local; your Render URL in prod | web |

## 5. Run it locally

```bash
pnpm install
pnpm dev          # web app on http://localhost:3000
pnpm worker:dev   # background worker (separate terminal, optional in Phase 1)
```

The worker will heartbeat-log every 30s. Since no jobs are produced in Phase 1, you'll only see "idle" lines — that's expected.

## 6. Phase 1 test plan

Run through these on your phone (or desktop browser):

1. **Sign-in screen** — enter your email, tap *Send magic link*. Confirmation card appears.
2. **Email** — open the magic link. Should land on `/projects` (empty state).
3. **Create project** — tap *New project*, enter a name, tap *Create*. Redirects into the project home.
4. **Quick actions** — tap each tile (Camera, Rooms, Upload, Chat). Each shows a clearly labeled "Phase X" placeholder with a back link.
5. **Back to list** — tap the back link. Project list shows your new project.
6. **Archive** — tap the archive icon next to a project. It disappears from the active list.
7. **Toggle Archived view** — tap *Archived* (top-right). See archived project. Tap the rotate icon to restore.
8. **Settings** — from any screen, tap the gear icon (top-right). See your email + user ID. Tap *Sign out* — back to sign-in.
9. **Auto-open** — sign in again. You should land directly in the most recently opened project, not the project list.
10. **Mobile install** — iOS Safari: *Share → Add to Home Screen*. Android Chrome: *Install app*. Launches in standalone mode.
11. **Worker boots** (optional) — `pnpm worker:dev` prints `[worker local-NNNN] starting; poll=5000ms handlers=[none]` and then idle heartbeats.

If 1–10 work, Phase 1 is good — tell me to start Phase 2.

## 7. Deploy to Render

The repo includes a `render.yaml` Blueprint that provisions both services in one click.

1. Push this branch to GitHub (already done if you're reading this from a PR).
2. Go to <https://dashboard.render.com> → **New +** → **Blueprint**.
3. Connect the repo. Render reads `render.yaml` and shows the two services it will create:
   - **scope-check-web** (web, Pro plan, Oregon region) — runs `pnpm build` then `pnpm start`
   - **scope-check-worker** (background worker, Pro plan) — runs `pnpm worker`
4. Click **Apply**. Render asks you to fill in env var values for each `sync: false` entry. Paste from your `.env.local`. For `NEXT_PUBLIC_SITE_URL`, use the URL Render is about to assign — typically `https://scope-check-web.onrender.com` (or your custom domain once you add one).
5. **Create Resources**. First deploy takes ~3-5 minutes.
6. Back in **Supabase → Authentication → URL Configuration**:
   - Update **Site URL** to your Render URL
   - Make sure your Render URL + `/auth/callback` is in the allowed redirect list

If you change the region in `render.yaml` or your service names, update the Supabase redirect URLs to match.

### Editing env vars later

Render dashboard → service → **Environment** → edit. Both services pick up changes on next deploy. The worker auto-deploys on every push to `main`, same as the web service.

---

## Architecture notes

### Why a background worker

Document extraction (Phase 2) calls Claude vision on multi-page PDFs. Those calls can run for minutes per document. Doing that inside an HTTP request would block the Render web service and risk timeouts.

So instead:

- **Web service** handles uploads, writes the file to Supabase Storage, inserts a `jobs` row with `kind = 'extract_document'`, and returns a 202 immediately.
- **Worker service** polls the `jobs` table via the `claim_next_job` RPC, runs the extraction, and updates the document/job rows when done.
- The UI polls (or subscribes via Supabase Realtime in a later iteration) to show extraction status: `queued → running → completed/failed`.

### Jobs queue contract

Defined in `supabase/migrations/0002_jobs.sql`:

- `jobs` table — `kind`, `payload jsonb`, `status`, `attempts`, `max_attempts`, `run_after`, `locked_by`, `last_error`, `result`, `project_id`.
- `claim_next_job(worker_id, job_kinds)` — atomic claim using `FOR UPDATE SKIP LOCKED`. Multiple workers are safe to scale horizontally.
- `release_stuck_jobs(stuck_after_seconds)` — recovery helper for jobs that crashed mid-run. Wire to a schedule (Supabase pg_cron or a periodic worker tick) when needed.
- The worker (`worker/index.ts`) does exponential backoff on retry (30s → 2m → 8m), then marks the job `failed` once `attempts >= max_attempts`.

In Phase 1 there are no producers, so the worker idles. Phase 2 will register the first handler.

---

## Project structure

```
src/
  app/
    auth/                 # callback + sign-out routes
    projects/             # list, [projectId] home + per-phase placeholders
    settings/
    sign-in/
  components/             # shared UI (app header, register-sw, coming-soon)
    ui/                   # shadcn/ui primitives
  lib/
    projects/actions.ts   # server actions for project CRUD
    supabase/             # browser, server, middleware, admin (service role)
    utils.ts
  middleware.ts           # auth gating + session refresh
worker/
  index.ts                # background worker entry --- Render `scope-check-worker`
supabase/
  migrations/             # SQL --- run in dashboard or via Supabase CLI
public/
  manifest.webmanifest
  sw.js
  icons/                  # placeholder icons --- replace with your branding
render.yaml               # Render Blueprint (web + worker, Pro plan)
```

## Notes

- **API keys**: server-side env vars only. The settings screen does **not** prompt the user for keys.
- **Service worker**: only registers in production builds (`NODE_ENV=production`) so it doesn't interfere with HMR during dev. Test PWA install with `pnpm build && pnpm start`.
- **Icons**: the included PNGs are solid-color placeholders. Drop in real artwork at `public/icons/icon-192.png` and `public/icons/icon-512.png` when you have it.
- **Phase 2+ folder placeholders** under `projects/[projectId]/{documents,rooms,camera,chat}` will be replaced with the real screens as we build them.
