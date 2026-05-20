/**
 * ⏰ TaskRunToast — 定时任务执行通知组件（v4.7.0）
 * 显示在页面顶部或底部的任务完成/失败通知
 */

import { useState, useEffect } from 'react';
import type { ExecutionResult } from '../types/scheduled-task';

interface TaskRunToastProps {
  result: ExecutionResult | null;
  onDismiss: () => void;
  onViewResult?: (taskId: string) => void;
}

export default function TaskRunToast({ result, onDismiss, onViewResult }: TaskRunToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setVisible(true);
      // 自动消失：5秒后折叠
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!result || !visible) return null;

  const isSuccess = result.success;

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 2000,
      background: '#fff',
      borderRadius: 8,
      boxShadow: `0 4px 20px ${isSuccess ? 'rgba(87,204,134,0.2)' : 'rgba(231,76,60,0.2)'}`,
      borderLeft: `4px solid ${isSuccess ? '#57CC86' : '#e74c3c'}`,
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      minWidth: 320, maxWidth: 500,
      animation: 'toastSlideDown 0.25s ease-out',
    }}>
      <style>{`
        @keyframes toastSlideDown {
          from { opacity: 0; transform: translate(-50%, -100%); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* 状态图标 */}
      <span style={{ fontSize: 18, flexShrink: 0 }}>{isSuccess ? '✅' : '❌'}</span>

      {/* 文字 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
          {isSuccess ? `「${result.taskName}」已完成` : `「${result.taskName}」执行失败`}
        </div>
        {isSuccess && result.content && (
          <div style={{
            fontSize: 12, color: '#666', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {result.content.length > 80 ? result.content.slice(0, 80) + '...' : result.content}
          </div>
        )}
        {!isSuccess && result.errorMessage && (
          <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 2 }}>
            {result.errorMessage.length > 60 ? result.errorMessage.slice(0, 60) + '...' : result.errorMessage}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {isSuccess && onViewResult && (
        <button onClick={() => onViewResult(result.taskId)}
          style={{
            padding: '5px 12px', borderRadius: 6,
            border: '1px solid #57CC86', background: '#E6F7EF', color: '#1A7D4E',
            fontSize: 12, cursor: 'pointer', flexShrink: 0,
          }}
        >查看结果</button>
      )}

      {/* 关闭 */}
      <button onClick={onDismiss}
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: '#999', flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
