import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mediapipe-vendor': ['@mediapipe/tasks-vision'],
          'decart-vendor': ['@decartai/sdk'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});

