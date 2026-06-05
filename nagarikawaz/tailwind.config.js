/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9f4', 100: '#d9f0e5', 200: '#b3e1cb',
          300: '#7dc9a8', 400: '#4aad82', 500: '#2d9265',
          600: '#1f7350', 700: '#175c40', 800: '#0f4830', 900: '#082e1e',
        },
        nepal: { red: '#DC143C', blue: '#003893' },
      },
      fontFamily: {
        display: ['"Mukta"', '"DM Sans"', 'sans-serif'],
        body:    ['"Mukta"', '"DM Sans"', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in':  'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: { '0%': { transform: 'translateY(14px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
}
