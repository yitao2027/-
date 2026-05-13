/**
 * ⏰ TaskEditorDrawer — 定时任务创建/编辑抽屉面板（v4.7.0）
 * 右侧滑入的表单面板
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store';
import type { ScheduledTask, TriggerType, TaskTemplate } from '../types/scheduled-task';
import { TASK_TEMPLATES, TRIGGER_TYPE_LABELS, WEEKDAY_LABELS } from '../types/scheduled-task';

interface TaskEditorDrawerProps {
  visible: boolean;
  editTask?: ScheduledTask | null;  // null=新建模式，有值=编辑模式
  onClose: () => void;
  onSave: (task: ScheduledTask) => void;
}

export default function TaskEditorDrawer({ visible, editTask, onClose, onSave }: TaskEditorDrawerProps) {
  const createTask = useStore(s => s.createScheduledTask);
  const updateTask = useStore(s => s.updateScheduledTask);

  // 表单状态
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('daily');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [weekDays, setWeekDays] = useState<number[]>([1]); // 默认周一
  const [onceAt, setOnceAt] = useState('');
  const [expertType, setExpertType] = useState('');
  const [skillName, setSkillName] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [useUserContext, setUseUserContext] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyWechat, setNotifyWechat] = useState(false);
  const [notifyFeishu, setNotifyFeishu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // 初始化表单（编辑模式或从模板填充）
  useEffect(() => {
    if (editTask) {
      setName(editTask.name);
      setTriggerType(editTask.triggerType);
      setHour(editTask.schedule.hour);
      setMinute(editTask.schedule.minute);
      setWeekDays(editTask.schedule.weekDays || [1]);
      setOnceAt(editTask.schedule.onceAt || '');
      setExpertType(editTask.taskContent.expertType || '');
      setSkillName(editTask.taskContent.skillName || '');
      setPromptTemplate(editTask.taskContent.promptTemplate);
      setUseUserContext(editTask.taskContent.useUserContext);
      setNotifyInApp(editTask.notification.channels.includes('in_app'));
      setNotifyWechat(editTask.notification.channels.includes('wechat_webhook'));
      setNotifyFeishu(editTask.notification.channels.includes('feishu_webhook'));
    } else {
      // 新建默认值
      setName('');
      setTriggerType('daily');
      setHour(9); setMinute(0);
      setWeekDays([1]);
      setOnceAt('');
      setExpertType(''); setSkillName('');
      setPromptTemplate('');
      setUseUserContext(true);
      setNotifyInApp(true); setNotifyWechat(false); setNotifyFeishu(false);
    }
  }, [editTask, visible]);

  /** 应用预设模板 */
  const applyTemplate = (tpl: TaskTemplate) => {
    setName(tpl.name);
    setTriggerType(tpl.defaultTriggerType);
    setHour(tpl.defaultSchedule.hour);
    setMinute(tpl.defaultSchedule.minute);
    setWeekDays(tpl.defaultSchedule.weekDays || [1]);
    setOnceAt(tpl.defaultSchedule.onceAt || '');
    setExpertType(tpl.defaultExpertType || '');
    setSkillName(tpl.defaultSkillName || '');
    setPromptTemplate(tpl.defaultPrompt);
    setShowTemplates(false);
  };

  /** 提交保存 */
  const handleSave = async () => {
    if (!name.trim()) { alert('⚠️ 请输入任务名称'); return; }
    if (!promptTemplate.trim()) { alert('⚠️ 请输入提示词（描述你想要AI执行的任务）'); return; }

    setSaving(true);
    try {
      const taskData: Omit<ScheduledTask, 'id'|'createdAt'|'updatedAt'|'runCount'|'nextRunAt'|'lastRunAt'|'lastRunStatus'> = {
        name: name.trim(),
        enabled: true,
        triggerType,
        schedule: {
          hour, minute,
          weekDays: triggerType === 'weekly' ? weekDays : undefined,
          onceAt: triggerType === 'once' ? (onceAt || new Date().toISOString()) : undefined,
        },
        taskContent: {
          expertType: expertType || undefined,
          skillName: skillName || undefined,
          promptTemplate: promptTemplate.trim(),
          useUserContext,
        },
        notification: {
          enabled: notifyInApp || notifyWechat || notifyFeishu,
          channels: [
            ...(notifyInApp ? ['in_app'] as const : []),
            ...(notifyWechat ? ['wechat_webhook'] as const : []),
            ...(notifyFeishu ? ['feishu_webhook'] as const : []),
          ],
        },
        // 不发送空字符串元数据——让Rust端用serde default填充
      };

      console.log('[TaskEditor] 📤 开始保存任务:', name.trim(), '| trigger:', triggerType);

      let saved: ScheduledTask;
      if (editTask) {
        console.log('[TaskEditor] ✏️ 编辑模式，更新ID:', editTask.id);
        await updateTask(editTask.id, { ...taskData, id: editTask.id } as ScheduledTask);
        saved = { ...taskData, id: editTask.id } as ScheduledTask;
      } else {
        console.log('[TaskEditor] ➕ 新建模式，调用createTask...');
        saved = await createTask(taskData);
        console.log('[TaskEditor] ✅ 任务创建成功! ID:', saved.id, 'Name:', (saved as any).name);
      }

      console.log('[TaskEditor] → 回调onSave并关闭抽屉');
      onSave(saved);
      onClose();
    } catch (e) {
      console.error('[TaskEditor] ❌ 保存失败（完整错误）:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      // 更详细的错误提示
      alert('❌ 保存失败：\n\n' + (errMsg.length > 200 ? errMsg.slice(0, 200) + '...(已截断)' : errMsg)
        + '\n\n\n请检查控制台日志获取更多详情');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
      background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      height: '100vh', // ← 确保占满全屏高度
      animation: 'slideInRight 0.2s ease-out',
    }}>
      {/* 样式注入 */}
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      {/* 头部 */}
      <div style={{
        height: 52, borderBottom: '1px solid #e8e8ea',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>
          {editTask ? '编辑定时任务' : '新建定时任务'}
        </span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#999' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* 表单区域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 任务名称 */}
        <FormField label="任务名称 *" required>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="如：每日晨报"
            style={inputStyle}
          />
        </FormField>

        {/* 触发频率 */}
        <FormField label="触发方式">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['daily', 'weekly', 'once'] as TriggerType[]).map(type => (
              <button key={type} onClick={() => setTriggerType(type)}
                style={triggerType === type ? activeBtnStyle : inactiveBtnStyle}
              >
                {TRIGGER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </FormField>

        {/* 时间配置 */}
        <FormField label="执行时间">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min="0" max="23" value={hour}
              onChange={e => setHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
              style={{ ...inputStyle, width: 60, textAlign: 'center' }}
            />
            <span style={{ fontSize: 14, color: '#666' }}>:</span>
            <input type="number" min="0" max="59" value={minute}
              onChange={e => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
              style={{ ...inputStyle, width: 60, textAlign: 'center' }}
            />

            {triggerType === 'weekly' && (
              <div style={{ marginLeft: 12, display: 'flex', gap: 4 }}>
                {[1,2,3,4,5,6,7].map(d => (
                  <button key={d} onClick={() => {
                    setWeekDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
                  }}
                    style={weekDays.includes(d)
                      ? { ...activeBtnStyle, fontSize: 11, padding: '3px 7px', minWidth: 28 }
                      : { ...inactiveBtnStyle, fontSize: 11, padding: '3px 7px', minWidth: 28 }
                    }
                  >{WEEKDAY_LABELS[d]?.charAt(1) || d}</button>
                ))}
              </div>
            )}

            {triggerType === 'once' && (
              <input type="datetime-local" value={onceAt.replace('Z', '')}
                onChange={e => setOnceAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                style={{ ...inputStyle, flex: 1 }}
              />
            )}
          </div>
        </FormField>

        {/* 从模板创建 */}
        {!editTask && (
          <FormField label="快捷入口">
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowTemplates(!showTemplates)}
                style={inactiveBtnStyle}
              >
                📋 从模板创建
              </button>
              {showTemplates && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#fff', border: '1px solid #e8e8ea', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0.1)', zIndex: 10, marginTop: 4,
                  maxHeight: 240, overflowY: 'auto',
                }}>
                  {TASK_TEMPLATES.map(tpl => (
                    <div key={tpl.id} onClick={() => applyTemplate(tpl)}
                      style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                        borderBottom: '1px solid #f5f5f5',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>{tpl.name}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>{tpl.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormField>
        )}

        {/* 提示词（任务核心内容） */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block', color: '#333' }}>
            提示词 <span style={{ color: '#e74c3c', marginLeft: 2 }}>*</span>
          </label>
          <p style={{ fontSize: 11.5, color: '#999', marginBottom: 8, margin: '0 0 8px 0' }}>描述你想要什么样的定时任务，AI将按此执行</p>
          <textarea value={promptTemplate} onChange={e => setPromptTemplate(e.target.value)}
            rows={6} placeholder="例如：&#10;请分析本周经营状况，输出以下报告：&#10;1. 营收趋势概览（同比/环比变化）&#10;2. 毛利率分析及异常项&#10;3. 人效比与优化建议&#10;4. 成本控制亮点与风险点&#10;5. 下周经营建议（3条可执行措施）"
            style={{
              ...inputStyle, resize: 'vertical', minHeight: 120,
              fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13,
            }}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={useUserContext} onChange={e => setUseUserContext(e.target.checked)} 
              style={{ width: 16, height: 16, accentColor: '#57CC86' }}
            />
            <span style={{ fontSize: 13, color: '#666' }}>自动携带我的店铺档案上下文</span>
          </label>
        </div>

        {/* 通知设置 */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#333' }}>完成后通知</div>
          
          {[
            { label: 'App内弹窗提醒', checked: notifyInApp, set: setNotifyInApp },
            { label: '企业微信推送（需先在设置中配置）', checked: notifyWechat, set: setNotifyWechat },
            { label: '飞书推送（需先在设置中配置）', checked: notifyFeishu, set: setNotifyFeishu },
          ].map((item, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i === 0 ? 0 : 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#57CC86' }}
              />
              <span style={{ fontSize: 13, color: '#666' }}>{item.label}</span>
            </label>
          ))}
        </div>

      </div>

      {/* 底部按钮 — zIndex确保不被遮挡 */}
      <div style={{
        height: 64, borderTop: '1px solid #e8e8ea',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 12, padding: '0 20px', flexShrink: 0,
        position: 'relative', zIndex: 10,
      }}>
        <button type="button" onClick={onClose} style={cancelBtnStyle}>取消</button>
        <button type="button" onClick={handleSave} disabled={saving}
          style={{ ...saveBtnStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? '保存中...' : (editTask ? '保存修改' : '保存并启用 ✓')}
        </button>
      </div>
    </div>
  );
}

// ── 子组件 ──

function FormField({ label, children, required }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block', color: '#333' }}>
        {label}{required && <span style={{ color: '#e74c3c', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ── 统一样式常量 ──

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid #ddd', outline: 'none', fontSize: 13,
  transition: 'border-color 0.15s',
  boxSizing: 'border-box' as const,
};

const activeBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 6, border: '1px solid #57CC86',
  background: '#E6F7EF', color: '#1A7D4E', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const inactiveBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 6, border: '1px solid #e8e8ea',
  background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 24px', borderRadius: 6, border: '1px solid #e8e8ea',
  background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 24px', borderRadius: 6, border: 'none',
  background: '#57CC86', color: '#fff', fontSize: 13, fontWeight: 500,
};
