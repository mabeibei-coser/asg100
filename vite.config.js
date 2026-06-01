import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.ASG100_API_PORT || env.PORT || '4002';

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 3000,
      open: true,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
