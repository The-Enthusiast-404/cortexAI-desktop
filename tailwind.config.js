import scrollbar from "tailwind-scrollbar";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-dark": "rgb(var(--color-primary-dark) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-dark": "rgb(var(--color-accent-dark) / <alpha-value>)",

        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-dark": "rgb(var(--color-surface-dark) / <alpha-value>)",
        "surface-secondary":
          "rgb(var(--color-surface-secondary) / <alpha-value>)",
        "surface-secondary-dark":
          "rgb(var(--color-surface-secondary-dark) / <alpha-value>)",

        text: "rgb(var(--color-text) / <alpha-value>)",
        "text-dark": "rgb(var(--color-text-dark) / <alpha-value>)",
        "text-secondary": "rgb(var(--color-text-secondary) / <alpha-value>)",
        "text-secondary-dark":
          "rgb(var(--color-text-secondary-dark) / <alpha-value>)",

        divider: "rgb(var(--color-divider) / <alpha-value>)",
        "divider-dark": "rgb(var(--color-divider-dark) / <alpha-value>)",

        input: "rgb(var(--color-input) / <alpha-value>)",
        "input-dark": "rgb(var(--color-input-dark) / <alpha-value>)",

        hover: "rgb(var(--color-hover) / <alpha-value>)",
        "hover-dark": "rgb(var(--color-hover-dark) / <alpha-value>)",

        user: "rgb(var(--color-user) / <alpha-value>)",
        "user-dark": "rgb(var(--color-user-dark) / <alpha-value>)",
        assistant: "rgb(var(--color-assistant) / <alpha-value>)",
        "assistant-dark": "rgb(var(--color-assistant-dark) / <alpha-value>)",
      },
      transitionProperty: {
        theme:
          "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        normal: "var(--transition-normal)",
        slow: "var(--transition-slow)",
      },
      keyframes: {
        slideDown: {
          "0%": { height: 0, opacity: 0 },
          "100%": { height: "var(--kb-accordion-content-height)", opacity: 1 },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        messageIn: {
          "0%": { transform: "translateY(10px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
      },
      animation: {
        slideDown: "slideDown 200ms ease-out",
        fadeIn: "fadeIn 200ms ease-out",
        messageIn: "messageIn 200ms ease-out",
      },
    },
  },
  plugins: [scrollbar({ nocompatible: true })],
};
