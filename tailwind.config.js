/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,jsx,ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#1e1e1e',
          sidebar: '#252525',
          hover: '#2d2d2d',
          border: '#3a3a3a',
          text: '#dcddde',
          muted: '#808080',
          accent: '#7c3aed',
          link: '#7c6af7',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
