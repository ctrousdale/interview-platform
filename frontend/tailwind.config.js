/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        carbon: { 950: '#161616', 900: '#1c1c1c', 850: '#222222', 800: '#262626', 700: '#393939', 600: '#525252' },
        ink: '#f2f4f8', muted: '#b6b8bb', purple: '#be95ff', cyan: '#78a9ff', mint: '#42be65', coral: '#ee5396',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { panel: '0 16px 48px rgba(0, 0, 0, 0.12)' },
    },
  },
  plugins: [],
}
