# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegraph-Image: a free image hosting app (图床) deployed on **Cloudflare Pages**. It proxies uploads to `telegra.ph` and Telegram, logs all access to **Cloudflare D1** (SQLite), and exposes an admin panel for image management and content moderation. Built with Next.js 14 App Router running entirely in the **Edge runtime**.

This repo is a localized fork of `x-dr/telegraph-Image` (root `name` is `2026freetu`).

## Commands

- `npm run dev` — local dev server (note: edge routes calling `getRequestContext()`/D1 only work when built/deployed on Cloudflare, not in plain `next dev`)
- `npm run build` / `npm start` — Next.js build and production server
- `npm run lint` — ESLint via `eslint-config-next`
- `npm run d1` — apply schema locally with Wrangler: `wrangler d1 execute img --local --file=./tgimglog.sql`

There is no test framework configured.

## Deployment Target & Constraints

The app is built for Cloudflare Pages via `@cloudflare/next-on-pages`. Every API route sets `export const runtime = 'edge';`. Cloudflare-specific bindings are accessed through `getRequestContext()` from `@cloudflare/next-on-pages`, not the Node.js `process`:

- `env.IMG` — **D1 database binding** (SQLite). Stores two tables defined in `tgimglog.sql`:
  - `imginfo`: uploaded image metadata (`url`, `referer`, `ip`, `rating`, `total`, `time`)
  - `tgimglog`: per-request access log (`url`, `referer`, `ip`, `time`)
- `env.IMGRS` — optional **R2 storage bucket** binding (configured in CF dashboard, see `docs/manage.md`)
- Cloudflare environment variables (e.g. `TG_BOT_TOKEN`, `ModerateContentApiKey`, `CUSTOM_DOMAIN`) are read off `env` at runtime.

**Local dev gotcha:** routes that depend on `env.IMG`/bindings will silently degrade in plain `next dev`. The code is written to branch on `if (!env.IMG)` and still serve images by proxying `telegra.ph` directly. Meaningful testing requires deploying to Cloudflare Pages (and setting the `nodejs_compat` compatibility flag per README step 7).

## Architecture

### Request flow

1. **Upload** (`src/app/api/tg/route.js`): client POSTs a file → the route proxies it to `https://telegra.ph/upload` → returns a `/file/<name>` URL to the client. On success it calls a moderation API and inserts a row into `imginfo`.
2. **Serve** (`src/app/api/file/[name]/route.js`): the canonical image endpoint, exposed publicly via the rewrite in `next.config.mjs` (`/file/:name* → /api/file/:name*`). On each hit it: proxies the image from `telegra.ph`, inserts a `tgimglog` row, looks up the cached `rating` in `imginfo`, and `total += 1`. If `rating === 3` it redirects to `/img/blocked.png` instead.
3. **Telegram-backed variants** under `src/app/api/`: `cfile/[name]` (cached, served from Telegram Bot API via `getFile`) and `rfile/[name]`. `cfile` uses Cloudflare's `caches.default` and bypasses the rating block for admin/list/home referers.
4. **Aux upload proxies**: `58img`, `tencent`, `vviptuangou` proxy uploads to alternative Chinese image hosts; `ip` returns the caller's IP; `total` returns aggregate stats.

### Content moderation (rating) logic

`rating` is an integer where `3` means blocked/NSFW. Two sources, priority `RATINGAPI` > `ModerateContentApiKey` (both optional env). `rating === 3` triggers the `blocked.png` redirect and must **not** be cached — see commit `a4c1f82` (rating=3 images are deliberately excluded from cache so the block stays effective). When changing caching/rating behavior, preserve this non-caching contract for blocked images.

### Auth model (NextAuth v5 beta)

`src/auth.js` configures a single `CredentialsProvider` with two hardcoded roles checked against env vars:
- **admin**: `BASIC_USER` / `BASIC_PASS` → `role: 'admin'`
- **user**: `REGULAR_USER` / `REGULAR_PASS` → `role: 'user'`

JWT sessions (24h), `secret` from `SECRET` env (fallback default is in `.env.example` — replace in production). Roles propagate via the `jwt`/`session` callbacks.

`src/middleware.js` (`auth()` wrapper) gates three route prefixes with a static `matcher`:
- `/admin/:path*` and `/api/admin/:path*` — require `admin` role; unauthenticated → redirect to `/login` (pages) or 401 JSON (API)
- `/api/enableauthapi/:path*` — optional guest gate, only enforced when `ENABLE_AUTH_API=true`

`/api/admin/*` routes (`list`, `log`, `ip`, `block`, `delete`) query/mutate the D1 tables for the admin UI.

### Frontend

- `src/app/page.js` — public upload UI (client component, uses `react-photo-view`, `react-toastify`, FontAwesome)
- `src/app/admin/page.js` — admin dashboard using `src/components/Table.jsx`; calls `/api/admin/*`
- `src/app/login/page.jsx` + `src/components/SignIn.jsx` — NextAuth sign-in
- Styling: Tailwind CSS (`tailwind.config.js`); `src/app/layout.js` injects global CSS, Toastify/PhotoView CSS, and Google Analytics (`G-JVKEXR5XSG`).

## Conventions

- All SQL is written inline per-route; many queries interpolate values directly (e.g. `WHERE url='${url}'`). Prefer the parameterized `.bind()` form (as used in `insertTgImgLog`) when touching these.
- Helpers like `get_nowTime()` and `getRating()` are duplicated across route files rather than shared — match the local copy's signature when editing.
- Time is formatted in `Asia/Shanghai` via `Intl.DateTimeFormat`.
