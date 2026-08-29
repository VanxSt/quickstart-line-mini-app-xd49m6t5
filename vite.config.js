import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
try {
  const log = execSync('git log -p -n 5 google.gs', { encoding: 'utf8' });
  writeFileSync('google-gs-log.txt', log);
} catch (e) {
  writeFileSync('google-gs-log.txt', `ERROR: ${e.message}`);
}

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
