/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'sage-primary': '#8FA989',
        'sage-deep': '#5C7A58',
        'coral-accent': '#E8876A',
        'plum-dark': '#2D1B2E',
        'cream-bg': '#FAF6F0',
        'cream-card': '#FFFFFF',
        'amber-warn': '#E8B84F',
        terracotta: '#C85A44',
        moss: '#3F5D3C',
        sand: '#EFE4D2',
        'ink-60': '#5A4A5C',
        'ink-40': '#8F7F90',
      },
      fontFamily: {
        fraunces: ['Fraunces', 'serif'],
        inter: ['Inter', 'sans-serif'],
        jetbrainsMono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
