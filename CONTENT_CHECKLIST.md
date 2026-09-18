# Content Checklist — What Hyrum Needs to Provide Before Launch

Everything on the live site today (bio, photos, reviews, contact info) is an obviously-fake development placeholder. Nothing below was invented as if it were real — it's either blank (hidden automatically) or clearly labeled as a placeholder. Here's what's needed to replace it, and exactly where each item goes.

## Media

- [ ] **Landscape cutting video**, ~10 seconds, muted-friendly (no audio needed), ideally 1920×1080 or wider. Export as both `hero.mp4` (H.264) and `hero.webm` if possible. Place at `public/assets/video/hero.mp4` / `hero.webm`. See README "Replacing the hero video" for exact encoding recommendations.
- [ ] **Hero poster image** — a single strong still frame from the video, 1600×900 or larger. Replace `public/assets/images/placeholders/hero-poster.jpg`.
- [ ] **12–24 strong haircut photos**, ideally the original uncompressed files (the admin gallery tool will resize/optimize on upload). A mix of portrait, square, and landscape shots so the grid doesn't look repetitive.
- [ ] **Before/after pairs**, clearly labeled which photo is which, for the Transformations category.
- [ ] **A real portrait of Hyrum** for the About section. Replace `public/assets/images/placeholders/about-portrait.jpg`.
- [ ] **Logo/wordmark preference** — right now the header/footer just render the brand name as text. If there's a real logo, supply an SVG or high-res PNG.
- [ ] **Favicon source** — a simple square mark works best. Replace `public/assets/images/favicon.png` (512×512) and regenerate a real multi-size `.ico` (see README).
- [ ] **Social preview image** for link previews (Open Graph), 1200×630. Replace `public/assets/images/placeholders/og-image.jpg`.

## Gallery content

- [ ] Confirm or adjust the gallery categories (currently: Fades, Tapers, Textured, Long Hair, Beards, Transformations) — editable in `/admin/gallery`.
- [ ] Confirm the service/cut type list (currently generic placeholders: Classic Haircut, Skin Fade, Taper Fade, Textured Crop, Beard Trim & Lineup, Haircut + Beard Combo, Kids Haircut) — editable in `/admin/services`. No prices are ever shown; this list only feeds the booking form.

## About Hyrum

- [ ] Approved biography text (a safe generic placeholder is live now) — editable in `/admin/settings`.
- [ ] Specialties (left blank/hidden until provided).
- [ ] Preferred city / general service area, and whether a full street address may be shown publicly.
- [ ] Availability note (e.g. "Tuesday–Saturday") and preferred contact method.

## Contact & social

- [ ] Business phone number.
- [ ] Business email address.
- [ ] Instagram profile URL.
- [ ] Facebook profile URL.
- [ ] Google Maps (or similar) link, if directions should be offered.

## Scheduling

- [ ] **Calendly URL (or a Google Calendar Appointment Schedule link, which works the same way).** A temporary demo link (`https://calendly.com/jamesbaldwindean2026/new-meeting`) is currently configured in `/admin/settings` and `.env` — **replace this with Hyrum's real scheduling link before launch.** Until replaced, the site is not booking against Hyrum's real calendar.
- [ ] Preferred time-of-day windows shown on the request-only form (currently: Morning / Early afternoon / Late afternoon / Evening) — editable in `/admin/settings`.
- [ ] Cancellation/rescheduling policy text — editable in `/admin/settings`, also feeds the FAQ answer.
- [ ] SMS/text confirmation: the site never claims to send a text unless a real SMS provider is wired up (it isn't, by default). Decide whether text confirmations happen manually or via a future integration.

## Reviews

- [ ] Real client reviews, with permission to publish, to replace the three `[Placeholder review]`-labeled entries. Add/edit in `/admin/reviews`; only approved reviews are shown.

## FAQ

- [ ] Two FAQ answers are explicitly marked `[Owner to review: ...]` in the seed data (what to bring as a reference photo, and the reschedule/cancellation policy) — fill these in via `/admin/settings`.

## Legal / privacy

- [ ] A contact email or process for privacy/data-deletion requests (`privacy_contact_email` in settings; falls back to the general contact email if blank).
- [ ] Confirm the data-retention approach described in `/privacy` matches what the business actually wants to do with booking history.

## Automation (planned, not yet built)

- [ ] The brief mentions an **n8n automation** will be added soon (e.g., to notify Hyrum of new requests, sync confirmed bookings to Google Calendar, or read Calendly webhooks). No n8n workflow is included in this project — coordinate the integration point (likely the admin bookings list, or a small JSON export endpoint) when that's ready.

## Hosting

- [ ] Desired domain name.
- [ ] Production hosting details (a standard PHP/Apache or Nginx host with SQLite or MySQL — see README "Deployment").
