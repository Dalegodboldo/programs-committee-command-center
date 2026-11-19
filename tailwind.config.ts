import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colors come from CSS variables so admins can change them on the Design page (lib/settings.ts).
        brand: Object.fromEntries([50, 100, 500, 600, 700, 900].map((n) => [n, `rgb(var(--brand-${n}) / <alpha-value>)`])),
        gold: Object.fromEntries([50, 100, 400, 600, 800].map((n) => [n, `rgb(var(--gold-${n}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
};
export default config;
