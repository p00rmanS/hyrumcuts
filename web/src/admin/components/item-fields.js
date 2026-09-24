import { h } from '../../lib/dom.js';
import { validateItemFields } from '../validation/settings.js';
import { checkbox, field } from '../ui.js';

/**
 * The text fields for one portfolio item: title, category, alt text,
 * description, haircut label, featured, and publish-or-draft.
 *
 * Alt text is written by the owner (a prompt and example help), never
 * generated automatically: machine descriptions of people and haircuts are
 * often wrong, and this text is what screen-reader users hear.
 *
 * @param {{ categories: Array<{ id: string, name: string }>, values?: Record<string, any>, showPublish?: boolean, defaultCategoryId?: string }} options
 */
export function itemFields({ categories, values = {}, showPublish = true, defaultCategoryId = '' }) {
  const title = field({ key: 'title', label: 'Title', type: 'text', max: 120, required: true, example: 'Mid skin fade with textured top' }, values.title ?? '');
  const alt = field(
    {
      key: 'alt_text',
      label: 'Alt text (describes the photo for people who can\'t see it)',
      type: 'textarea',
      rows: 2,
      max: 300,
      help: 'Say what the photo shows in one short sentence. Required before you can publish. Write it yourself: automatic descriptions often get haircuts wrong.',
      example: 'Side view of a mid skin fade blending into a textured crop.',
    },
    values.alt_text ?? '',
  );
  const description = field({ key: 'description', label: 'Description (optional)', type: 'textarea', rows: 2, max: 1000, help: 'Shown when someone opens the photo.' }, values.description ?? '');
  const service = field({ key: 'service_label', label: 'Haircut style (optional)', type: 'text', max: 80, example: 'Skin Fade' }, values.service_label ?? '');

  const catId = h('select', { id: 'cat-' + Math.random().toString(36).slice(2), class: 'a-input' }, h('option', { value: '' }, 'No category'), categories.map((c) => h('option', { value: c.id }, c.name)));
  catId.value = values.category_id ?? defaultCategoryId ?? '';
  const category = h('div', { class: 'mb-5' }, h('label', { class: 'a-label', for: catId.id }, 'Category'), catId);

  const featured = checkbox({ label: 'Featured', help: 'Marks your best work (screen readers announce it).', checked: Boolean(values.is_featured) });
  const publish = showPublish ? checkbox({ label: 'Publish now', help: 'Visible on your website right away. Leave off to save it as a draft.', checked: Boolean(values.is_published) }) : null;

  const details = h('details', { class: 'mb-5' }, h('summary', { class: 'cursor-pointer text-sm font-semibold min-h-[44px] flex items-center' }, 'More details (optional)'), h('div', { class: 'pt-3' }, description.el, service.el));

  const el = h('div', {}, title.el, category, alt.el, details, featured.el, publish?.el ?? null);

  const get = () => ({
    title: title.get().trim(),
    alt_text: alt.get().trim(),
    description: description.get().trim(),
    service_label: service.get().trim(),
    category_id: catId.value || null,
    is_featured: featured.input.checked,
    is_published: publish ? publish.input.checked : Boolean(values.is_published),
  });

  return {
    el,
    get,
    /** Validate and show errors inline. Returns true when OK. */
    validate() {
      const v = get();
      const result = validateItemFields(v, { publishing: v.is_published });
      title.setError(result.errors.title ?? '');
      alt.setError(result.errors.alt_text ?? '');
      description.setError(result.errors.description ?? '');
      service.setError(result.errors.service_label ?? '');
      if (!result.ok) (result.errors.title ? title.input : result.errors.alt_text ? alt.input : description.input).focus();
      return result.ok;
    },
    inputs: { title: title.input, alt: alt.input, publish: publish?.input ?? null, category: catId },
  };
}
