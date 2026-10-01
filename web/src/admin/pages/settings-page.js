import { h } from '../../lib/dom.js';
import { announcementStatus } from '../../lib/content.js';
import { isPlaceholderBio } from '../../lib/placeholders.js';
import { searchPreview, SECTION_PUBLIC_PATH } from './settings-helpers.js';
import { getSettings, updateSettings } from '../services/data.js';
import { SETTINGS_SECTIONS, validateSection } from '../validation/settings.js';
import { fieldGroup, pageHeader, saveShortcut, toast, trackDirty, withBusy } from '../ui.js';

/**
 * One form component for every structured settings page (Hero, About,
 * Booking link, Contact, Social links, SEO). Structured fields only: there is
 * deliberately no HTML editor, so nothing the owner types can break the design
 * or inject markup.
 */
export function forSection(sectionKey) {
  return {
    default: async function settingsPage({ ownerId, setGuard, main }) {
      const section = SETTINGS_SECTIONS[sectionKey];
      let settings = await getSettings();

      const group = fieldGroup(section.fields, settings);
      const errorBox = h('div', { class: 'a-alert-error hidden mb-4', role: 'alert', tabindex: '-1' });
      const save = h('button', { type: 'submit', class: 'a-btn-primary' }, 'Save changes');
      const form = h('form', { class: 'a-card max-w-2xl', novalidate: true }, errorBox, ...group.els);
      const dirty = trackDirty(form, { setGuard });

      // Booking page extra: a clear explanation of what each provider does.
      const bioNotice = sectionKey === 'about' && isPlaceholderBio(settings.about_bio) ? h('div', { class: 'a-alert-warn max-w-2xl mb-4' }, 'Your biography is still the starter placeholder text. Replace it with your own words and save.') : null;
      const extra = bioNotice ?? (sectionKey === 'booking' ? h('div', { class: 'a-alert-info max-w-2xl mb-4' }, 'Your booking system stays exactly as it is. Changing the link here only changes where the "Book" buttons send visitors. Leave the provider on "None" to use the on-site request form only.') : null);

      const shortcut = saveShortcut(form, save);
      const bar = h('div', { class: 'mt-2 flex flex-wrap items-center gap-4' }, save, dirty.indicator, shortcut.hint);
      form.appendChild(bar);

      // Live helpers that react as the owner types.
      const live = liveHelper(sectionKey, group, () => settings);
      if (live) form.addEventListener('input', live.update);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorBox.classList.add('hidden');
        group.clearErrors();
        const result = validateSection(sectionKey, group.values());
        if (!result.ok) {
          group.showErrors(result.errors);
          errorBox.textContent = 'Please fix the highlighted fields.';
          errorBox.classList.remove('hidden');
          return;
        }
        await withBusy(save, async () => {
          try {
            settings = await updateSettings(ownerId, result.cleaned);
            // Show exactly what was stored (URLs get https:// added, whitespace trimmed).
            for (const spec of section.fields) group.fields[spec.key].input.value = Array.isArray(settings[spec.key]) ? settings[spec.key].join('\n') : (settings[spec.key] ?? '');
            dirty.markClean();
            live?.update();
            toast('Saved. Your website will show this the next time someone loads it.');
          } catch (error) {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
            errorBox.focus();
          }
        }, 'Saving…');
      });

      // The share image lives on the SEO page and needs its own uploader.
      const publicPath = SECTION_PUBLIC_PATH[sectionKey];
      const viewLink = publicPath ? h('a', { href: publicPath, target: '_blank', rel: 'noopener noreferrer', class: 'a-btn-secondary' }, 'See it on your website ↗') : null;
      const blocks = [pageHeader(section.title, section.description, viewLink), extra, live?.el, form];
      if (sectionKey === 'seo') {
        const { shareImageCard } = await import('./share-image.js');
        blocks.push(await shareImageCard({ ownerId, settings, main }));
      }
      return { node: h('div', { class: 'a-page' }, ...blocks.filter(Boolean)), cleanup: () => {
        dirty.dispose();
        shortcut.dispose();
      } };
    },
  };
}

/**
 * Section-specific live feedback shown above the form:
 *  - Announcement: whether it is showing now, scheduled or ended.
 *  - SEO: a Google-style preview of the search result.
 */
function liveHelper(sectionKey, group, getSettings) {
  const current = () => ({ ...getSettings(), ...group.values() });

  if (sectionKey === 'announcement') {
    const el = h('div', { class: 'a-alert-info max-w-2xl mb-4', role: 'status', 'aria-live': 'polite' });
    const update = () => {
      const { state, message } = announcementStatus(current());
      el.className = `${state === 'live' ? 'a-alert-ok' : state === 'ended' ? 'a-alert-warn' : 'a-alert-info'} max-w-2xl mb-4`;
      el.replaceChildren(h('span', { class: 'font-semibold' }, 'Status: '), message);
    };
    update();
    return { el, update };
  }

  if (sectionKey === 'seo') {
    const title = h('p', { class: 'text-lg leading-snug text-[#1a0dab] break-words' });
    const url = h('p', { class: 'text-sm text-[#006621] break-all' });
    const desc = h('p', { class: 'text-sm text-[#4d5156] break-words' });
    const tips = h('ul', { class: 'mt-3 space-y-1 text-sm text-amber-900 list-disc pl-5' });
    const el = h(
      'section',
      { class: 'a-card max-w-2xl mb-4', 'aria-labelledby': 'seo-preview-h' },
      h('h2', { id: 'seo-preview-h', class: 'text-sm font-semibold uppercase tracking-wide text-muted mb-3' }, 'Preview in Google search results'),
      h('div', { class: 'bg-white p-4 border border-ink/10' }, url, title, desc),
      tips,
      h('p', { class: 'mt-2 text-xs text-muted' }, 'An approximation. Google decides the final wording and may change it.'),
    );
    const update = () => {
      const p = searchPreview(current(), { fallbackTitle: getSettings().brand_name });
      title.textContent = p.title;
      url.textContent = p.url;
      desc.textContent = p.description || 'No description yet.';
      tips.replaceChildren(...p.tips.map((t) => h('li', {}, t)));
    };
    update();
    return { el, update };
  }
  return null;
}
