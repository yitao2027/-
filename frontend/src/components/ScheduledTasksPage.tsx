/**
 * ⏰ ScheduledTasksPage — 定时任务管理主页面（v4.9.9）
 * 任务卡片网格 + 新建按钮 + 编辑器抽屉
 *
 * v4.9.9 变更：删除右侧抽屉式TaskChatDrawer，改为复用ChatArea全屏窗口
 * - 点击卡片/💬按钮 → createTaskSession() → 自动跳转chat页面
 * - 与专家角色聊天体验完全一致
 */

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import TaskCard from './TaskCard';
import TaskEditorDrawer from './TaskEditorDrawer';
import type { ScheduledTask } from '../types/scheduled-task';

export default function ScheduledTasksPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const scheduledTasks = useStore(s => s.scheduledTasks);
  const activeCount = useStore(s => s.activeScheduledCount);
  const loadTasks = useStore(s => s.loadScheduledTasks);
  const deleteTask = useStore(s => s.deleteScheduledTask);
  const toggleTask = useStore(s => s.toggleScheduledTask);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editTask, setEditTask] = useState<ScheduledTask | null>(null);

  // 🆕 任务会话相关（v4.9.9 — 跳转ChatArea全屏窗口）
  const createTaskSession = useStore(s => s.createTaskSession);

  // 页面加载时获取任务列表
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 监听后端执行完成事件
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{ taskId: string; taskName: string; success: boolean; content?: string }>(
          'scheduled-task-complete',
          (event) => {
            const payload = event.payload;
            console.log('[定时任务]', payload.success ? `✅ ${payload.taskName} 执行完成` : `❌ ${payload.taskName} 执行失败`);
            loadTasks();

            // 🔧 B087修复: 后端定时自动执行完成后，将结果写入对应taskSession
            // 场景：scheduler后台定时执行（非用户手动▶），结果需要送达前端聊天窗口
            if (payload.success && payload.content) {
              const store = useStore.getState();
              // 查找该任务是否有活跃的taskSession
              const activeSession = store.taskSessions.find(s => s.taskId === payload.taskId);
              if (activeSession) {
                // 写入assistant消息到对应taskSession
                const assistantMsg: any = {
                  id: `sched-result-${Date.now()}`,
                  role: 'assistant',
                  content: payload.content,
                  timestamp: new Date(),
                  thinkingSteps: [],
                  isThinkingComplete: true,
                };
                store.addMessageToTaskSession(activeSession.id, assistantMsg);
                console.log('[定时任务] B087: 结果已写入taskSession', activeSession.id);
              } else {
                console.log('[定时任务] B087: 无活跃taskSession，结果仅通过通知展示');
              }
            }

            if (Notification.permission === 'granted') {
              new Notification('勺子Claw 定时任务', {
                body: `${payload.taskName} - ${payload.success ? '执行完成' : '执行失败'}`,
              });
            }
          }
        );
      } catch (e) {
        console.warn('[定时任务] 无法监听事件:', e);
      }
    }

    setup();
    return () => { if (unlisten) unlisten(); };
  }, [loadTasks]);

  /** 新建 */
  const handleCreate = () => {
    setEditTask(null);
    setDrawerVisible(true);
  };

  /** 编辑 */
  const handleEdit = (task: ScheduledTask) => {
    setEditTask(task);
    setDrawerVisible(true);
  };

  /** 删除（二次确认） */
  const handleDelete = async (id: string) => {
    const task = scheduledTasks.find(t => t.id === id);
    if (!task) return;

    if (confirm(`确定删除「${task.name}」吗？此操作不可撤销。`)) {
      try {
        await deleteTask(id);
      } catch (e) {
        alert('删除失败：' + (e as Error).message);
      }
    }
  };

  /** 切换启用/暂停 */
  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleTask(id, enabled);
    } catch (e) {
      alert('操作失败：' + (e as Error).message);
    }
  };

  /** v5.3.2: 手动执行 — 直接在聊天中执行（不再弹窗阻塞UI） */
  const handleRunNow = async (id: string) => {
    const task = scheduledTasks.find(t => t.id === id);
    if (!task) return;
    const promptTemplate = task.taskContent?.promptTemplate || '';
    const skillName = task.taskContent?.skillName || '';
    // 🔧 v5.3.9: 不打打招呼，第一句话直接是任务执行结果
    createTaskSession(task.id, task.name, promptTemplate, skillName, promptTemplate, true);
    // 🔧 v5.3.8: 同时设置activeTab，防止App侧导航状态不同步
    useStore.getState().setActiveTab('chat');
    console.log('[定时任务] ▶ createTaskSession完成, prompt长度=', promptTemplate.length, '→ onNavigate chat');
    onNavigate('chat');
  };

  /** 💬 打开任务聊天 — v4.9.9: 创建任务会话，自动跳转到ChatArea全屏窗口 */
  const handleChatOpen = useCallback((taskId: string) => {
    const task = scheduledTasks.find(t => t.id === taskId);
    if (!task) return;

    const promptTemplate = task.taskContent?.promptTemplate || '';
    const skillName = task.taskContent?.skillName || '';

    // 🔧 v5.3.1: 打开聊天时自动发送任务内容执行（不再只打招呼）
    // 🔧 B085修复: 使用直接run模式，与handleRunNow一致，避免重复greeting
    createTaskSession(task.id, task.name, promptTemplate, skillName, promptTemplate, true);
    // 🔧 B085修复: 必须同步调用setActiveTab和onNavigate，否则B016可能不触发或时序不对
    // 缺失这两行导致点击卡片后留在定时任务页面或跳到主聊天窗口
    useStore.getState().setActiveTab('chat');
    console.log('[定时任务] 💬 handleChatOpen完成, prompt长度=', promptTemplate.length, '→ onNavigate chat');
    onNavigate('chat');
  }, [scheduledTasks, createTaskSession]);

  /** 保存回调 — 强制刷新列表（修复保存后不显示的Bug） */
  const handleSave = (_saved: ScheduledTask) => {
    setTimeout(() => loadTasks(), 300);
  };

  /** 构建任务列表 */
  const allTasks = scheduledTasks;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── 左侧：任务管理区域 ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
        flex: 1, minWidth: 0,
        transition: 'width 0.25s ease',
      }}>
        {/* 工具栏 */}
        <div style={{
          height: 56, borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', flexShrink: 0,
        }}>
          <div style={{ fontSize: 14, color: '#666' }}>
            共 <strong>{allTasks.length}</strong> 个任务
            {activeCount > 0 && (
              <span style={{ color: '#57CC86', marginLeft: 8 }}>
                · {activeCount} 个运行中
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* 刷新按钮 */}
            <button onClick={loadTasks}
              title="刷新列表"
              style={{
                width: 34, height: 34, borderRadius: 6,
                border: '1px solid #e8e8ea', background: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#666',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>

            {/* 新建按钮 */}
            <button onClick={handleCreate}
              style={{
                height: 34, paddingLeft: 16, paddingRight: 16, borderRadius: 6,
                border: 'none', background: '#57CC86', color: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              新建任务
            </button>
          </div>
        </div>

        {/* 卡片网格区域 */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12
        }}>
          {allTasks.length === 0 ? (
            <EmptyState onCreate={handleCreate} />
          ) : (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 14, alignContent: 'flex-start'
            }}>
              {allTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRunNow={handleRunNow}
                  onChatOpen={handleChatOpen}
                />
              ))}
            </div>
          )}

          {/* 底部提示 */}
          {scheduledTasks.length > 0 && (
            <div style={{
              marginTop: 'auto', paddingTop: 16,
              fontSize: 12, color: '#bbb', textAlign: 'center',
            }}>
              提示：保持勺子Claw 运行以确保定时任务正常触发
            </div>
          )}
        </div>
      </div>

      {/* 编辑抽屉 */}
      <TaskEditorDrawer
        visible={drawerVisible}
        editTask={editTask}
        onClose={() => { setDrawerVisible(false); setEditTask(null); }}
        onSave={handleSave}
      />
    </div>
  );
}

// ────────────────────────────────────────────────
//  空状态组件
// ────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, color: '#999',
    }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <span style={{ fontSize: 15 }}>还没有定时任务</span>
      <span style={{ fontSize: 13 }}>创建一个任务，让AI自动为你工作</span>
      <button onClick={onCreate}
        style={{
          marginTop: 8, height: 36, paddingLeft: 20, paddingRight: 20, borderRadius: 6,
          border: '1px solid #57CC86', background: '#fff', color: '#57CC86',
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}
      >
        + 创建第一个任务
      </button>
    </div>
  );
}
