
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables from process.cwd()
  const env = loadEnv(mode, process.cwd(), '');
  
  // Consolidate possible API key names from Vercel environment
  const apiKey = env.VITE_API_KEY || env.API_KEY || env.GEMINI_API_KEY || '';

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      target: 'esnext'
    },
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});
