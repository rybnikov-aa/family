import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';

// Runs the Express app through Vite:
//  - `npm run dev`  -> dev server with hot reload (vite-plugin-node)
//  - `npm run build`-> SSR bundle for production (dist/server.js)
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    ...VitePluginNode({
      adapter: 'express',
      appPath: './src/app.ts',
      exportName: 'app',
    }),
  ],
  build: {
    outDir: 'dist',
  },
});
