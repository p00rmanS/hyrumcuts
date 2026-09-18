# Third-Party Notices

This project intentionally uses almost no third-party code. This file lists everything that isn't original to the project, and one deliberate blocker that was **not** resolved automatically.

## Runtime dependencies

**None.** `composer.json` has zero `require` packages — the entire application (routing, templating, validation, sessions, CSRF, rate limiting, mail, uploads) is hand-written PHP with no framework, to keep the dependency surface minimal for a site this size.

## Development-only dependencies

| Package | Purpose | License |
|---|---|---|
| [`phpunit/phpunit`](https://phpunit.de/) | Automated test runner (dev only, not shipped to production) | BSD-3-Clause |
| [`tailwindcss`](https://tailwindcss.com/) (npm, build-time only) | Compiles `resources/css/app.css` into `public/assets/css/app.css`; not loaded from a CDN and not shipped as source | MIT |

## Fonts

No third-party or Google Fonts are loaded. The design uses local/system font stacks (`tailwind.config.js` → `fontFamily`) to avoid a third-party font request entirely. **See `CONTENT_CHECKLIST.md`** — if the client supplies a licensed display/body typeface, self-host the font files under `public/assets/fonts/` and update `tailwind.config.js` and `resources/css/app.css` with a local `@font-face` rule; do not link to fonts.googleapis.com without revisiting the CSP in `app/Core/Response.php`.

## Social icons

The build brief originally asked for Instagram/Facebook SVG icons from:

> `https://github.com/gauravghongde/social-icons`

**That repository has no `LICENSE` file, and the GitHub API reports its `license` field as `null`.** Under GitHub's Terms of Service, a public repository with no license is "all rights reserved" by default — viewing the code is permitted, but copying, modifying, or redistributing it (including its SVG assets) is not, absent explicit permission from the author. No files were taken from that repository.

**Resolution:** the Instagram and Facebook glyphs actually shipped come from [Simple Icons](https://github.com/simple-icons/simple-icons) instead, verified via the GitHub API to be licensed **CC0-1.0 (Creative Commons Zero / public domain)** — free to use, modify, and redistribute with no attribution required. The two files were downloaded from that project's `develop` branch, optimized with SVGO (appearance preserved), and committed at:

- `public/assets/icons/social/instagram.svg`
- `public/assets/icons/social/facebook.svg`

They're inlined by [`app/Views/partials/social-icons.php`](app/Views/partials/social-icons.php) (so `fill="currentColor"` can follow the link's hover/focus color) inside a link with a descriptive `aria-label` — e.g. "Visit HyrumHaircuts on Instagram" — and only render at all once a real profile URL is set in `/admin/settings`.

Note: Simple Icons' assets represent real brand marks. Normal "link to our profile" usage like this is exactly what they're intended for, but if the icons are ever recolored or resized in a way that distorts the mark, revisit each brand's own logo guidelines (Meta's brand resource center for Instagram/Facebook).

## Placeholder imagery

All development seed images (`public/assets/images/gallery/*.jpg`, `hero-poster.jpg`, `og-image.jpg`, `about-portrait.jpg`, `favicon*.png`) are generated locally by [`app/Core/PlaceholderImage.php`](app/Core/PlaceholderImage.php) and [`bin/generate-favicon.php`](bin/generate-favicon.php) at seed time — flat brand-color panels with a "PLACEHOLDER" label, drawn with PHP's GD extension. They are not photographs, are not AI-generated imagery presented as real clients or real work, and are not sourced from any third party. Replace them with Hyrum's real photos/video per `CONTENT_CHECKLIST.md` before launch.
