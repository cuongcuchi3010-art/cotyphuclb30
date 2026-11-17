/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: { sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'] },
      colors: {
        son: { DEFAULT: '#C8102E', 50: '#FDEBEE', 100: '#F9D0D6', 600: '#A50D26', 700: '#850A1F' },
        nghe: { DEFAULT: '#F2A900', 50: '#FFF7E0', 100: '#FDEBB3', 600: '#C98C00' },
        ngoc: { DEFAULT: '#0E9F8E', 50: '#E3F7F4', 100: '#BDEDE6', 600: '#0B7F72', 700: '#085F55' },
        giay: { DEFAULT: '#FBF6EC', dark: '#17140F' },
      },
      boxShadow: { card: '0 6px 24px -8px rgb(0 0 0 / 0.25)' },
    },
  },
  plugins: [],
};
