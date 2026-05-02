import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load REACT_APP_ env vars so existing code works without any changes
  const env = loadEnv(mode, process.cwd(), ['REACT_APP_', 'VITE_']);

  // Map every REACT_APP_* → process.env.REACT_APP_* for backward compatibility
  const define = Object.entries(env).reduce((acc, [key, val]) => {
    acc[`process.env.${key}`] = JSON.stringify(val);
    return acc;
  }, {
    'process.env.NODE_ENV': JSON.stringify(mode),
  });

  return {
    plugins: [
      // ── MUST be first: treat every .js in src/ as JSX ──────────────────
      // This runs BEFORE vite:import-analysis so JSX in .js files is valid
      {
        name: 'treat-js-as-jsx',
        enforce: 'pre',
        async transform(code, id) {
          if (!id.match(/\/src\/.*\.js$/)) return null;
          return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        },
      },
      react(),
    ],

    envPrefix: ['REACT_APP_', 'VITE_'],

    define,

    server: {
      port: 3000,
      host: '0.0.0.0',     // bind to all interfaces (IPv4 + IPv6)
      strictPort: false,   // auto-increment if 3000 is taken
      open: false,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          ws: true,
        },
      },
    },

    build: {
      outDir: 'build',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react:  ['react', 'react-dom', 'react-router-dom'],
            query:  ['@tanstack/react-query'],
            charts: ['recharts'],
            lucide: ['lucide-react'],
            forms:  ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
    },

    optimizeDeps: {
      esbuildOptions: {
        loader: { '.js': 'jsx' },
      },
      include: [
        'react', 'react-dom', 'react-router-dom',
        '@tanstack/react-query', 'axios', 'zustand',
        'lucide-react', 'recharts', 'react-hot-toast',
        'dayjs', 'clsx',
      ],
    },
  };
});
