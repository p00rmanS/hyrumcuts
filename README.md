# HyrumHaircuts

The public website and owner-managed CMS for barber **Hyrum**.

- **Public site** (`/`): cinematic hero, filterable portfolio with lightbox (shareable `/#work/<id>` links to a single cut), About, Services, reviews, FAQ, contact, an optional scheduled announcement bar, and a **Book a Haircut** flow (Calendly popup plus an on-site request form). No prices, no payments.
- **Owner CMS** (`/admin`): a mobile-first admin where Hyrum manages photos, videos, categories, copy, contact details, services, reviews, FAQ, announcements, booking link and SEO. **Published changes appear on the next page load, with no rebuild or redeploy.**

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript modules, Tailwind CSS 3, built with Vite (no UI framework) |
| Database | Supabase PostgreSQL with Row Level Security |
| Auth | Supabase Auth (email + password, single owner, no public sign-up) |
| Media | Supabase Storage (`site-media` bucket, TUS resumable uploads for large video) |
| Hosting | GitHub Pages (static build, deployed by GitHub Actions) at https://p00rmans.github.io/hyrumcuts/. Netlify still works too (`netlify.toml`). |
| Booking | Calendly (unchanged) + an on-site request form whose requests land in a private **Requests** inbox in `/admin` (Supabase) |

> `legacy-php/` is the previous PHP + SQLite site, kept for reference only. It is **not deployed**. See [`legacy-php/README.md`](legacy-php/README.md).

---

## 1. Architecture

```
Visitor's browser                            Owner's browser (/admin)
   │  anon key, read-only                      │  owner's session (JWT)
   ▼                                           ▼
 GitHub Pages (static files) ──────────────── Supabase ─────────────────────────────┐
                                             ├─ PostgREST  → PostgreSQL (RLS decides everything)
                                             ├─ Auth       → the one owner account
                                             └─ Storage    → public-read bucket, owner-only writes
```

- The public pages are **static HTML that is filled in by the browser** from Supabase on every load (only published rows, only the columns needed). The HTML ships with sensible brand copy, so the page is meaningful before data arrives and if Supabase is unreachable.
- The public site uses only `@supabase/postgrest-js` (small) and **never carries a login session**: even if Hyrum is signed in to `/admin` in the same browser, public pages show exactly what a stranger sees, never drafts.
- **Authorization lives in PostgreSQL** (RLS) and Storage policies. The admin's route guard is only user experience.
- No secret key ever reaches the browser. The app refuses to start if it is given a `service_role` / `sb_secret_` key (`web/src/lib/env.js`).

### Important files

```
web/                      the site (Vite root)
  index.html, booking/, privacy/, 404.html, admin/index.html
  partials/               shared header + footer
  src/public-site/        public behaviour (gallery, lightbox, hero video, sections…)
  src/admin/              the CMS: pages/, services/, components/, validation/
  src/lib/                supabase clients, content queries, media rules, URL helpers,
                          starter-content.js (the placeholder content, one source of truth)
  src/styles/             app.css (public), admin.css
  tests/                  Vitest unit tests
supabase/
  migrations/             schema, RLS, audit log, storage, owner bootstrap
  tests/database/         pgTAP security tests
  bootstrap_owner.sql     SQL-editor way to register the owner
scripts/
  bootstrap-owner.mjs     create + register the owner, load starter content (developer, one-off)
  seed-starter-content.mjs  load the placeholder photos + portrait (Hyrum then replaces them)
  verify-security.mjs     end-to-end RLS + Storage verification against a real stack
  netlify-headers.js      generates _headers (CSP), robots.txt, sitemap.xml
.github/workflows/        deploy-pages.yml: lint + test + build + publish to GitHub Pages
netlify.toml              build + /admin rewrite (only if hosting on Netlify instead)
CMS_OWNER_GUIDE.md        plain-language guide for Hyrum
CONTENT_CHECKLIST.md      what Hyrum still needs to provide
```

### Database

`supabase/migrations/` (applied in order):

| Migration | Contents |
|---|---|
| `…000100_cms_core_schema` | `site_owner` (exactly one row), `site_settings`, `gallery_categories`, `gallery_items`, `gallery_media`, `reviews`, `faqs`, `services`; constraints (lengths, https-only URLs, alt-text-before-publish, owner-scoped storage paths); `updated_at` triggers |
| `…000200_rls_and_grants` | RLS on every table; explicit minimum grants; atomic `reorder_content()` (SECURITY INVOKER) |
| `…000300_admin_audit_log` | append-only audit log written only by triggers; stores column *names*, never values |
| `…000400_storage_media` | `site-media` bucket (public read, 50 MiB, MIME allow-list), owner-only object policies, `storage_cleanup_queue` |
| `…000500_owner_bootstrap` | first-run starter content (bio, FAQ answers, placeholder reviews, categories, services) and `private.bootstrap_owner(email)` |
| `20260930000100_appointment_requests` | the booking-form inbox: visitors may only insert (column-level grants), only the owner can read / change status / delete; server-set owner and status; a site-wide flood limit; never audit-logged |
| `20260923000100_site_announcement` | announcement-bar columns on `site_settings` (text, optional https link, optional start/end dates) |

