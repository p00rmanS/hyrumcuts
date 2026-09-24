import { h } from '../../lib/dom.js';
import { safeNextPath } from '../router.js';
import { checkOwner, sendPasswordReset, signIn, signOut } from '../services/auth.js';
import { uid, withBusy } from '../ui.js';

/** Sign in. No sign-up: the owner account is created by the developer. */
export default async function login({ query, navigate }) {
  // Already signed in as the owner? Skip the form.
  const existing = await checkOwner().catch(() => ({ user: null }));
  if (existing.user && !existing.reason) {
    await navigate(safeNextPath(query.get('next')), { replace: true, force: true });
    return h('div', {});
  }

  const emailId = uid('email');
  const passId = uid('password');
  const errorBox = h('div', { class: 'a-alert-error hidden mb-4', role: 'alert', tabindex: '-1' });
  const notice = query.get('reset') === 'done' ? h('div', { class: 'a-alert-ok mb-4', role: 'status' }, 'Your password was changed. Please sign in with the new one.') : null;
  const email = h('input', { id: emailId, name: 'email', type: 'email', class: 'a-input', autocomplete: 'username', required: true, inputmode: 'email', autocapitalize: 'none', spellcheck: 'false' });
  const password = h('input', { id: passId, name: 'password', type: 'password', class: 'a-input', autocomplete: 'current-password', required: true });
  const toggle = h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm mt-1', 'aria-pressed': 'false', onClick: () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.textContent = show ? 'Hide password' : 'Show password';
  } }, 'Show password');
  const submit = h('button', { type: 'submit', class: 'a-btn-primary w-full' }, 'Sign in');

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
    errorBox.focus();
  };

  const form = h(
    'form',
    { class: 'a-card', novalidate: true },
    notice,
    errorBox,
    h('div', { class: 'mb-4' }, h('label', { class: 'a-label', for: emailId }, 'Email'), email),
    h('div', { class: 'mb-5' }, h('label', { class: 'a-label', for: passId }, 'Password'), password, toggle),
    submit,
    h('p', { class: 'mt-4 text-center' }, h('button', { type: 'button', class: 'underline text-sm min-h-[44px]', onClick: () => showForgot() }, 'Forgot your password?')),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.classList.add('hidden');
    if (!email.value.trim() || !password.value) return showError('Enter your email and password.');
    await withBusy(submit, async () => {
      try {
        await signIn(email.value, password.value);
        const { reason } = await checkOwner({ force: true });
        if (reason === 'not-owner') {
          await signOut();
          return showError('That account can\'t manage this site.');
        }
        await navigate(safeNextPath(query.get('next')), { replace: true, force: true });
      } catch (error) {
        password.value = '';
        showError(error.message);
      }
      return undefined;
    }, 'Signing in…');
  });

  const wrap = h('div', { class: 'min-h-screen flex items-center justify-center p-4' }, h('div', { class: 'w-full max-w-sm' }, h('h1', { class: 'text-3xl text-center mb-1', tabindex: '-1', dataset: { pageTitle: '' } }, 'HyrumHaircuts'), h('p', { class: 'text-center text-muted mb-6' }, 'Sign in to manage your website'), form));

  function showForgot() {
    const fEmail = h('input', { id: uid('reset-email'), type: 'email', class: 'a-input', autocomplete: 'username', required: true, inputmode: 'email' });
    fEmail.value = email.value;
    const msg = h('div', { class: 'hidden mb-4', role: 'status' });
    const send = h('button', { type: 'submit', class: 'a-btn-primary w-full' }, 'Email me a reset link');
    const forgot = h(
      'form',
      { class: 'a-card', novalidate: true },
      h('h2', { class: 'text-xl mb-2' }, 'Reset your password'),
      h('p', { class: 'text-muted text-sm mb-4' }, 'Enter your email and we\'ll send a link to choose a new password.'),
      msg,
      h('div', { class: 'mb-4' }, h('label', { class: 'a-label', for: fEmail.id }, 'Email'), fEmail),
      send,
      h('p', { class: 'mt-4 text-center' }, h('button', { type: 'button', class: 'underline text-sm min-h-[44px]', onClick: () => wrap.querySelector('div').replaceChild(form, forgot) }, 'Back to sign in')),
    );
    forgot.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fEmail.value.trim()) return;
      await withBusy(send, async () => {
        try {
          await sendPasswordReset(fEmail.value);
          // Identical message whether or not the address has an account.
          msg.className = 'a-alert-ok mb-4';
          msg.textContent = 'If that email belongs to the site owner, a reset link is on its way. It can take a few minutes; check your spam folder too.';
        } catch (error) {
          msg.className = 'a-alert-error mb-4';
          msg.textContent = error.message;
        }
      }, 'Sending…');
    });
    wrap.querySelector('div').replaceChild(forgot, form);
    fEmail.focus();
  }

  return wrap;
}
