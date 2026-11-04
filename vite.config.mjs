import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'place-bundle-artifacts',
      closeBundle() {
        const distDir = path.resolve(process.cwd(), 'dist-ui');
        const jsSrc = path.join(distDir, 'ui-react.bundle.js');
        const cssSrc = path.join(distDir, 'ui-react.bundle.css');

        const jsDest = path.resolve(process.cwd(), 'js/ui-react.bundle.js');
        const cssDest = path.resolve(process.cwd(), 'css/ui-react.bundle.css');

        if (fs.existsSync(jsSrc)) {
          fs.copyFileSync(jsSrc, jsDest);
          console.log(`[vite] Bundled JS placed at: js/ui-react.bundle.js`);
        }
        if (fs.existsSync(cssSrc)) {
          fs.copyFileSync(cssSrc, cssDest);
          console.log(`[vite] Bundled CSS placed at: css/ui-react.bundle.css`);
        }

        // Clean up temporary dist-ui directory
        try {
          fs.rmSync(distDir, { recursive: true, force: true });
        } catch (_) {}
      },
    },
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-ui',
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: path.resolve(process.cwd(), 'src/ui/main.jsx'),
      name: 'UIReactBundle',
      formats: ['iife'],
      fileName: () => 'ui-react.bundle.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'ui-react.bundle.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