> **Deploy order:** apply migrations *before* deploying a frontend that uses them. The public site selects every settings column it knows about; if a column is missing, the settings request fails and the site falls back to its bundled brand copy.

**How ownership works.** `public.site_owner` holds one row: the owner's Auth user id. Every content table has `owner_id … REFERENCES site_owner`, so only that one user can create rows, and RLS limits reads/updates/deletes to `owner_id = auth.uid()`. A second, valid Supabase user can sign in but **cannot** create, edit, delete, upload or read anything private.

**Visibility.** Visitors (`anon`) can read only rows with `is_published = true AND archived_at IS NULL`, plus the public-safe `site_settings` row. Hiding a category removes its filter but its work still appears under "All".

---

## 2. Local installation

Requirements: **Node 22+**, **Docker Desktop** (for the local Supabase stack). On Windows 11 Home, Docker Desktop needs WSL 2 (`wsl --install`).

```bash
git clone <repo> HyrumHaircut && cd HyrumHaircut
npm ci
cp .env.example .env          # filled in below
```

### Start a local Supabase stack

```bash
npm run db:start              # supabase start (first run downloads images)
npm run db:reset              # applies supabase/migrations + seed.sql
npx supabase status           # shows the API URL and keys
```

Put the printed **API URL** and **Publishable key** (or `anon key`) in `.env`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SITE_SLUG=hyrumhaircuts
```

### Create the owner account (local)

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SECRET_KEY=<secret key from `supabase status`> \
OWNER_EMAIL=you@example.com \
node scripts/bootstrap-owner.mjs
```

It creates the Auth user, registers them as the site owner, prints a temporary password, and loads the **starter content** described below. Then:

```bash
npm run dev                   # http://127.0.0.1:5183   (admin at /admin)
```

> The secret key here is **only for this one-off script on your machine.** Never put it in `.env`, a `VITE_*` variable, Netlify, or Git.

### Starter (placeholder) content

The site is never empty. When the owner is registered it comes with the **same content the original site launched with**, so Hyrum's job is only to replace it:

| What | Where it comes from | How Hyrum replaces it |
|---|---|---|
| Biography, FAQ answers, 3 `[Placeholder review]` quotes, services, categories | created by the database (`…000500_owner_bootstrap.sql`) | Website Content → About / FAQ, Reviews, Settings → Services, Portfolio → Categories |
| 13 portfolio items (11 photos + 2 before/after) and the portrait | files + rows loaded by `scripts/seed-starter-content.mjs` (run automatically by `bootstrap-owner.mjs`; `--no-starter` skips it; `npm run seed:starter` re-runs it on an empty portfolio) | Manage Work → Edit → replace the photo; Media → Profile Photo |
| Hero video | bundled `web/public/assets/video/hyrum1.mp4` | Hero |

They are ordinary, fully editable rows and files: rename, replace, reorder, hide or delete any of them. **The admin tracks what is still a placeholder without any flag to maintain**: a photo whose file name ends in `-starter.jpg`, a review still starting `[Placeholder review]`, an FAQ answer still starting `[Owner to review`, or the unchanged starter biography. The moment Hyrum replaces one, it stops being flagged. The dashboard lists what is left and each list shows a "Placeholder: replace me" badge.

The starter text and images are defined once in `web/src/lib/starter-content.js` (a test keeps it word-for-word identical to the SQL). If a build has **no backend configured at all** (a preview before Supabase is set up) the public site shows this same content straight from the bundle, so it always looks complete. It is *not* used when a backend is configured but unreachable, so an outage can never show placeholder work in place of Hyrum's real content.

### Environment variables

