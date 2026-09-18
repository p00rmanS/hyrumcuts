/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.php',
    './public/assets/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        ivory: '#F4F0E8',
        paper: '#FFFFFF',
        stone: '#A7A198',
        copper: '#B56B3B',
      },
      fontFamily: {
        // No external font requests: self-hosting real display/body faces
        // is listed in CONTENT_CHECKLIST.md for the client to supply, and
        // until then this stack keeps the editorial-serif / clean-sans
        // pairing the brief calls for without a third-party font request.
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
