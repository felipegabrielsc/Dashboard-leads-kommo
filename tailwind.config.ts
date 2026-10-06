import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3efe6",
        card: "#fffdf8",
        ink: "#1c1915",
        mute: "#6d655c",
        line: "#e4dccf",
        pine: "#1b6b43",
        pineSoft: "#e7f5ec",
        wine: "#9f2d2d",
        wineSoft: "#fdeeee",
        sea: "#1e4d7b",
        seaSoft: "#e7f1f8",
        brass: "#8a5a12",
        brassSoft: "#fbf3e0",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(28,25,21,0.04), 0 16px 40px rgba(88, 62, 28, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
