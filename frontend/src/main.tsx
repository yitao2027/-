import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 🔥 全局JS错误捕获 — 直接显示在页面上，不依赖任何框架
window.addEventListener('error', (e) => {
  const el = document.getElementById('loading-fallback')
  if (el) {
    el.innerHTML = `<div style="color:#ff4444;font-size:16px;text-align:left;max-width:800px;padding:20px;">
      <strong>⚠️ 勺子Claw JS 错误:</strong>
      <pre style="color:#ff8888;margin-top:8px;white-space:pre-wrap;">${String(e.message)}\n\n${String(e.error?.stack || '')}</pre>
    </div>`
    el.style.alignItems = 'flex-start'
    el.style.justifyContent = 'center'
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const el = document.getElementById('loading-fallback')
  if (el) {
    el.innerHTML = `<div style="color:#ffaa00;font-size:16px;text-align:left;max-width:800px;padding:20px;">
      <strong>⚠️ 勺子Claw Promise 拒绝:</strong>
      <pre style="color:#ffcc88;margin-top:8px;white-space:pre-wrap;">${String(e.reason)}</pre>
    </div>`
  }
})

console.log('[ShaoziClaw] main.tsx 开始执行...')

// ========== ErrorBoundary — 捕获白屏根因 ==========
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error, errorInfo: null }
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔥 ShaoziClaw Crash:', error, errorInfo)
    this.setState({ error, errorInfo })
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40, fontFamily: 'monospace', background: '#E6F7EF',
          color: '#1A7D4E', minHeight: '100vh',
        }}>
          <h1 style={{ color: '#1A7D4E', fontSize: 20 }}>⚠️ 勺子Claw 渲染崩溃</h1>
          <pre style={{
            background: '#fff', padding: 16, borderRadius: 8,
            marginTop: 16, overflow: 'auto', fontSize: 12, color: '#dc2626',
            border: '1px solid #fcd34d',
          }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          {this.state.errorInfo && (
            <pre style={{
              background: '#fff', padding: 16, borderRadius: 8,
              marginTop: 16, overflow: 'auto', fontSize: 11, color: '#6b7280',
              border: '1px solid #e5e7eb',
            }}>
              Component Stack:
              {this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

try {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('#root element not found!')
  
  console.log('[ShaoziClaw] 找到root元素, 开始渲染React...')
  
  ReactDOM.createRoot(rootEl!).render(
    <ErrorBoundary>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </ErrorBoundary>,
  )
  
  // 隐藏loading fallback（React已挂载成功）
  setTimeout(() => {
    const fb = document.getElementById('loading-fallback')
    if (fb) fb.style.display = 'none'
  }, 100)
} catch(err: any) {
  console.error('[ShaoziClaw] React渲染失败:', err)
  document.getElementById('loading-fallback')!.innerHTML = `
    <div style="color:#ff4444;font-size:18px;">❌ React 启动失败:<br/>${err.message}<br/><pre>${err.stack}</pre></div>`
}
