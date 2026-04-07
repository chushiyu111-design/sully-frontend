import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

type BuildInfo = {
  buildId: string;
  builtAt: string;
};

const builtAt = new Date().toISOString();
const buildId =
  process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12) ||
  process.env.GITHUB_SHA?.slice(0, 12) ||
  `${builtAt.replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;

const buildInfo: BuildInfo = { buildId, builtAt };

function buildInfoPlugin(info: BuildInfo): Plugin {
  const body = `${JSON.stringify(info, null, 2)}\n`;

  return {
    name: 'sully-build-info',
    configureServer(server) {
      server.middlewares.use('/build-info.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: body,
      });
    },
  };
}

export default defineConfig({
  plugins: [react() as any, buildInfoPlugin(buildInfo)],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    proxy: {
      '/minimax-api': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/minimax-api/, ''),
      },
    },
  },
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
