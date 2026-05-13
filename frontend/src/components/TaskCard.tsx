/**
 * ⏰ TaskCard — 定时任务卡片组件（v4.7.0）
 * 显示单个定时任务的摘要信息 + 操作按钮
 */

import { useStore } from '../store';
import type { ScheduledTask } from '../types/scheduled-task';
import { TRIGGER_TYPE_LABELS, WEEKDAY_LABELS } from '../types/scheduled-task';

interface TaskCardProps {
  task: ScheduledTask;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (id: string) => void;
  onRunNow: (id: string) => void;
  onChatOpen?: (id: string) => void;       // 💬 打开任务独立聊天
}

export default function TaskCard({ task, onToggle, onEdit, onDelete, onRunNow, onChatOpen }: TaskCardProps) {
  /** 整张卡片点击 → 打开聊天（优先于按钮） */
  const handleCardClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮区域，不触发卡片点击
    if ((e.target as HTMLElement).closest('button')) return;
    if (onChatOpen) onChatOpen(task.id);
  };
  const formatTime = () => {
    const h = String(task.schedule.hour).padStart(2, '0');
    const m = String(task.schedule.minute).padStart(2, '0');
    
    if (task.triggerType === 'weekly' && task.schedule.weekDays?.length) {
      const days = task.schedule.weekDays.map(d => WEEKDAY_LABELS[d] || `${d}`).join('/');
      return `每周${days} ${h}:${m}`;
    }
    if (task.triggerType === 'once' && task.schedule.onceAt) {
      return new Date(task.schedule.onceAt).toLocaleString('zh-CN', { 
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
    }
    return `每天 ${h}:${m}`;
  };

  const statusColor = task.enabled ? '#57CC86' : '#ccc';
  const statusLabel = task.enabled 
    ? (task.triggerType === 'once' && task.runCount > 0 ? '已执行' : '已启用')
    : '已暂停';
  
  const lastRunLabel = task.lastRunAt
    ? new Date(task.lastRunAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
        + ' ' + new Date(task.lastRunAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '-';

  return (
    <div
      style={{
        width: 260,
        borderRadius: 8,
        background: '#fff',
        border: `1px solid #e8e8ea`,
        borderLeft: `3px solid ${statusColor}`,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        cursor: onChatOpen ? 'pointer' : 'default',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
      onClick={handleCardClick}
    >
      {/* 头部：名称 + 状态 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.name}
          </span>
        </div>
        <span style={{
          fontSize: 11,
          color: task.enabled ? '#57CC86' : '#999',
          background: task.enabled ? '#E6F7EF' : '#f5f5f5',
          padding: '2px 8px',
          borderRadius: 10,
          whiteSpace: 'nowrap',
          marginLeft: 8,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* 时间 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{formatTime()}</span>
      </div>

      {/* 元信息 */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999' }}>
        <span>上次: {lastRunLabel}</span>
        <span>已运行{task.runCount}次</span>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
        {/* 播放/暂停 */}
        <button
          onClick={() => onToggle(task.id, !task.enabled)}
          title={task.enabled ? "暂停任务" : "启用任务"}
          style={{
            width: 30, height: 28, borderRadius: 6, border: '1px solid #e8e8ea',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: task.enabled ? '#57CC86' : '#999',
          }}
        >
          {task.enabled
            ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>)
            : (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>)
          }
        </button>

        {/* 立即执行 */}
        <button
          onClick={() => onRunNow(task.id)}
          title="立即执行一次"
          style={{
            width: 30, height: 28, borderRadius: 6, border: '1px solid #e8e8ea',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#333',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        </button>

        {/* 💬 聊天 */}
        {onChatOpen && (
          <button
            onClick={() => onChatOpen(task.id)}
            title="打开任务聊天"
            style={{
              width: 30, height: 28, borderRadius: 6, border: '1px solid #e8e8ea',
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#57CC86',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        )}

        {/* 编辑 */}
        <button
          onClick={() => onEdit(task)}
          title="编辑"
          style={{
            width: 30, height: 28, borderRadius: 6, border: '1px solid #e8e8ea',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#666', flex: 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        {/* 删除 */}
        <button
            onClick={() => onDelete(task.id)}
            title="删除"
            style={{
            width: 30, height: 28, borderRadius: 6, border: '1px solid #e8e8ea',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#999',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
