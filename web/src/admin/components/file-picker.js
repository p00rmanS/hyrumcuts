import { h } from '../../lib/dom.js';
import { uid } from '../ui.js';

/**
 * Drag-and-drop zone that is also a normal, keyboard-operable file picker.
 * On phones the native picker offers the photo library, files or the camera.
 *
 * @param {{
 *   accept: string, multiple?: boolean, label: string, hint?: string,
 *   onFiles: (files: File[]) => void, capture?: 'environment'|'user',
 * }} options
 */
export function filePicker({ accept, multiple = false, label, hint, onFiles, capture }) {
  const id = uid('file');
  const input = h('input', { id, type: 'file', accept, multiple, class: 'sr-only', capture, 'aria-describedby': hint ? `${id}-hint` : undefined });
  const zone = h(
    'label',
    { for: id, class: 'block cursor-pointer border-2 border-dashed border-ink/40 bg-paper hover:border-ink text-center px-4 py-8 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-copper-dark' },
    h('span', { class: 'block font-semibold' }, label),
    h('span', { class: 'block text-sm text-muted mt-1' }, multiple ? 'Tap to choose, or drop files here' : 'Tap to choose, or drop a file here'),
  );

  const deliver = (list) => {
    const files = [...(list ?? [])];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  input.addEventListener('change', () => {
    deliver(input.files);
    input.value = ''; // allow choosing the same file again after a fix
  });
  for (const type of ['dragenter', 'dragover']) {
    zone.addEventListener(type, (e) => {
      e.preventDefault();
      zone.classList.add('border-ink', 'bg-ivory');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    zone.addEventListener(type, (e) => {
      e.preventDefault();
      zone.classList.remove('border-ink', 'bg-ivory');
    });
  }
  zone.addEventListener('drop', (e) => deliver(e.dataTransfer?.files));

  return { el: h('div', {}, input, zone, hint ? h('p', { id: `${id}-hint`, class: 'a-help' }, hint) : null), input };
}
