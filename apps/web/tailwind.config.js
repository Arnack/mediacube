/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        blue: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
        },
        surface: 'hsl(var(--surface))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px hsl(217 91% 60% / 0.3)' },
          '50%': { boxShadow: '0 0 16px hsl(217 91% 60% / 0.5)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-4px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        glow: 'glow 2s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.15s ease-out',
      },
      boxShadow: {
        'glow-sm': '0 0 8px hsl(217 91% 60% / 0.2)',
        'glow-md': '0 0 16px hsl(217 91% 60% / 0.3), 0 0 32px hsl(217 91% 60% / 0.1)',
        'glow-lg': '0 0 24px hsl(217 91% 60% / 0.4), 0 0 48px hsl(217 91% 60% / 0.15)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
