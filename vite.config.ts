/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  server: {
    proxy: {
      // 登录联调时先在另一终端跑 `pnpm dev:worker`（wrangler dev，需先 pnpm build）
      '/api/auth': 'http://127.0.0.1:8787',
      // 徽章图标兜底代理直接转到 R2，开发时不依赖 wrangler（生产由 worker 的
      // /api/badge-icon 路由承担同一职责）；size=small 对应 svg/ 目录下的小图标
      '/api/badge-icon': {
        target: 'https://r2.2libra.com',
        changeOrigin: true,
        rewrite: (path) => {
          const params = new URL(path, 'http://localhost').searchParams
          const id = params.get('id') ?? ''
          const dir = params.get('size') === 'small' ? 'svg/' : ''
          return `/badge/${dir}${encodeURIComponent(id)}.svg`
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
  },
})
