import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#f7f7f5",
        panel: "#ffffff",
        border: "#e7e5e4",
        text: "#1c1917",
        muted: "#78716c",
      },
    },
  },
  plugins: [],
};

export default config;
