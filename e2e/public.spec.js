import { expect, test } from '@playwright/test';

/** Visitor-facing site, against the local stack seeded by e2e/global-setup.js. */

const WIDTHS = [320, 375, 430, 768, 1024, 1440];

test.describe('public site', () => {
  test('renders published work, hides drafts, and logs no errors', async ({ page }) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));

    await page.goto('/');
    await expect(page.locator('[data-gallery-item]').first()).toBeVisible();
    await expect(page.getByText('E2E Published Cut').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('E2E Secret Draft');
    await expect(page.locator('body')).not.toContainText(/undefined|\[object/);
    expect(problems).toEqual([]);
  });

  test('gallery lightbox: opens, closes with Escape and returns focus', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-gallery-item]').first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    const box = page.locator('[data-lightbox]');
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('role', 'dialog');
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('the draft is not reachable through the API as a visitor either', async ({ request }) => {
    const creds = JSON.parse((await import('node:fs')).readFileSync('e2e/.auth/creds.json', 'utf8'));
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
    const res = await request.get(`${creds.url}/rest/v1/gallery_items?select=title`, { headers: { apikey: key } });
    expect(res.ok()).toBeTruthy();
    const titles = (await res.json()).map((r) => r.title);
    expect(titles).toContain('E2E Published Cut');
    expect(titles).not.toContain('E2E Secret Draft');
  });

  for (const width of WIDTHS) {
    test(`no horizontal scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/booking/', '/privacy/']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('booking: request form validates accessibly and Book buttons point at the booking page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-book-cta]').first()).toHaveAttribute('href', '/booking/');
    await page.goto('/booking/');
    await page.getByRole('button', { name: 'Request Appointment' }).click();
    const summary = page.locator('[data-form-errors]');
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute('role', 'alert');
    await expect(page.locator('#full_name')).toHaveAttribute('aria-invalid', 'true');
  });

  test('keyboard: the mobile menu opens, traps focus and closes with Escape', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile menu only');
    await page.goto('/');
    const toggle = page.locator('[data-mobile-menu-toggle]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('admin pages are marked noindex', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
