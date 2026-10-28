/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // Industrial UpdatePilot palette
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffe',
          300: '#7cc3fd',
          400: '#36a3fa',
          500: '#0071e3', // Apple signature blue
          600: '#006ac8',
          700: '#0154a2',
          800: '#064785',
          900: '#0b3c6f',
          950: '#07264a',
        },
        status: {
          success: '#34c759', // Apple system green
          warning: '#ff9500', // Apple system orange
          error: '#ff3b30',   // Apple system red
          info: '#0071e3',    // Apple system blue
          neutral: '#8e8e93', // Apple system gray
        },
      },
      borderRadius: {
        '3xl': '1.5rem',
        '2xl': '1.25rem',
        xl: '1rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'apple': '0 4px 20px -2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'apple-hover': '0 20px 40px -12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'apple-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
        'apple-glow': '0 0 35px -5px rgba(0, 113, 227, 0.25)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'apple-fade-in': 'appleFadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'apple-shimmer': 'appleShimmer 3s ease-in-out infinite',
        'apple-breathe': 'appleBreathe 3s ease-in-out infinite',
        'apple-float': 'appleFloat 4s ease-in-out infinite',
      },
      keyframes: {
        appleFadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.98)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        },
        appleShimmer: {
          '0%': { transform: 'translateX(-100%) skewX(-15deg)' },
          '100%': { transform: 'translateX(250%) skewX(-15deg)' },
        },
        appleBreathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9', boxShadow: '0 0 0 0 rgba(0, 113, 227, 0.3)' },
          '50%': { transform: 'scale(1.025)', opacity: '1', boxShadow: '0 0 28px 6px rgba(0, 113, 227, 0.2)' },
        },
        appleFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};
