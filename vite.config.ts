
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load environment variables from process.cwd()
  const env = loadEnv(mode, process.cwd(), '');
  
  // Consolidate possible API key names from Vercel environment
  const apiKey = env.VITE_API_KEY || env.API_KEY || env.GEMINI_API_KEY || '';
  const useServerApiInDev = String(env.VITE_USE_SERVER_API || '').toLowerCase() === 'true';
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
  const apiProxy = useServerApiInDev
    ? {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      }
    : undefined;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Only proxy /api/* when explicitly enabled for local backend testing.
      proxy: apiProxy,
    },
    build: {
      outDir: 'dist',
      target: 'esnext'
    },
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
    }
  };
});
