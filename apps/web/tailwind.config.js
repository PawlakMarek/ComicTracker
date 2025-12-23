/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["\"Bodoni Moda\"", "serif"],
        body: ["\"IBM Plex Sans\"", "sans-serif"]
      },
      colors: {
        ink: {
          900: "#0b0b0b",
          800: "#151414",
          700: "#231f1f"
        },
        mist: {
          50: "#f7f5f2",
          100: "#f1ebe4",
          200: "#e5ddd4",
          300: "#d7ccbf"
        },
        ember: {
          500: "#f06b3e",
          600: "#d6572c",
          700: "#b8451f"
        },
        moss: {
          500: "#2f6d6a",
          600: "#255e5b",
          700: "#1d4f4c"
        }
      },
      boxShadow: {
        soft: "0 24px 60px -40px rgba(15, 12, 8, 0.45)",
        card: "0 18px 40px -28px rgba(13, 12, 10, 0.55)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        },
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        fadeUp: "fadeUp 0.6s ease-out forwards"
      }
    }
  },
  plugins: []
};
