import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      borderRadius: {
        "3xl": "3.5rem",
        "2xl": "3rem",
        xl: "2.5rem",
        lg: "2rem",
        md: "1.5rem",
        DEFAULT: "1rem",
        sm: "0.75rem",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
            opacity: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
          to: {
            height: "0",
            opacity: "0",
          },
        },
        // Shimmer effect for primary CTA buttons
        shimmer: {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(100%)",
          },
        },
        // QR Scanner laser animation (Solar Flare orange)
        scan: {
          "0%, 100%": {
            transform: "translateY(0%)",
            opacity: "0.8",
          },
          "50%": {
            transform: "translateY(100%)",
            opacity: "1",
          },
        },
        // Cascade fade-in for table rows (waterfall effect)
        "cascade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(8px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        // Float-in effect for cards
        "float-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(16px) scale(0.98)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0) scale(1)",
          },
        },
        // Fade-in animation
        "fade-in": {
          "0%": {
            opacity: "0",
          },
          "100%": {
            opacity: "1",
          },
        },
        // Slide-in from bottom
        "slide-in-from-bottom": {
          "0%": {
            transform: "translateY(16px)",
            opacity: "0",
          },
          "100%": {
            transform: "translateY(0)",
            opacity: "1",
          },
        },
        // Pulse glow for status indicators
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.6))",
          },
          "50%": {
            opacity: "0.7",
            filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.8))",
          },
        },
        // Indicator pill bounce
        "indicator-bounce": {
          "0%": {
            transform: "scaleY(0.8)",
          },
          "50%": {
            transform: "scaleY(1.1)",
          },
          "100%": {
            transform: "scaleY(1)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
        scan: "scan 2s ease-in-out infinite",
        "cascade-in": "cascade-in 0.4s ease-out forwards",
        "float-in": "float-in 0.5s ease-out forwards",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-in-bottom": "slide-in-from-bottom 0.3s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "indicator-bounce": "indicator-bounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionTimingFunction: {
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;