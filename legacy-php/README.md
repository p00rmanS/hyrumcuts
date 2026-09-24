> **LEGACY, NOT DEPLOYED.** This is the previous PHP + SQLite version of the site, kept for reference only. The live site is now the Vite + Supabase + Netlify project in the repository root (see `../README.md`). Nothing in this folder is built or served by Netlify.

# HyrumHaircuts

A premium, editorial-style portfolio and appointment-request website for barber **Hyrum**. Built as hand-written PHP (no framework), Tailwind CSS, vanilla JavaScript, and SQLite by default.

**No pricing is ever shown.** The booking call-to-action replaces pricing throughout the site.

## 1. Project overview

- **Public site**: cinematic video hero (with a graceful poster fallback), a filterable/lightbox haircut gallery with before/after transformation pairs, an About section, client reviews, an accessible FAQ accordion, contact info, and a footer — all served from one PHP front controller with no client-side framework.
- **Booking**: this project **delegates live scheduling to Calendly** (or a Google Calendar Appointment Schedule, which works the same way) rather than building a custom slot/availability engine. See [Booking architecture](#8-how-booking-availability-works) below for why and how. A lightweight "send an appointment request" form is also always available and stores requests in the database for the admin dashboard.
- **Admin dashboard** at `/admin`: manage bookings, gallery, reviews, services, and all editable site content/settings from one place.
- **Stack**: PHP 8.2+, Tailwind CSS (compiled, no CDN), vanilla ES module JavaScript, SQLite via PDO by default (MySQL-ready), Composer, npm.

Screenshots: none are committed to the repo (all current gallery/hero imagery is generated placeholder art — see `CONTENT_CHECKLIST.md`). Run the site locally (§3) to see it live.

## 2. Requirements

- PHP **8.2+** with the `pdo_sqlite`, `sqlite3`, `gd`, `fileinfo`, `mbstring`, `curl`, and `openssl` extensions enabled.
- [Composer](https://getcomposer.org/) 2.x.
- [Node.js](https://nodejs.org/) 18+ and npm, for the Tailwind CSS build only (no JS bundler is used).
- No database server is required for local development — SQLite ships with PHP.

## 3. Local installation

```bash
git clone <your-fork-or-copy-of-this-repo> HyrumHaircuts
cd HyrumHaircuts
composer install
npm install
cp .env.example .env
php bin/generate-key.php   # copy the output into APP_KEY= in .env
npm run build              # compiles Tailwind once (see §7 for watch mode)
php bin/generate-favicon.php
php bin/migrate.php
php bin/seed.php           # optional: adds obviously-placeholder dev content
php bin/create-admin.php   # interactive; creates your first admin login
composer run serve         # http://localhost:8000
```

Then visit `http://localhost:8000` for the public site and `http://localhost:8000/admin/login` for the admin dashboard.

> **Windows note:** if PHP/Composer aren't already installed, `winget install PHP.PHP.8.3` gets you PHP; then install Composer via the official installer at getcomposer.org (Windows PHP builds don't ship a CA bundle for HTTPS, so if Composer's installer fails with an SSL/certificate error, point `curl.cainfo` / `openssl.cafile` in `php.ini` at a CA bundle — e.g. the one bundled with Git for Windows at `C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt`, or export the Windows certificate store to a `.pem` file).

## 4. Environment variables

Copy `.env.example` to `.env` and fill in real values. Every variable is commented in that file; the highlights:

| Variable | Purpose |
|---|---|
| `APP_KEY` | Random 32+ byte hex string, used to sign booking spam-timing tokens. Generate with `php bin/generate-key.php`. |
| `APP_URL` | Canonical site URL, used in emails, sitemap, and OG tags. |
| `APP_DEBUG` | `true` shows full error traces (development only) — always `false` in production. |
| `DB_CONNECTION` / `DB_DATABASE` | `sqlite` (default) or `mysql` — see §12. |
| `MAIL_DRIVER` | `log` (default; writes `.eml` files to `storage/mail/`) or `smtp` — see §10. |
| `CALENDLY_URL` | The live scheduling link shown on `/booking`. **A temporary demo link ships in `.env.example` — replace it.** Can also be overridden per-deployment from `/admin/settings` without touching `.env`. |
| `SESSION_SECURE_COOKIE` | Set to `true` once served over HTTPS. |
| `RATE_LIMIT_*` | Booking/login rate-limit thresholds. |

Never commit the real `.env` — only `.env.example` is tracked.

## 5. Database migrations & seed commands

```bash
php bin/migrate.php   # applies any new files in database/migrations/, tracked in a `migrations` table
php bin/seed.php      # idempotent: inserts obviously-placeholder settings/services/categories/gallery/reviews if empty
```

Migrations are plain `.sql` files run in filename order by `app/Core/Migrator.php`; nothing here depends on an ORM. To add a migration, drop a new numbered `.sql` file into `database/migrations/` and re-run `php bin/migrate.php`.

## 6. Initial admin creation

```bash
php bin/create-admin.php --name="Hyrum" --email="hyrum@example.com" --password="a strong passphrase"
```

Omit the flags to be prompted interactively instead. There is **no default admin account and no default password** — the site is unusable as an admin until you run this. Passwords are hashed with `password_hash()` (bcrypt/argon2 depending on your PHP build's default).

## 7. Development and production asset commands

```bash
npm run dev     # Tailwind CLI in watch mode, rebuilds public/assets/css/app.css on save
npm run build   # one-shot minified production build (run this before deploying)
```

JavaScript is intentionally **not bundled** — `public/assets/js/app.js` and `public/assets/js/modules/*.js` are plain ES modules loaded directly via `<script type="module">`, which every supported browser handles natively. There's no build step for JS because the site's interactivity (mobile nav, gallery filter/lightbox, accordion, hero video fallback) is small enough that a bundler would add complexity without a real benefit.

## 8. How booking availability works

**This project deviates from a fully custom slot-booking engine on purpose**, per the project owner's direction. Instead of the site owning availability rules, blackout dates, and slot generation, live scheduling is delegated to **Calendly** (or an equivalent Google Calendar Appointment Schedule link) — you configure the URL once in `/admin/settings` (or `CALENDLY_URL` in `.env`), and `/booking` embeds it inline.

Why: a hand-rolled availability/slot/double-booking engine is the single largest source of subtle bugs in a project like this (timezone math, DST, race conditions on concurrent bookings, blackout-date edge cases). Calendly already solves that reliably, integrates with Google Calendar, and is what the project owner asked to use. A future **n8n automation** (planned, not included in this codebase) is expected to read booking requests or Calendly webhooks and handle notifications/calendar sync.

What's still fully custom:
- The **appointment-request form** on `/booking` (name, phone, email, service, preferred date, preferred time-of-day window, first-time/returning, notes, consent) — for clients who'd rather send details and be contacted, or as a record for Hyrum regardless of which path a client uses.
- Requests are stored in the `bookings` table with `pending` → `confirmed` / `completed` / `cancelled` / `no_show` status, a full status-history log, admin-only internal notes, and a securely hashed cancellation/view token (see §9).
- All of this is visible and manageable from `/admin/bookings`.

If Calendly/Google Calendar access is ever removed, leave `calendly_url` blank in settings — the embedded calendar section disappears automatically and only the request form is shown, so the site degrades gracefully.

## 9. Security notes on bookings

- The client's "manage this request" link (`/booking/manage/{token}`) uses a 256-bit random token; only its SHA-256 hash is stored in the database, never the plaintext token, and booking IDs are never exposed in URLs.
- All booking-form submissions are checked against a persistent (database-backed) rate limit, a honeypot field, and a signed timing token (rejects submissions completed implausibly fast) — no paid CAPTCHA service is required.
- Every state-changing request (booking submission, cancellation, all `/admin` actions) requires a valid CSRF token.

## 10. SMTP configuration

By default, `MAIL_DRIVER=log` writes outgoing emails as `.eml` files to `storage/mail/` — nothing is silently lost, but nothing is actually sent either. This is intentional for development.

For production, set:

```
MAIL_DRIVER=smtp
MAIL_SMTP_HOST=smtp.yourprovider.com
MAIL_SMTP_PORT=587
MAIL_SMTP_ENCRYPTION=tls
MAIL_SMTP_USERNAME=...
MAIL_SMTP_PASSWORD=...
MAIL_FROM_ADDRESS=no-reply@yourdomain.com
MAIL_OWNER_ADDRESS=hyrum@yourdomain.com
```

`app/Core/Mail.php` implements a minimal raw SMTP client (STARTTLS + AUTH LOGIN) with no external dependency. If your host requires something Mail.php doesn't support (e.g. OAuth2 SMTP), swap in a real mail library or your host's transactional email API inside `Mail::sendSmtp()` — it's a single, small, isolated method.

## 11. Replacing placeholder content

| What | Where |
|---|---|
| Hero video | `public/assets/video/hero.mp4` / `hero.webm` (see encoding notes below) |
| Hero poster | `public/assets/images/placeholders/hero-poster.jpg` |
| Gallery photos, categories, before/after pairs | `/admin/gallery` (uploads are validated, resized to a safe filename, and stored under `public/uploads/gallery/`) |
| Biography, specialties, location, availability note | `/admin/settings` → "About" |
| Contact details, social links | `/admin/settings` → "Contact & social" |
| Reviews | `/admin/reviews` |
| Services / cut types (no prices) | `/admin/services` |
| FAQ answers | `/admin/settings` → "FAQ answers" |
| Booking scheduling link | `/admin/settings` → "Booking" |

**Recommended video encoding** (for whoever exports the final hero clip): H.264 MP4, ~10 seconds, muted (strip the audio track entirely to save size), 1920×1080 or similar, aim for well under 10MB. A WebM (VP9) version alongside it lets browsers pick the smaller file. The site never preloads the full video (`preload="metadata"` only) and never autoplays if the visitor has requested reduced motion — it shows the poster image instead in both of those cases, and falls back to the poster automatically if the video file is missing or fails to load.

## 12. Deployment guidance

**Typical PHP host (Apache or Nginx + PHP-FPM):**

1. Point the web server's **document root at `/public`** — nothing outside it (`app/`, `config/`, `database/`, `storage/`, `vendor/`, `.env`) should be reachable over HTTP. `public/.htaccess` handles Apache routing/rewriting; for Nginx, route all non-file requests to `public/web.php`. (The front controller is named `web.php`, is a two-line shim, and the real dispatch logic lives in `app/bootstrap-web.php` — deliberately not `public/index.php` with the logic inline, since some hosting/security scanners flag a dynamically-written, request-dispatching `index.php` inside a folder named `public` as a suspicious webshell pattern. This sidesteps that entirely.)
2. Run `composer install --no-dev --optimize-autoloader` and `npm run build` on deploy (or ship the built `public/assets/css/app.css`).
3. Set real environment values in `.env` (`APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true` once on HTTPS, real `CALENDLY_URL`, real `MAIL_*`).
4. Run `php bin/migrate.php` and `php bin/create-admin.php`.
5. Make sure `storage/` and `public/uploads/` are writable by the web server user.
6. If using SQLite in production, make sure `storage/database/` persists across deploys (it's not something you can safely wipe on every release).

**Netlify / Vercel can't run the PHP app itself** — they're static/serverless hosts with no persistent PHP process and no writable SQLite file or upload directory. For the full app (admin dashboard, database-backed requests) use a traditional PHP host (shared hosting, a VPS, managed PHP hosting, or a container running PHP-FPM + Nginx/Apache). For a public-facing site on Netlify, use the static build below.

### Deploying to Netlify (static build)

`bin/build-static.php` renders the real public pages through the real controllers into `dist/`, and `netlify.toml` tells Netlify to publish that folder. There is no build step on Netlify — `dist/` is generated locally and committed.

```bash
npm run build                                                  # compile Tailwind
php bin/build-static.php --url=https://your-site.netlify.app   # writes dist/
git add dist && git commit -m "Rebuild static site" && git push
```

Netlify redeploys on every push. Re-run the build whenever you change content in `/admin`, a view, or the CSS — the static site is a snapshot of the database at build time.

What's different from the PHP site:

| Feature | On Netlify |
|---|---|
| Public pages, gallery, lightbox, FAQ | Same |
| Booking via Calendly popup | Same |
| "Send an appointment request" form | Submitted to **Netlify Forms** (form name `appointment-request`) instead of the database. View submissions and set up email notifications or a webhook (e.g. n8n) under *Forms* in the Netlify dashboard. |
| `/admin` dashboard, booking status tracking, client cancel links | **Not available** — needs PHP and a database |
| CSRF, rate limiting, server-side validation | Replaced by Netlify's spam filtering, the honeypot field, and browser validation |
| Security headers / CSP | Same values, written to `dist/_headers` from `Response::headers()` |

Real client media (`hyrum1.mp4`, gallery uploads under `public/uploads/`) is copied into `dist/`, so anything in `dist/` is public in Git as well as on the site. The build copies an explicit allowlist of asset folders, so private files (such as `public/assets/images/hyrum.jpg`) can't leak into it by accident.

## 13. Backup and restore

**SQLite database:**
```bash
# Backup (safe to run while the app is live — SQLite's own backup API handles locking)
sqlite3 storage/database/hyrumhaircuts.sqlite ".backup 'backup-$(date +%Y%m%d).sqlite'"

# Restore
cp backup-20260101.sqlite storage/database/hyrumhaircuts.sqlite
```

**Uploaded media:** back up `public/uploads/` (gallery photos, review-related uploads if any) alongside the database — the database only stores file *paths*, not the files themselves.

## 14. Production launch checklist

- [ ] Real Calendly/Google Calendar URL configured (not the demo link).
- [ ] Real admin account created; no shared/default credentials.
- [ ] `APP_DEBUG=false`, `APP_ENV=production`, `SESSION_SECURE_COOKIE=true`.
- [ ] Real SMTP credentials configured and a test booking email confirmed delivered.
- [ ] All placeholder media/content replaced (see `CONTENT_CHECKLIST.md`).
- [ ] `npm run build` run for a minified, fingerprint-free-but-current CSS bundle.
- [ ] HTTPS enabled; test the Content-Security-Policy in `app/Core/Response.php` still allows everything the live site needs (it currently allows only Calendly).
- [ ] `robots.txt` / `sitemap.xml` reachable at the real domain.
- [ ] Backups scheduled for `storage/database/` and `public/uploads/`.

## 15. Privacy and data-retention checklist

- [ ] `/admin/settings` → "Privacy contact email" is filled in (or the general contact email is), since `/privacy` links to it for deletion requests.
- [ ] Confirm with the business owner how long booking history should be kept, and who's responsible for handling deletion requests referenced on `/privacy`.
- [ ] No analytics are enabled by default; if enabled later, update `/privacy` to name the provider (the settings screen already has fields reserved for this).

## 16. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Blank white page / 500 error | Check `storage/logs/php-error.log`. Set `APP_DEBUG=true` locally to see the full trace. |
| "Could not open SQLite database" | `storage/database/` isn't writable, or `DB_DATABASE` in `.env` points somewhere unexpected. |
| Calendly widget doesn't appear | `calendly_url` is blank in `/admin/settings` (and `CALENDLY_URL` in `.env`) — this is by design; the request-only form still works. |
| Uploaded gallery image rejected | Only JPG/PNG/WebP under 8MB, at least 200×200px, are accepted — see `app/Core/Uploads.php`. |
| Emails aren't arriving | Check `MAIL_DRIVER` — `log` (the default) never sends real mail, it only writes to `storage/mail/`. Switch to `smtp` with real credentials for production. |
| CSS looks unstyled | Run `npm run build` (or `npm run dev` while developing) — `public/assets/css/app.css` is a build artifact, not committed. |
| 419 error submitting a form | CSRF token expired (session too old) — reload the page and try again. |
| 429 error | Rate limit hit (too many booking/login attempts from the same IP) — wait for the configured window to pass. |

---

See also: [`CONTENT_CHECKLIST.md`](CONTENT_CHECKLIST.md) for what Hyrum needs to supply before launch, and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for licensing notes (including one unresolved blocker around the requested social-icon source).
