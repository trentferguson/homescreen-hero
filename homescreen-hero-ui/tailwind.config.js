/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-hover": "rgb(var(--color-primary-hover) / <alpha-value>)",
        "background-light": "#f6f6f8",
        "background-dark": "rgb(var(--color-bg-dark) / <alpha-value>)",
        "card-dark": "rgb(var(--color-card-dark) / <alpha-value>)",
        "card-hover": "rgb(var(--color-card-hover) / <alpha-value>)",
        slate: {
          950: "rgb(var(--color-slate-950) / <alpha-value>)",
          900: "rgb(var(--color-slate-900) / <alpha-value>)",
          800: "rgb(var(--color-slate-800) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-expand": {
          from: { opacity: "0", transform: "translateY(-8px)", maxHeight: "0" },
          to: { opacity: "1", transform: "translateY(0)", maxHeight: "400px" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-expand": "slide-expand 0.4s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
