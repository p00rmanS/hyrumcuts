/**
 * Tiny, safe DOM builder.
 *
 * Content from the database is ALWAYS inserted as text (textContent / text
 * nodes) and never parsed as HTML, so a review or title containing markup is
 * displayed literally instead of being executed. Inline event-handler strings
 * and `javascript:` URLs are refused.
 */

import { toUrl } from './base.js';

const URL_ATTRS = new Set(['href', 'src', 'poster', 'action', 'formaction', 'srcset']);

export function isSafeUrlAttribute(value) {
  // Browsers drop tabs, newlines and control characters while parsing a URL,
  // so "java\tscript:" still runs. Remove them before checking the scheme.
  // eslint-disable-next-line no-control-regex
  const v = String(value).replace(/[\u0000-\x20\u007f]+/g, '').toLowerCase();
  return !(v.startsWith('javascript:') || v.startsWith('data:text') || v.startsWith('vbscript:'));
}

/**
 * @param {string} tag
 * @param {Record<string, any>} [attrs] class, dataset, aria-*, boolean attrs, on* functions
 * @param {...(Node | string | number | null | undefined | false | Array<any>)} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') {
      el.className = String(value);
    } else if (name === 'dataset') {
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined && v !== null) el.dataset[k] = String(v);
      }
    } else if (name.startsWith('on')) {
      if (typeof value === 'function') el.addEventListener(name.slice(2).toLowerCase(), value);
      // A string here would be an inline handler: refuse.
    } else if (URL_ATTRS.has(name)) {
      if (!isSafeUrlAttribute(value)) continue;
      // Root-relative app paths ("/booking/") get the site's base path (e.g. "/hyrumcuts/booking/").
      const v = String(value);
      el.setAttribute(name, name === 'srcset' ? v.split(', ').map((part) => toUrl(part)).join(', ') : toUrl(v));
    } else if (value === true) {
      el.setAttribute(name, '');
    } else {
      el.setAttribute(name, String(value));
    }
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children) {
    if (child === undefined || child === null || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

/** Replace all children of `parent`. */
export function mount(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
}

/** Show/hide with the `hidden` class used across the site. */
export function setVisible(el, visible) {
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

/** Build an inline SVG icon from a fixed, developer-authored path string. */
export function svgIcon(pathData, { size = 20, stroke = 'currentColor', strokeWidth = 1.75, fill = 'none' } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', fill);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', String(strokeWidth));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}
