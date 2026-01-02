import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env variables to make them available during build
  // Fix: Property 'cwd' does not exist on type 'Process'. Using type casting to any to access the Node.js method.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    // Relative base path is essential for GitHub Pages
    base: './',
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          // Splitting chunks for better performance and cache control
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
            'vendor-icons': ['lucide-react']
          }
        }
      }
    },
    server: {
      port: 3000,
      host: true
    }
  };
});