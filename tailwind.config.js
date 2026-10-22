/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
      },
      colors: {
        apple: {
          blue: '#0071e3',
          blueHover: '#0077ED',
          green: '#34c759',
          red: '#ff3b30',
          purple: '#af52de',
          indigo: '#5856d6',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
        'glass-hover': '0 12px 40px 0 rgba(0, 0, 0, 0.12)',
        dock: '0 20px 48px -8px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.25) inset',
        'ios-card': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      }, height: {
        "1/12": "8.3333333%",
        "11/12": "91.66666%",
        "1/10": "10%",
        "3/20": "15%",
        "4/5": "80%",
        "5/12": "41.666666%",
        "7/12": "58.33333%",
        "1/24": "4.16666666%",
        "7/8": "87.5%",
        "100": "100%"


      },
      width: {
        "9/10": "90%",
        "11/12": "91.66666%",
        "4/5": "80%",
        "160": "40rem",
        "144": "36rem",
        '128': '32rem',
      },
      zIndex: {
        '10': '10',
        '20': '20',
        '25': '25',
        '30': '30',
        '40': '40',
        '50': '50',
      },
    },
  },
  plugins: [],
};
