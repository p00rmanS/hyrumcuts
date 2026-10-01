import { announcementStatus } from '../../lib/content.js';
import { h } from '../../lib/dom.js';
import { getDashboardCounts, getPlaceholderSummary, getRecentActivity, getSettings } from '../services/data.js';
import { pageHeader, timeAgo } from '../ui.js';
import { computeWarnings, describeActivity } from './dashboard-logic.js';

/** Real status only: counts and warnings from the database, no invented analytics. */
export default async function dashboard() {
  const [settings, counts, activity] = await Promise.all([getSettings(), getDashboardCounts(), getRecentActivity(8).catch(() => [])]);
  const placeholders = await getPlaceholderSummary(settings).catch(() => undefined);
  const warnings = computeWarnings(settings, counts, placeholders);
  const announcement = announcementStatus(settings);
  const stat = (label, value, href) =>
    h('a', { href, class: 'a-card block hover:border-ink transition-colors' }, h('p', { class: 'text-3xl font-display' }, value ?? '–'), h('p', { class: 'text-sm text-muted' }, label));

  return h(
    'div',
    { class: 'a-page' },
    pageHeader('Dashboard', 'A quick look at your website.', [h('a', { href: '/admin/portfolio/add', class: 'a-btn-primary' }, '+ Add work'), h('a', { href: '/admin/media/hero', class: 'a-btn-secondary' }, 'Replace hero video')]),

    warnings.length
      ? h(
          'section',
          { class: 'mb-8', 'aria-labelledby': 'todo-h' },
          h('h2', { id: 'todo-h', class: 'text-xl mb-3' }, 'Needs your attention'),
          h(
            'ul',
            { class: 'space-y-2' },
            warnings.map((w) =>
              h('li', { class: `${w.level === 'warn' ? 'a-alert-warn' : 'a-alert-info'} flex flex-wrap items-center justify-between gap-3` }, h('span', { class: 'flex-1 min-w-[12rem]' }, w.message), h('a', { href: w.href, class: 'a-btn-secondary a-btn-sm' }, w.cta)),
            ),
          ),
        )
      : h('div', { class: 'a-alert-ok mb-8' }, 'Everything looks good. Nothing needs your attention right now.'),

    h(
      'section',
      { class: 'mb-8', 'aria-labelledby': 'stats-h' },
      h('h2', { id: 'stats-h', class: 'text-xl mb-3' }, 'Your portfolio'),
      h('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-3' }, stat('Published', counts.published, '/admin/portfolio?status=published'), stat('Drafts', counts.drafts, '/admin/portfolio?status=draft'), stat('Reviews shown', counts.reviews, '/admin/reviews'), stat('FAQs shown', counts.faqs, '/admin/content/faq')),
      counts.archived ? h('p', { class: 'text-sm text-muted mt-2' }, `${counts.archived} archived item${counts.archived === 1 ? '' : 's'} (hidden, can be restored).`) : null,
    ),

    announcement.state === 'off'
      ? null
      : h(
          'section',
          { class: 'mb-8', 'aria-labelledby': 'announce-h' },
          h('h2', { id: 'announce-h', class: 'text-xl mb-3' }, 'Announcement'),
          h(
            'div',
            { class: `${announcement.state === 'live' ? 'a-alert-ok' : announcement.state === 'ended' ? 'a-alert-warn' : 'a-alert-info'} flex flex-wrap items-center justify-between gap-3` },
            h('span', { class: 'flex-1 min-w-[12rem]' }, h('span', { class: 'font-semibold' }, `“${settings.announcement_text.trim()}”`), h('br'), announcement.message),
            h('a', { href: '/admin/content/announcement', class: 'a-btn-secondary a-btn-sm' }, 'Edit'),
          ),
        ),

    h(
      'section',
      { 'aria-labelledby': 'recent-h' },
      h('h2', { id: 'recent-h', class: 'text-xl mb-3' }, 'Recent changes'),
      activity.length === 0
        ? h('p', { class: 'text-muted' }, 'Changes you make will appear here.')
        : h('ul', { class: 'a-card divide-y divide-ink/10 !p-0' }, activity.map((row) => h('li', { class: 'flex items-center justify-between gap-3 px-4 py-3 text-sm' }, h('span', {}, describeActivity(row)), h('time', { class: 'text-muted shrink-0', datetime: row.created_at }, timeAgo(row.created_at))))),
    ),
  );
}
