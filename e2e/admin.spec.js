import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { solidPng } from '../scripts/lib/png.mjs';

/**
 * The owner's journeys, at desktop and phone size, against the local stack.
 * Runs in order: later tests rely on work created by earlier ones.
 */
const creds = () => JSON.parse(readFileSync('e2e/.auth/creds.json', 'utf8'));

async function signIn(page, email, password) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Sign in as the owner and wait until the dashboard is really there (a click alone is not "signed in"). */
async function signInAsOwner(page) {
  await signIn(page, creds().ownerEmail, creds().password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function signOut(page, isMobile) {
  if (isMobile) await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  // (On a phone the "More" drawer is also a dialog, so pick the confirmation by its title.)
  await page.getByRole('dialog', { name: 'Sign out?' }).getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

test.describe.serial('admin', () => {
  test('signed-out visitors are sent to the login page, including on a direct refresh', async ({ page }) => {
    for (const path of ['/admin', '/admin/portfolio', '/admin/portfolio/add', '/admin/settings/booking']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login\?next=/);
      await expect(page.getByRole('heading', { name: 'HyrumHaircuts' })).toBeVisible();
    }
  });

  test('a wrong password gives one generic message, and there is no sign-up', async ({ page }) => {
    await signIn(page, creds().ownerEmail, 'Definitely-Wrong-1234');
    await expect(page.getByRole('alert')).toContainText(/don't match/i);
    await page.goto('/admin/login');
    await expect(page.getByText(/sign up|create account|register/i)).toHaveCount(0);
  });

  test('a second signed-in user who is not the owner cannot manage the site', async ({ page }) => {
    await signIn(page, creds().otherEmail, creds().password);
    // Valid Supabase credentials, but not the registered owner: signed straight back out.
    await expect(page.getByRole('alert')).toContainText(/can't manage this site/i);
    await expect(page).toHaveURL(/\/admin\/login/);
    // ...and every admin page stays locked.
    for (const path of ['/admin', '/admin/portfolio', '/admin/settings/contact']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });

  test('the owner signs in, the session survives a refresh, and admin URLs work directly', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/admin/portfolio');
    await expect(page.getByRole('heading', { name: 'Manage work' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Manage work' })).toBeVisible();
    await expect(page.getByText('E2E Secret Draft')).toBeVisible(); // the owner sees drafts
  });

  test('uploads a photo, publishes it, and it appears publicly on the next load', async ({ page, browser }) => {
    await signInAsOwner(page);
    await page.goto('/admin/portfolio/add');
    await page.locator('#panel-photos input[type=file]').setInputFiles({ name: 'IMG_2041-fresh_fade.png', mimeType: 'image/png', buffer: solidPng(900, 1200, [70, 60, 50]) });

    await expect(page.locator('#panel-photos').getByLabel(/^Title/)).toBeVisible();
    await expect(page.locator('#panel-photos').getByLabel(/^Title/)).toHaveValue('IMG 2041 fresh fade'); // default title from the file name
    await page.locator('#panel-photos').getByLabel(/^Title/).fill('E2E Uploaded Fade');

    // Publishing needs alt text: try without it first.
    await page.locator('#panel-photos').getByLabel('Publish now').check();
    await page.locator('#panel-photos').getByRole('button', { name: /Save (all|this photo)/ }).click();
    await expect(page.getByText(/alt text/i).first()).toBeVisible();

    await page.locator('#panel-photos').getByLabel(/Alt text/).fill('A fresh fade seen from the side');
    await page.locator('#panel-photos').getByRole('button', { name: /Save (all|this photo)/ }).click();
    await expect(page.getByText('Saved and published')).toBeVisible({ timeout: 30_000 });

    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto('/');
    await expect(pub.getByText('E2E Uploaded Fade').first()).toBeVisible();
    await visitor.close();
  });

  test('saves a draft that visitors cannot see', async ({ page, browser }) => {
    await signInAsOwner(page);
    await page.goto('/admin/portfolio/add');
    await page.locator('#panel-photos input[type=file]').setInputFiles({ name: 'draft.png', mimeType: 'image/png', buffer: solidPng(900, 1200, [20, 20, 20]) });
    await page.locator('#panel-photos').getByLabel(/^Title/).fill('E2E Second Draft');
    await page.locator('#panel-photos').getByRole('button', { name: /Save (all|this photo)/ }).click();
    await expect(page.getByText('Saved as a draft')).toBeVisible({ timeout: 30_000 });

    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto('/');
    await pub.waitForLoadState('networkidle');
    await expect(pub.locator('body')).not.toContainText('E2E Second Draft');
    await visitor.close();
  });

  test('rejects a file that is not really an image', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/admin/portfolio/add');
    await page.locator('#panel-photos input[type=file]').setInputFiles({ name: 'totally-a-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('MZ\x90\x00 this is really a program, not a photo') });
    await expect(page.getByRole('alert').filter({ hasText: /isn't a JPEG, PNG or WebP/i })).toBeVisible();
  });

  test('reorders work with the keyboard-accessible buttons, and the order is saved', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/admin/portfolio');
    await expect(page.getByText('E2E Published Cut').first()).toBeVisible(); // wait for the list to load
    const titles = async () => page.locator('ul[aria-label="Portfolio"] li a.font-semibold').allInnerTexts();
    const before = await titles();
    expect(before.length).toBeGreaterThan(1);
    await page.getByRole('button', { name: /^Move .* down$/ }).first().click();
    await expect.poll(titles).not.toEqual(before);
    const moved = await titles();
    await page.reload();
    await expect(page.getByText('E2E Published Cut').first()).toBeVisible(); // wait for the list to load again
    expect(await titles()).toEqual(moved); // the new order was really saved
  });

  test('edits settings, and the public site shows the change on the next load', async ({ page, browser }) => {
    await signInAsOwner(page);
    await page.goto('/admin/settings/contact');
    await page.getByLabel(/^Phone number/).fill('(801) 555-0199');
    await page.getByLabel(/^Public email address/).fill('e2e@example.test');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved. Your website will show this')).toBeVisible();

    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto('/');
    await expect(pub.locator('[data-contact]').getByText('(801) 555-0199')).toBeVisible();
    await visitor.close();

    // Validation: a bad address is refused with a clear message by the field.
    await page.getByLabel(/^Public email address/).fill('not-an-email');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/full email address/i)).toBeVisible();
  });

  test('posts an announcement, schedules it, and turns it off again', async ({ page, browser, isMobile }) => {
    await signInAsOwner(page);
    await page.goto('/admin/content/announcement');
    await expect(page.getByText(/Status: Off/)).toBeVisible();
    await page.getByLabel(/^Message/).fill('E2E: away next week');
    await expect(page.getByText(/Status: Showing now/)).toBeVisible(); // updates live, before saving
    // Desktop saves with the keyboard shortcut; phones use the button.
    if (isMobile) await page.getByRole('button', { name: 'Save changes' }).click();
    else await page.keyboard.press('Control+s');
    await expect(page.getByText('Saved. Your website will show this')).toBeVisible();

    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto('/booking/');
    const bar = pub.locator('[data-announcement]');
    await expect(bar).toContainText('E2E: away next week');
    await pub.getByRole('button', { name: 'Dismiss announcement' }).click();
    await expect(bar).toBeHidden();

    // Scheduled for the future: gone from the site, and the admin says so.
    await page.getByLabel(/^Show from/).fill('2099-01-05');
    await expect(page.getByText(/Status: Scheduled/)).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved. Your website will show this')).toBeVisible();
    const fresh = await browser.newContext();
    const pub2 = await fresh.newPage();
    await pub2.goto('/');
    await expect(pub2.locator('[data-gallery-item]').first()).toBeVisible();
    await expect(pub2.locator('[data-announcement]')).toBeHidden();
    await visitor.close();
    await fresh.close();

    // Leave the site as it was for the next run.
    await page.getByLabel(/^Message/).fill('');
    await page.getByLabel(/^Show from/).fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/Status: Off/)).toBeVisible();
  });

  test('a visitor sends an appointment request and the owner handles it in Requests', async ({ page, browser }) => {
    const name = `E2E Visitor ${Date.now()}`;
    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto('/booking/');
    await pub.locator('#full_name').fill(name);
    await pub.locator('#phone').fill('(801) 555-0177');
    await pub.locator('#email').fill('visitor@example.test');
    await pub.locator('#client_type').selectOption('first_time');
    await pub.locator('#preferred_date').fill('2030-03-14');
    const slot = pub.locator('#preferred_time_slot');
    if (await slot.isEnabled()) await slot.selectOption({ index: 1 });
    await pub.locator('#consent').check();
    await pub.getByRole('button', { name: 'Request Appointment' }).click();
    await expect(pub).toHaveURL(/\/booking\/thanks\/$/);
    await visitor.close();

    await signInAsOwner(page);
    await expect(page.getByText(/new appointment request/)).toBeVisible(); // dashboard alert
    await page.goto('/admin/requests');
    const card = page.locator('article').filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:8015550177');
    await card.getByRole('button', { name: 'Mark contacted' }).click();
    await expect(card.getByText('Contacted', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();
    await expect(card).toHaveCount(0);
  });

  test('searches Manage Work, and the search survives a refresh', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/admin/portfolio');
    await page.getByLabel('Search').fill('secret draft');
    await expect(page.getByText(/Showing 1 of \d+/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Secret Draft' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Published Cut' })).toHaveCount(0);
    await expect(page).toHaveURL(/q=secret\+draft/);
    await page.reload();
    await expect(page.getByLabel('Search')).toHaveValue('secret draft');
    await expect(page.getByText(/Showing 1 of \d+/)).toBeVisible();
  });

  test('warns before leaving a form with unsaved changes', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/admin/settings/social');
    await page.getByLabel(/^Instagram link/).fill('instagram.com/e2e');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    // Whichever link to another admin page is visible in this layout (sidebar on desktop, tab bar on a phone).
    const leave = () => page.locator('a[href="/admin/portfolio"]:visible').first().click();

    await leave();
    const dialog = page.getByRole('dialog', { name: /Leave without saving/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/settings\/social/);
    await expect(page.getByLabel(/^Instagram link/)).toHaveValue('instagram.com/e2e'); // nothing was lost

    await leave();
    await page.getByRole('dialog', { name: /Leave without saving/ }).getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page).toHaveURL(/\/admin\/portfolio/);
  });

  test('replaces the hero video and poster', async ({ page, browser }) => {
    test.setTimeout(120_000);
    await signInAsOwner(page);
    await page.goto('/admin/media/hero');
    await page.locator('input[type=file][accept*="video"]').setInputFiles('web/public/assets/video/hyrum1.mp4');
    await expect(page.getByRole('button', { name: 'Save hero media' })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Save hero media' }).click();
    await expect(page.getByText(/Saved\. Your new hero media/)).toBeVisible({ timeout: 60_000 });

    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto('/');
    await expect(pub.locator('[data-hero-video] source')).toHaveAttribute('src', /storage\/v1\/object\/public\/site-media\/.+\/hero\//);
    await visitor.close();
  });

  test('signs out, and admin pages are locked again', async ({ page, isMobile }) => {
    await signInAsOwner(page);
    await signOut(page, isMobile);
    await page.goto('/admin/portfolio');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
