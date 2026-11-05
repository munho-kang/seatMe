import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 화면이 부르는 /api/... 는 Spring Boot 서버(seatMe/, 8080)로 넘긴다. 인증키는 그쪽에만 있다.
    proxy: { '/api': 'http://localhost:8080' },
  },
})
