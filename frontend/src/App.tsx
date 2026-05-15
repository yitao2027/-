import { useState, useEffect, useRef } from 'react'
import { useStore, useAppStore, type ExpertType } from './store'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import LoginScreen from './components/LoginScreen'
import ExpertCenter from './components/ExpertCenter'
import Settings from './components/Settings'
import OnboardingFlow from './components/OnboardingFlow'
import UpdateNotifier from './components/UpdateNotifier'
import ScheduledTasksPage from './components/ScheduledTasksPage'

type Page = 'chat' | 'experts' | 'settings' | 'onboarding' | 'scheduled'

export default function App() {
  const { isAuthenticated, login, setBackendAuth, refreshPointsBalance, userProfile, createExpertSession,
    activeTaskId, activeExpertSessionId, activeTaskSessionId, activeTab } = useStore()
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [authChecked, setAuthChecked] = useState(false)

  // 🔧 v5.3.5: 同步 store.activeTab → currentPage，解决▶按钮只改store不导航的Bug
  useEffect(() => {
    if (activeTab && activeTab !== currentPage) {
      console.log('[AppNav] activeTab changed:', activeTab, '→ navigate')
      setCurrentPage(activeTab as Page)
    }
  }, [activeTab])

  // 🔧 B016修复：监听任务/专家/任务会话切换，自动从二级页面跳回聊天页
  // 当用户在专家中心/定时任务等二级页面时，点击侧边栏任务/会话应自动切回chat
  const prevActiveRef = useRef({ taskId: activeTaskId, sessionId: activeExpertSessionId, taskSessionId: activeTaskSessionId })
  useEffect(() => {
    const prev = prevActiveRef.current
    const taskIdChanged = prev.taskId !== activeTaskId
    const sessionIdChanged = prev.sessionId !== activeExpertSessionId
    const taskSessionIdChanged = prev.taskSessionId !== activeTaskSessionId
    if ((taskIdChanged || sessionIdChanged || taskSessionIdChanged) && currentPage !== 'chat') {
      setCurrentPage('chat')
    }
    prevActiveRef.current = { taskId: activeTaskId, sessionId: activeExpertSessionId, taskSessionId: activeTaskSessionId }
  }, [activeTaskId, activeExpertSessionId, activeTaskSessionId, currentPage])

  // v4.9.6: 每日餐饮热点导航协调——拦截热点事件，确保在chat页面渲染后prefill
  const pendingHotspotRef = useRef(false)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      // 从sidebar或scheduled-page触发的都处理
      if (detail?.source === 'sidebar' || detail?.source === 'scheduled-page') {
        pendingHotspotRef.current = true
        // 如果当前不在chat页面，先导航过去
        if (currentPage !== 'chat') {
          setCurrentPage('chat')
        }
      }
    }
    window.addEventListener('shaoziclaw-daily-hotspot', handler)
    return () => window.removeEventListener('shaoziclaw-daily-hotspot', handler)
  }, [currentPage])

  // v4.9.5: 当currentPage切换到chat时，检查是否需要触发热点prefill
  useEffect(() => {
    if (currentPage !== 'chat') return
    if (!pendingHotspotRef.current) return
    pendingHotspotRef.current = false // 重置标志
    // 延迟等待ChatArea组件挂载完成
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('shaoziclaw-prefill-hotspot'))
    }, 300)
    return () => clearTimeout(timer)
  }, [currentPage])

  // 🔐 启动时同步后端认证状态 + 邀请码检查 + 积分登录恢复
  useEffect(() => {
    async function checkAuth() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        // 调用后端get_app_state检查是否已登录
        const state = await invoke<{ is_authenticated: boolean; current_user?: { name: string; id: string; email: string } }>('get_app_state')
        if (state?.is_authenticated) {
          // 🔑 v4.6 新增：检查邀请码是否已验证（本地模式）
          const inviteVerified = localStorage.getItem('shaoziclaw_invite_verified') === 'true'
          const pointsLoggedIn = !!localStorage.getItem('shaoziclaw_jwt_token')
          if (!inviteVerified && !pointsLoggedIn) {
            // 后端认证了但没通过邀请码 → 强制走登录页重新验证
            console.warn('[App] 用户未通过邀请码验证，拦截到登录页')
          } else {
            // 后端已认证 + 邀请码已通过/积分已登录 → 同步前端状态
            if (state.current_user) {
              await setBackendAuth(state.current_user.name || 'user', state.current_user.id)
            }
            // 积分系统余额恢复
            if (pointsLoggedIn) {
              await refreshPointsBalance()
            }
          }
        }
      } catch (e) {
        console.warn('[App] 后端认证检查失败:', e)
      } finally {
        setAuthChecked(true)
      }
    }
