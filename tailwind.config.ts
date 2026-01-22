import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        diff: {
          add: '#2ea043',
          addBg: '#1a4721',
          addBgLight: '#d4edda',
          remove: '#f85149',
          removeBg: '#5c2d2d',
          removeBgLight: '#f8d7da',
          modify: '#d29922',
          modifyBg: '#533d08',
          modifyBgLight: '#fff3cd',
          same: '#8b949e',
        },
      },
    },
  },
  plugins: [],
};

export default config;
