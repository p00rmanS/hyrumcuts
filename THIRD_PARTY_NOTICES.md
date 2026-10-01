# Third-party notices

Versions are pinned exactly in `package.json` and locked in `package-lock.json`. Licences below were read from the installed packages. `npm audit` reports 0 known vulnerabilities at the time of writing.

## Runtime dependencies (shipped to browsers)

| Package | Version | Licence | Used for |
|---|---|---|---|
| [`@supabase/postgrest-js`](https://github.com/supabase/supabase-js) | 2.116.0 | MIT | Public site reads (small, no auth code) |
| [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) | 2.116.0 | MIT | Admin: auth, database, Storage (admin bundle only) |
| [`tus-js-client`](https://github.com/tus/tus-js-client) | 4.3.1 | MIT | Resumable video uploads (admin bundle only, loaded on demand) |
| [`sortablejs`](https://github.com/SortableJS/Sortable) | 1.15.7 | MIT | Touch-friendly drag-and-drop reordering (admin only) |

## Build and test tooling (not shipped)

`vite` 8.3.0, `tailwindcss` 3.4.19, `postcss` 8.5.28, `autoprefixer` 10.6.1, `vitest` 5.0.1, `eslint` 10.11.0, `@eslint/js` 10.0.1, `globals` 17.12.0: **MIT**. `@playwright/test` 1.63.0: **Apache-2.0**. `supabase` (CLI) 2.117.0: **MIT**.

## Icons

The Instagram and Facebook glyphs (`web/src/assets/icons/`) come from [Simple Icons](https://github.com/simple-icons/simple-icons), licensed **CC0-1.0** (public domain), verified before use. They represent real brand marks and are used only as links to Hyrum's own profiles; if they are ever recoloured or distorted, check Meta's brand guidelines.

The repository originally requested was `gauravghongde/social-icons`. It has **no licence** (all rights reserved by default), so nothing was taken from it.

## Fonts

No web fonts are downloaded. The design uses local system font stacks (see `tailwind.config.js`), so there is no third-party font request. If a licensed typeface is supplied later, self-host it and update the CSP in `scripts/netlify-headers.js`.

## Media

- `web/public/assets/video/hyrum1.mp4` is Hyrum's own footage, carried over from the previous site as the **starter hero clip** until he uploads a replacement in the CMS.
- `web/public/assets/images/gallery/*.jpg` (13 portfolio placeholders), `placeholders/about-portrait.jpg`, `hero-poster.jpg` and `og-image.jpg`, and the favicons, are **generated placeholder art** (flat brand-colour panels with a label), not photographs and not third-party work. They ship as the site's starter content (loaded into Storage by `scripts/seed-starter-content.mjs`, or served from the bundle when no backend is connected) and are replaced from `/admin`. No real photographs of clients are bundled.

## Third-party services

Supabase (database, auth, storage, and the appointment-request inbox), GitHub Pages (hosting; Netlify is also supported) and Calendly (booking widget, loaded only when a Calendly link is configured, and only after a visitor shows intent to book). No analytics or tracking scripts are used.
