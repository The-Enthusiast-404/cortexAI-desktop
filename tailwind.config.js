import scrollbar from "tailwind-scrollbar";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class", // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        "chat-dark": "#1a1b1e",
        "chat-darker": "#141517",
        "chat-light": "#ffffff",
        "chat-lighter": "#f9fafb",
        "chat-border": {
          light: "#e5e7eb",
          dark: "#2d2d2d",
        },
        "chat-input": {
          light: "#ffffff",
          dark: "#2d2d2d",
        },
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
