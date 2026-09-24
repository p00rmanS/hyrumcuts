import { h } from '../../lib/dom.js';
import { sortableList } from '../components/sortable-list.js';
import { categoriesApi, itemsApi, saveOrder } from '../services/data.js';
import { deleteItemFlow, kindLabel, previewItem, thumbUrl } from './portfolio-common.js';
import { itemHasPlaceholderMedia } from '../../lib/placeholders.js';
import { emptyState, pageHeader, statusBadge, toast, withBusy } from '../ui.js';

/**
 * Manage Work: filter, publish/hide, feature, reorder (drag or Up/Down),
 * archive/restore and permanent delete.
 */
export default async function portfolioList({ ownerId, query }) {
  const cats = await categoriesApi.list();
  const state = { status: query.get('status') || 'all', categoryId: query.get('category') || '' };
  let items = [];
  const container = h('div', { class: 'a-page' });
  const listHost = h('div', { 'aria-live': 'polite' });

  const statusSel = h('select', { id: 'flt-status', class: 'a-input', onChange: (e) => { state.status = e.target.value; load(); } }, [['all', 'All (not archived)'], ['published', 'Published'], ['draft', 'Drafts'], ['placeholder', 'Still placeholders'], ['archived', 'Archived']].map(([v, l]) => h('option', { value: v, selected: v === state.status }, l)));
  const catSel = h('select', { id: 'flt-cat', class: 'a-input', onChange: (e) => { state.categoryId = e.target.value; load(); } }, h('option', { value: '' }, 'All categories'), cats.map((c) => h('option', { value: c.id, selected: c.id === state.categoryId }, c.name)));

  const filtered = () => state.status !== 'all' || Boolean(state.categoryId);

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
        location.assign(`/admin/portfolio/${item.id}`);
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

  function draw() {
    if (items.length === 0) {
      listHost.replaceChildren(
        filtered()
          ? emptyState({ title: 'Nothing matches those filters', message: 'Try a different category or status.', action: h('button', { type: 'button', class: 'a-btn-secondary', onClick: () => { state.status = 'all'; state.categoryId = ''; statusSel.value = 'all'; catSel.value = ''; load(); } }, 'Clear filters') })
          : emptyState({ title: 'No work yet', message: 'Upload your first photos to build your portfolio. Nothing goes public until you publish it.', action: h('a', { href: '/admin/portfolio/add', class: 'a-btn-primary' }, 'Add your first work') }),
      );
      return;
    }
    if (filtered()) {
      listHost.replaceChildren(h('p', { class: 'text-sm text-muted mb-3' }, 'Clear the filters to reorder your work.'), h('ul', { class: 'space-y-2' }, items.map((i) => h('li', {}, row(i, null)))));
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
    h('div', { class: 'grid gap-3 sm:grid-cols-2 mb-6 max-w-xl' }, h('div', {}, h('label', { class: 'a-label', for: 'flt-status' }, 'Show'), statusSel), h('div', {}, h('label', { class: 'a-label', for: 'flt-cat' }, 'Category'), catSel)),
    listHost,
  );
  await load();
  return container;
}
