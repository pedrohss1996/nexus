/** @type {import('tailwindcss').Config} */

// Azul da marca Nexus (#2860AB) — a única cor de destaque do sistema.
const primary = {
  50: '#eef3fc',
  100: '#dce6f9',
  200: '#b8cdf3',
  300: '#8fa9e9',
  400: '#6d8fe0',
  500: '#2860AB',
  600: '#215099',
  700: '#1c4087',
  800: '#173075',
  900: '#122063',
  950: '#0c1640',
};

// Cinzas neutros de verdade. O tema escuro usava "slate" (azul-marinho);
// remapeado aqui, todas as views passam a usar estes tons sem precisar
// trocar classe por classe. Escala pensada para o escuro: 900 é o fundo,
// 800 a superfície, 700 a borda/hover, 600 a borda de controle.
const neutralDark = {
  50: '#f7f7f7',
  100: '#ededed',
  200: '#d9d9d9',
  300: '#bdbdbd',
  400: '#a3a3a3',
  500: '#7a7a7a',
  600: '#454545',
  700: '#2e2e2e',
  800: '#1c1c1c',
  900: '#121212',
  950: '#0a0a0a',
};

module.exports = {
  darkMode: 'class',
  content: [
    './views/**/*.ejs',
    './public/**/*.js',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        primary,
        // Cores de destaque soltas pelas views (ciano, índigo, violeta)
        // convergem para o azul da marca: uma cor só, nos dados e na ação.
        cyan: primary,
        indigo: primary,
        violet: primary,
        purple: primary,
        slate: neutralDark,
        neutral: neutralDark,
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
        // Papéis semânticos (definidos em input.css para claro e escuro)
        ground: 'rgb(var(--ground) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        active: 'rgb(var(--active) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        negative: 'rgb(var(--negative) / <alpha-value>)',
      },
      borderColor: {
        DEFAULT: 'rgb(var(--line) / 1)',
      },
    },
  },
  plugins: [],
};
