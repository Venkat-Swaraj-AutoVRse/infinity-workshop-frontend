import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use the GitHub Pages subpath only when explicitly deploying there.
// Amplify (and local dev) serve from the root path.
const base =
  process.env.DEPLOY_TARGET === 'gh-pages'
    ? '/infinity-workshop-frontend/'
    : '/';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 3000,
  },
});
