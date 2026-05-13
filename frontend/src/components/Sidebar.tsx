import { useState, useRef, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useStore, type Task, type ExpertType } from '../store';
import { triggerUpdateCheck } from './UpdateNotifier';

// ====== WorkBuddy风格侧边栏 v4.7 — 新建任务选择器 + 任务省略号菜单 + 个人中心tab化 ======
interface SidebarProps {
  onNavigate: (page) => void;
}

type Page = 'chat' | 'experts' | 'settings' | 'scheduled' | 'home' | 'onboarding';

function formatTaskDate(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 30) return `${diffDays}天前`
  return `${Math.floor(diffDays / 30)}月前`
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { activeTab, toggleSidebar, sidebarOpen, isBetaUser,
    tasks, activeTaskId, createTask, deleteTask, switchTask, renameTask,
    
    taskSearchQuery, setTaskSearchQuery, getFilteredTasks,
    userName, userId, logout,
    pointsBalance, isPointsLoggedIn,
    userProfile, expertSessions, activeExpertSessionId, activeExpertType,
    switchExpertSession, createExpertSession,
    activeScheduledCount, scheduledTasks,
    taskSessions, activeTaskSessionId, switchTaskSession, closeTaskSession,
  } = useStore();

  // ---- 状态 ----
  const [showNewTaskMenu, setShowNewTaskMenu] = useState(false)        // 新建任务选择器（实时/定时）
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showNewTaskInput, setShowNewTaskInput] = useState(false)      // 实时任务的输入框
  const [showUserPanel, setShowUserPanel] = useState(false)
  const [profileTab, setProfileTab] = useState<'info' | 'onboarding' | 'update'>('info')  // 个人中心3个tab
  const [appVersion, setAppVersion] = useState('')  // 动态读取当前版本号
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle'|'checking'|'latest'|'available'>('idle')  // 更新检查状态

  // 启动时从Tauri获取真实版本号
  useEffect(() => {
    getVersion().then(v => setAppVersion(v)).catch(() => {})
  }, [])
  // ---- 任务省略号菜单 ----
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null)   // 当前打开的"..."菜单
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)  // 正在编辑名字的任务
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const taskMenuRef = useRef<HTMLDivElement>(null)

  const filteredTasks = getFilteredTasks()

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (taskMenuRef.current && !taskMenuRef.current.contains(e.target as Node)) {
        setTaskMenuId(null);
        setEditingTaskId(null);
      }
      // 新建任务选择器点击外部也关闭
      const newTaskBtn = document.getElementById('sidebar-newtask-btn');
      const newTaskPanel = document.getElementById('sidebar-newtask-menu');
      if (showNewTaskMenu && newTaskPanel && !newTaskPanel.contains(e.target as Node) && !newTaskBtn?.contains(e.target as Node)) {
        setShowNewTaskMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewTaskMenu]);

  // ---- 创建实时任务 ----
  const handleCreateRealtimeTask = () => {
    setShowNewTaskMenu(false);
    setShowNewTaskInput(true);
  };

  const handleCreateTaskSubmit = () => {
    const title = newTaskTitle.trim() || '新对话';
    createTask(title);
    setNewTaskTitle('');
    setShowNewTaskInput(false);
    onNavigate('chat');
  };

  // ---- 创建定时任务（跳转到定时任务页面）----
  const handleCreateScheduledTask = () => {
    setShowNewTaskMenu(false);
    useStore.getState().setActiveTab('scheduled');
    onNavigate('scheduled');
  };

  // ---- 任务改名 ----
  const startRenameTask = (taskId: string, currentTitle: string) => {
    setEditingTaskId(taskId);
    setEditTaskTitle(currentTitle);
    setTaskMenuId(null);
  };

  const submitRenameTask = () => {
    if (editingTaskId && editTaskTitle.trim()) {
      renameTask(editingTaskId, editTaskTitle.trim());
    }
    setEditingTaskId(null);
    setEditTaskTitle('');
  };

  // ====== 导航菜单 ======
  const navItems = [
    { id: 'chat' as Page, label: 'Claw', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, desc: 'AI对话' },
    { id: 'experts' as Page, label: '专家', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, badge: '25', desc: '餐饮专家角色' },
    { id: 'scheduled' as Page, label: '定时任务', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, badge: activeScheduledCount > 0 ? String(activeScheduledCount) : undefined, desc: '自动化定时执行' },
  ];

  return (
    <>
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={toggleSidebar} />
      )}

      {/* ====== 侧边栏主体 ====== */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-[278px]
        flex flex-col transition-transform duration-300
        bg-[#fafafa] border-r border-gray-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        
        {/* ═══ Logo区域 ═══ */}
        <div className="p-4 pb-2 flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
               style={{ background: '#FFFFFF', border: '1px solid #E8F5EC' }}>
            <img src="/logo-graphic.svg" alt="勺子Claw" style={{width:32,height:32,objectFit:'contain'}} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[16px] font-semibold leading-tight" style={{color:'#1a1a1a'}}>勺子Claw</span>
              {isBetaUser && (
                <span className="px-1.5 py-px rounded text-[10px] font-normal" style={{ background: '#f5f5f5', color: '#999', border: 'none' }}>v{appVersion || '...'}</span>
              )}
            </div>
            <span className="text-[12px]" style={{color:'#888'}}>餐饮人的超级AI大脑</span>
          </div>
          <div className="w-2 h-2 rounded-full shrink-0" style={{background:'#57CC86', opacity: 0.7}} />
        </div>

        {/* ═══ 搜索框 ═══ */}
        <div className="px-3 mb-1.5">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={taskSearchQuery} onChange={(e) => setTaskSearchQuery(e.target.value)} placeholder="搜索任务"
              className="w-full pl-8 pr-8 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
              style={{ background: '#f5f5f5', border: '1px solid #eaeaea', color: '#333' }}/>
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 text-gray-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
          </div>
        </div>

        {/* ═══ + 新建任务按钮 + 选择器弹出层 ═══ */}
        <div className="px-3 mb-2 relative">
          <button id="sidebar-newtask-btn" onClick={() => { setShowNewTaskMenu(v => !v); setShowNewTaskInput(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-100"
            style={{ color: '#555', border: '1px solid #eaeaea', background: '#fff' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建任务
            <svg className="ml-auto" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {/* ⭐ 选择器弹出层：实时任务 / 定时任务 */}
          {showNewTaskMenu && (
            <div id="sidebar-newtask-menu" className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl overflow-hidden shadow-lg border border-gray-200"
                 style={{ background: '#FFFFFF' }}>
              <button onClick={handleCreateRealtimeTask}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background:'#F5F5F5'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium" style={{color:'#1a1a1a'}}>新建实时对话</p>
                  <p className="text-[11px]" style={{color:'#999'}}>立即开始一次新的AI对话</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <div className="mx-3 border-t border-gray-100" />

              <button onClick={handleCreateScheduledTask}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background:'#FFF9E6'}}>
                  {/* 闹钟图标 - 平面设计风格 */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 14.5"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/><path d="M12 3v2"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium" style={{color:'#1a1a1a'}}>新建定时任务</p>
                  <p className="text-[11px]" style={{color:'#999'}}>设置自动化执行计划</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}

          {/* 实时任务输入框（选择实时任务后显示） */}
          {showNewTaskInput && (
            <div className="mt-1.5 p-2.5 rounded-lg bg-white border border-gray-200 shadow-sm">
              <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTaskSubmit()}
                placeholder="输入任务名称..." autoFocus
                className="w-full px-2.5 py-1.5 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#57CC86]/30 border border-gray-200"
                style={{ color: '#333' }}/>
              <div className="flex justify-end gap-1.5 mt-2">
                <button onClick={() => { setShowNewTaskInput(false); setNewTaskTitle(''); }}
                        className="px-2.5 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-100">取消</button>
                <button onClick={handleCreateTaskSubmit}
                        className="px-3 py-1 rounded text-[11px] font-medium text-white" style={{ background: '#333' }}>创建</button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ 主导航菜单 ═══ */}
        <nav className="px-2 space-y-0.5 shrink-0 mt-3">
          {navItems.map((item) => (
            <button key={item.id}
              onClick={() => {
                useStore.getState().setActiveTab(item.id);
                // 🔧 v4.9.1 Claw = 全局主聊天入口：点击时重置到普通聊天模式
                // 🔧 v5.1.3: 使用set()而非直接修改Zustand状态，确保订阅者正确re-render (B039)
                if (item.id === 'chat') {
                  useStore.setState({ activeExpertSessionId: null, activeExpertType: 'general', activeTaskSessionId: null });
                }
                onNavigate(item.id);
                window.innerWidth < 1024 && toggleSidebar();
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[15px] font-medium transition-all relative group ${
                activeTab === item.id ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <span style={{ color: activeTab === item.id ? '#1a1a1a' : '#999' }}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (<span className="px-1.5 py-0.5 rounded text-[11px] font-normal" style={{ background: '#f5f5f5', color: '#AAA' }}>{item.badge}</span>)}
              <span className="hidden group-hover:inline absolute left-full ml-2 px-2 py-1 rounded text-[10px] bg-gray-800 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">{item.desc}</span>
            </button>
          ))}
        </nav>

        {/* ═══ 任务列表区域 ═══ */}
        <div className="flex-1 overflow-y-auto min-h-0 mt-4">
          {/* 任务标题头 */}
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[12px] font-normal" style={{color:'#AAA', letterSpacing: '0.5px'}}>任务</span>
            {filteredTasks.length > 0 && (<span className="text-[10px] text-gray-400">{filteredTasks.length}</span>)}
          </div>
          
          <div className="px-2 space-y-0.5" ref={taskMenuRef}>
            {filteredTasks.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-[11px] text-gray-400">暂无任务记录</p>
                <p className="text-[10px] text-gray-300 mt-1">点击上方「新建任务」开始</p>
              </div>
            ) : (
              filteredTasks.slice(0, 10).map((task) => (
                <div key={task.id}
                  onClick={() => { switchTask(task.id); useStore.getState().setActiveTab('chat'); onNavigate('chat'); window.innerWidth < 1024 && toggleSidebar() }}
                  className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                    activeTaskId === task.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}>
                  {/* 复选框样式 */}
                  <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    activeTaskId === task.id ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}>
                    {activeTaskId === task.id && (<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>)}
                  </div>
                  
                  {/* 任务信息 */}
                  <div className="flex-1 min-w-0">
                    {/* 编辑模式 or 正常标题 */}
                    {editingTaskId === task.id ? (
                      <input autoFocus value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' ? submitRenameTask() : e.key === 'Escape' && setEditingTaskId(null)}
                        onBlur={() => submitRenameTask()}
                        className="w-full px-1.5 py-0.5 rounded text-[13px] font-semibold outline-none"
                        style={{ color: '#1a1a1a', border: '1px solid #57CC86', background: '#fff' }}
                        onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <p className="text-[13px] truncate" style={{ color: activeTaskId === task.id ? '#1a1a1a' : '#444', fontWeight: activeTaskId === task.id ? 600 : 400 }}>{task.title}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <span>{formatTaskDate(new Date(task.createdAt))}</span>
                      {task.messages.length > 0 && <span>· {task.messages.length}条消息</span>}
                    </p>
                  </div>

                  {/* .... 省略号菜单按钮 */}
                  <div className="relative flex items-center shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setTaskMenuId(taskMenuId === task.id ? null : task.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all text-gray-400 hover:text-gray-600"
                      title="更多操作">
                      {/* 三点省略号 */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>

                    {/* 下拉小菜单 */}
                    {taskMenuId === task.id && (
                      <div className="absolute right-0 top-full mt-1 w-32 rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50"
                           style={{ background: '#FFFFFF' }}>
                        <button onClick={(e) => { e.stopPropagation(); startRenameTask(task.id, task.title); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-colors"
                          style={{ color: '#444' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          改名字
                        </button>
                        <div className="border-t border-gray-100" />
                        <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); setTaskMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-red-50 transition-colors"
                          style={{ color: '#EF4444' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* 展开更多 */}
            {filteredTasks.length > 10 && (
              <button className="w-full px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">展开更多 ({filteredTasks.length - 10})</button>
            )}


            {/* ═══ 定时任务列表（闹钟图标标识）═══ */}
            {scheduledTasks.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-[12px] font-normal flex items-center gap-1.5" style={{color:'#AAA', letterSpacing: '0.5px'}}>
                    {/* 小闹钟平面图标 */}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 14.5"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/>
                    </svg>
                    定时任务
                  </span>
                  <span className="text-[10px] text-gray-400">{scheduledTasks.length}</span>
                </div>
                {scheduledTasks.slice(0, 5).map((stask) => (
                  <div key={stask.id}
                    onClick={() => { onNavigate('scheduled'); window.innerWidth < 1024 && toggleSidebar(); }}
                    className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50">
                    {/* 闹钟图标 */}
                    <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                      stask.enabled ? 'bg-amber-50' : 'bg-gray-100'
                    }`}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={stask.enabled ? '#B8860B' : '#AAA'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 14.5"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] truncate" style={{ color: stask.enabled ? '#333' : '#AAA', fontWeight: stask.enabled ? 500 : 400 }}>{stask.name || '未命名任务'}</p>
                      <p className="text-[10px]" style={{color:'#BBB'}}>{stask.scheduleType === 'recurring' ? '重复执行' : '一次性'}{stask.rrule || stask.scheduledAt ? ` · ${(stask.rrule || '').split(';')[0]?.replace('FREQ=', '') || ''}` : ''}</p>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${stask.enabled ? 'bg-amber-400' : 'bg-gray-300'}`} />
                  </div>
                ))}
              </>
            )}

            {/* ═══ 任务会话列表（定时任务执行会话）═══ */}
            {taskSessions.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-[12px] font-normal flex items-center gap-1.5" style={{color:'#AAA', letterSpacing: '0.5px'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#57CC86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    执行会话
                  </span>
                  <span className="text-[10px] text-gray-400">{taskSessions.length}</span>
                </div>
                {taskSessions.map((session) => (
                  <div key={session.id}
                    onClick={() => { switchTaskSession(session.id); useStore.getState().setActiveTab('chat'); onNavigate('chat'); window.innerWidth < 1024 && toggleSidebar(); }}
                    className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                      activeTaskSessionId === session.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}>
                    <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] ${
                      activeTaskSessionId === session.id ? 'bg-[#57CC86]' : 'bg-gray-200'
                    }`}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={activeTaskSessionId === session.id ? 'white' : '#666'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] truncate" style={{ color: activeTaskSessionId === session.id ? '#1a1a1a' : '#444', fontWeight: activeTaskSessionId === session.id ? 600 : 400 }}>{session.taskName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <span>{formatTaskDate(new Date(session.updatedAt))}</span>
                        {session.messages.length > 0 && <span>· {session.messages.length}条消息</span>}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation();
                      useStore.getState().deleteTaskSession(session.id);
                    }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 transition-all" title="删除会话">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ═══ 专家会话列表 ═══ */}
            {expertSessions.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-[12px] font-normal" style={{color:'#AAA', letterSpacing: '0.5px'}}>🎯 专家会话</span>
                  <span className="text-[10px] text-gray-400">{expertSessions.length}</span>
                </div>
                {expertSessions.map((session) => (
                  <div key={session.id}
                    onClick={() => { switchExpertSession(session.id); useStore.getState().setActiveTab('chat'); onNavigate('chat'); window.innerWidth < 1024 && toggleSidebar(); }}
                    className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                      activeExpertSessionId === session.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}>
                    <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] ${
                      activeExpertSessionId === session.id ? 'bg-[#333]' : 'bg-gray-200'
                    }`}>{session.emoji || '🤖'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] truncate" style={{ color: activeExpertSessionId === session.id ? '#1a1a1a' : '#444', fontWeight: activeExpertSessionId === session.id ? 600 : 400 }}>{session.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <span>{formatTaskDate(new Date(session.updatedAt))}</span>
                        {session.messages.length > 0 && <span>· {session.messages.length}条消息</span>}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation();
                      // 🔧 v4.9.9: 统一调用store的deleteExpertSession方法
                      useStore.getState().deleteExpertSession(session.id);
                    }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 transition-all" title="删除会话">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ═══ 底部用户区域 — 个人中心（v4.7 重构）═══ */}
        <div className="shrink-0 border-t border-gray-200">

          {/* ── 用户头像栏（点击展开个人中心）── */}
          <button onClick={() => setShowUserPanel(v => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            style={{ background: 'transparent', border: 'none' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                 style={{ background: '#FFFFFF', border: '1px solid #E8F5EC' }}>
              <img src="/logo-graphic.svg" alt="勺子Claw" style={{width:26,height:26,objectFit:'contain'}} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-semibold text-gray-800 truncate">{userName || '勺子用户'}</p>
              <p className="text-[10px] font-mono text-gray-400 truncate">
                {isPointsLoggedIn ? <span className="text-[#57CC86] font-semibold">{pointsBalance} 积分</span> : userId}
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"
              style={{ transform: showUserPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* ── 个人中心面板（Tab化：档案 / 引导问答 / 检查更新）── */}
          {showUserPanel && (
            <div className="px-3 pb-3" style={{ background: '#FAFAFA' }}>
              <div className="border-t border-gray-100 pt-2">

                {/* ========== Tab 切换栏 ========== */}
                <div className="flex gap-1 mb-2.5 px-1 rounded-lg p-0.5" style={{ background: '#F0F0F0' }}>
                  <button onClick={() => setProfileTab('info')}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                      profileTab === 'info' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-500'
                    }`} style={profileTab === 'info' ? { background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { background: 'transparent' }}>
                    👤 档案
                  </button>
                  <button onClick={() => setProfileTab('onboarding')}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                      profileTab === 'onboarding' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-500'
                    }`} style={profileTab === 'onboarding' ? { background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { background: 'transparent' }}>
                    💡 引导
                  </button>
                  <button onClick={() => setProfileTab('update')}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                      profileTab === 'update' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-500'
                    }`} style={profileTab === 'update' ? { background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { background: 'transparent' }}>
                    🔄 更新
                  </button>
                </div>

                {/* ========== Tab 1: 档案信息 ========== */}
                {profileTab === 'info' && (
                  <div className="space-y-2">
                    {/* 昵称编辑 */}
                    <div className="flex items-center gap-2 px-1">
                      <label className="text-[11px] text-gray-500 shrink-0">昵称</label>
                      <input defaultValue={userName || ''}
                        onChange={(e) => useStore.getState().updateUserName(e.target.value)} placeholder="给自己起个名字…"
                        className="flex-1 px-2 py-1.5 rounded-md text-[12px] outline-none"
                        style={{ background: '#fff', border: '1px solid #eaeaea', color: '#333' }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#57CC86'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#eaeaea'}/>
                    </div>

                    {/* 用户ID */}
                    <div className="rounded-lg p-2.5 flex items-center gap-2.5" style={{ background: '#F8F8FA', border: '1px solid #EDEDED' }}>
                      <span style={{ fontSize: '12px' }}>🆔</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">用户 ID</p>
                        <p className="text-[11px] font-mono font-bold text-gray-700 tracking-wide">{userId}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(userId || ''); }}
                        className="px-2 py-1 rounded text-[10px] font-medium hover:bg-gray-100 transition-colors shrink-0"
                        style={{ color: '#666', background: '#f0f0f0', border: 'none', cursor: 'pointer' }}>复制</button>
                    </div>

                    {/* 设置入口 */}
                    <div onClick={() => { useStore.setState({ activeTab: 'settings' }); onNavigate('settings'); setShowUserPanel(false); }}
                      className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors group">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 group-hover:bg-[#E6F7EF] transition-colors shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] text-gray-700 font-medium">系统设置</span>
                        <span className="text-[10px] text-gray-400 ml-1.5 block">模型 · 集成 · 关于</span>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                )}

                {/* ========== Tab 2: 引导问答（嵌入OnboardingFlow的紧凑版）========== */}
                {profileTab === 'onboarding' && (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    <p className="text-[11px] text-gray-400 px-1 mb-1">修改首次使用的7个引导问题，让AI更懂你</p>
                    
                    {/* 7个问题的摘要展示，点击可跳转编辑 */}
                    {[
                      { key: 'userName', label: '称呼你什么？', val: userProfile.userName || '未填写', icon: '✨' },
                      { key: 'brandName', label: '品牌名称？', val: userProfile.brandName || '未填写', icon: '🏪' },
                      { key: 'brandStatus', label: '品牌状态？', val: userProfile.brandStatus === 'running' ? '已开业' : '策划中', icon: '🎯' },
                      { key: 'category', label: '所属品类？', val: userProfile.category || '未填写', icon: '👨‍🍳' },
                      { key: 'region', label: '所在地区？', val: userProfile.region || '未填写', icon: '📍' },
                      { key: 'position', label: '你的角色？', val: userProfile.position || '未填写', icon: '👥' },
                      { key: 'competitors', label: '对标品牌？', val: userProfile.competitors || '未填写', icon: '💼' },
                    ].map((q) => (
                      <div key={q.key} 
                        onClick={() => { setShowUserPanel(false); useStore.setState({ activeTab: 'onboarding' }); onNavigate('onboarding'); }}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors group">
                        <span className="text-xs shrink-0 w-5 text-center">{q.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] text-gray-700">{q.label}</span>
                          <span className={`ml-1.5 text-[10px] ${q.val === '未填写' ? 'text-gray-300 italic' : 'text-gray-500'}`}>({q.val})</span>
                        </div>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    ))}

                    <button onClick={() => { setShowUserPanel(false); useStore.setState({ activeTab: 'onboarding' }); onNavigate('onboarding'); }}
                      className="w-full py-2 rounded-lg text-[11px] font-medium transition-all"
                      style={{ background: '#57CC86', color: '#1A1A1A', border: 'none', marginTop: '4px' }}>
                      ✏️ 进入完整编辑模式
                    </button>
                  </div>
                )}

                {/* ========== Tab 3: 检查更新 ========== */}
                {profileTab === 'update' && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-gray-400 px-1 mb-1">检查是否有新版本可用</p>
                    
                    {/* 版本卡片 */}
                    <div className="rounded-lg p-3" style={{ background: '#F8F8FA', border: '1px solid #EDEDED' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <img src="/logo-graphic.svg" alt="" style={{width:22,height:22,objectFit:'contain'}} />
                          <span className="text-[12px] font-semibold" style={{color:'#333'}}>勺子Claw</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px]" style={{background:'#f0f0f0', color:'#666'}}>v{appVersion || '...'}</span>
                      </div>
                      <p className="text-[10px]" style={{color:'#AAA'}}>{appVersion ? `当前版本: v${appVersion}` : '加载中...'}</p>
                    </div>

                    {/* 手动检查更新按钮 */}
                    <button onClick={async () => {
                      setUpdateCheckStatus('checking');
                      // 触发全局UpdateNotifier检查，它会显示底部条
                      triggerUpdateCheck(true);
                      // 同时自己异步检查状态
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        const result = await invoke<{ available: boolean; version?: string }>('check_update');
                        if (result && result.available) {
                          setUpdateCheckStatus('available');
                          // 触发全局UpdateNotifier显示
                          window.dispatchEvent(new CustomEvent('shaoziclaw-update-available', { detail: result }));
                        } else {
                          setUpdateCheckStatus('latest');
                          setTimeout(() => setUpdateCheckStatus('idle'), 3000);
                        }
                      } catch (e) {
                        console.error('[Sidebar] 检查更新失败:', e);
                        setUpdateCheckStatus('idle');
                      }
                    }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-medium transition-all hover:opacity-90"
                      style={{ background: updateCheckStatus === 'available' ? '#57CC86' : updateCheckStatus === 'latest' ? '#3DAA5F' : '#333', color: '#fff', border: 'none', cursor: updateCheckStatus === 'checking' ? 'wait' : 'pointer' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ animation: updateCheckStatus === 'checking' ? 'spin 1s linear infinite' : 'none' }}>
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      {updateCheckStatus === 'checking' ? '检查中...' : updateCheckStatus === 'latest' ? '已是最新版本 ✅' : updateCheckStatus === 'available' ? '新版本就绪，查看上方提示' : '检查更新'}
                    </button>

                    {/* 更新日志链接 */}
                    <button onClick={async () => {
                        try {
                          const { invoke } = await import('@tauri-apps/api/core');
                          await invoke('open_url', { url: 'https://www.shaoziclaw.com/changelog.html' });
                        } catch {
                          window.open('https://www.shaoziclaw.com/changelog.html', '_blank');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] transition-all hover:bg-gray-100"
                      style={{ color: '#888', background: '#f5f5f5', border: '1px solid #eaeaea', cursor: 'pointer' }}>
                      📋 更新日志
                    </button>
                  </div>
                )}

                {/* 底部：版本号 + 退出 */}
                <div className="pt-2 flex items-center justify-between border-t border-gray-100 mt-1">
                  <span className="text-[11px]" style={{color:'#bbb'}}>勺子Claw v{appVersion || '...'}</span>
                  <button onClick={() => { logout(); setShowUserPanel(false); }}
                    className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>退出登录</button>
                </div>
              </div>
            </div>
          )}
        </div>
    </aside>
    </>
  );
}
