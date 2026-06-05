/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',
          400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',
          800:'#065f46',900:'#064e3b',950:'#022c22',
        },
        nepal: { red: '#DC143C', blue: '#003893' },
        surface: {
          DEFAULT: '#0d1a10',
          50:  '#f0faf4', 100: '#d4f0e2',
          900: '#0d1a10', 950: '#080f09',
        },
      },
      fontFamily: {
        display: ['"Mukta"', '"DM Sans"', 'sans-serif'],
        body:    ['"Mukta"', '"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      borderRadius: {
        xl:  '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      animation: {
        'slide-up': 'fadeUp 0.3s ease-out',
        'fade-in':  'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { '0%': { opacity:0, transform:'translateY(12px)' }, '100%': { opacity:1, transform:'translateY(0)' } },
        fadeIn: { '0%': { opacity:0 }, '100%': { opacity:1 } },
      },
    },
  },
  plugins: [],
}
