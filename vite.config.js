import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        second: resolve(__dirname, 'second.html'),
        admin: resolve(__dirname, 'admin.html'),
        adminGas: resolve(__dirname, 'admin-gas.html'),
      },
    },
  },
});