| Variable | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env`, GitHub repo variable | no |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env`, GitHub repo variable | no (publishable). Legacy `anon` keys work too. |
| `VITE_SITE_SLUG` | `.env` (the workflow sets it) | no |
| `VITE_SITE_URL` | `.env`, GitHub repo variable (optional) | no (canonical/share URLs, `sitemap.xml`) |
| `VITE_BASE_PATH` | GitHub repo variable (optional, default `/hyrumcuts/`) | no. `/` for a domain root. In Git Bash prefix the build with `MSYS_NO_PATHCONV=1`. |
| `SUPABASE_SECRET_KEY` | your shell only, for `bootstrap-owner` / `verify-security` | **yes, never committed or deployed** |

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server on `127.0.0.1:5183` |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve `dist/` on `127.0.0.1:4183` |
| `npm test` | unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run db:test` | pgTAP security tests (`supabase test db`) |
| `npm run test:rls` | end-to-end RLS + Storage + resumable-upload verification |
| `npm run test:e2e` | Playwright browser tests |
| `npm audit` | dependency audit |

---

## 3. Supabase project setup (production)

1. Create a project at supabase.com. Note the **Project URL** and **Publishable key** (Project Settings → API Keys).
2. Link and push the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. **Auth settings** (Dashboard → Authentication):
   - *Sign In / Providers → Email*: **disable "Allow new users to sign up"** (there is no public sign-up; the owner is created by you).
   - *Password*: minimum length 12, require upper + lower + digits (matches `supabase/config.toml`).
   - *Rate limits*: keep the defaults or tighten them; sign-in and password-reset endpoints are rate-limited by Supabase.
   - *URL Configuration*: **Site URL** = `https://hyrumhaircuts.com`; add `https://hyrumhaircuts.com/admin/reset-password` to **Redirect URLs**.
   - *SMTP*: configure a real SMTP provider so password-reset emails are reliably delivered (Supabase's built-in mailer is heavily rate-limited).
   - Optional: enable CAPTCHA (Turnstile/hCaptcha) for sign-in.
4. **Storage**: the migration creates the `site-media` bucket and policies. Confirm it under Storage (public, 50 MiB, allowed types image/jpeg, png, webp, video/mp4, webm). Free plans cap files at 50 MiB.
5. **Register the owner**, either way:
   - Dashboard → Authentication → Users → *Add user* (tick auto-confirm), then run [`supabase/bootstrap_owner.sql`](supabase/bootstrap_owner.sql) in the SQL editor; **or**
   - `SUPABASE_URL=… SUPABASE_SECRET_KEY=… OWNER_EMAIL=… node scripts/bootstrap-owner.mjs`
6. Run the Supabase **Security Advisor** (Dashboard → Advisors). Expected: no RLS-disabled tables, no exposed functions.

Data API note: the migrations grant only the minimum privileges explicitly and keep RLS enabled on every table, so they work whether or not "automatically expose new tables" is on.

### Owner hand-over and offboarding

The owner's Auth user id is baked into their content and file paths (`<owner-uuid>/…`), and `site_owner` allows only one row. **To hand the site to a different person, change the email and password of the *same* Auth user** (Dashboard → Authentication → Users → the user → update email / send password recovery). Do **not** create a second owner.

To lock someone out: Dashboard → Authentication → Users → *Sign out user* / change the password / ban the user. Storage and database access stops immediately for new requests; existing access tokens expire within the JWT lifetime (1 hour by default).

### Account recovery

Hyrum uses **"Forgot your password?"** on `/admin/login`. If the email is unreachable, the developer changes the email on the same Auth user, then triggers a recovery from the Dashboard.

---

## 4. Deploying to GitHub Pages

The site is published from the `main` branch by [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml): lint and unit tests must pass, then it builds and publishes `dist/`.

1. **Apply the migrations** to the Supabase project *before* the first deploy (`npx supabase link --project-ref <ref>` then `npx supabase db push`), and register the owner (section 3).
2. GitHub → repo **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public values, so use *Variables*, not *Secrets*. **Never a secret key.** Optional: `VITE_BASE_PATH` (default `/hyrumcuts/`), `VITE_SITE_URL` (default `https://p00rmans.github.io/hyrumcuts`).
4. Push to `main` (or run the workflow from the Actions tab). The site appears at https://p00rmans.github.io/hyrumcuts/.
5. Supabase → **Authentication → URL Configuration**: Site URL `https://p00rmans.github.io/hyrumcuts/`, and add `https://p00rmans.github.io/hyrumcuts/admin/reset-password` to Redirect URLs (password reset emails).

How GitHub Pages differs from a host with server config, and what the build does about it:

| Netlify feature | On GitHub Pages |
|---|---|
| `/admin/*` rewrite | `404.html` loads `spa-redirect.js` first, which sends any `/admin/...` address to `/admin/`; the admin restores it. Direct visits and refreshes of any admin URL work. |
| `_headers` CSP | The same policy is injected as a `<meta http-equiv="Content-Security-Policy">` tag in every page, plus a referrer-policy meta tag. |
| `X-Frame-Options: DENY` / `frame-ancestors` | Not possible in a meta tag; the admin refuses to run inside a frame instead (`admin/main.js`). |
| HSTS, `Permissions-Policy`, `no-store` on /admin | Not available. GitHub Pages serves HTTPS only. The admin is still `noindex`. |
| Netlify Forms | Replaced by the **Requests** inbox (Supabase table, insert-only for visitors). |
| Sub-path | Every root-relative link gets the base path at build time (`web/src/lib/base.js`, `vite.config.js`). |

Test a sub-path build locally: `MSYS_NO_PATHCONV=1 VITE_BASE_PATH=/hyrumcuts/ npm run build`, then serve `dist/` under `/hyrumcuts/` with any static server that returns `404.html` for missing files.

### Alternative: Netlify

1. Push this repository to GitHub and *Add new site → Import from Git* in Netlify.
2. Build settings are read from `netlify.toml` (`npm run build`, publish `dist`, Node 22).
3. Set these **Site configuration → Environment variables** (all four are public-safe):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_SLUG=hyrumhaircuts`, `VITE_SITE_URL=https://hyrumhaircuts.com`.
   **Do not add a secret key.**
4. Deploy. Then add the custom domain and HTTPS.
6. Deploy previews and branch deploys are automatically `noindex` (see below).

What `npm run build` generates for Netlify (`scripts/netlify-headers.js`):

- `_headers`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, a minimal `Permissions-Policy`, HSTS, and a **Content-Security-Policy limited to this site, your Supabase project (API + direct storage host) and Calendly**. `/admin/*` is `noindex` and `no-store`.
- On non-production contexts (`CONTEXT` ≠ `production`) every response is `X-Robots-Tag: noindex` and `robots.txt` disallows everything.
- `robots.txt` (disallows `/admin/`) and `sitemap.xml`.

`netlify.toml` rewrites `/admin/*` to the admin shell, so **direct visits and refreshes of any admin URL work**.

> Cache note: public content is fetched fresh on every load (no CDN caching of API data). Media files have unique names and are cached; replacing media uploads a new name, so nothing is ever stale.

---

## 5. Testing and verification

```bash
npm test               # 197 unit tests (config safety, URL rules, media validation, upload cleanup on failure, gallery filter/sort, settings validation, route guard, announcement scheduling, starter-content integrity…)
npm run lint
npm run db:start && npm run db:reset
npm run db:test        # pgTAP: 39 RLS/Storage assertions inside Postgres
npm run test:rls       # API-level: anon vs owner vs a second user; Storage; TUS resumable upload
npm run test:e2e       # Playwright (needs the local stack + a built preview)
npm audit
```

**Last full run** (2026-09-30, local Supabase, Windows 11, Edge): 197 unit tests, ESLint, production build (root and `/hyrumcuts/` base), `npm audit` (0 vulnerabilities), all 7 migrations applied by `db reset`, 39/39 pgTAP, 81/81 `test:rls` (including the Requests inbox and a 7 MB resumable upload), and 57 Playwright tests passing at desktop and phone size (1 phone-only test skipped on desktop by design). The `/hyrumcuts/` build was also checked by hand on a GitHub-Pages-like static server (deep admin links via 404.html, booking request into the inbox).

> Run `npm run test:e2e` against the **local** stack only. If your `.env` points at a hosted project, override it for that shell first: `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_PUBLISHABLE_KEY=<local publishable key from supabase status>` (variables already set in the environment take priority over `.env`).

`verify-security.mjs` and `security.test.sql` prove: visitors read published content; visitors cannot read drafts; visitors cannot mutate content; Hyrum manages his own content; a different signed-in user cannot manage Hyrum's rows, upload, or delete his files; the audit log, owner row and cleanup queue stay private.

---

## 6. Backup and restore

**Database**
```bash
npx supabase db dump --linked -f backup-$(date +%F).sql          # schema + policies
npx supabase db dump --linked --data-only -f data-$(date +%F).sql # content
```
Restore into a fresh project: `psql "$DB_URL" -f backup.sql` (then the data file), or `supabase db push` for the schema and `psql` for data. Supabase Pro adds daily backups and point-in-time recovery; the free plan has none, so schedule the dumps above.

**Storage**: the bucket is public-read, so files can be mirrored with any S3 client using Supabase's S3-compatible endpoint (Project Settings → Storage → S3 connection), e.g. `rclone sync supabase:site-media ./backup-media`. Database rows only store file *paths*, so back up both together.

---

## 7. Production launch checklist

- [ ] Real owner account created; temporary password changed via "Forgot password".
- [ ] Public sign-up **disabled** in Supabase Auth; password policy 12+ characters.
- [ ] SMTP configured; a password-reset email was received.
- [ ] Site URL and redirect URL set; `hyrumhaircuts.com` HTTPS live.
- [ ] GitHub repo variables set (no secret keys); Pages source is "GitHub Actions"; the deploy workflow succeeded.
- [ ] Supabase Auth Site URL and reset-password redirect point at the live address.
- [ ] Security Advisor shows no warnings; `npm run test:rls` passed on a scratch project.
- [ ] Real Calendly link entered in **Booking Link**; the Book buttons open it.
- [ ] Hero video + poster, profile photo, 12–24 photos, bio, contact and social links added ([`CONTENT_CHECKLIST.md`](CONTENT_CHECKLIST.md)).
- [ ] Every starter placeholder replaced or removed: the dashboard's **"Needs your attention"** list shows what is left (photos, `[Placeholder review]` quotes, `[Owner to review…]` FAQ answers, the biography, the portrait, the hero clip). Nothing marked `[Placeholder…]` should be live at launch.
- [ ] A test request sent from the live booking page shows up in **Requests**, then deleted.
- [ ] Backups scheduled.
- [ ] Lighthouse (mobile) run on the live URL.

Controls that depend on **Supabase / hosting settings** (not code): disabling sign-ups, password policy, SMTP, rate limits, CAPTCHA, JWT lifetime, backups, HSTS at the CDN, and form-spam filtering. This project cannot enforce those from the repository; the launch checklist above covers them.

---

## 8. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Admin says **"Setup needed"** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` missing at build time. Set them as GitHub repo variables (or in Netlify) and redeploy: Vite bakes them in at build. |
| Startup error mentions a *secret* / *service_role* key | A privileged key was put in a `VITE_*` variable. Remove it, use the publishable key, and rotate the leaked key. |
| Sign-in says "email and password don't match" | Wrong credentials, or the user doesn't exist. Generic on purpose. Check the user in the Dashboard. |
| Signed in but "This account can't manage the site" | That user isn't the registered owner. Run `bootstrap-owner`/`bootstrap_owner.sql` for the right email. |
| Saves fail with **"permission"** | RLS refused. You are signed in as a non-owner, or the session expired. Sign out/in. Check `site_owner` has a row. |
| "Your settings row is missing" | Owner was never bootstrapped (no `site_owner` row). Run the bootstrap. |
| Photo upload rejected | Only JPEG/PNG/WebP (real file contents, not just the name). **HEIC** must be converted (iPhone: Settings → Camera → Formats → Most Compatible). |
| Video upload fails / stalls | Free plan max object is 50 MiB; CMS hero limit is 50 MB. Files over 6 MB use resumable (TUS) uploads: check `connect-src` in the CSP includes `https://<ref>.storage.supabase.co`, and press **Save** again to resume after an interruption. |
| Images/videos blocked, console shows CSP errors | `VITE_SUPABASE_URL` at build time doesn't match the real project URL (the CSP is generated from it). Fix the variable and redeploy. |
| CORS errors | Wrong project URL, or calling a non-Supabase host. The API sends CORS headers for any origin; recheck the URL. |
| `/admin/...` shows "Page not found" on refresh | GitHub Pages: `404.html` must load `spa-redirect.js` first (it does in `web/404.html`). Netlify: `netlify.toml` not deployed, or the `/admin/*` rewrite was removed. |
| Live site has broken links or missing images, pointing at `/booking/` instead of `/hyrumcuts/booking/` | Built with the wrong `VITE_BASE_PATH`. It must match the repository name for a project site (`/hyrumcuts/`), or `/` on a custom domain. |
| The booking form says requests "aren't switched on yet" | No owner registered in this Supabase project, or the site was built without Supabase variables. |
| Booking form says "a lot of requests are coming in" | The site-wide flood limit (20 requests per 10 minutes) was hit, usually by a bot. It clears itself. |
| Public site shows only the default brand copy (none of Hyrum's edits) right after a deploy | The frontend expects a column the database doesn't have yet. Apply the pending migrations (`npx supabase db push`). |
| Public site shows the gallery error message | Supabase unreachable / paused (free projects pause after inactivity). Restore the project. The page still shows brand copy and Book buttons. |
| Reset email never arrives | SMTP not configured (built-in mailer is rate-limited) or the redirect URL isn't allow-listed. |
| Old file still visible after a replace | It shouldn't be: replacements use new file names. If a delete failed it is queued and retried the next time `/admin` opens. |
