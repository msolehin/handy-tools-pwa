/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        white: 'rgb(var(--color-white) / <alpha-value>)',
        black: 'rgb(var(--color-black) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      // `animate-fade-in` and `animate-slide-up` were already used in 28 files and 101 places,
      // but the keyframes never existed — every one of those animations was silently a no-op.
      keyframes: {
        'fade-in': {
          from: { opacity: '0', translate: '0 4px' },
          to: { opacity: '1', translate: '0 0' },
        },
        // Both animations move with the `translate` property, not `transform`: with fill-mode
        // `both` a transform keyframe sticks around forever and wipes any Tailwind transform on
        // the same element — which is how every `left-1/2 -translate-x-1/2` toast and the peek
        // "Menu" button ended up sitting half a width to the right.
        'slide-up': {
          from: { translate: '0 100%' },
          to: { translate: '0 0' },
        },
        // Each headline line rises out of its own overflow-hidden mask, so the words arrive
        // from behind the line above rather than simply fading in.
        'headline-rise': {
          from: { transform: 'translateY(105%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('light', 'html.light &');
    },
  ],
}
