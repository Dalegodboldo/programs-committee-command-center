import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef2f9', 100: '#dce4f2', 500: '#3b5185', 600: '#1f3360', 700: '#1b2a4a', 900: '#0f1830' },
        gold: { 50: '#fdf6e9', 100: '#fbefd9', 400: '#e8a33d', 600: '#b9771a', 800: '#8a5a10' },
      },
    },
  },
  plugins: [],
};
export default config;
