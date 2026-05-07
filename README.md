# Scope Check

Job site submittal & compliance assistant. Mobile-first PWA built with Next.js 14, Supabase, and Anthropic Claude.

## Status — Phase 1: Foundation (✅ ready to test)

What's wired up in this commit:

- Magic-link sign-in (Supabase Auth, email OTP)
- Auto-open last project on the root route
- Project list — create / select / archive / unarchive
- Project home with quick action tiles (Camera, Rooms, Upload Docs, Chat) — tiles route to clearly-labeled "Phase X" placeholders for now
- Settings screen with profile + sign-out
- Auth-protected routes via middleware
- PWA manifest + minimal service worker (install-to-homescreen works)
- SQL migration with row-level security (`profiles`, `projects`)

Phases 2–6 will come on top of this foundation — folder structure already accommodates them.

---

## 1. Prereqs

- Node 20+ (you have 22.x ✅)
- `pnpm` (you have 10.x ✅) — `corepack enable` if missing
- A Supabase account (free tier is fine)
- An Anthropic API key (needed in Phase 2; can skip for now)

## 2. Create the Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Name: `scope-check` (or whatever). Pick a region close to you. Save the database password somewhere safe — you generally won't need it for app dev.
3. Wait ~2 minutes for provisioning.

### 2a. Grab API keys

In the Supabase dashboard for your new project:

- Sidebar → **Project Settings** → **API**
- Copy these three values into `.env.local` (see step 4 below):
  - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
  - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret — server only)

### 2b. Configure auth (magic links)

- Sidebar → **Authentication** → **URL Configuration**
  - **Site URL**: `http://localhost:3000` (you'll change this to your Vercel URL later)
  - **Redirect URLs**: add both
    - `http://localhost:3000/auth/callback`
    - `https://*.vercel.app/auth/callback` (so previews work after you deploy)
- Sidebar → **Authentication** → **Providers** → make sure **Email** is enabled.
- (Optional) **Email templates** → **Magic Link** — Supabase ships a working default template.

### 2c. Run the database migration

- Sidebar → **SQL editor** → **New query**.
- Paste the contents of `supabase/migrations/0001_phase1_init.sql` and run it.
- You should see two new tables under **Table Editor**: `profiles` and `projects`.

> Why this matters: the migration also enables **row-level security** so users can only see their own projects. Don't skip it.

## 3. Anthropic API key (optional in Phase 1)

- Go to <https://console.anthropic.com> → **API Keys** → **Create key**.
- Name it `scope-check-dev`. Copy the value into `ANTHROPIC_API_KEY` (see step 4).

You don't need a working key to test Phase 1, but the env var must be present (can be blank) for the app to build.

## 4. Local env vars

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the values from steps 2a and 3:

| Var | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (optional in Phase 1) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local; your Vercel URL in prod |

## 5. Run it

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## 6. Phase 1 test plan

Run through these on your phone (or the desktop browser to start):

1. **Sign-in screen** — enter your email, tap *Send magic link*. Confirmation card appears.
2. **Email** — open the magic link. Should land on `/projects` (empty state).
3. **Create project** — tap *New project*, enter a name, tap *Create*. You're redirected into the project home.
4. **Quick actions** — tap each tile (Camera, Rooms, Upload, Chat). Each should show a clearly labeled "Phase X" placeholder with a back link.
5. **Back to list** — tap the back link in the header. Project list shows your new project.
6. **Archive** — tap the archive icon next to a project. It disappears from the active list.
7. **Toggle Archived view** — tap *Archived* (top-right). See archived project. Tap the rotate icon to restore.
8. **Settings** — from any screen, tap the gear icon (top-right). See your email + user ID. Tap *Sign out* — back to sign-in.
9. **Auto-open** — sign in again. You should land directly in the most recently opened project (not the project list).
10. **Mobile install** — on iOS Safari, *Share → Add to Home Screen*. On Android Chrome, *Install app*. App launches in standalone mode.

If all 10 work, Phase 1 is good — tell me to start Phase 2.

## 7. Deploy to Vercel (when you're ready)

1. Push this branch to GitHub (already done if you're reading this from a PR).
2. <https://vercel.com> → **Add New** → **Project** → import the repo.
3. Framework preset: **Next.js** (auto-detected).
4. **Environment Variables** — paste the same values from `.env.local`. For `NEXT_PUBLIC_SITE_URL`, use `https://YOUR-APP.vercel.app` (whatever Vercel assigns). You can update it later when you have a custom domain.
5. **Deploy**.
6. Back in Supabase → Authentication → URL Configuration → update **Site URL** and **Redirect URLs** to use the Vercel domain.

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
supabase/
  migrations/             # SQL — run in dashboard or via Supabase CLI
public/
  manifest.webmanifest
  sw.js
  icons/                  # placeholder icons — replace with your branding
```

## Notes

- **API keys**: server-side env vars only. The settings screen does **not** prompt the user for keys.
- **Service worker**: only registers in production builds (`NODE_ENV=production`) so it doesn't interfere with HMR during dev. Test PWA install with `pnpm build && pnpm start`.
- **Icons**: the included PNGs are solid-color placeholders. Drop in real artwork at `public/icons/icon-192.png` and `public/icons/icon-512.png` when you have it.
- **Phase 2+ folder placeholders** under `projects/[projectId]/{documents,rooms,camera,chat}` will be replaced with the real screens as we build them.
