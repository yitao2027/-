// FirecrawlPanel.tsx — 舆情采集面板
// 内置 Firecrawl API，已充值 3000 积分，仅供舆情监测场景使用
//
// 计费规则：search=5积分，scrape=1积分/page，deep=50积分

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';

// ============================================================
// 类型定义
// ============================================================

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_credits: number;
  request_count: number;
  rank: number;
}

interface FirecrawlStatus {
  credits_total: number;
  credits_remaining: number;
  credits_used: number;
  total_requests: number;
  top_users: LeaderboardEntry[];
}

interface SearchResult {
  url: string;
  title: string;
  description: string;
  raw_content?: string;
  score: number;
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  credits_remaining: number;
  credits_used: number;
}

interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  credits_remaining: number;
  credits_used: number;
}

// ============================================================
// 工具函数
// ============================================================

async function invokeFirecrawl(command: string, params: Record<string, unknown>) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, params);
}

function getCreditPercent(remaining: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((remaining / total) * 100);
}

function getCreditColor(percent: number): string {
  if (percent > 60) return '#22C55E';  // 绿色
  if (percent > 30) return '#3DAA5F';  // 黄色
  return '#EF4444';                    // 红色
}

function getCreditLabel(percent: number): string {
  if (percent > 60) return '充足';
  if (percent > 30) return '预警';
  return '不足';
}

// ============================================================
// 组件主体
// ============================================================

