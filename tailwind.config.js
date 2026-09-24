import { resolve } from 'node:path';

const root = import.meta.dirname;

/** @type {import('tailwindcss').Config} */
export default {
  content: [resolve(root, 'web/**/*.{html,js}')],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        ivory: '#F4F0E8',
        paper: '#FFFFFF',
        // Decorative only (borders, dividers) and text on dark backgrounds.
        // #A7A198 on white is 2.56:1, so it must not carry body text.
        stone: '#A7A198',
        // Muted body text on light backgrounds: 5.77:1 on white, 5.07:1 on ivory (WCAG AA).
        muted: '#6B655C',
        copper: '#B56B3B',
        // Small copper text and hover fills on light backgrounds: 5.82:1 on white,
        // 5.12:1 on ivory. Plain copper is only 3.6-4.1:1 there.
        'copper-dark': '#98532B',
      },
      fontFamily: {
        // No external font requests: keeps the editorial-serif / clean-sans
        // pairing without a third-party font download.
        display: ['Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', 'P052', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        content: '1400px',
      },
      letterSpacing: {
        widest2: '.28em',
      },
    },
  },
  plugins: [],
};
