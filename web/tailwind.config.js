/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surfaceAlt: 'var(--surface-alt)',
        border: 'var(--border)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        textMuted: 'var(--text-muted)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        income: 'var(--income)',
        expense: 'var(--expense)',
        warning: 'var(--warning)',
      },
      borderRadius: { card: '16px' },
      fontFamily: {
        display: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      transitionTimingFunction: {
        house: 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};
