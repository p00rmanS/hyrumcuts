import { h } from '../../lib/dom.js';
import { sortableList } from '../components/sortable-list.js';
import { categoriesApi, countItemsInCategory, nextSortOrder, reassignCategory, saveOrder } from '../services/data.js';
import { CATEGORY_FIELDS, slugify, uniqueSlug, validateRecord } from '../validation/settings.js';
import { checkbox, confirmDialog, emptyState, fieldGroup, openDialog, pageHeader, toast, withBusy } from '../ui.js';

/**
 * Gallery categories: add, rename, reorder, hide, and delete safely.
 * A category that still has work in it can't just be deleted; the owner is
 * asked where to move that work first (the database enforces this too).
 */
export default async function categories() {
  let rows = await categoriesApi.list();
  const container = h('div', { class: 'a-page' });

  async function reload() {
    try {
      rows = await categoriesApi.list();
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
    draw();
  }

  function openForm(row) {
    const isNew = !row;
    const group = fieldGroup(CATEGORY_FIELDS, row ?? {});
    const shown = checkbox({ label: 'Show this filter on my website', help: 'Turn off to hide it without deleting it.', checked: row ? row.is_published : true });
    const errorBox = h('div', { class: 'a-alert-error hidden', role: 'alert' });
    openDialog({
      title: isNew ? 'Add category' : 'Edit category',
      wide: true,
      body: h('form', { novalidate: true, onSubmit: (e) => e.preventDefault() }, errorBox, ...group.els, shown.el),
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: isNew ? 'Add category' : 'Save changes',
          variant: 'primary',
          close: false,
          onClick: async (api) => {
            errorBox.classList.add('hidden');
            group.clearErrors();
            const result = validateRecord(CATEGORY_FIELDS, group.values());
            if (!result.ok) return void group.showErrors(result.errors);
            try {
              if (isNew) {
                const base = slugify(result.cleaned.name);
                if (!base) return void group.showErrors({ name: 'Use some letters or numbers in the name.' });
                await categoriesApi.create({ ...result.cleaned, slug: uniqueSlug(base, rows.map((r) => r.slug)), is_published: shown.input.checked, sort_order: await nextSortOrder('gallery_categories') });
              } else {
                await categoriesApi.update(row.id, { ...result.cleaned, is_published: shown.input.checked });
              }
              api.close();
              toast(isNew ? 'Category added.' : 'Changes saved.');
              await reload();
            } catch (error) {
              errorBox.textContent = error.message;
              errorBox.classList.remove('hidden');
            }
            return undefined;
          },
        },
      ],
    });
  }

  async function toggle(row, btn) {
    await withBusy(btn, async () => {
      try {
        await categoriesApi.update(row.id, { is_published: !row.is_published });
        toast(row.is_published ? 'Filter hidden. Its work still appears under "All".' : 'Filter is showing on your website.');
        await reload();
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
    }, '…');
  }

  async function remove(row) {
    let used;
    try {
      used = await countItemsInCategory(row.id);
    } catch (error) {
      return void toast(error.message, { type: 'error' });
    }
    const others = rows.filter((r) => r.id !== row.id);

    if (used === 0) {
      const ok = await confirmDialog({ title: `Delete "${row.name}"?`, message: 'No work is in this category. This can\'t be undone.', confirmLabel: 'Delete category', danger: true });
      if (!ok) return undefined;
      try {
        await categoriesApi.remove(row.id);
        toast('Category deleted.');
        await reload();
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
      return undefined;
    }

    // In use: choose where its work goes first.
    const target = h('select', { id: 'reassign', class: 'a-input' }, h('option', { value: '' }, 'No category (still shows under "All")'), others.map((o) => h('option', { value: o.id }, o.name)));
    openDialog({
      title: `Delete "${row.name}"?`,
      body: [h('p', {}, `${used} piece${used === 1 ? '' : 's'} of work ${used === 1 ? 'is' : 'are'} in this category. Choose where ${used === 1 ? 'it' : 'they'} should go. Nothing is deleted except the category itself.`), h('label', { class: 'a-label', for: 'reassign' }, 'Move the work to'), target],
      actions: [
        { label: 'Cancel', variant: 'secondary', autofocus: true },
        {
          label: 'Move work and delete category',
          variant: 'danger',
          close: false,
          onClick: async (api) => {
            try {
              await reassignCategory(row.id, target.value || null);
              await categoriesApi.remove(row.id);
              api.close();
              toast('Category deleted and its work moved.');
              await reload();
            } catch (error) {
              toast(error.message, { type: 'error' });
            }
          },
        },
      ],
    });
    return undefined;
  }

  function rowView(row, { handle, up, down }) {
    return h(
      'div',
      { class: 'a-row flex-wrap' },
      handle,
      h('div', { class: 'flex-1 min-w-[9rem]' }, h('p', { class: 'font-semibold break-words' }, row.name), row.description ? h('p', { class: 'text-sm text-muted break-words' }, row.description) : null, h('div', { class: 'mt-1' }, row.is_published ? h('span', { class: 'a-badge-live' }, 'Showing') : h('span', { class: 'a-badge-draft' }, 'Hidden'))),
      h('div', { class: 'flex flex-wrap items-center gap-1' }, up, down, h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: (e) => toggle(row, e.currentTarget) }, row.is_published ? 'Hide' : 'Show'), h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: () => openForm(row) }, 'Rename'), h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm text-red-800', onClick: () => remove(row) }, 'Delete')),
    );
  }

  function draw() {
    const parts = [pageHeader('Categories', 'The filters above your gallery. A filter only appears when it has published work in it.', h('button', { type: 'button', class: 'a-btn-primary', onClick: () => openForm(null) }, '+ Add category'))];
    if (rows.length === 0) {
      parts.push(emptyState({ title: 'No categories yet', message: 'Add categories like Fades or Tapers so visitors can filter your work.', action: h('button', { type: 'button', class: 'a-btn-primary', onClick: () => openForm(null) }, 'Add a category') }));
    } else {
      parts.push(
        sortableList({
          items: rows,
          label: 'Categories',
          renderItem: rowView,
          onReorder: async (ids) => {
            await saveOrder('gallery_categories', ids);
            rows = ids.map((id) => rows.find((r) => r.id === id));
          },
        }).el,
      );
    }
    container.replaceChildren(...parts);
  }

  draw();
  return container;
}

