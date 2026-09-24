import { h } from '../../lib/dom.js';
import { sortableList } from '../components/sortable-list.js';
import { faqsApi, nextSortOrder, reviewsApi, saveOrder, servicesApi } from '../services/data.js';
import { isPlaceholderFaq, isPlaceholderReview } from '../../lib/placeholders.js';
import { FAQ_FIELDS, REVIEW_FIELDS, SERVICE_FIELDS, validateRecord } from '../validation/settings.js';
import { checkbox, confirmDialog, emptyState, fieldGroup, openDialog, pageHeader, toast, withBusy } from '../ui.js';

/**
 * One editor for every simple ordered list (reviews, FAQs, services).
 *
 * @typedef {{
 *   title: string, subtitle: string, table: 'reviews'|'faqs'|'services', api: any, fields: any[],
 *   noun: string, primary: (row: any) => string, secondary?: (row: any) => string,
 *   publishLabel: string, publishHelp: string, canArchive: boolean, defaultPublished: boolean,
 *   notice?: string, emptyTitle: string, emptyMessage: string,
 * }} ListConfig
 */

/** @param {ListConfig} config */
function makeListPage(config) {
  return async function listPage() {
    let rows = await config.api.list();
    let showArchived = false;
    const container = h('div', { class: 'a-page' });

    async function reload() {
      try {
        rows = await config.api.list();
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
      draw();
    }

    function openForm(row) {
      const isNew = !row;
      const group = fieldGroup(config.fields, row ?? {});
      const publish = checkbox({ label: config.publishLabel, help: config.publishHelp, checked: row ? row.is_published : config.defaultPublished });
      const errorBox = h('div', { class: 'a-alert-error hidden', role: 'alert' });
      const form = h('form', { novalidate: true, onSubmit: (e) => e.preventDefault() }, config.notice && isNew ? h('div', { class: 'a-alert-info mb-4' }, config.notice) : null, errorBox, ...group.els, publish.el);

      openDialog({
        title: isNew ? `Add ${config.noun}` : `Edit ${config.noun}`,
        wide: true,
        body: form,
        actions: [
          { label: 'Cancel', variant: 'secondary' },
          {
            label: isNew ? `Add ${config.noun}` : 'Save changes',
            variant: 'primary',
            close: false,
            onClick: async (api) => {
              errorBox.classList.add('hidden');
              group.clearErrors();
              const result = validateRecord(config.fields, group.values());
              if (!result.ok) {
                group.showErrors(result.errors);
                return;
              }
              try {
                const payload = { ...result.cleaned, is_published: publish.input.checked };
                if (isNew) await config.api.create({ ...payload, sort_order: await nextSortOrder(config.table) });
                else await config.api.update(row.id, payload);
                api.close();
                toast(isNew ? `${cap(config.noun)} added.` : 'Changes saved.');
                await reload();
              } catch (error) {
                errorBox.textContent = error.message;
                errorBox.classList.remove('hidden');
              }
            },
          },
        ],
      });
    }

    async function toggleShown(row, btn) {
      await withBusy(btn, async () => {
        try {
          await config.api.update(row.id, { is_published: !row.is_published });
          toast(row.is_published ? `${cap(config.noun)} hidden from your website.` : `${cap(config.noun)} is now showing on your website.`);
          await reload();
        } catch (error) {
          toast(error.message, { type: 'error' });
        }
      }, '…');
    }

    async function archive(row, restore) {
      try {
        await config.api.update(row.id, restore ? { archived_at: null } : { archived_at: new Date().toISOString(), is_published: false });
        toast(restore ? `${cap(config.noun)} restored (as a hidden item).` : `${cap(config.noun)} archived. You can restore it any time.`);
        await reload();
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
    }

    async function remove(row) {
      const ok = await confirmDialog({
        title: `Delete this ${config.noun} permanently?`,
        message: h('div', {}, h('p', { class: 'font-semibold mb-2' }, `"${truncate(config.primary(row), 80)}"`), h('p', {}, 'This can\'t be undone.' + (config.canArchive ? ' If you might want it back, archive it instead.' : ''))),
        confirmLabel: 'Delete permanently',
        danger: true,
      });
      if (!ok) return;
      try {
        await config.api.remove(row.id);
        toast(`${cap(config.noun)} deleted.`);
        await reload();
      } catch (error) {
        toast(error.message, { type: 'error' });
      }
    }

    function rowView(row, { handle, up, down }, archivedView) {
      const badge = row.archived_at ? h('span', { class: 'a-badge-archived' }, 'Archived') : row.is_published ? h('span', { class: 'a-badge-live' }, 'Shown') : h('span', { class: 'a-badge-draft' }, 'Hidden');
      const buttons = [];
      if (!archivedView) {
        buttons.push(h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: (e) => toggleShown(row, e.currentTarget) }, row.is_published ? 'Hide' : 'Show'));
      }
      buttons.push(h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: () => openForm(row) }, 'Edit'));
      if (config.canArchive) buttons.push(h('button', { type: 'button', class: 'a-btn-secondary a-btn-sm', onClick: () => archive(row, Boolean(row.archived_at)) }, row.archived_at ? 'Restore' : 'Archive'));
      buttons.push(h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm text-red-800', onClick: () => remove(row) }, 'Delete'));

      return h(
        'div',
        { class: 'a-row flex-wrap' },
        archivedView ? null : handle,
        h('div', { class: 'flex-1 min-w-[10rem]' }, h('p', { class: 'font-semibold break-words' }, truncate(config.primary(row), 90)), config.secondary?.(row) ? h('p', { class: 'text-sm text-muted break-words' }, truncate(config.secondary(row), 120)) : null, h('div', { class: 'mt-1 flex flex-wrap gap-1' }, badge, config.isPlaceholder?.(row) ? h('span', { class: 'a-badge-draft' }, 'Placeholder: replace me') : null)),
        h('div', { class: 'flex flex-wrap items-center gap-1' }, archivedView ? null : [up, down], buttons),
      );
    }

    function draw() {
      const active = rows.filter((r) => !r.archived_at);
      const archived = rows.filter((r) => r.archived_at);
      const parts = [pageHeader(config.title, config.subtitle, h('button', { type: 'button', class: 'a-btn-primary', onClick: () => openForm(null) }, `+ Add ${config.noun}`))];

      if (active.length === 0) {
        parts.push(emptyState({ title: config.emptyTitle, message: config.emptyMessage, action: h('button', { type: 'button', class: 'a-btn-primary', onClick: () => openForm(null) }, `Add your first ${config.noun}`) }));
      } else {
        const list = sortableList({
          items: active,
          label: config.title,
          renderItem: (row, controls) => rowView(row, controls, false),
          onReorder: async (ids) => {
            await saveOrder(config.table, ids);
            rows = [...ids.map((id) => rows.find((r) => r.id === id)), ...archived];
          },
        });
        parts.push(list.el);
      }

      if (config.canArchive && archived.length) {
        parts.push(
          h('div', { class: 'mt-8' }, h('button', { type: 'button', class: 'a-btn-secondary', 'aria-expanded': String(showArchived), onClick: () => { showArchived = !showArchived; draw(); } }, `${showArchived ? 'Hide' : 'Show'} archived (${archived.length})`)),
          showArchived ? h('ul', { class: 'space-y-2 mt-3', 'aria-label': 'Archived' }, archived.map((r) => h('li', {}, rowView(r, {}, true)))) : null,
        );
      }
      container.replaceChildren(...parts);
    }

    draw();
    return container;
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function forReviews() {
  return {
    default: makeListPage({
      title: 'Reviews',
      subtitle: 'Real client reviews you have permission to share. Only "shown" reviews appear on your website.',
      table: 'reviews',
      api: reviewsApi,
      fields: REVIEW_FIELDS,
      noun: 'review',
      primary: (r) => `“${r.quote}”`,
      secondary: (r) => [r.reviewer_name, r.haircut_type].filter(Boolean).join(' · '),
      isPlaceholder: isPlaceholderReview,
      publishLabel: 'Approved and shown',
      publishHelp: 'Turn on once the client has said you may share it. Leave off to keep it as a hidden draft.',
      canArchive: true,
      defaultPublished: false,
      notice: 'Only add reviews from real clients, with their permission. Never write or edit a review to say something they didn\'t.',
      emptyTitle: 'No reviews yet',
      emptyMessage: 'Add a real review when a client says you can share it. Until then this section stays off your website.',
    }),
  };
}

export function forFaqs() {
  return {
    default: makeListPage({
      title: 'FAQ',
      subtitle: 'Questions clients ask before booking. Drafts stay hidden until you turn them on.',
      table: 'faqs',
      api: faqsApi,
      fields: FAQ_FIELDS,
      noun: 'question',
      primary: (r) => r.question,
      secondary: (r) => r.answer,
      isPlaceholder: isPlaceholderFaq,
      publishLabel: 'Show on my website',
      publishHelp: 'Turn off to keep it as a draft.',
      canArchive: true,
      defaultPublished: true,
      emptyTitle: 'No questions yet',
      emptyMessage: 'Add the questions clients ask most. The FAQ section is hidden while it\'s empty.',
    }),
  };
}

export function forServices() {
  return {
    default: makeListPage({
      title: 'Services',
      subtitle: 'The cuts you offer. Shown in the Services section of your home page and as the "Service / cut type" choices on your request form. No prices are shown anywhere.',
      table: 'services',
      api: servicesApi,
      fields: SERVICE_FIELDS,
      noun: 'service',
      primary: (r) => r.name,
      secondary: (r) => r.description,
      publishLabel: 'Show on my website',
      publishHelp: 'Turn off to hide it without deleting it.',
      canArchive: false,
      defaultPublished: true,
      emptyTitle: 'No services yet',
      emptyMessage: 'Add the kinds of cuts you offer. While the list is empty the Services section is hidden and the request form just shows "No preference".',
    }),
  };
}

