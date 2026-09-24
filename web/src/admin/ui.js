import { h, mount } from '../lib/dom.js';
import { displayValue } from './validation/settings.js';

/**
 * Small UI kit for the admin: toasts, accessible dialogs, form fields,
 * busy buttons. Everything from the database or the owner is rendered as
 * text, never as HTML (see lib/dom.js).
 */

let idCounter = 0;
export const uid = (prefix = 'a') => `${prefix}-${(idCounter += 1)}`;

// ---------------------------------------------------------------------------
// Toasts + live announcements
// ---------------------------------------------------------------------------

let toastRoot;
function ensureToastRoot() {
  if (toastRoot?.isConnected) return toastRoot;
  toastRoot = h('div', { class: 'fixed inset-x-0 bottom-20 lg:bottom-6 z-[80] flex flex-col items-center gap-2 px-4 pointer-events-none', dataset: { toasts: '' } });
  document.body.appendChild(toastRoot);
  return toastRoot;
}

/**
 * Show a message that is also announced to screen readers.
 * Success/info are polite; errors are assertive and stay until dismissed.
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'info', timeout?: number }} [options]
 */
export function toast(message, { type = 'success', timeout } = {}) {
  const root = ensureToastRoot();
  const isError = type === 'error';
  const cls = { success: 'a-alert-ok', error: 'a-alert-error', info: 'a-alert-info' }[type];
  const close = () => el.remove();
  const el = h(
    'div',
    { class: `${cls} pointer-events-auto flex items-start gap-3 shadow-lg max-w-md w-full`, role: isError ? 'alert' : 'status', 'aria-live': isError ? 'assertive' : 'polite' },
    h('span', { class: 'flex-1' }, message),
    h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm -my-2 -mr-2', 'aria-label': 'Dismiss message', onClick: close }, '×'),
  );
  root.appendChild(el);
  const ms = timeout ?? (isError ? 0 : 4500);
  if (ms) setTimeout(close, ms);
  return close;
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: focus moves in, is trapped, Escape closes, the page
 * behind becomes inert, and focus returns to whatever opened it.
 *
 * @param {{ title: string, body: Node | string | Array<Node|string>, actions?: Array<{ label: string, variant?: 'primary'|'secondary'|'danger', onClick?: (api: any) => any, close?: boolean, autofocus?: boolean }>, onClose?: () => void, wide?: boolean }} options
 * @returns {{ close: () => void, el: HTMLElement }}
 */
export function openDialog({ title, body, actions = [], onClose, wide = false }) {
  const opener = document.activeElement;
  const titleId = uid('dlg-title');
  const bodyEl = h('div', { class: 'text-sm leading-relaxed space-y-3' }, body);
  const footer = h('div', { class: 'mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2' });

  const panel = h(
    'div',
    { class: `bg-paper w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-xl`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('h2', { id: titleId, class: 'text-xl mb-3' }, title),
    bodyEl,
    footer,
  );
  const overlay = h('div', { class: 'fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-ink/60 p-0 sm:p-4' }, panel);

  const inertTargets = [...document.body.children].filter((el) => !el.matches('[data-toasts]') && !['SCRIPT', 'STYLE'].includes(el.tagName));
  let closed = false;

  const api = {
    el: panel,
    close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      for (const el of inertTargets) el.removeAttribute('inert');
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
      onClose?.();
    },
  };

  for (const action of actions) {
    const btn = h(
      'button',
      {
        type: 'button',
        class: { primary: 'a-btn-primary', secondary: 'a-btn-secondary', danger: 'a-btn-danger' }[action.variant ?? 'secondary'],
        dataset: action.autofocus ? { autofocus: '' } : {},
        onClick: async () => {
          if (btn.disabled) return;
          btn.disabled = true;
          try {
            await action.onClick?.(api);
            if (action.close !== false) api.close();
          } finally {
            btn.disabled = false;
          }
        },
      },
      action.label,
    );
    footer.appendChild(btn);
  }
  if (actions.length === 0) footer.remove();

  function onKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      api.close();
    } else if (event.key === 'Tab') {
      const focusable = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  document.body.appendChild(overlay);
  for (const el of inertTargets) el.setAttribute('inert', '');
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) api.close();
  });
  // Safest default focus: the least destructive button, else the first control.
  (panel.querySelector('[data-autofocus]') ?? panel.querySelector(FOCUSABLE))?.focus();
  return api;
}

