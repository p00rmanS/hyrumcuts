import { h } from '../../lib/dom.js';
import { CLIENT_TYPE_LABELS, formatRequestDate, REQUEST_STATUSES } from '../../lib/requests.js';
import { mailtoHref, telHref } from '../../lib/urls.js';
import { requestsApi } from '../services/data.js';
import { refreshRequestBadges } from '../shell.js';
import { confirmDialog, emptyState, pageHeader, timeAgo, toast, withBusy } from '../ui.js';

/**
 * Requests: the appointment requests people send from the booking page.
 * Built for a phone: one card per request with Call / Text / Email buttons
 * and a single tap to move it along (New -> Contacted -> Booked / Closed).
 */

const FILTERS = [
  ['open', 'Open (not closed)'],
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['booked', 'Booked'],
  ['closed', 'Closed'],
  ['all', 'All'],
];

const BADGE = { new: 'a-badge-star', contacted: 'a-badge-draft', booked: 'a-badge-live', closed: 'a-badge-archived' };

const smsHref = (phone) => {
  const tel = telHref(phone);
  return tel ? tel.replace(/^tel:/, 'sms:') : '';
};

export default async function requestsPage({ query }) {
  const state = { status: FILTERS.some(([v]) => v === query.get('status')) ? query.get('status') : 'open' };
  let rows = [];
  const listHost = h('div', { 'aria-live': 'polite' });

  const filterSel = h(
    'select',
    { id: 'req-filter', class: 'a-input', onChange: (e) => { state.status = e.target.value; load(); } },
    FILTERS.map(([v, l]) => h('option', { value: v, selected: v === state.status }, l)),
  );

  async function load() {
    listHost.replaceChildren(h('div', { class: 'a-skeleton h-32 w-full' }));
    try {
      rows = await requestsApi.list({ status: state.status });
      refreshRequestBadges();
    } catch (error) {
      listHost.replaceChildren(h('div', { class: 'a-alert-error', role: 'alert' }, error.message));
      return;
    }
    draw();
  }

  async function setStatus(row, status, button) {
    await withBusy(button, async () => {
      try {
        await requestsApi.setStatus(row.id, status);
        toast(`Marked as ${REQUEST_STATUSES.find((s) => s.value === status)?.label.toLowerCase()}.`);
        await load();
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
    }, '…');
  }

  async function remove(row) {
    const ok = await confirmDialog({
      title: 'Delete this request permanently?',
      message: `${row.full_name}'s request and contact details will be erased. Do this when a client asks you to delete their information, or once you no longer need it.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    });
    if (!ok) return;
    try {
      await requestsApi.remove(row.id);
      toast('Request deleted.');
      await load();
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  function card(row) {
    const tel = telHref(row.phone);
    const sms = smsHref(row.phone);
    const mail = mailtoHref(row.email);
    const statusLabel = REQUEST_STATUSES.find((s) => s.value === row.status)?.label ?? row.status;
    const detail = (label, value) => (value ? h('div', { class: 'flex gap-2' }, h('dt', { class: 'font-semibold shrink-0' }, `${label}:`), h('dd', { class: 'break-words min-w-0' }, value)) : null);
    const next = row.status === 'new' ? ['contacted', 'Mark contacted'] : row.status === 'contacted' ? ['booked', 'Mark booked'] : null;

    return h(
      'article',
      { class: `a-card ${row.status === 'new' ? 'border-l-4 border-l-ink' : ''}`, 'aria-labelledby': `req-${row.id}` },
      h(
        'div',
        { class: 'flex flex-wrap items-start justify-between gap-2 mb-3' },
        h('div', {}, h('h2', { id: `req-${row.id}`, class: 'text-lg font-semibold break-words' }, row.full_name), h('p', { class: 'text-sm text-muted' }, `Sent ${timeAgo(row.created_at)}`)),
        h('span', { class: BADGE[row.status] ?? 'a-badge-draft' }, statusLabel),
      ),
      h(
        'dl',
        { class: 'space-y-1 text-sm mb-4' },
        detail('Wants', formatRequestDate(row.preferred_date) + (row.preferred_time_slot ? `, ${row.preferred_time_slot}` : '')),
        detail('Service', row.service || 'No preference'),
        detail('Client', CLIENT_TYPE_LABELS[row.client_type]),
        detail('Phone', row.phone),
        detail('Email', row.email),
        row.notes ? h('div', {}, h('dt', { class: 'font-semibold' }, 'Notes:'), h('dd', { class: 'whitespace-pre-line break-words bg-ivory p-2 mt-1' }, row.notes)) : null,
      ),
      h(
        'div',
        { class: 'flex flex-wrap gap-2 mb-3' },
        tel ? h('a', { href: tel, class: 'a-btn-primary a-btn-sm' }, 'Call') : null,
        sms ? h('a', { href: sms, class: 'a-btn-secondary a-btn-sm' }, 'Text') : null,
        mail ? h('a', { href: mail, class: 'a-btn-secondary a-btn-sm' }, 'Email') : null,
      ),
      h(
        'div',
        { class: 'flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3' },
        next ? h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: (e) => setStatus(row, next[0], e.currentTarget) }, next[1]) : null,
        row.status !== 'closed'
          ? h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: (e) => setStatus(row, 'closed', e.currentTarget) }, 'Close')
          : h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: (e) => setStatus(row, 'contacted', e.currentTarget) }, 'Reopen'),
        row.status === 'new' ? null : h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm', onClick: (e) => setStatus(row, 'new', e.currentTarget) }, 'Mark as new'),
        h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm text-red-800 ml-auto', onClick: () => remove(row) }, 'Delete'),
      ),
    );
  }

  function draw() {
    if (rows.length === 0) {
      listHost.replaceChildren(
        state.status === 'open' || state.status === 'new'
          ? emptyState({ title: 'No open requests', message: 'When someone sends a request from your booking page it shows up here. You can call, text or email them straight from this page.' })
          : emptyState({ title: 'Nothing here', message: 'No requests with that status.', action: h('button', { type: 'button', class: 'a-btn-secondary', onClick: () => { state.status = 'open'; filterSel.value = 'open'; load(); } }, 'Show open requests') }),
      );
      return;
    }
    listHost.replaceChildren(h('div', { class: 'grid gap-4 max-w-3xl' }, rows.map(card)));
  }

  const container = h(
    'div',
    { class: 'a-page' },
    pageHeader('Requests', 'Appointment requests from your booking page. Only you can see them.'),
    h('div', { class: 'mb-4 max-w-xs' }, h('label', { class: 'a-label', for: 'req-filter' }, 'Show'), filterSel),
    listHost,
    h('p', { class: 'text-xs text-muted mt-6 max-w-3xl' }, 'These contain your clients\' personal details. Delete a request when a client asks, or when you no longer need it.'),
  );
  await load();
  return container;
}
