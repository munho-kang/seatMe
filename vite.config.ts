import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 화면이 부르는 /api/... 는 서버(server/, npm run server, 8787)로 넘긴다. 인증키는 그쪽에만 있다.
    // changeOrigin: false — 서버가 주소를 localhost:5173으로 알아야 네이버 로그인이 이 화면으로 돌아온다
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } },
  },
})
