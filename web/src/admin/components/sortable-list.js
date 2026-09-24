import Sortable from 'sortablejs';
import { h } from '../../lib/dom.js';
import { toast } from '../ui.js';

/**
 * A reorderable list that works three ways:
 *   - drag the handle (mouse or touch),
 *   - the Move up / Move down buttons (keyboard, screen readers, no dragging needed),
 *   - both save through the same `onReorder`, which should persist atomically.
 *
 * If saving fails the list snaps back to the previous order, so what is on
 * screen always matches what is stored.
 *
 * @param {{
 *   items: Array<{ id: string }>,
 *   renderItem: (item: any, controls: { handle: HTMLElement, up: HTMLElement, down: HTMLElement }) => HTMLElement,
 *   onReorder: (ids: string[]) => Promise<void>,
 *   label: string,
 * }} options
 */
export function sortableList({ items, renderItem, onReorder, label }) {
  let order = items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const status = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const list = h('ul', { class: 'space-y-2', 'aria-label': label });
  let busy = false;

  function build() {
    list.replaceChildren();
    order.forEach((id, index) => {
      const item = byId.get(id);
      const handle = h('span', { class: 'drag-handle', 'aria-hidden': 'true', title: 'Drag to reorder' }, '⋮⋮');
      const up = h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm', 'aria-label': `Move ${nameOf(item)} up`, disabled: index === 0, onClick: () => move(id, -1) }, '↑');
      const down = h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm', 'aria-label': `Move ${nameOf(item)} down`, disabled: index === order.length - 1, onClick: () => move(id, 1) }, '↓');
      const li = h('li', { dataset: { id } }, renderItem(item, { handle, up, down }));
      list.appendChild(li);
    });
  }

  const nameOf = (item) => item.title ?? item.name ?? item.question ?? item.reviewer_name ?? 'item';

  async function commit(nextOrder, announce) {
    if (busy) return;
    const previous = order;
    order = nextOrder;
    busy = true;
    build();
    try {
      await onReorder(order);
      status.textContent = announce;
    } catch (error) {
      order = previous; // roll back so the screen matches what is saved
      build();
      toast(`Couldn't save the new order. ${error.message}`, { type: 'error' });
    } finally {
      busy = false;
    }
  }

  function move(id, delta) {
    const from = order.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commit(next, `${nameOf(byId.get(id))} moved to position ${to + 1} of ${order.length}.`).then(() => {
      // Keep keyboard focus on the same control after the list re-renders.
      list.querySelector(`li[data-id="${CSS.escape(id)}"] button[aria-label$="${delta < 0 ? 'up' : 'down'}"]:not([disabled])`)?.focus();
    });
  }

  build();
  Sortable.create(list, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    forceFallback: false,
    onEnd: (evt) => {
      if (evt.oldIndex === evt.newIndex) return;
      const next = [...order];
      next.splice(evt.newIndex, 0, next.splice(evt.oldIndex, 1)[0]);
      // Sortable already moved the DOM node; commit() rebuilds from `order`, which is the source of truth.
      commit(next, `${nameOf(byId.get(next[evt.newIndex]))} moved to position ${evt.newIndex + 1} of ${order.length}.`);
    },
  });

  const root = h('div', {}, status, list);
  return {
    el: root,
    /** Replace the items (after an edit) without losing the wiring. */
    refresh(nextItems) {
      byId.clear();
      for (const i of nextItems) byId.set(i.id, i);
      order = nextItems.map((i) => i.id);
      build();
    },
  };
}
