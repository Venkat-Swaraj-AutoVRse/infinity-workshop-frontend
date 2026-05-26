import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/infinity-workshop-frontend/',
  server: {
    port: 3000,
  },
});
