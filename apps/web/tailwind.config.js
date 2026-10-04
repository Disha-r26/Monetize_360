/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ledger: "#F8FAFC",
        paper: "#FFFFFF",
        ink: {
          DEFAULT: "#0F172A",
          muted: "#475569",
          subtle: "#94A3B8",
          border: "#E2E8F0",
        },
        sidebar: {
          DEFAULT: "#0E3378",
          dark: "#092455",
          hover: "#154194",
          border: "#184293",
        },
        marigold: {
          DEFAULT: "#D97706",
          light: "#FEF3C7",
        },
        lagoon: {
          DEFAULT: "#059669",
          light: "#ECFDF5",
        },
        cobalt: {
          DEFAULT: "#2563EB",
          light: "#EFF6FF",
          hover: "#1D4ED8",
        },
        coral: {
          DEFAULT: "#E11D48",
          light: "#FFF1F2",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};
