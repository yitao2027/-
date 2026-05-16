import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke, Channel } from '@tauri-apps/api/core'

/** 在外部浏览器打开URL（优先用Tauri shell命令，降级window.open） */
async function openInBrowser(url: string) {
  try {
    await invoke('open_url', { url })
  } catch {
    window.open(url, '_blank')
  }
}

interface UpdateInfo {
  available: boolean
  version?: string
  body?: string
  date?: string
  download_url?: string
}

// ════════════════════════════════════════════════════════
// 🔄 UpdateNotifier — 自动更新通知（v4.6.2 WorkBuddy风格）
//
// 设计原则（参考 WorkBuddy 底部条）：
//   ① 完全静默 — 检查中/错误/无更新 → 不渲染任何UI
//   ② 发现新版本 → 底部内嵌条（不是浮窗），在主内容区底部
//   ③ 三个操作：查看更新日志 / 立即重启升级 / 关闭
//   ④ 风格统一：中性灰背景 + 薄荷绿主按钮
//   ⑤ 20分钟轮询 → 使用中也能检测到更新
//
// 使用位置：
//   从 Sidebar 移到 App.tsx 的 <main> 底部，全局生效
// ═══════════════════════════════════════════════════════

let _triggerCheck: ((isManual?: boolean) => void) | null = null
export function triggerUpdateCheck(isManual = true) { _triggerCheck?.(isManual) }

const CHECK_INTERVAL_MS = 20 * 60 * 1000 // 每20分钟
const INITIAL_DELAY_MS = 3000             // 启动后3秒
const RETRY_MAX = 3                       // 首次检查最大重试次数
const RETRY_DELAY_MS = 5000               // 重试间隔5秒
const CHANGELOG_URL = 'https://www.shaoziclaw.com/changelog.html'

