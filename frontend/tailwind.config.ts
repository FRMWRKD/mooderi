import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          void: "#000000",
          surface: "#0a0a0a",
          elevated: "#111111",
          glass: "#0d0d0d",
        },
        accent: {
          blue: "#FFFFFF", // Changed to white for minimal look
          orange: "#FF6B35",
          purple: "#8B5CF6",
          green: "#10B981",
          yellow: "#F59E0B",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "rgba(255, 255, 255, 0.7)",
          tertiary: "rgba(255, 255, 255, 0.5)",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.15)",
          light: "rgba(255, 255, 255, 0.3)",
          focus: "rgba(255, 255, 255, 0.6)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Monaco", "monospace"],
      },
      borderRadius: {
        DEFAULT: "4px",
        lg: "6px",
        xl: "8px",
        "2xl": "12px",
        pill: "9999px",
      },
      boxShadow: {
        glow: "0 0 10px rgba(255, 255, 255, 0.1)",
        "glow-strong": "0 0 20px rgba(255, 255, 255, 0.15)",
        glass: "0 4px 20px rgba(0, 0, 0, 0.5)",
      },
      backdropBlur: {
        glass: "20px",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        marqueeVertical: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-100%)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        marquee: "marquee 40s linear infinite",
        "marquee-vertical": "marqueeVertical 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
