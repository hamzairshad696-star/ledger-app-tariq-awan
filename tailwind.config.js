/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        navy: { 950: '#081428', 900: '#0E1F3D', 800: '#162B52', 700: '#1F3A6B', 600: '#2C4C85' },
        ink: '#13213A',
        paper: '#F5F7FA',
        line: '#E3E8EF',
        st: {
          paid: '#0F8F63', paidbg: '#E7F5EF',
          cur: '#2563C9', curbg: '#E8F0FC',
          part: '#B7790A', partbg: '#FBF3E1',
          pend: '#C23B35', pendbg: '#FBEAE9',
          none: '#7A8699', nonebg: '#F0F2F5',
          adv: '#6546B8', advbg: '#F0ECFA',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,32,64,0.05), 0 1px 1px rgba(16,32,64,0.03)',
        pop: '0 20px 50px -12px rgba(8,20,40,0.35)',
      },
    },
  },
  plugins: [],
};
