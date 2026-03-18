import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.smconnection.cl',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
