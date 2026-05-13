import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { getVersion } from '@tauri-apps/api/app';

// 统一配色方案：品牌黄 + 中性灰阶
const COLORS = {
  bg: {
    card: 'rgba(255,255,255,0.03)',
    cardHover: 'rgba(255,255,255,0.05)',
    primary: 'rgba(87,204,134,0.06)',
    primaryHover: 'rgba(87,204,134,0.10)',
  },
  border: {
    default: 'rgba(255,255,255,0.06)',
    primary: 'rgba(87,204,134,0.12)',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.55)',
    muted: 'rgba(255,255,255,0.35)',
    brand: '#57CC86',
  }
};

export default function HomeScreen() {
  const { userName, setActiveTab, wechatConfig, feishuConfig, customModels } = useStore();
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => { getVersion().then(v => setAppVersion(v)).catch(() => {}) }, []);

  const stats = [
    { label: '品牌Slogan', value: '超级AI大脑', sub: '餐饮人的AI伙伴' },
    { label: '知识库资料', value: '931', sub: '份行业资料' },
    { label: '自定义模型', value: String(customModels.length), sub: '个已接入' },
    { label: '集成状态', value: [wechatConfig.enabled, feishuConfig.enabled].filter(Boolean).length + '/2', sub: '已连接' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 欢迎区 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold" style={{ color: COLORS.text.primary }}>你好，{userName || '餐饮人'}</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: COLORS.bg.primary, color: COLORS.text.brand, border: `1px solid ${COLORS.border.primary}` }}>
              内测版 v{appVersion || '...'}
            </span>
          </div>
          <p className="text-sm" style={{ color: COLORS.text.secondary }}>餐饮人的超级AI大脑，20位AI专家随时待命，今天想聊什么？</p>
        </div>

        {/* 统计卡片区 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              onClick={() => setActiveTab('settings')}
              className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: COLORS.bg.card, border: `1px solid ${COLORS.border.default}` }}
            >
              <div className="text-2xl font-bold mb-1" style={{ color: COLORS.text.brand }}>{stat.value}</div>
              <div className="text-xs" style={{ color: COLORS.text.secondary }}>{stat.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: COLORS.text.muted }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* 快捷入口 */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.text.primary }}>快捷入口</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 对话入口 - 大卡片 */}
            <button
              onClick={() => setActiveTab('chat')}
              className="md:col-span-2 row-span-2 p-5 rounded-xl text-left transition-all hover:scale-[1.01] group"
              style={{ background: COLORS.bg.primary, border: `1px solid ${COLORS.border.primary}` }}
            >
              <div className="w-11 h-11 rounded-xl mb-4 flex items-center justify-center"
                   style={{ background: 'rgba(87,204,134,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#57CC86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1" style={{ color: COLORS.text.primary }}>开始对话</h3>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.text.secondary }}>向任意AI专家提问，获取专业建议</p>
              <div className="mt-4 flex items-center gap-1 text-xs transition-colors" style={{ color: 'rgba(87,204,134,0.60)' }}>
                立即开始 →
              </div>
            </button>

            {/* 模型配置 */}
            <button
              onClick={() => setActiveTab('settings')}
              className="p-4 rounded-xl text-left transition-all group"
              style={{ background: COLORS.bg.card, border: `1px solid ${COLORS.border.default}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg.cardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.bg.card; }}
            >
              <div className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center text-base"
                   style={{ background: 'rgba(255,255,255,0.06)' }}>🤖</div>
              <h3 className="text-sm font-medium mb-0.5" style={{ color: COLORS.text.primary }}>模型配置</h3>
              <p className="text-[11px]" style={{ color: COLORS.text.muted }}>接入自定义大模型</p>
              {customModels.length > 0 && (
                <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: 'rgba(87,204,134,0.08)', color: COLORS.text.brand }}>{customModels.length}个已接入</span>
              )}
            </button>

            {/* 微信集成 */}
            <button
              onClick={() => setActiveTab('settings')}
              className="p-4 rounded-xl text-left transition-all group"
              style={{ background: COLORS.bg.card, border: `1px solid ${COLORS.border.default}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg.cardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.bg.card; }}
            >
              <div className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center text-base"
                   style={{ background: 'rgba(255,255,255,0.06)' }}>💬</div>
              <h3 className="text-sm font-medium mb-0.5" style={{ color: COLORS.text.primary }}>微信通知</h3>
              <p className="text-[11px]" style={{ color: COLORS.text.muted }}>{wechatConfig.enabled ? '已连接' : '扫码绑定'}</p>
              {wechatConfig.enabled && (
                <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: 'rgba(87,204,134,0.08)', color: COLORS.text.brand }}>✓ 已启用</span>
              )}
            </button>

            {/* 飞书集成 */}
            <button
              onClick={() => setActiveTab('settings')}
              className="p-4 rounded-xl text-left transition-all group"
              style={{ background: COLORS.bg.card, border: `1px solid ${COLORS.border.default}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg.cardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.bg.card; }}
            >
              <div className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center text-base"
                   style={{ background: 'rgba(255,255,255,0.06)' }}>🚀</div>
              <h3 className="text-sm font-medium mb-0.5" style={{ color: COLORS.text.primary }}>飞书通知</h3>
              <p className="text-[11px]" style={{ color: COLORS.text.muted }}>{feishuConfig.enabled ? '已连接' : '配置Webhook'}</p>
              {feishuConfig.enabled && (
                <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: 'rgba(87,204,134,0.08)', color: COLORS.text.brand }}>✓ 已启用</span>
              )}
            </button>

            {/* 专家中心 */}
            <button
              onClick={() => setActiveTab('experts')}
              className="p-4 rounded-xl text-left transition-all group"
              style={{ background: COLORS.bg.card, border: `1px solid ${COLORS.border.default}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg.cardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.bg.card; }}
            >
              <div className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center text-base"
                   style={{ background: 'rgba(255,255,255,0.06)' }}>⚡</div>
              <h3 className="text-sm font-medium mb-0.5" style={{ color: COLORS.text.primary }}>专家中心</h3>
              <p className="text-[11px]" style={{ color: COLORS.text.muted }}>浏览全部技能模块</p>
            </button>
          </div>
        </div>

        {/* 推荐场景 */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.text.primary }}>推荐场景</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { emoji: '📊', title: '菜单定价分析', desc: '基于成本结构优化菜品价格和毛利率' },
              { emoji: '🛒', title: '外卖运营优化', desc: '提升曝光率、转化率、复购率的系统方案' },
              { emoji: '👥', title: '员工排班管理', desc: '科学排班、用工合规、降低人力成本' },
              { emoji: '📍', title: '选址评估报告', desc: '人流、竞品、租金综合评估打分' },
            ].map((item) => (
              <button
                key={item.title}
                onClick={() => setActiveTab('chat')}
                className="p-4 rounded-xl text-left transition-all group flex items-start gap-3"
                style={{ background: COLORS.bg.card, border: `1px solid ${COLORS.border.default}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.bg.cardHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.bg.card; }}
              >
                <span className="text-xl mt-0.5">{item.emoji}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-medium" style={{ color: COLORS.text.primary }}>{item.title}</h3>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: COLORS.text.muted }}>{item.desc}</p>
                </div>
                <svg className="shrink-0 mt-1 transition-colors" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: COLORS.text.muted }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="rounded-xl p-4 flex items-start gap-3"
             style={{ background: COLORS.bg.primary, border: `1px solid ${COLORS.border.primary}` }}>
          <svg className="shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#57CC86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(87,204,134,0.80)' }}>内测版使用提示</p>
            <p className="text-[11px] leading-relaxed" style={{ color: COLORS.text.muted }}>
当前为勺子Claw v{appVersion || '...'}内测版本。邀请码由宋宣私下发放，如需申请请发送邮件至 songxuan@shaoziclaw.com。
              建议先配置自定义大模型和微信/飞书通知以获得最佳体验。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
