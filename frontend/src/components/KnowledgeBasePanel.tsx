// KnowledgeBasePanel.tsx — 知识库管理面板（v5.1 RAG）
// 管理本地RAG知识库：查看状态、下载索引、重新初始化

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';

interface DownloadProgress {
  progress: number;
  message: string;
}

export default function KnowledgeBasePanel() {
  const { kbStatus, kbTotalChunks, kbIndexVersion, refreshKbStatus, setKbStatus } = useStore();
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 首次进入刷新状态
  useEffect(() => {
    refreshKbStatus();
  }, [refreshKbStatus]);

  const handleDownload = useCallback(async () => {
    setError(null);
    setKbStatus('loading');
    setDownloadProgress({ progress: 0, message: '准备下载...' });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { Channel } = await import('@tauri-apps/api/core');

      const channel = new Channel<DownloadProgress>();
      channel.onmessage = (progress) => {
        setDownloadProgress(progress);
      };

      const status = await invoke<any>('download_kb_index', {
        onProgress: channel,
      });

      // 下载+初始化成功
      setKbStatus('ready');
      useStore.getState().setKbInfo(status.totalChunks || 0, status.indexVersion || null);
      setDownloadProgress(null);
    } catch (e: any) {
      console.error('[KB] 下载失败:', e);
      setError(typeof e === 'string' ? e : e.message || '下载失败');
      setKbStatus('uninitialized');
      setDownloadProgress(null);
    }
  }, [setKbStatus]);

  const handleReinit = useCallback(async () => {
    setError(null);
    setKbStatus('loading');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<any>('init_knowledge_base');
      setKbStatus('ready');
      useStore.getState().setKbInfo(status.totalChunks || 0, status.indexVersion || null);
    } catch (e: any) {
      console.error('[KB] 初始化失败:', e);
      setError(typeof e === 'string' ? e : e.message || '初始化失败');
      setKbStatus('uninitialized');
    }
  }, [setKbStatus]);

  // 状态指示器
  const statusConfig = {
    unknown: { color: '#AAA', bg: '#333', icon: '❓', label: '检测中...' },
    uninitialized: { color: '#F59E0B', bg: '#422006', icon: '⚠️', label: '未初始化' },
    ready: { color: '#57CC86', bg: '#052e16', icon: '✅', label: '已就绪' },
    loading: { color: '#60A5FA', bg: '#172554', icon: '⏳', label: '处理中...' },
  }[kbStatus];

  return (
    <div className="space-y-4">
      {/* 状态卡片 */}
      <div
        className="rounded-xl p-4 border"
        style={{
          background: statusConfig.bg,
          borderColor: `${statusConfig.color}33`,
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{statusConfig.icon}</span>
          <div>
            <div className="text-sm font-medium" style={{ color: statusConfig.color }}>
              {statusConfig.label}
            </div>
            <div className="text-xs text-gray-500">餐饮专业RAG知识库</div>
          </div>
        </div>

        {/* 统计信息 */}
        {kbStatus === 'ready' && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-lg p-3" style={{ background: '#111' }}>
              <div className="text-xs text-gray-500 mb-1">知识条目</div>
              <div className="text-lg font-bold" style={{ color: '#57CC86' }}>
                {kbTotalChunks.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: '#111' }}>
              <div className="text-xs text-gray-500 mb-1">索引版本</div>
              <div className="text-lg font-bold" style={{ color: '#57CC86' }}>
                {kbIndexVersion || '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 下载进度 */}
      {downloadProgress && (
        <div className="rounded-xl p-4 border" style={{ background: '#172554', borderColor: '#60A5FA33' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="animate-spin">⏳</span>
            <span className="text-sm font-medium" style={{ color: '#60A5FA' }}>
              {downloadProgress.message}
            </span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: '#1E293B' }}>
            <div
              className="rounded-full h-2 transition-all duration-300"
              style={{
                width: `${downloadProgress.progress}%`,
                background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
              }}
            />
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="rounded-xl p-4 border" style={{ background: '#1a0505', borderColor: '#EF444433' }}>
          <div className="text-sm" style={{ color: '#EF4444' }}>{error}</div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {(kbStatus === 'uninitialized' || kbStatus === 'unknown') && (
          <button
            onClick={handleDownload}
            disabled={kbStatus === 'loading'}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #57CC86, #1A7D4E)',
              color: 'white',
            }}
          >
            下载知识库索引
          </button>
        )}
        {kbStatus === 'ready' && (
          <button
            onClick={handleReinit}
            disabled={kbStatus === 'loading'}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: '#1E293B',
              color: '#94A3B8',
              border: '1px solid #334155',
            }}
          >
            重新初始化
          </button>
        )}
      </div>

      {/* 说明 */}
      <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #1E293B' }}>
        <div className="text-xs text-gray-500 space-y-2">
          <p>知识库包含 261+ 个餐饮专业技能（SKILL.md），覆盖选址、营运、营销、供应链、法务等全链条知识。</p>
          <p>AI在回答时会自动检索相关知识作为参考依据，提升回答的专业性和准确性。</p>
          <p style={{ color: '#60A5FA' }}>
            索引文件约 50MB，首次下载后保存在本地，无需重复下载。
          </p>
        </div>
      </div>
    </div>
  );
}
