import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { useStore, type CustomModel } from '../store';
import PointsPanel from './PointsPanel';
import FirecrawlPanel from './FirecrawlPanel';
import KnowledgeBasePanel from './KnowledgeBasePanel';

/** 在外部浏览器打开URL */
async function openInBrowser(url: string) {
  try {
    await invoke('open_url', { url });
  } catch {
    window.open(url, '_blank');
  }
}

// 预设模型提供商
const MODEL_PROVIDERS = [
  { id: 'siliconflow', name: '硅基流动', icon: '🟣' },
  { id: 'dashscope', name: '阿里百炼', icon: '🟠' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🔵' },
];

// 内置预装模型（v5.1.0: 统一走墨行 Moxing API，含多模态能力标签）
const BUILTIN_MODELS = [
  { id: 'deepseek-v4', name: '墨行 · DeepSeek V4', provider: 'moxing', icon: '🔵', desc: '默认旗舰 · 深度推理 ✅', isCustomEndpoint: true, apiBase: 'https://www.moxing.pro', apiKey: 'sk-mxai-***（服务端内置）', capabilities: ['text', 'code'] as const },
  { id: 'glm-5.1', name: '墨行 · GLM-5.1', provider: 'moxing', icon: '🟢', desc: '推理旗舰 · 智谱文本 ✅', isCustomEndpoint: true, apiBase: 'https://www.moxing.pro', apiKey: 'sk-mxai-***（服务端内置）', capabilities: ['text', 'code'] as const },
  { id: 'kimi-k2.5', name: '墨行 · Kimi K2.5', provider: 'moxing', icon: '🟣', desc: '视觉识别 · 月之暗面 ✅', isCustomEndpoint: true, apiBase: 'https://www.moxing.pro', apiKey: 'sk-mxai-***（服务端内置）', capabilities: ['text', 'code', 'image'] as const },
  { id: 'seedance-2.0', name: '墨行 · Seedance 2.0', provider: 'moxing', icon: '🟡', desc: '视频生成 · 豆包 ✅', isCustomEndpoint: true, apiBase: 'https://www.moxing.pro', apiKey: 'sk-mxai-***（服务端内置）', capabilities: ['video'] as const },
];

// 自定义提供商预设（v5.0.0: 默认走墨行）
const CUSTOM_PROVIDER_PRESETS = [
  { id: 'moxing', name: '墨行 Moxing', apiBase: 'https://www.moxing.pro' },
  { id: 'custom', name: '其他/自部署', apiBase: '' },
];

export default function Settings() {
  const {
    userName, userEmail, isBetaUser, redeemed,
    customModels, activeModelId,
    wechatConfig, feishuConfig,
    logout,
    addCustomModel, removeCustomModel, updateCustomModel, setActiveModel,
    updateWechatConfig, testWechatConnection,
    updateFeishuConfig, testFeishuConnection,
  } = useStore();

  const [activeSection, setActiveSection] = useState<'models' | 'points' | 'firecrawl' | 'kb' | 'wechat' | 'feishu' | 'about'>('models');
  const [showAddModel, setShowAddModel] = useState(false);
  const [testingWechat, setTestingWechat] = useState(false);
  const [testingFeishu, setTestingFeishu] = useState(false);
  const [wechatTestResult, setWechatTestResult] = useState<'success' | 'fail' | null>(null);
  const [feishuTestResult, setFeishuTestResult] = useState<'success' | 'fail' | null>(null);

  const [newModel, setNewModel] = useState({
    provider: 'openai',
    name: '', apiKey: '', apiBase: '',
    model: '', maxTokens: 4096, temperature: 0.7, isActive: false,
  });
  const [selectedProvider, setSelectedProvider] = useState(MODEL_PROVIDERS[0]);

  useEffect(() => {
    if (newModel.provider) {
      const p = MODEL_PROVIDERS.find(mp => mp.id === newModel.provider);
      if (p) {
        setSelectedProvider(p);
        setNewModel(prev => ({ ...prev, apiBase: p.apiBase || prev.apiBase }));
      }
    }
  }, [newModel.provider]);

  const handleAddModel = () => {
    if (!newModel.name || !newModel.apiKey || !newModel.model) return;
    addCustomModel({ ...newModel, isActive: customModels.length === 0 });
    setNewModel({ provider: 'openai', name: '', apiKey: '', apiBase: MODEL_PROVIDERS[0].apiBase || '', model: '', maxTokens: 4096, temperature: 0.7, isActive: false });
    setShowAddModel(false);
  };

  const handleRemoveModel = (id: string) => removeCustomModel(id);
  const handleSetActiveModel = (id: string | null) => setActiveModel(id);

  const handleTestWechat = async () => {
    setTestingWechat(true); setWechatTestResult(null);
    const ok = await testWechatConnection();
    setWechatTestResult(ok ? 'success' : 'fail'); setTestingWechat(false);
  };

  const handleTestFeishu = async () => {
    setTestingFeishu(true); setFeishuTestResult(null);
    const ok = await testFeishuConnection();
    setFeishuTestResult(ok ? 'success' : 'fail'); setTestingFeishu(false);
  };

  const activeModel = customModels.find(m => m.id === activeModelId);

  // ─── 浅色主题通用样式常量 ───
  const cardStyle = { background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px' };
  const inputStyle = "w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all";
  const inputFocusStyle = "focus:border-purple-400 focus:bg-white";

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#F8F8FA', padding: '24px 32px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* 页头 */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>系统设置</h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>管理你的账户、模型配置和第三方集成</p>
        </div>

        {/* 用户信息卡 */}
        <div style={{ ...cardStyle, padding: '18px 22px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', fontWeight: 700, color: '#000'
          }}>
            {userName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827' }}>{userName || '用户'}</span>
              {isBetaUser && (
                <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: '#E6F7EF', color: '#1A7D4E' }}>内测版</span>
              )}
              {redeemed && (
                <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: '#D1FAE5', color: '#059669' }}>已激活 ✓</span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{userEmail}</span>
          </div>
          <button onClick={logout}
            style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: '#FEF2F2', color: '#DC2626', border: 'none', cursor: 'pointer' }}>
            退出登录
          </button>
        </div>

        {/* 导航标签 */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#EDEDED', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          {[{ id: 'models' as const, label: '模型配置', icon: '🤖' }, { id: 'points' as const, label: '积分充值', icon: '💎' }, { id: 'firecrawl' as const, label: '舆情采集', icon: '🔥' }, { id: 'kb' as const, label: '知识库', icon: '📚' }, { id: 'wechat' as const, label: '微信集成', icon: '💬' }, { id: 'feishu' as const, label: '飞书集成', icon: '🚀' }, { id: 'about' as const, label: '关于', icon: 'ℹ️' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              style={{
                padding: '7px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: activeSection === tab.id ? '#fff' : 'transparent',
                color: activeSection === tab.id ? '#111827' : '#6B7280',
                boxShadow: activeSection === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <span style={{ marginRight: '5px' }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* ════════ 积分充值 ════════ */}
        {activeSection === 'points' && <PointsPanel />}

        {/* ════════ 模型配置 ════════ */}
        {activeSection === 'models' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* 自动模式 */}
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E6F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⚡</div>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>自动模式</h3>
                    <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>系统根据任务复杂度自动选择最优模型</p>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!activeModelId} onChange={(e) => { if (e.target.checked) handleSetActiveModel(null); }} className="sr-only peer" />
                  <div style={{ width: '44px', height: '24px', borderRadius: '12px', position: 'relative', transition: 'all 0.2s', background: !activeModelId ? '#57CC86' : '#D1D5DB' }}
                    className={`${!activeModelId ? '' : ''}`}>
                    <div style={{ position: 'absolute', top: '2px', left: !activeModelId ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
                  </div>
                </label>
              </div>
              {!activeModelId && (
                <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontSize: '12.5px', color: '#059669', fontWeight: 500 }}>已开启 · 勺子Claw 将自动选择最合适的模型处理你的请求</span>
                </div>
              )}
            </div>

            {/* 内置模型 */}
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>内置模型</h3>
                <span style={{ fontSize: '11px', color: '#9CA3AF', background: '#F3F4F6', padding: '3px 10px', borderRadius: '6px' }}>{BUILTIN_MODELS.length} 个可用</span>
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '6px' }}>
                {BUILTIN_MODELS.map(model => {
                  return (
                    <button key={model.id}
                      onClick={() => { /* 切换到该内置模型 */ }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px',
                        borderRadius: '10px', border: '1px solid transparent', background: '#FAFAFB',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#FAFAFB' }}>
                      <span style={{ fontSize: '19px' }}>{model.icon}</span>
                      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 550, color: '#1f2937' }}>{model.name}</div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{model.desc}{model.isCustomEndpoint ? ' (via vtok.ai)' : model.needsKey ? ' · 需配置Key' : ''}</div>
                        {'capabilities' in model && model.capabilities && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                            {model.capabilities.includes('text') && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#EFF6FF', color: '#3B82F6' }}>文字</span>}
                            {model.capabilities.includes('code') && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#F0FDF4', color: '#22C55E' }}>代码</span>}
                            {model.capabilities.includes('image') && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#FDF4FF', color: '#A855F7' }}>图片</span>}
                            {model.capabilities.includes('video') && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#FFF7ED', color: '#F97316' }}>视频</span>}
                          </div>
                        )}
                      </div>
                      {!model.needsKey && (
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A' }}>可用</span>
                      )}
                      {model.needsKey && (
                        <span style={{ fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: '#E6F7EF', color: '#1A7D4E' }}>需配置</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 自定义模型 */}
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>自定义模型</h3>
                <button onClick={() => setShowAddModel(!showAddModel)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: '#F3E8FF', color: '#7C3AED', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#EDE9FE'} onMouseLeave={(e) => e.currentTarget.style.background = '#F3E8FF'}>
                  ➕ 配置自定义模型
                </button>
              </div>

              {/* 添加表单 */}
              {showAddModel && (
                <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '10px', background: '#FAFAFB', border: '1px solid #EDEDED', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#7C3AED', margin: 0 }}>添加自定义模型</h4>

                  <div><label style={{ display: 'block', fontSize: '11.5px', color: '#6B7280', marginBottom: '4px', marginLeft: '2px' }}>显示名称</label>
                    <input type="text" value={newModel.name} onChange={e => setNewModel(prev => ({ ...prev, name: e.target.value }))} placeholder="如：我的GPT-4o"
                      className={`${inputStyle} ${inputFocusStyle}`} /></div>

                  <div><label style={{ display: 'block', fontSize: '11.5px', color: '#6B7280', marginBottom: '4px', marginLeft: '2px' }}>API Key</label>
                    <input type="password" value={newModel.apiKey} onChange={e => setNewModel(prev => ({ ...prev, apiKey: e.target.value }))} placeholder="sk-... （本地加密存储）"
                      className={`${inputStyle} ${inputFocusStyle}`} style={{ fontFamily: 'monospace', fontSize: '12px' }} /></div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={{ display: 'block', fontSize: '11.5px', color: '#6B7280', marginBottom: '4px', marginLeft: '2px' }}>API Base URL</label>
                      <input type="text" value={newModel.apiBase} onChange={e => setNewModel(prev => ({ ...prev, apiBase: e.target.value }))} placeholder="https://api.openai.com/v1"
                        className={`${inputStyle} ${inputFocusStyle}`} style={{ fontFamily: 'monospace', fontSize: '11px' }} /></div>
                    <div><label style={{ display: 'block', fontSize: '11.5px', color: '#6B7280', marginBottom: '4px', marginLeft: '2px' }}>模型名称</label>
                      <input type="text" value={newModel.model} onChange={e => setNewModel(prev => ({ ...prev, model: e.target.value }))} placeholder="gpt-4o / claude-sonnet-4..."
                        className={`${inputStyle} ${inputFocusStyle}`} style={{ fontFamily: 'monospace', fontSize: '11px' }} /></div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                    <button onClick={handleAddModel} disabled={!newModel.name || !newModel.apiKey || !newModel.model}
                      style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#000', background: 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)', border: 'none', cursor: 'pointer', opacity: (!newModel.name || !newModel.apiKey || !newModel.model) ? 0.4 : 1 }}>
                      确认添加
                    </button>
                    <button onClick={() => setShowAddModel(false)} style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', color: '#6B7280', background: 'transparent', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              )}

              {customModels.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>尚未配置自定义模型</p>
                  <p style={{ fontSize: '12px', color: '#D1D5DB', marginTop: '4px' }}>点击上方按钮接入你自己的大模型API</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customModels.map(model => {
                    const isActive = model.id === activeModelId;
                    return (
                      <div key={model.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px',
                        border: `1px solid ${isActive ? '#DDD6FE' : '#EDEDED'}`,
                        background: isActive ? '#FAF5FF' : '#fff', transition: 'all 0.2s'
                      }}>
                        <span style={{ fontSize: '16px' }}>🎯</span>
                        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => handleSetActiveModel(isActive ? null : model.id)}>
                          <div style={{ fontSize: '13.5px', fontWeight: 550, color: isActive ? '#7C3AED' : '#1f2937' }}>{model.name}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{model.model}</div>
                        </div>
                        {isActive && <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A' }}>使用中</span>}
                        {!isActive && <button onClick={(e) => { e.stopPropagation(); handleSetActiveModel(model.id); }} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11px', background: '#F3F4F6', color: '#6B7280', border: 'none', cursor: 'pointer' }}>使用</button>}
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveModel(model.id); }} style={{ padding: '5px', borderRadius: '6px', background: 'transparent', border: 'none', color: '#D1D5DB', cursor: 'pointer' }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ 舆情采集 ════════ */}
        {activeSection === 'firecrawl' && (
          <FirecrawlPanel />
        )}

        {/* ════════ 知识库（v5.1 RAG） ════════ */}
        {activeSection === 'kb' && (
          <KnowledgeBasePanel />
        )}

        {/* ════════ 微信集成 ════════ */}
        {activeSection === 'wechat' && (
          <div style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>💬</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>微信 / 企业微信集成</h3>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>接收勺子Claw通知到微信群或企业微信</p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={wechatConfig.enabled} onChange={e => updateWechatConfig({ enabled: e.target.checked })} className="sr-only" />
                <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: wechatConfig.enabled ? '#10B981' : '#D1D5DB', position: 'relative', transition: 'all 0.2s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: wechatConfig.enabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: '#6B7280', marginBottom: '5px', marginLeft: '2px', fontWeight: 500 }}>企业微信 Webhook 地址</label>
                <input type="text" value={wechatConfig.webhookUrl || ''} onChange={e => updateWechatConfig({ webhookUrl: e.target.value })}
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                  className={`${inputStyle} ${inputFocusStyle}`} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                <p style={{ fontSize: '11px', color: '#D1D5DB', marginTop: '4px', marginLeft: '2px' }}>在企业微信群 → 群机器人 → 添加 → 复制Webhook地址</p>
              </div>

              {wechatConfig.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '6px' }}>
                  <button onClick={handleTestWechat} disabled={testingWechat || !wechatConfig.webhookUrl}
                    style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, background: '#DCFCE7', color: '#059669', border: '1px solid #A7F3D0', cursor: testingWechat || !wechatConfig.webhookUrl ? 'not-allowed' : 'pointer', opacity: testingWechat || !wechatConfig.webhookUrl ? 0.5 : 1 }}>
                    {testingWechat ? '测试中...' : '发送测试消息'}
                  </button>
                  {wechatTestResult === 'success' && <span style={{ fontSize: '12.5px', color: '#059669' }}>✓ 连接成功</span>}
                  {wechatTestResult === 'fail' && <span style={{ fontSize: '12.5px', color: '#DC2626' }}>✕ 连接失败</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ 飞书集成 ════════ */}
        {activeSection === 'feishu' && (
          <div style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🚀</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>飞书集成</h3>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>通过飞书机器人推送勺子Claw通知</p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={feishuConfig.enabled} onChange={e => updateFeishuConfig({ enabled: e.target.checked })} className="sr-only" />
                <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: feishuConfig.enabled ? '#3B82F6' : '#D1D5DB', position: 'relative', transition: 'all 0.2s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: feishuConfig.enabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: '#6B7280', marginBottom: '5px', marginLeft: '2px', fontWeight: 500 }}>飞书 Webhook 地址</label>
                <input type="text" value={feishuConfig.webhookUrl || ''} onChange={e => updateFeishuConfig({ webhookUrl: e.target.value })}
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                  className={`${inputStyle} ${inputFocusStyle}`} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
              </div>

              {feishuConfig.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '6px' }}>
                  <button onClick={handleTestFeishu} disabled={testingFeishu || !feishuConfig.webhookUrl}
                    style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, background: '#DBEAFE', color: '#2563EB', border: '1px solid #BFDBFE', cursor: testingFeishu || !feishuConfig.webhookUrl ? 'not-allowed' : 'pointer', opacity: testingFeishu || !feishuConfig.webhookUrl ? 0.5 : 1 }}>
                    {testingFeishu ? '测试中...' : '发送测试消息'}
                  </button>
                  {feishuTestResult === 'success' && <span style={{ fontSize: '12.5px', color: '#2563EB' }}>✓ 连接成功</span>}
                  {feishuTestResult === 'fail' && <span style={{ fontSize: '12.5px', color: '#DC2626' }}>✕ 连接失败</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ 关于 ════════ */}
        {activeSection === 'about' && (
          <AboutSection />
        )}

      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 📋 AboutSection — 个人中心关于页面（v4.6.2 增强）
// 含：版本信息 + 用户档案入口 + 检查更新(+稍后/重启) + 官网链接
// ═════════════════════════════════════════════════════
function AboutSection() {
  const { userProfile, userName, userId } = useStore();
  const [checking, setChecking] = useState(false);
  const [appVersion, setAppVersion] = useState(''); // 动态版本号
  const [checkResult, setCheckResult] = useState<'idle' | 'latest' | 'error'>('idle');

  useEffect(() => { getVersion().then(v => setAppVersion(v)).catch(() => {}) }, []);
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; version?: string; body?: string; download_url?: string } | null>(null);
  const [showUpdateChoice, setShowUpdateChoice] = useState(false);

  // 检查更新
  const handleCheckUpdate = async () => {
    setChecking(true);
    setCheckResult('idle');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ available: boolean; version?: string; body?: string; date?: string; download_url?: string }>('check_update');
      if (result && result.available) {
        setUpdateInfo(result as any);
        setShowUpdateChoice(true);
      } else {
        setCheckResult('latest');
        setTimeout(() => setCheckResult('idle'), 4000);
      }
    } catch (e) {
      console.error('[AboutSection] 检查更新失败:', e);
      setCheckResult('error');
      setTimeout(() => setCheckResult('idle'), 4000);
    }
    setChecking(false);
  };

  // 稍后更新 — 关闭选择框
  const handleLater = () => {
    setShowUpdateChoice(false);
    // 同时触发全局事件让 UpdateNotifier 底部条显示
    if (updateInfo) {
      window.dispatchEvent(new CustomEvent('shaoziclaw-update-available', { detail: updateInfo }));
    }
  };

  // 重启更新 — 调用 Rust 安装
  const handleRestartNow = async () => {
    if (!updateInfo?.download_url) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('download_and_install_update', {
        dmgUrl: updateInfo.download_url,
        onProgress: new Promise((resolve) => resolve(undefined)),
      });
    } catch (e) {
      console.error('[AboutSection] 安装失败:', e);
      // 失败则打开官网让用户手动下载
      openInBrowser('https://www.shaoziclaw.com');
    }
  };

  const cardStyle = { background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── 版本信息卡片 ── */}
      <div style={{ ...cardStyle, padding: '28px', textAlign: 'center' }}>
        <div style={{ display: 'inlineFlex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', marginBottom: '16px',
          background: 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)', boxShadow: '0 8px 24px rgba(87,204,134,0.25)' }}>
          <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
            <path d="M50 10C27.9 10 10 27.9 10 50s17.9 40 40 40 40-17.9 40-40S72.1 10 50 10z" fill="#111"/>
            <path d="M35 35h30v8H35zM30 47h40v6H30zM33 57h34v6H33zM37 67h26v6H37z" fill="#57CC86"/>
            <circle cx="72" cy="28" r="8" fill="#57CC86"/>
          </svg>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>勺子Claw</h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '16px' }}>餐饮人的超级AI大脑</p>

        {/* 版本号 */}
        <div style={{ display: 'inlineFlex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '20px', marginBottom: '16px', background: '#E6F7EF', border: '1px solid #B8E6CD' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A7D4E' }}>v{appVersion || '...'}</span>
          <span style={{ fontSize: '11.5px', color: '#3DAA5F' }}>· {new Date().toISOString().slice(0,10)}</span>
        </div>

        {/* 统计数据 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', maxWidth: '360px', margin: '0 auto' }}>
          {[{ label: '专家角色', value: '21' }, { label: '模块体系', value: 'M1-M20' }, { label: '知识库', value: '931份' }].map(item => (
            <div key={item.label} style={{ padding: '14px 10px', borderRadius: '10px', background: '#FAFAFB', border: '1px solid #EDEDED' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>{item.value}</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 用户档案入口（西贝7问）── */}
      <div style={{ ...cardStyle, padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>我的用户档案</h3>
            <p style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '2px' }}>完善你的餐饮信息，让AI更懂你</p>
          </div>
        </div>

        {/* 档案摘要网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {[
            { label: '昵称', val: userName || userProfile.userName || '未设置', icon: '✨' },
            { label: '品牌', val: userProfile.brandName || '未填写', icon: '🏪' },
            { label: '品类', val: userProfile.category || '未填写', icon: '🍽️' },
            { label: '地区', val: userProfile.region || '未填写', icon: '📍' },
            { label: '角色', val: userProfile.position || '未填写', icon: '👥' },
            { label: '对标', val: userProfile.competitors || '未填写', icon: '🎯' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '8px', background: '#FAFAFB', border: '1px solid #EDEDED' }}>
              <span style={{ fontSize: '13px' }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: '#AAA' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: item.val === '未填写' || item.val === '未设置' ? '#CCC' : '#333', fontWeight: 500, truncate: true }}>{item.val}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => {
          // 跳转到 Onboarding 页面
          useStore.getState().setActiveTab('onboarding');
          // 使用 CustomEvent 通知父组件切换页面
          window.dispatchEvent(new CustomEvent('shaoziclaw-navigate', { detail: 'onboarding' }));
        }}
          style={{ width: '100%', padding: '9px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
            background: 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)', color: '#fff', border: 'none',
            cursor: 'pointer', transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
          ✏️ 编辑我的档案（7问引导）
        </button>
      </div>

      {/* ── 检查更新区域 ── */}
      <div style={{ ...cardStyle, padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '18px' }}>🔄</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>检查更新</h3>
            <p style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '2px' }} >发现新版本时可选择立即或稍后更新</p>
          </div>
        </div>

        {!showUpdateChoice ? (
          <>
          {/* 检查按钮 */}
          <button onClick={handleCheckUpdate} disabled={checking}
            style={{
              width: '100%', padding: '10px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              background: checking ? '#E5E7EB' : '#333', color: '#fff', border: 'none',
              cursor: checking ? 'wait' : 'pointer', transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {checking ? '正在检查...' : '检查更新'}
          </button>
          {checkResult === 'latest' && (
            <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', color: '#166534', textAlign: 'center' }}>
              ✅ 当前版本 v{appVersion || '...'} 已是最新版本
            </div>
          )}
          {checkResult === 'error' && (
            <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', background: '#fef6f0', border: '1px solid #f0d9c4', fontSize: '12px', color: '#b85c00', textAlign: 'center' }}>
              ⚠️ 检查失败，请检查网络后重试
            </div>
          )}
          </>
        ) : (
          /* 更新选择面板 */
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #B8E6CD', background: '#E6F7EF' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #B8E6CD' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A7D4E' }}>
                  发现新版本 v{updateInfo?.version}
                </span>
              </div>
              {updateInfo?.body && (
                <p style={{ fontSize: '11.5px', color: '#3DAA5F', marginTop: '6px', lineHeight: 1.5 }}>{updateInfo.body}</p>
              )}
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: '10px' }}>
              <button onClick={handleLater}
                style={{ flex: 1, padding: '8px 0', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                  background: '#fff', color: '#666', border: '1px solid #DDD', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f9f9f9'; e.currentTarget.style.borderColor = '#ccc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#DDD'; }}>
                ⏰ 稍后提醒我
              </button>
              <button onClick={handleRestartNow}
                style={{ flex: 1, padding: '8px 0', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                  background: '#57CC86', color: '#fff', border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#3DAA5F'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#57CC86'}>
                🚀 立即重启更新
              </button>
            </div>
          </div>
        )}

        {/* 更新日志链接 */}
        <button onClick={() => openInBrowser('https://www.shaoziclaw.com/changelog.html')}
          style={{
            width: '100%', marginTop: '10px', padding: '8px 0', borderRadius: '8px',
            fontSize: '12px', color: '#888', background: '#f5f5f5', border: '1px solid #eaeaea',
            cursor: 'pointer', transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#eee'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}>
          📋 查看完整更新日志 →
        </button>
      </div>

      {/* ── 底部信息 ── */}
      <div style={{ textAlign: 'center', paddingTop: '8px', borderTop: '1px solid #EDEDED' }}>
        <a href="https://www.shaoziclaw.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', marginBottom: 6, display: 'inline-block' }}>
          <span style={{ fontSize: '12px', color: '#57CC86', fontWeight: 600 }}>🌐 官网：www.shaoziclaw.com</span>
        </a>
        <p style={{ fontSize: '12px', color: '#D1D5DB', margin: '6px 0 2px' }}>© 2026 勺子Claw（ShaoziClaw）All Rights Reserved.</p>
        <p style={{ fontSize: '11px', color: '#D1D5DB' }}>内测版本 · 功能持续迭代中</p>
      </div>
    </div>
  );
}