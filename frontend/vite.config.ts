import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // 必须用绝对路径！Tauri用自定义协议(tauri://localhost/)加载，./会导致ES Module解析失败→白屏
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true, // B091诊断：开sourcemap以还原TDZ崩溃栈到源码行
  },
  // 🔧 禁用rolldown（Vite8默认），使用经典Rollup（rolldown对复杂JSX有解析bug）
  experimental: {
    rollupCompat: true,
  },
})
