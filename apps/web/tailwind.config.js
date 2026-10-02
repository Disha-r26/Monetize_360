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
        ledger: "#F2F4F1",
        paper: "#FFFFFF",
        ink: {
          DEFAULT: "#13202C",
          muted: "#4A5D6E",
          subtle: "#8295A5",
          border: "#DDE3DA",
        },
        marigold: {
          DEFAULT: "#E59A00",
          light: "#FFF4DE",
        },
        lagoon: {
          DEFAULT: "#0E8F83",
          light: "#E3F6F4",
        },
        cobalt: {
          DEFAULT: "#2F5BEA",
          light: "#EBF0FD",
        },
        coral: {
          DEFAULT: "#D9453D",
          light: "#FDECEB",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};
