import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function copySqlWasm(): Plugin {
  return {
    name: 'copy-sql-wasm',
    apply: 'build',
    async closeBundle() {
      const src = fileURLToPath(new URL('./node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));
      const destDir = fileURLToPath(new URL('./dist/assets/', import.meta.url));
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(src, path.join(destDir, 'sql-wasm.wasm'));
    },
  };
}

export default defineConfig({
  plugins: [vue(), copySqlWasm()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        // KernelSU WebView loads via file://, so relative asset paths are mandatory
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  base: './',
  worker: {
    format: 'es',
  },
});