export default function UpdateNotifier() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false) // 检查失败标记
  const [isLatest, setIsLatest] = useState(false)     // 已是最新版本标记
  const [manualCheckTime, setManualCheckTime] = useState(0) // 手动检查触发时间戳
  const hasUpdateRef = useRef(false) // 🔧 用ref跟踪是否有待处理更新（避免useCallback依赖updateInfo导致setInterval重建）
  const dismissedRef = useRef(false) // 🔧 用ref跟踪是否已关闭

  // 🔧 核心检查逻辑 — 带重试（不依赖updateInfo/dismissed状态，避免setInterval反复触发）
  const checkForUpdate = useCallback(async (retryCount = 0, isManual = false) => {
    if (hasUpdateRef.current || dismissedRef.current) return // 已有待处理的更新 或 已关闭

    try {
      const info = await invoke<UpdateInfo>('check_update')
      console.log(`[UpdateNotifier] check result (retry=${retryCount}, manual=${isManual}):`, JSON.stringify(info))
      if (info.available) {
        hasUpdateRef.current = true // 🔧 标记已有更新，阻止后续重复检查
        setCheckFailed(false)
        setIsLatest(false)
        setUpdateInfo(info)
      } else if (retryCount < RETRY_MAX && !hasUpdateRef.current) {
        // 无更新但还没到重试上限 → 延迟重试（首次检查阶段）
        console.log(`[UpdateNotifier] no update, retrying in ${RETRY_DELAY_MS}ms... (${retryCount + 1}/${RETRY_MAX})`)
        setTimeout(() => checkForUpdate(retryCount + 1, isManual), RETRY_DELAY_MS)
      } else {
        // 正常无更新（轮询阶段或已用完重试）
        setCheckFailed(false)
        // 如果是手动检查，显示"已是最新版本"
        if (isManual) {
          setIsLatest(true)
          setManualCheckTime(Date.now())
          // 3秒后自动消失
          setTimeout(() => setIsLatest(false), 3000)
        }
      }
    } catch (e) {
      console.warn(`[UpdateNotifier] check error (retry=${retryCount}):`, e)
      if (retryCount < RETRY_MAX) {
        // 异常 → 重试
        setTimeout(() => checkForUpdate(retryCount + 1, isManual), RETRY_DELAY_MS)
      } else {
        // 所有重试都失败了
        console.error('[UpdateNotifier] all retries exhausted')
        // 🔧 只在手動檢查時才顯示失敗提示，自動輪詢失敗靜默處理
        if (isManual) {
          setCheckFailed(true)
        }
        // 自動檢查失敗 →靜默，不干擾用戶
      }
    }
  }, []) // 🔧 空依赖！用ref代替state依赖，避免setInterval反复重建

  // 🚀 重启升级 — 调用Rust后端下载DMG+安装+重启
  async function handleInstallAndRestart() {
    if (!updateInfo?.download_url || downloading) return

    setDownloading(true)
    setProgress(0)

    try {
      // 创建 Channel 接收进度回调
      const onProgress = new Channel<number>()
      onProgress.onmessage = (progress) => {
        setProgress(progress)
      }

      await invoke('download_and_install_update', {
        dmgUrl: updateInfo.download_url,
        onProgress,
      })
    } catch (e) {
      console.error('[UpdateNotifier] install failed:', e)
      setDownloading(false)
      // 如果失败，打开DMG让用户手动安装
      if (updateInfo.download_url) {
        openInBrowser(updateInfo.download_url)
      }
    }
  }

  // ═════ 生命周期 ═════
  useEffect(() => {
    const initTimer = setTimeout(() => checkForUpdate(0, false), INITIAL_DELAY_MS)
    const intervalTimer = setInterval(() => checkForUpdate(0, false), CHECK_INTERVAL_MS)
    _triggerCheck = (isManual = true) => checkForUpdate(0, isManual)
    return () => {
      clearTimeout(initTimer)
      clearInterval(intervalTimer)
      _triggerCheck = null
    }
  }, [checkForUpdate])

  // 🔧 同步dismissed状态到ref（让checkForUpdate能读到最新值）
  useEffect(() => { dismissedRef.current = dismissed }, [dismissed])

  // ═════ 渲染 ═════

  // 🔴 检查全部失败 → 显示手动重试条
  if (checkFailed && !updateInfo && !dismissed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', background: '#fef6f0', borderTop: '1px solid #f0d9c4',
        flexShrink: 0, fontSize: 12,
      }}>
        <span style={{ color: '#b85c00' }}>⚠️ 更新检查失败</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setCheckFailed(false); checkForUpdate(0); }}
            style={{ padding: '4px 12px', borderRadius: 6, background: '#57CC86', color: '#fff',
              border: 'none', fontSize: 11.5, cursor: 'pointer' }}>
            重试
          </button>
          <button onClick={() => setDismissed(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#bbb', padding: '2px 4px' }}>
            ✕
          </button>
        </div>
      </div>
    )
  }

  // ✅ 已是最新版本（手动检查触发，3秒后自动消失）
  if (isLatest && !updateInfo && !dismissed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0',
        flexShrink: 0, fontSize: 12,
        animation: 'updateSlideUp 0.3s ease-out',
      }}>
        <span style={{ color: '#166534' }}>✅ 已是最新版本</span>
        <button onClick={() => setIsLatest(false)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: '#86efac', padding: '2px 4px',
        }}>✕</button>
      </div>
    )
  }

  if (!updateInfo || dismissed) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 20px',
        background: '#fafafa',
        borderTop: '1px solid #e8e8e8',
        flexShrink: 0,
        fontSize: 12,
        animation: 'updateSlideUp 0.3s ease-out',
      }}
    >
      {/* 内联动画 */}
      <style>{`
        @keyframes updateSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes updatePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* 左侧：状态文字 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {/* 旋转图标 */}
        <span style={{
          display: 'inline-flex',
          color: '#57CC86',
          fontSize: 14,
          animation: downloading ? 'updatePulse 1s infinite' : 'none',
        }}>
          {downloading ? '⏳' : '🔄'}
        </span>
        <span style={{ color: '#333', fontWeight: 500 }}>
          {downloading ? `正在下载更新... ${progress}%` : '新版本就绪'}
        </span>
        {!downloading && updateInfo.version && (
          <span style={{ color: '#999' }}>v{updateInfo.version}</span>
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* 更新日志按钮 */}
        <button
          onClick={() => openInBrowser(CHANGELOG_URL)}
          disabled={downloading}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: 'transparent',
            color: downloading ? '#ccc' : '#666',
            border: '1px solid #ddd',
            fontSize: 11.5,
            cursor: downloading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            if (!downloading) {
              e.currentTarget.style.background = '#f5f5f5'
              e.currentTarget.style.borderColor = '#ccc'
              e.currentTarget.style.color = '#333'
            }
          }}
          onMouseLeave={(e) => {
            if (!downloading) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#ddd'
              e.currentTarget.style.color = '#666'
            }
          }}
        >
          更新日志
        </button>

        {/* 重启升级按钮 */}
        <button
          onClick={handleInstallAndRestart}
          disabled={downloading}
          style={{
            padding: '4px 14px',
            borderRadius: 6,
            background: downloading ? '#e0e0e0' : '#57CC86',
            color: '#fff',
            border: 'none',
            fontSize: 11.5,
            fontWeight: 500,
            cursor: downloading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            if (!downloading) e.currentTarget.style.background = '#3DAA5F'
          }}
          onMouseLeave={(e) => {
            if (!downloading) e.currentTarget.style.background = '#57CC86'
          }}
        >
          {downloading ? '下载中...' : '重启升级'}
        </button>

        {/* 关闭按钮 */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: '#bbb',
            padding: '2px 4px',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#888'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#bbb'}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
