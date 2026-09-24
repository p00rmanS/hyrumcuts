import { h } from '../../lib/dom.js';
import { getVerifiedUser, passwordProblems, signOut, updatePassword } from '../services/auth.js';
import { uid, withBusy } from '../ui.js';

/**
 * Landing page for the emailed reset link. supabase-js exchanges the link's
 * one-time code for a short session automatically; this page only works while
 * that recovery session exists.
 */
export default async function resetPassword({ navigate }) {
  // The code exchange happens asynchronously on page load; give it a moment.
  let user = null;
  for (let i = 0; i < 12 && !user; i += 1) {
    user = await getVerifiedUser().catch(() => null);
    if (!user) await new Promise((r) => setTimeout(r, 250));
  }

  if (!user) {
    return h(
      'div',
      { class: 'min-h-screen flex items-center justify-center p-4' },
      h(
        'div',
        { class: 'a-card max-w-sm w-full' },
        h('h1', { class: 'text-2xl mb-3', tabindex: '-1', dataset: { pageTitle: '' } }, 'This link has expired'),
        h('p', { class: 'text-muted mb-5' }, 'Reset links only work once and for a short time. Request a new one from the sign-in page.'),
        h('a', { href: '/admin/login', class: 'a-btn-primary w-full' }, 'Back to sign in'),
      ),
    );
  }

  const pw = h('input', { id: uid('np'), type: 'password', class: 'a-input', autocomplete: 'new-password', required: true });
  const pw2 = h('input', { id: uid('np2'), type: 'password', class: 'a-input', autocomplete: 'new-password', required: true });
  const err = h('div', { class: 'a-alert-error hidden mb-4', role: 'alert', tabindex: '-1' });
  const submit = h('button', { type: 'submit', class: 'a-btn-primary w-full' }, 'Save new password');
  const show = (m) => {
    err.textContent = m;
    err.classList.remove('hidden');
    err.focus();
  };

  const form = h(
    'form',
    { class: 'a-card max-w-sm w-full', novalidate: true },
    h('h1', { class: 'text-2xl mb-1', tabindex: '-1', dataset: { pageTitle: '' } }, 'Choose a new password'),
    h('p', { class: 'text-muted text-sm mb-4' }, 'Use at least 12 characters, with upper and lower case letters and a number.'),
    err,
    h('div', { class: 'mb-4' }, h('label', { class: 'a-label', for: pw.id }, 'New password'), pw),
    h('div', { class: 'mb-5' }, h('label', { class: 'a-label', for: pw2.id }, 'Type it again'), pw2),
    submit,
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    const problems = passwordProblems(pw.value);
    if (problems.length) return show(`Your password needs ${problems.join(', ')}.`);
    if (pw.value !== pw2.value) return show('The two passwords don\'t match.');
    await withBusy(submit, async () => {
      try {
        await updatePassword(pw.value);
        await signOut();
        await navigate('/admin/login?reset=done', { replace: true, force: true });
      } catch (error) {
        show(error.message);
      }
    }, 'Saving…');
    return undefined;
  });

  return h('div', { class: 'min-h-screen flex items-center justify-center p-4' }, form);
}
