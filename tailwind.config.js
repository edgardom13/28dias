/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6B21A8',
          hover: '#5E1D93',
          light: '#FAF5FF',
        },
        danger: {
          DEFAULT: '#DC2626',
          hover: '#B91C1C',
        },
      },
      animation: {
        'ken-burns': 'kenBurns 20s ease-out',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        'logo-pulse': 'logoPulse 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease',
        'fab-pulse': 'fab-pulse 2s infinite',
      },
    },
  },
  plugins: [],
}