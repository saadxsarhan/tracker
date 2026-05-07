import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Remat brand
        navy: {
          DEFAULT: '#1F2D5A',
          50: '#E8EAF3',
          100: '#C5CAE0',
          600: '#1F2D5A',
          700: '#16213F',
          900: '#0B1226'
        },
        gold: {
          DEFAULT: '#C9A94F',
          100: '#F5EDD2',
          500: '#C9A94F',
          700: '#9C8333'
        },
        rag: {
          green: '#10B981',
          greenBg: '#D1FAE5',
          amber: '#F59E0B',
          amberBg: '#FEF3C7',
          red: '#EF4444',
          redBg: '#FEE2E2'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['"Noto Naskh Arabic"', 'serif']
      }
    }
  },
  plugins: []
};
export default config;
