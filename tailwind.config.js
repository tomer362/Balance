/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'sage-primary': 'var(--sage-primary)',
        'sage-deep': 'var(--sage-deep)',
        'coral-accent': 'var(--coral-accent)',
        'plum-dark': 'var(--plum-dark)',
        'cream-bg': 'var(--cream-bg)',
        'cream-card': 'var(--cream-card)',
        'amber-warn': 'var(--amber-warn)',
        terracotta: 'var(--terracotta)',
        moss: 'var(--moss)',
        sand: 'var(--sand)',
        'ink-60': 'var(--ink-60)',
        'ink-40': 'var(--ink-40)',
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
