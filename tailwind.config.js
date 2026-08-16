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
        // A segment sweeping its track, for work whose duration genuinely cannot be predicted —
        // a debounce plus a round trip on someone's mobile data. `translate` again, not
        // `transform`, for the reason above; being infinite it needs no fill-mode either.
        //
        // Starts only just off the left edge, not a full segment out: a save is on screen for
        // roughly a second, so a sweep that spends its first frames invisible has already spent
        // most of its budget before the user sees anything happen.
        indeterminate: {
          from: { translate: '-40% 0' },
          to: { translate: '260% 0' },
        },
        // The measurable half of a save: the debounce before the request leaves. Width, not
        // translate, because this one is a real quantity being shown — it has to end flush with
        // the right-hand edge of its track, and the duration is set per-render from DEBOUNCE_MS.
        'progress-fill': {
          from: { width: '0%' },
          to: { width: '100%' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        // linear, emphatically not ease-in-out. An eased sweep crawls at both ends of every
        // cycle, and with only about one cycle ever visible that reads as a bar sitting still.
        // Constant speed is the whole point of an indeterminate indicator: it has no progress
        // to report, so its only job is to look unmistakably alive.
        indeterminate: 'indeterminate 1s linear infinite',
        // `forwards`, so it holds at full width if the push takes a moment to start rather than
        // snapping back to empty. The duration here is a placeholder — SyncToast overrides it
        // inline with the wait the store actually reported.
        'progress-fill': 'progress-fill 800ms linear forwards',
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('light', 'html.light &');
    },
  ],
}