/**
 * Yes/no confirmation. Resolves true only on an explicit confirm.
 * @param {{ title: string, message: string | Node, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} options
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (value) => {
      answered = true;
      resolve(value);
    };
    openDialog({
      title,
      body: typeof message === 'string' ? h('p', {}, message) : message,
      onClose: () => {
        if (!answered) resolve(false);
      },
      actions: [
        { label: cancelLabel, variant: 'secondary', autofocus: true, onClick: () => answer(false) },
        { label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => answer(true) },
      ],
    });
  });
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/**
 * Run an async action from a button: disables it while running (so a second
 * tap can't submit twice), shows a busy label, and always restores it.
 * @param {HTMLButtonElement} button
 * @param {() => Promise<any>} action
 * @param {string} [busyLabel]
 */
export async function withBusy(button, action, busyLabel = 'Working…') {
  if (!button || button.dataset.busy === 'true') return undefined;
  const original = button.textContent;
  button.dataset.busy = 'true';
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = busyLabel;
  try {
    return await action();
  } finally {
    button.dataset.busy = 'false';
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = original;
  }
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

/**
 * Render one labelled field from a FieldSpec.
 * @returns {{ el: HTMLElement, input: HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement, get: () => string, setError: (msg?: string) => void }}
 */
export function field(spec, value = '', { name } = {}) {
  const id = uid('f');
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const shown = displayValue(spec, value);

  const common = { id, name: name ?? spec.key, 'aria-describedby': `${helpId} ${errId}` };
  let input;
  if (spec.type === 'textarea' || spec.type === 'lines') {
    input = h('textarea', { ...common, class: 'a-input', rows: spec.rows ?? (spec.type === 'lines' ? 5 : 4) });
    input.value = shown;
  } else if (spec.type === 'select') {
    input = h('select', { ...common, class: 'a-input' }, spec.options.map(([v, label]) => h('option', { value: v }, label)));
    input.value = shown;
  } else {
    const type = { url: 'url', email: 'email', tel: 'tel', date: 'date' }[spec.type] ?? 'text';
    input = h('input', { ...common, class: 'a-input', type, autocomplete: 'off', inputmode: spec.type === 'url' ? 'url' : undefined, spellcheck: spec.type === 'text' || spec.type === 'textarea' ? 'true' : 'false' });
    input.value = shown;
  }

  const help = [spec.help, spec.example ? `Example: ${spec.example}` : ''].filter(Boolean).join(' ');
  const error = h('p', { id: errId, class: 'a-error hidden', role: 'alert' });
  const counter = spec.max && spec.type !== 'select' && spec.type !== 'lines' ? h('p', { class: 'a-count', 'aria-hidden': 'true' }) : null;
  const updateCount = () => {
    if (counter) counter.textContent = `${input.value.length} / ${spec.max}`;
  };
  updateCount();
  input.addEventListener('input', () => {
    updateCount();
    if (input.getAttribute('aria-invalid') === 'true') setError('');
  });

  function setError(message) {
    error.textContent = message ?? '';
    error.classList.toggle('hidden', !message);
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  const el = h(
    'div',
    { class: 'mb-5' },
    h('label', { class: 'a-label', for: id }, spec.label, spec.required ? h('span', { class: 'text-muted font-normal' }, ' (required)') : null),
    input,
    h('p', { id: helpId, class: `a-help ${help ? '' : 'hidden'}` }, help),
    counter,
    error,
  );
  return { el, input, get: () => input.value, setError };
}

/** Build several fields and give back helpers to read values and show server-side errors. */
export function fieldGroup(specs, values = {}) {
  const fields = Object.fromEntries(specs.map((s) => [s.key, field(s, values[s.key] ?? '')]));
  return {
    els: specs.map((s) => fields[s.key].el),
    fields,
    values: () => Object.fromEntries(specs.map((s) => [s.key, fields[s.key].get()])),
    showErrors(errors) {
      let first = null;
      for (const s of specs) {
        fields[s.key].setError(errors[s.key] ?? '');
        if (errors[s.key] && !first) first = fields[s.key].input;
      }
      first?.focus();
      return Boolean(first);
    },
    clearErrors() {
      for (const s of specs) fields[s.key].setError('');
    },
  };
}

/** A labelled checkbox row. */
export function checkbox({ label, help, checked = false, name }) {
  const id = uid('cb');
  const input = h('input', { type: 'checkbox', id, name, class: 'mt-1 h-6 w-6 shrink-0 accent-[#111]' });
  input.checked = checked;
  return {
    input,
    el: h('div', { class: 'flex items-start gap-3 mb-4' }, input, h('label', { for: id, class: 'text-sm' }, h('span', { class: 'font-semibold' }, label), help ? h('span', { class: 'block text-muted' }, help) : null)),
  };
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

export function pageHeader(title, subtitle, actions) {
  return h(
    'div',
    { class: 'mb-6 flex flex-wrap items-start justify-between gap-3' },
    h('div', {}, h('h1', { class: 'a-h1', tabindex: '-1', dataset: { pageTitle: '' } }, title), subtitle ? h('p', { class: 'text-muted' }, subtitle) : null),
    actions ? h('div', { class: 'flex flex-wrap gap-2' }, actions) : null,
  );
}

export function emptyState({ title, message, action }) {
  return h('div', { class: 'a-card text-center py-10' }, h('h2', { class: 'text-xl mb-2' }, title), h('p', { class: 'text-muted mb-5 max-w-md mx-auto' }, message), action ?? null);
}

export function errorPanel(error, onRetry) {
  return h(
    'div',
    { class: 'a-alert-error', role: 'alert' },
    h('p', { class: 'font-semibold mb-1' }, 'Something went wrong'),
    h('p', {}, error?.message ?? 'Please try again.'),
    onRetry ? h('button', { type: 'button', class: 'a-btn-secondary mt-3', onClick: onRetry }, 'Try again') : null,
  );
}

export function loading(label = 'Loading…') {
  return h('div', { class: 'a-page', role: 'status', 'aria-live': 'polite' }, h('div', { class: 'a-skeleton h-8 w-48 mb-4' }), h('div', { class: 'a-skeleton h-24 w-full mb-3' }), h('div', { class: 'a-skeleton h-24 w-full' }), h('span', { class: 'sr-only' }, label));
}

export function statusBadge(item) {
  if (item.archived_at) return h('span', { class: 'a-badge-archived' }, 'Archived');
  return item.is_published ? h('span', { class: 'a-badge-live' }, 'Published') : h('span', { class: 'a-badge-draft' }, 'Draft');
}

export function timeAgo(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const units = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
  ];
  let value = seconds;
  let label = 'second';
  for (const [size, name] of units) {
    if (seconds >= size) {
      value = Math.floor(seconds / size);
      label = name;
    }
  }
  if (label === 'week' && value >= 5) return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${value} ${label}${value === 1 ? '' : 's'} ago`;
}

export { h, mount };

/**
 * Unsaved-changes tracking for a form. Returns { isDirty, markClean, dispose }.
 * Registers a guard so navigating away (or closing the tab) asks first.
 */
export function trackDirty(root, { setGuard }) {
  let dirty = false;
  const mark = () => {
    dirty = true;
    indicator.textContent = 'Unsaved changes';
    indicator.className = 'text-sm font-semibold text-amber-900';
  };
  const indicator = h('p', { class: 'text-sm text-muted', role: 'status', 'aria-live': 'polite' }, 'All changes saved');
  root.addEventListener('input', mark);
  root.addEventListener('change', mark);
  setGuard(() => dirty);
  return {
    indicator,
    isDirty: () => dirty,
    markClean() {
      dirty = false;
      indicator.textContent = 'Saved ✓';
      indicator.className = 'text-sm text-green-900 font-semibold';
    },
    markDirty: mark,
    dispose: () => setGuard(null),
  };
}
