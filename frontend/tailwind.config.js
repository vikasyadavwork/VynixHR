/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        grey: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#374151",
          700: "#1f2937",
          800: "#111827",
        }, 
        whitesmoke: {
          50: "#f5f5f5",
          100: "#eaeaea",
          200: "#d6d6d6",
          300: "#c2c2c2",
          400: "#a6a6a6",
          500: "#8a8a8a",
          600: "#6e6e6e",
          700: "#525252",
          800: "#363636",
        },
        cadetblue: {
          100: "#e0f7f9",
          200: "#b0e0e6",  // light shade (this is actually "powder blue" but close)
          300: "#90cfcf",
          400: "#70bebe",
          500: "#5f9ea0",  // true cadetblue
          600: "#4c7f80",
          700: "#3a6363",
          800: "#2f4f4f",  // darkslategray — visually cohesive with cadetblue
          900: "#1f3434",
        },
        pink: {
          50: "#ffe4e6",
          100: "#fecdd3",
          200: "#fda4af",
          300: "#fb7185",
          400: "#f43f5e",
          500: "#e11d48", // Default pink
          600: "#be123c",
          700: "#9f1239",
          800: "#881337",
          900: "#701a33",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
