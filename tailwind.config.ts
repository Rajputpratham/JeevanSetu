import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './components/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f2',
          100: '#d7ece2',
          200: '#aed9c6',
          300: '#82c2ab',
          400: '#4fa884',
          500: '#2e8f66',
          600: '#1f7453',
          700: '#1b5e45',
          800: '#174a38',
          900: '#123c2f',
          950: '#0b241b',
        },
        cream: '#faf9f6',
        ink: '#1f2a27',
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'Roboto',
          '"Noto Sans"',
          '"Noto Sans Devanagari"',
          '"Noto Sans Bengali"',
          '"Noto Sans Tamil"',
          '"Noto Sans Telugu"',
          '"Noto Sans Gujarati"',
          '"Noto Sans Kannada"',
          '"Noto Sans Oriya"',
          '"Noto Sans Malayalam"',
          '"Noto Nastaliq Urdu"',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgba(18, 60, 47, 0.08), 0 4px 16px rgba(18, 60, 47, 0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
export default config;