export default function FirecrawlPanel() {
  const { userId, userName } = useStore();

  // 状态
  const [status, setStatus] = useState<FirecrawlStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // 采集状态
  const [brandName, setBrandName] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeContent, setScrapeContent] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'monitor' | 'results'>('monitor');

  // 加载状态
  const fetchStatus = useCallback(async () => {
    try {
      const data = await invokeFirecrawl('firecrawl_status', {}) as FirecrawlStatus;
      setStatus(data);
    } catch (e) {
      console.error('[FirecrawlPanel] 加载状态失败:', e);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 执行舆情搜索
  const handleSearch = async () => {
    if (!brandName.trim()) return;
    setLoading(true);
    setError(null);
    setSearchResults([]);
    setScrapeContent({});

    try {
      const res = await invokeFirecrawl('firecrawl_search', {
        query: brandName.trim(),
        userId: userId || 'anonymous',
        userName: userName || '匿名用户',
      }) as SearchResponse;

      if (res.success) {
        setSearchResults(res.results || []);
        setStatus(prev => prev ? {
          ...prev,
          credits_remaining: res.credits_remaining,
          credits_used: prev.credits_used + res.credits_used,
        } : null);
        setActiveTab('results');
      } else {
        setError('搜索失败，请重试');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || '搜索失败，请检查积分是否充足');
    } finally {
      setLoading(false);
    }
  };

  // 抓取单个页面内容
  const handleScrape = async (url: string) => {
    if (scrapeContent[url]) return; // 已有内容
    setScraping(true);
    try {
      const res = await invokeFirecrawl('firecrawl_scrape', {
        url,
        userId: userId || 'anonymous',
        userName: userName || '匿名用户',
      }) as ScrapeResult;

      if (res.content) {
        setScrapeContent(prev => ({ ...prev, [url]: res.content }));
        setStatus(prev => prev ? {
          ...prev,
          credits_remaining: res.credits_remaining,
        } : null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setScraping(false);
    }
  };

  // 把抓取内容注入到当前对话
  const injectToChat = (result: SearchResult) => {
    const content = scrapeContent[result.url] || result.raw_content || result.description;
    const text = `## 舆情数据：${result.title}\n\n**来源**：${result.url}\n\n**摘要**：${result.description}\n\n${content ? `**详细内容**：\n${content.slice(0, 2000)}` : ''}`;

    // 通过自定义事件传递到 ChatArea
    const event = new CustomEvent('shaoziclaw-inject-content', {
      detail: { content: text, source: '舆情采集', title: result.title }
    });
    window.dispatchEvent(event);
  };

  const creditsPercent = status ? getCreditPercent(status.credits_remaining, status.credits_total) : 100;
  const creditsColor = getCreditColor(creditsPercent);
  const creditsLabel = getCreditLabel(creditsPercent);

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif' }}>
      {/* 页头 */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
          🔥 舆情采集工具
        </h2>
        <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
          内置 Firecrawl · 3000 积分已充值 · 仅供舆情监测使用
        </p>
      </div>

      {/* 积分卡片 */}
      {statusLoading ? (
        <div style={{
          background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px',
          padding: '20px', marginBottom: '16px', textAlign: 'center', color: '#9CA3AF'
        }}>
          加载中...
        </div>
      ) : status && (
        <div style={{
          background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px',
          padding: '20px', marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>剩余积分</span>
              <div style={{ fontSize: '28px', fontWeight: 700, color: creditsColor }}>
                {status.credits_remaining.toLocaleString()}
                <span style={{ fontSize: '14px', fontWeight: 400, color: '#9CA3AF', marginLeft: '4px' }}>
                  / {status.credits_total.toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
                fontSize: '12px', fontWeight: 600,
                background: creditsColor + '20', color: creditsColor
              }}>
                {creditsLabel}
              </span>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                已消耗 {status.credits_used} 积分
              </div>
            </div>
          </div>

          {/* 进度条 */}
          <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${creditsPercent}%`, background: creditsColor,
              borderRadius: '3px', transition: 'width 0.3s ease'
            }} />
          </div>

          {/* 积分消耗说明 */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            {[
              { label: '搜索', cost: 5, desc: '次' },
              { label: '抓取', cost: 1, desc: '页' },
              { label: '深度研究', cost: 50, desc: '次' },
            ].map(item => (
              <div key={item.label} style={{ fontSize: '11px', color: '#6B7280', background: '#F9FAFB', padding: '4px 8px', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600 }}>{item.cost}</span> 积分/{item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 标签页 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#F3F4F6', borderRadius: '10px', padding: '3px' }}>
        {[
          { key: 'monitor', label: '📡 舆情采集', icon: '📡' },
          { key: 'results', label: '📋 采集结果', icon: '📋' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'monitor' | 'results')}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#111827' : '#9CA3AF',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
            {tab.key === 'results' && searchResults.length > 0 && (
              <span style={{
                marginLeft: '4px', background: '#57CC86', color: '#000',
                fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '10px'
              }}>
                {searchResults.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 舆情采集 Tab */}
      {activeTab === 'monitor' && (
        <div>
          <div style={{
            background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px',
            padding: '16px', marginBottom: '16px'
          }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              品牌名称
            </label>
            <input
              type="text"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入品牌名，如：霸王茶姬"
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB',
                borderRadius: '8px', fontSize: '14px', color: '#111827',
                background: '#FAFAFA', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#EF4444', background: '#FEF2F2', padding: '8px 12px', borderRadius: '6px' }}>
                {error}
              </div>
            )}
            <button
              onClick={handleSearch}
              disabled={loading || !brandName.trim() || creditsPercent < 3}
              style={{
                marginTop: '12px', width: '100%', padding: '11px',
                background: loading || !brandName.trim() || creditsPercent < 3 ? '#E5E7EB' : '#57CC86',
                color: loading || !brandName.trim() || creditsPercent < 3 ? '#9CA3AF' : '#111827',
                border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                cursor: loading || !brandName.trim() || creditsPercent < 3 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              {loading ? '🔍 搜索中...' : `🔍 开始舆情采集（消耗 5 积分）`}
            </button>
            {creditsPercent < 10 && !loading && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#3DAA5F', textAlign: 'center' }}>
                ⚠️ 积分不足，可能无法完成采集
              </div>
            )}
          </div>

          {/* 排行榜 */}
          {status && status.top_users.length > 0 && (
            <div style={{
              background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px', padding: '16px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                🏆 积分消耗排行榜（Top 20）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {status.top_users.slice(0, 20).map(user => (
                  <div key={user.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '6px 0',
                    borderBottom: '1px solid #F3F4F6',
                  }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', textAlign: 'center',
                      lineHeight: '20px', fontSize: '11px', fontWeight: 700,
                      background: user.rank === 1 ? '#57CC86' : user.rank <= 3 ? '#F3F4F6' : '#FAFAFA',
                      color: user.rank <= 3 ? '#111' : '#9CA3AF',
                    }}>
                      {user.rank}
                    </span>
                    <span style={{ flex: 1, fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                      {user.user_name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                      {user.total_credits} 积分 · {user.request_count}次
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 采集结果 Tab */}
      {activeTab === 'results' && (
        <div>
          {searchResults.length === 0 ? (
            <div style={{
              background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px',
              padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px'
            }}>
              暂无采集结果，请先在「舆情采集」中搜索
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {searchResults.map((result, idx) => (
                <div key={idx} style={{
                  background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px', padding: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '14px', fontWeight: 600, color: '#111827', textDecoration: 'none', display: 'block', marginBottom: '4px' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {result.title}
                      </a>
                      <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {result.url}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}>
                        {result.description}
                      </div>
                    </div>
                    <span style={{
                      flexShrink: 0, fontSize: '10px', fontWeight: 600,
                      padding: '3px 6px', borderRadius: '4px',
                      background: result.score > 0.8 ? '#DCFCE7' : result.score > 0.5 ? '#FEF9C3' : '#F3F4F6',
                      color: result.score > 0.8 ? '#166534' : result.score > 0.5 ? '#854D0E' : '#6B7280',
                    }}>
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* 抓取的详细内容 */}
                  {scrapeContent[result.url] && (
                    <div style={{
                      marginTop: '10px', padding: '10px', background: '#FAFAFA',
                      borderRadius: '8px', fontSize: '12px', color: '#4B5563',
                      maxHeight: '120px', overflow: 'auto', lineHeight: '1.6'
                    }}>
                      {scrapeContent[result.url].slice(0, 500)}
                      {scrapeContent[result.url].length > 500 && '...'}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={() => handleScrape(result.url)}
                      disabled={scraping || !!scrapeContent[result.url]}
                      style={{
                        padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: '6px',
                        fontSize: '12px', background: scrapeContent[result.url] ? '#F3F4F6' : '#fff',
                        color: scrapeContent[result.url] ? '#9CA3AF' : '#374151',
                        cursor: scraping || scrapeContent[result.url] ? 'default' : 'pointer',
                      }}
                    >
                      {scraping && !scrapeContent[result.url] ? '⏳ 抓取中(1积分)' : scrapeContent[result.url] ? '✅ 已抓取' : '📄 抓取详情(1积分)'}
                    </button>
                    <button
                      onClick={() => injectToChat(result)}
                      style={{
                        padding: '5px 12px', border: 'none', borderRadius: '6px',
                        fontSize: '12px', background: '#57CC86', color: '#111827',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      💬 注入对话
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