checkAuth()
  }, [])

  // 🔧 v5.5.19: 知识库已随安装包内置，不再触发远程下载
  // setup() 阶段会自动从 resources/knowledge-base 解包到 app_data_dir，
  // RAG 引擎随后初始化。这里只在认证完成后刷新一次状态展示。
  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;

    async function refreshKB() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        // 给 setup 中的异步初始化留几秒
        await new Promise(r => setTimeout(r, 2000))
        if (cancelled) return
        const status = await invoke<any>('get_kb_status')
        console.log('[App] 知识库状态:', status)
        useAppStore.getState().refreshKbStatus()
      } catch (e) {
        console.warn('[App] 刷新知识库状态失败:', e)
      }
    }

    refreshKB()
    return () => { cancelled = true }
  }, [authChecked])

  // 认证检查中 → 显示加载
  if (!authChecked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f5f5f7',
        flexDirection: 'column', gap: '16px'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
        <span style={{ fontSize: '14px', color: '#999' }}>正在加载...</span>
      </div>
    )
  }

  // 【3】首次使用 → 显示档案收集引导
  if (isAuthenticated && authChecked && !userProfile.completed) {
    return (
      <OnboardingFlow onComplete={() => {
        // 引导完成后自动切换到聊天页面
        setCurrentPage('chat')
      }} />
    )
  }

  // 未登录 或 未通过邀请码验证 且 未积分登录 → 显示登录页
  const inviteVerified = typeof window !== 'undefined' ? localStorage.getItem('shaoziclaw_invite_verified') === 'true' : false
  const pointsLoggedIn = typeof window !== 'undefined' ? !!localStorage.getItem('shaoziclaw_jwt_token') : false
  if ((!isAuthenticated || (!inviteVerified && !pointsLoggedIn)) && authChecked) {
    return (
      <LoginScreen onLogin={() => {
        login('user@shaoziclaw.cn', '')
      }} />
    )
  }

  // 🔧 专家ID映射表（ExpertCenter的id格式 mX-name ↔ 内部type）
  const expertIdMap: Record<string, {type: ExpertType; title: string; emoji: string; skillName?: string}> = {
    // 🎨 图片设计（排第一）
    'm0-image-design': { type: 'image',     title: '图片设计专家',     emoji: '🎨' },
    // 🏥 老店增长
    'm0-old-store-growth': { type: 'ops',     title: '老店增长专家',     emoji: '🚀', skillName: 'old-store-growth-orchestrator' },
    // 品牌定位
    'm1-brand':       { type: 'brand',     title: '品牌策略专家',     emoji: '🎯', skillName: 'L1-brand-positioning' },
    // 运营服务
    'm3-ops':         { type: 'ops',       title: '营运总监',         emoji: '⚙️', skillName: 'L1-qscv-standard' },
    'm4-foodsafety':  { type: 'ops',       title: '食品安全管家',     emoji: '🛡️', skillName: 'L1-food-safety' },
    'm5-customer':    { type: 'ops',       title: '客服服务专家',     emoji: '💬', skillName: 'L1-service-mot' },
    'm14-digital':    { type: 'ops',       title: '数字化运营专家',   emoji: '💻', skillName: 'L1-digital-operation' },
    'm15-crisis':     { type: 'ops',       title: '危机公关专家',     emoji: '⚡', skillName: 'L1-crisis-pr' },
    // 品牌宣传
    'm7-marketing':   { type: 'marketing', title: '品牌宣传专家',     emoji: '📢', skillName: 'L1-promotion' },
    'm2-menu':        { type: 'marketing', title: '菜单工程专家',     emoji: '📋', skillName: 'L1-menu-pricing' },
    // 外卖运营
    'm8-waimai':      { type: 'waimai',    title: '外卖运营专家',     emoji: '🛵', skillName: 'L1-delivery-basics' },
    // 财务&合规
    'm10-finance':    { type: 'finance',   title: '财务顾问',         emoji: '💰', skillName: 'fn-cost-control' },
    'm19-legal':      { type: 'legal',     title: '法务合规顾问',     emoji: '⚖️', skillName: 'L1-legal-compliance' },
    // 战略扩张
    'm16-franchise':  { type: 'strategy',  title: '连锁扩张专家',     emoji: '🏢', skillName: 'L2-franchise-design' },
    'm17-multibrand': { type: 'strategy',  title: '品牌架构专家',     emoji: '🌳', skillName: 'L3-brand-strategy' },
    'm18-capital':    { type: 'strategy',  title: '融资顾问',         emoji: '📈', skillName: 'L3-capital-strategy' },
    'm13-opening':    { type: 'strategy',  title: '开店顾问',         emoji: '🚀', skillName: 'L1-opening-checklist' },
    // 组织管理
    'm6-hr':          { type: 'hr',       title: '人力资源专家',     emoji: '👥', skillName: 'L1-recruitment' },
    // 空间&选址
    'm11-location':   { type: 'space',    title: '选址评估专家',     emoji: '🧭', skillName: 'location-thousand-score' },
    'm12-space':      { type: 'space',    title: '空间设计专家',     emoji: '🏗️', skillName: 'L2-space-efficiency' },
    'm9-supply':      { type: 'ops',      title: '供应链专家',       emoji: '🔗', skillName: 'L1-procurement' },
    'm20-saas':       { type: 'ops',      title: '系统集成专家',     emoji: '🔌' },
    // 🆕 v4.9.0 三大新专家
    'm21-scientific-scheduling': { type: 'hr',   title: '科学排班专家',   emoji: '📊', skillName: 'scientific-scheduling' },
    'm22-scientific-ordering':   { type: 'supply', title: '科学订货专家',   emoji: '📦', skillName: 'scientific-ordering' },
    'm23-promotion-audit':       { type: 'ops',    title: '宣传审核专家',   emoji: '🛡️', skillName: 'promotion-audit' },
  }

  const handleSelectExpert = (expertId: string, greeting: string) => {
    console.log('[B008v2] handleSelectExpert called! expertId=', expertId)
    try {
      if (expertId) {
        const info = expertIdMap[expertId] || { type: 'general' as ExpertType, title: '餐饮专家', emoji: '🥄' }
        // 🔧 v5.5.22 Bug#2修复：skillName直接写入ExpertSession，避免selectedSkill全局漂移
        createExpertSession(info.type, info.title, info.emoji, undefined, greeting, info.skillName)
        if (info.skillName) {
          // 仍然同步全局selectedSkill，作为兼容兜底（旧逻辑）
          const { setSelectedSkill } = useAppStore.getState()
          setSelectedSkill(info.skillName)
        }
      }
    } catch (e) {
      console.error('[B008v2] createExpertSession error:', e)
    }
    // 🔧 无论 createExpertSession 是否成功，都必须跳转到对话页
    setCurrentPage('chat')
    ;(window as any).__selectedExpertId = expertId
    console.log('[B008v2] navigate to chat done')
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'chat': return <ChatArea />
      case 'experts': return <ExpertCenter onSelectExpert={handleSelectExpert} />
      case 'settings': return <Settings />
      case 'onboarding': return <OnboardingFlow onComplete={() => setCurrentPage('chat')} editMode />
      case 'scheduled': return <ScheduledTasksPage onNavigate={(tab) => setCurrentPage(tab as Page)} />
      default: return <ChatArea />
    }
  }

  // 页面标题映射
  const pageTitles: Record<Page, string> = {
    chat: '',
    experts: '专家中心',
    settings: '设置',
    onboarding: '引导设置',
    scheduled: '定时任务',
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#f5f5f7',
      color: '#333',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", "PingFang SC", sans-serif',
    }}>
      {/* 侧边栏 */}
      <Sidebar onNavigate={(tab) => setCurrentPage(tab as Page)} />

      {/* 主内容区 */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        background: '#fff',
      }}>
        {/* 顶部标题栏 */}
        {pageTitles[currentPage] && (
          <header style={{
            height: '48px',
            borderBottom: '1px solid #e8e8ea',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            background: '#fff',
            flexShrink: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: '#1a1a1a',
          }}>
            {pageTitles[currentPage]}
          </header>
        )}

        {/* 页面内容 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderPage()}
          {/* 🔄 更新通知条（全局底部，WorkBuddy风格） */}
          <UpdateNotifier />
        </div>
      </main>
    </div>
  )
}