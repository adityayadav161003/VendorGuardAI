/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0b0f19',
          card: '#131b2e',
          cardHover: '#1a243d',
          border: '#233252',
          accent: '#3b82f6',
          cyan: '#06b6d4',
          amber: '#f59e0b',
          emerald: '#10b981',
          rose: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}

// Dark mode theme
