import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { buildHeaders, buildRobots, buildSitemap } from './scripts/netlify-headers.js';

const repoRoot = import.meta.dirname;
const webRoot = resolve(repoRoot, 'web');

/**
 * Lets HTML pages share the header and footer:  <!-- @include header.html -->
 * Files live in web/partials/. Runs before Vite processes the page, so the
 * included markup is bundled and hashed like any other HTML.
 */
function htmlPartials() {
  return {
    name: 'hyrumhaircuts:html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/<!--\s*@include\s+([\w./-]+)\s*-->/g, (_match, file) => {
          // Only plain file names inside web/partials/ (no path traversal).
          if (file.includes('..') || file.startsWith('/')) throw new Error(`Invalid partial: ${file}`);
          return readFileSync(resolve(webRoot, 'partials', file), 'utf8');
        });
      },
    },
  };
}

/**
 * `/admin/anything` is a client-side route. In dev and `vite preview` the
 * server must hand every extension-less admin URL to the admin shell, exactly
 * like the Netlify rewrite in netlify.toml does in production.
 */
function adminSpaFallback() {
  const rewrite = (req, _res, next) => {
    const url = (req.url ?? '').split('?')[0];
    if (url.startsWith('/admin') && !url.includes('.') && url !== '/admin/index.html') {
      req.url = '/admin/index.html';
    }
    next();
  };
  return {
    name: 'hyrumhaircuts:admin-spa-fallback',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

/**
 * Emits dist/_headers (security headers + a CSP limited to this project's own
 * Supabase origin), dist/robots.txt and dist/sitemap.xml. Generated at build time so the CSP can
 * never drift from VITE_SUPABASE_URL.
 */
function netlifyFiles(env) {
  // Netlify sets CONTEXT to production | deploy-preview | branch-deploy. Only production is indexable.
  const context = process.env.CONTEXT;
  const indexable = !context || context === 'production';
  return {
    name: 'hyrumhaircuts:netlify-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: buildHeaders(env.VITE_SUPABASE_URL, { indexable }) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots(env.VITE_SITE_URL, { indexable }) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(env.VITE_SITE_URL) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, 'VITE_');

  return {
    root: webRoot,
    envDir: repoRoot,
    publicDir: resolve(webRoot, 'public'),
    plugins: [htmlPartials(), adminSpaFallback(), netlifyFiles(env)],
    css: {
      postcss: {
        plugins: [tailwindcss(resolve(repoRoot, 'tailwind.config.js')), autoprefixer()],
      },
    },
    build: {
      outDir: resolve(repoRoot, 'dist'),
      emptyOutDir: true,
      // Fingerprinted output lives in /build so it never collides with /assets (images, fallback video).
      assetsDir: 'build',
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        input: {
          home: resolve(webRoot, 'index.html'),
          booking: resolve(webRoot, 'booking/index.html'),
          thanks: resolve(webRoot, 'booking/thanks/index.html'),
          privacy: resolve(webRoot, 'privacy/index.html'),
          notFound: resolve(webRoot, '404.html'),
          admin: resolve(webRoot, 'admin/index.html'),
        },
      },
    },
    // Own ports (not Vite's default 5173/4173) so this project never collides with other local dev servers.
    server: { host: '127.0.0.1', port: 5183, strictPort: true },
    preview: { host: '127.0.0.1', port: 4183, strictPort: true },
    test: {
      root: repoRoot,
      include: ['web/tests/**/*.test.js'],
      environment: 'node',
      restoreMocks: true,
      // Fake, non-secret values so client modules are "configured" under test.
      env: {
        VITE_SUPABASE_URL: 'https://test-project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_not_real',
        VITE_SITE_SLUG: 'hyrumhaircuts-test',
      },
    },
  };
});
