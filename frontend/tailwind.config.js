/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VendorGuard heritage palette — olive / beige / brown with brass accents
        cream: {
          50: '#FBF8F1',
          100: '#F7F2E7',
          200: '#F0E9D8',
          300: '#E7DCC3',
          400: '#D9CBAA',
        },
        linen: '#FDFAF3',
        espresso: {
          DEFAULT: '#211A12',
          light: '#2E2519',
          soft: '#3B3022',
        },
        olive: {
          50: '#F4F1E2',
          100: '#E7E4C8',
          200: '#CDD09C',
          300: '#AFB777',
          400: '#93A05C',
          500: '#77854A',
          600: '#5F6D3B',
          700: '#4C572F',
          800: '#3C4525',
          900: '#2D341C',
          950: '#1F2413',
        },
        brown: {
          100: '#EFE4D0',
          200: '#DECBA9',
          300: '#C7A97B',
          400: '#AE8A56',
          500: '#926F41',
          600: '#775731',
          700: '#5C4224',
          800: '#44301A',
          900: '#2E2011',
        },
        brass: {
          DEFAULT: '#B9975B',
          light: '#D4BC88',
          deep: '#96763F',
        },
        // Semantic (warm, on-palette)
        sage: { DEFAULT: '#7D9464', deep: '#5E7549' },
        terracotta: { DEFAULT: '#B0563A', deep: '#8F4229' },
        gold: { DEFAULT: '#C29B4A', deep: '#A17F35' },
        stonewarm: { DEFAULT: '#8C8371', deep: '#6E6656' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        body: ['Outfit', 'Avenir Next', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(62, 48, 26, 0.06), 0 6px 20px -6px rgba(62, 48, 26, 0.12)',
        lifted: '0 2px 4px rgba(62, 48, 26, 0.08), 0 14px 34px -8px rgba(62, 48, 26, 0.22)',
        brass: '0 0 0 1px rgba(185, 151, 91, 0.35), 0 8px 24px -10px rgba(150, 118, 63, 0.45)',
        panel: 'inset 0 1px 0 rgba(255,255,255,0.55)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        rise: 'rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.4s ease both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
      borderRadius: {
        xl2: '1.15rem',
      },
    },
  },
  plugins: [],
}

// VendorGuard heritage theme
