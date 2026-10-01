import { h } from '../../lib/dom.js';
import { passwordProblems, signOut, updatePassword, verifyCurrentPassword } from '../services/auth.js';
import { confirmDialog, pageHeader, toast, uid, withBusy } from '../ui.js';
import { toUrl } from '../../lib/base.js';

/** Change password and sign out. */
export default async function account({ user }) {
  const cur = h('input', { id: uid('cur'), type: 'password', class: 'a-input', autocomplete: 'current-password', required: true });
  const np = h('input', { id: uid('new'), type: 'password', class: 'a-input', autocomplete: 'new-password', required: true });
  const np2 = h('input', { id: uid('new2'), type: 'password', class: 'a-input', autocomplete: 'new-password', required: true });
  const err = h('div', { class: 'a-alert-error hidden mb-4', role: 'alert', tabindex: '-1' });
  const save = h('button', { type: 'submit', class: 'a-btn-primary' }, 'Change password');
  const show = (m) => {
    err.textContent = m;
    err.classList.remove('hidden');
    err.focus();
  };

  const form = h(
    'form',
    { class: 'a-card mb-6 max-w-lg', novalidate: true },
    h('h2', { class: 'text-xl mb-1' }, 'Change password'),
    h('p', { class: 'text-muted text-sm mb-4' }, 'Use at least 12 characters, with upper and lower case letters and a number.'),
    err,
    h('div', { class: 'mb-4' }, h('label', { class: 'a-label', for: cur.id }, 'Current password'), cur),
    h('div', { class: 'mb-4' }, h('label', { class: 'a-label', for: np.id }, 'New password'), np),
    h('div', { class: 'mb-5' }, h('label', { class: 'a-label', for: np2.id }, 'Type the new password again'), np2),
    save,
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    if (!cur.value) return show('Enter your current password.');
    const problems = passwordProblems(np.value);
    if (problems.length) return show(`Your new password needs ${problems.join(', ')}.`);
    if (np.value !== np2.value) return show('The two new passwords don\'t match.');
    await withBusy(save, async () => {
      try {
        await verifyCurrentPassword(user.email, cur.value);
        await updatePassword(np.value);
        form.reset();
        toast('Your password was changed.');
      } catch (error) {
        show(error.message);
      }
    }, 'Saving…');
    return undefined;
  });

  const signOutEverywhere = h(
    'button',
    {
      type: 'button',
      class: 'a-btn-secondary',
      onClick: async () => {
        const ok = await confirmDialog({ title: 'Sign out everywhere?', message: 'This signs you out on every phone and computer, including this one. Do this if you lose a device or think someone else knows your password.', confirmLabel: 'Sign out everywhere', danger: true });
        if (!ok) return;
        try {
          await signOut({ everywhere: true });
          location.assign(toUrl('/admin/login'));
        } catch (error) {
          toast(error.message, { type: 'error' });
        }
      },
    },
    'Sign out on all devices',
  );

  return h(
    'div',
    { class: 'a-page' },
    pageHeader('Password & security', `Signed in as ${user.email ?? 'the site owner'}.`),
    form,
    h('div', { class: 'a-card max-w-lg' }, h('h2', { class: 'text-xl mb-1' }, 'Sign out'), h('p', { class: 'text-muted text-sm mb-4' }, 'Signing out on a shared or borrowed device keeps your site safe.'), h('div', { class: 'flex flex-wrap gap-2' }, h('button', { type: 'button', class: 'a-btn-primary', onClick: async () => { await signOut(); location.assign(toUrl('/admin/login')); } }, 'Sign out'), signOutEverywhere)),
  );
}
