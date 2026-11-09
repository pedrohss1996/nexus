/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Habilita dark mode com classe 'dark'
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js",
    "./public/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef3fc',
          100: '#dce6f9',
          200: '#b8cdf3',
          300: '#8fa9e9',
          400: '#5c7ed9',
          500: '#2860AB',
          600: '#215099',
          700: '#1c4087',
          800: '#173075',
          900: '#122063',
          950: '#0c1640',
        },
        secondary: {
          50: '#f2f9ef',
          100: '#e5f3df',
          200: '#cbe8bf',
          300: '#a8d894',
          400: '#82CA5D',
          500: '#6bb84a',
          600: '#5a9e3d',
          700: '#4a8430',
          800: '#3a6a24',
          900: '#2a5019',
        },
        // Papéis semânticos (valores em input.css, claro e escuro), usados
        // pelas telas novas para acompanhar o tema sem repetir dark:*
        ground: 'rgb(var(--ground) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        active: 'rgb(var(--active) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        negative: 'rgb(var(--negative) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
