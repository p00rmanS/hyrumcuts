import { h } from '../../lib/dom.js';
import { IMAGE } from '../../lib/media-config.js';
import { singleImageCard } from '../components/single-image.js';
import { processSingleImage } from '../services/image-processing.js';
import { getSettings } from '../services/data.js';
import { isPlaceholderPortrait } from '../../lib/placeholders.js';
import { pageHeader } from '../ui.js';

/** The portrait shown in the About section. */
export default async function profilePhoto({ ownerId }) {
  const settings = await getSettings();
  const card = singleImageCard({
    ownerId,
    settings,
    folder: 'profile',
    pathKey: 'profile_photo_path',
    altKey: 'profile_photo_alt',
    requireAlt: true,
    altHelp: 'A short description for people using screen readers. Say what the photo shows, not "photo of".',
    heading: 'Your portrait',
    help: 'Shown next to your biography. A tall (portrait-orientation) photo of you works best.',
    aspect: 'aspect-[4/5]',
    objectName: 'portrait',
    process: (file) => processSingleImage(file, IMAGE.portrait),
  });
  const note = isPlaceholderPortrait(settings) ? h('div', { class: 'a-alert-warn max-w-2xl mb-4' }, 'This is a placeholder portrait. Choose your own photo below to replace it.') : null;
  return h('div', { class: 'a-page' }, pageHeader('Profile photo', 'The portrait in your About section.'), note, card.el, h('div', { class: 'a-alert-info max-w-2xl' }, 'Only use photos you own or have permission to use. Don\'t include clients\' faces without their OK.'));
}
