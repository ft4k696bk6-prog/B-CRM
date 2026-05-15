import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#eef7f1",
        muted: "#8ea39a",
        line: "rgba(159, 191, 176, 0.18)",
        panel: "#0d1815",
        solar: "#d7b56d",
        leaf: "#30d391",
        sky: "#55b7a1",
        warn: "#d99a45",
        danger: "#ff6b6b"
      },
      boxShadow: {
        soft: "0 22px 60px rgba(0, 0, 0, 0.32)"
      }
    }
  },
  plugins: []
};

export default config;
