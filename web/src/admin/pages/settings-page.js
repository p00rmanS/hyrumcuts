import { h } from '../../lib/dom.js';
import { isPlaceholderBio } from '../../lib/placeholders.js';
import { getSettings, updateSettings } from '../services/data.js';
import { SETTINGS_SECTIONS, validateSection } from '../validation/settings.js';
import { fieldGroup, pageHeader, toast, trackDirty, withBusy } from '../ui.js';

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

      const bar = h('div', { class: 'mt-2 flex flex-wrap items-center gap-4' }, save, dirty.indicator);
      form.appendChild(bar);

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
            toast('Saved. Your website will show this the next time someone loads it.');
          } catch (error) {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
            errorBox.focus();
          }
        }, 'Saving…');
      });

      // The share image lives on the SEO page and needs its own uploader.
      const blocks = [pageHeader(section.title, section.description), extra, form];
      if (sectionKey === 'seo') {
        const { shareImageCard } = await import('./share-image.js');
        blocks.push(await shareImageCard({ ownerId, settings, main }));
      }
      return { node: h('div', { class: 'a-page' }, ...blocks.filter(Boolean)), cleanup: () => dirty.dispose() };
    },
  };
}
