import { h } from '../../lib/dom.js';
import { sortableList } from '../components/sortable-list.js';
import { categoriesApi, itemsApi, saveOrder } from '../services/data.js';
import { deleteItemFlow, kindLabel, previewItem, thumbUrl } from './portfolio-common.js';
import { itemHasPlaceholderMedia } from '../../lib/placeholders.js';
import { matchesSearch, portfolioQuery } from './settings-helpers.js';
import { emptyState, pageHeader, statusBadge, toast, withBusy } from '../ui.js';
import { toUrl } from '../../lib/base.js';

/**
 * Manage Work: filter, publish/hide, feature, reorder (drag or Up/Down),
 * archive/restore and permanent delete.
 */
export default async function portfolioList({ ownerId, query, navigate }) {
  const cats = await categoriesApi.list();
  const state = { status: query.get('status') || 'all', categoryId: query.get('category') || '', search: query.get('q') || '' };
  let items = [];
  let searchTimer = null;
  const container = h('div', { class: 'a-page' });
  const listHost = h('div', { 'aria-live': 'polite' });

  const statusSel = h('select', { id: 'flt-status', class: 'a-input', onChange: (e) => { state.status = e.target.value; syncUrl(); load(); } }, [['all', 'All (not archived)'], ['published', 'Published'], ['draft', 'Drafts'], ['placeholder', 'Still placeholders'], ['archived', 'Archived']].map(([v, l]) => h('option', { value: v, selected: v === state.status }, l)));
  const catSel = h('select', { id: 'flt-cat', class: 'a-input', onChange: (e) => { state.categoryId = e.target.value; syncUrl(); load(); } }, h('option', { value: '' }, 'All categories'), cats.map((c) => h('option', { value: c.id, selected: c.id === state.categoryId }, c.name)));

  const searchInput = h('input', {
    id: 'flt-search',
    type: 'search',
    class: 'a-input',
    placeholder: 'Title, haircut or category',
    autocomplete: 'off',
    enterkeyhint: 'search',
    onInput: (e) => {
      state.search = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        syncUrl();
        draw();
      }, 150);
    },
  });
  searchInput.value = state.search;
  const countLine = h('p', { class: 'text-sm text-muted mb-3', role: 'status', 'aria-live': 'polite' });

  const filtered = () => state.status !== 'all' || Boolean(state.categoryId) || Boolean(state.search.trim());

  /** Keep the filters in the address bar, so refresh and Back keep them. */
  function syncUrl() {
    history.replaceState(history.state, '', toUrl(`/admin/portfolio${portfolioQuery(state)}`));
  }

  async function load() {
    listHost.replaceChildren(h('div', { class: 'a-skeleton h-24 w-full' }));
    try {
      items = await itemsApi.list({ status: state.status, categoryId: state.categoryId || undefined });
    } catch (error) {
      listHost.replaceChildren(h('div', { class: 'a-alert-error', role: 'alert' }, error.message));
      return;
    }
    draw();
  }

  async function act(fn, ok) {
    try {
      await fn();
      if (ok) toast(ok);
      await load();
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  function row(item, controls) {
    const url = thumbUrl(item);
    const archived = Boolean(item.archived_at);
    const publishToggle = h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: async (e) => {
      if (!item.is_published && !item.alt_text.trim()) {
        toast('Add alt text before publishing. Opening the item so you can add it.', { type: 'info' });
        navigate(`/admin/portfolio/${item.id}`);
        return;
      }
      await withBusy(e.currentTarget, () => act(() => itemsApi.update(item.id, { is_published: !item.is_published }), item.is_published ? 'Hidden. It\'s now a draft.' : 'Published. It\'s live on your website.'), '…');
    } }, item.is_published ? 'Hide' : 'Publish');

    return h(
      'div',
      { class: 'a-row flex-wrap' },
      controls?.handle ?? null,
      h('a', { href: `/admin/portfolio/${item.id}`, class: 'shrink-0', 'aria-label': `Edit ${item.title}` }, url ? h('img', { src: url, alt: '', loading: 'lazy', class: 'h-16 w-16 object-cover bg-ivory' }) : h('span', { class: 'flex h-16 w-16 items-center justify-center bg-ivory text-xs text-muted' }, 'No image')),
      h(
        'div',
        { class: 'flex-1 min-w-[8rem]' },
        h('a', { href: `/admin/portfolio/${item.id}`, class: 'font-semibold break-words underline-offset-2 hover:underline' }, item.title),
        h('p', { class: 'text-sm text-muted' }, [item.category?.name ?? 'No category', kindLabel(item)].join(' · ')),
        h('div', { class: 'mt-1 flex flex-wrap gap-1' }, statusBadge(item), item.is_featured ? h('span', { class: 'a-badge-star' }, '★ Featured') : null,
          itemHasPlaceholderMedia(item) ? h('span', { class: 'a-badge-draft' }, 'Placeholder: replace me') : null, !item.alt_text.trim() ? h('span', { class: 'a-badge-draft' }, 'Needs alt text') : null),
      ),
      h(
        'div',
        { class: 'flex flex-wrap items-center gap-1' },
        controls ? [controls.up, controls.down] : null,
        archived ? null : publishToggle,
        archived ? null : h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', 'aria-pressed': String(item.is_featured), onClick: () => act(() => itemsApi.update(item.id, { is_featured: !item.is_featured }), item.is_featured ? 'No longer featured.' : 'Marked as featured.') }, item.is_featured ? '★ Unfeature' : '☆ Feature'),
        h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: () => previewItem(item) }, 'Preview'),
        h('a', { href: `/admin/portfolio/${item.id}`, class: 'a-btn-secondary a-btn-sm' }, 'Edit'),
        h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: () => act(() => (archived ? itemsApi.restore(item.id) : itemsApi.archive(item.id)), archived ? 'Restored as a draft.' : 'Archived. You can restore it any time.') }, archived ? 'Restore' : 'Archive'),
        h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm text-red-800', onClick: async () => { if (await deleteItemFlow(item, ownerId)) await load(); } }, 'Delete'),
      ),
    );
  }

  function clearFilters() {
    state.status = 'all';
    state.categoryId = '';
    state.search = '';
    statusSel.value = 'all';
    catSel.value = '';
    searchInput.value = '';
    syncUrl();
    load();
  }

  function draw() {
    const visible = items.filter((i) => matchesSearch(i, state.search));
    countLine.textContent = filtered() && items.length ? `Showing ${visible.length} of ${items.length}${state.search.trim() ? ` matching “${state.search.trim()}”` : ''}.` : '';
    if (visible.length === 0) {
      listHost.replaceChildren(
        filtered()
          ? emptyState({ title: 'Nothing matches', message: 'Try a different search, category or status.', action: h('button', { type: 'button', class: 'a-btn-secondary', onClick: clearFilters }, 'Clear filters') })
          : emptyState({ title: 'No work yet', message: 'Upload your first photos to build your portfolio. Nothing goes public until you publish it.', action: h('a', { href: '/admin/portfolio/add', class: 'a-btn-primary' }, 'Add your first work') }),
      );
      return;
    }
    if (filtered()) {
      listHost.replaceChildren(h('p', { class: 'text-sm text-muted mb-3' }, 'Clear the search and filters to reorder your work. ', h('button', { type: 'button', class: 'underline font-semibold', onClick: clearFilters }, 'Clear them')), h('ul', { class: 'space-y-2' }, visible.map((i) => h('li', {}, row(i, null)))));
      return;
    }
    const list = sortableList({
      items,
      label: 'Portfolio',
      renderItem: (item, controls) => row(item, controls),
      onReorder: async (ids) => {
        await saveOrder('gallery_items', ids);
        items = ids.map((id) => items.find((i) => i.id === id));
      },
    });
    listHost.replaceChildren(h('p', { class: 'text-sm text-muted mb-3' }, 'Drag the handle, or use the up and down buttons, to change the order on your website.'), list.el);
  }

  container.append(
    pageHeader('Manage work', 'Everything in your portfolio. Drafts and archived work are never visible to visitors.', h('a', { href: '/admin/portfolio/add', class: 'a-btn-primary' }, '+ Add work')),
    h(
      'div',
      { class: 'grid gap-3 sm:grid-cols-3 mb-4 max-w-3xl', role: 'search' },
      h('div', {}, h('label', { class: 'a-label', for: 'flt-search' }, 'Search'), searchInput),
      h('div', {}, h('label', { class: 'a-label', for: 'flt-status' }, 'Show'), statusSel),
      h('div', {}, h('label', { class: 'a-label', for: 'flt-cat' }, 'Category'), catSel),
    ),
    countLine,
    listHost,
  );
  await load();
  return container;
}
