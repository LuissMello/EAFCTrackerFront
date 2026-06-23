/** @type {import('tailwindcss').Config} */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ['"Saira Condensed"', "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        bg: withAlpha("--color-bg"),
        surface: {
          DEFAULT: withAlpha("--color-surface"),
          raised: withAlpha("--color-surface-raised"),
          sunken: withAlpha("--color-surface-sunken"),
        },
        fg: {
          DEFAULT: withAlpha("--color-fg"),
          secondary: withAlpha("--color-fg-secondary"),
          muted: withAlpha("--color-fg-muted"),
          subtle: withAlpha("--color-fg-subtle"),
        },
        border: {
          DEFAULT: withAlpha("--color-border"),
          strong: withAlpha("--color-border-strong"),
        },
        accent: {
          DEFAULT: withAlpha("--color-accent"),
          fg: withAlpha("--color-accent-fg"),
        },
        positive: {
          DEFAULT: withAlpha("--color-positive"),
          soft: withAlpha("--color-positive-soft"),
          fg: withAlpha("--color-positive-fg"),
        },
        warning: {
          DEFAULT: withAlpha("--color-warning"),
          soft: withAlpha("--color-warning-soft"),
          fg: withAlpha("--color-warning-fg"),
        },
        negative: {
          DEFAULT: withAlpha("--color-negative"),
          soft: withAlpha("--color-negative-soft"),
          fg: withAlpha("--color-negative-fg"),
        },
        quality: {
          poor: withAlpha("--color-quality-poor"),
          decent: withAlpha("--color-quality-decent"),
          good: withAlpha("--color-quality-good"),
          great: withAlpha("--color-quality-great"),
        },
        gold: {
          DEFAULT: withAlpha("--color-gold"),
          soft: withAlpha("--color-gold-soft"),
          fg: withAlpha("--color-gold-fg"),
        },
        "crest-chip": withAlpha("--color-crest-chip"),
      },
      ringColor: {
        accent: withAlpha("--color-accent"),
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        raised: "0 4px 12px -2px rgb(15 23 42 / 0.10)",
      },
    },
  },
  plugins: [],
};
