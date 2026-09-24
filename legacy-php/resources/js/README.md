# Front-end JavaScript

This project ships **vanilla, unbundled ES modules** — there is no JS build step. The source files that run in the browser live directly under [`public/assets/js/`](../../public/assets/js/) (`app.js` plus `modules/*.js`) and are loaded with `<script type="module">`, which every currently-supported browser handles natively.

This directory exists to match the project structure in the build brief, but there's nothing to compile: edit the files in `public/assets/js/` directly. Only CSS goes through an npm build step (Tailwind — see `package.json` and the README's "Development and production asset commands" section).
