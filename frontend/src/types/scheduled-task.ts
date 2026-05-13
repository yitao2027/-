/**
 * ⏰ 定时任务 — TypeScript 类型定义（v4.7.0）
 * 与 Rust 后端 scheduler.rs 数据模型一一对应
 */

// ── 触发方式 ──
export type TriggerType = 'daily' | 'weekly' | 'once'

// ── 时间配置 ──
export interface ScheduleConfig {
  hour: number          // 0-23
  minute: number        // 0-59
  weekDays?: number[]   // [1=Mon..7=Sun], 仅 weekly
  onceAt?: string       // ISO datetime, 仅 once
}

// ── 任务内容 ──
export interface TaskContent {
  expertType?: string      // ExpertType | null (brand/ops/marketing/waimai/finance/legal/hr/supply/data/general)
  skillName?: string       // 指定skill名称
  promptTemplate: string   // 用户预设的prompt模板
  useUserContext: boolean  // 是否携带用户档案上下文
}

// ── 通知渠道 ──
export type NotificationChannel = 'in_app' | 'wechat_webhook' | 'feishu_webhook'

export interface NotificationConfig {
  enabled: boolean
  channels: NotificationChannel[]
}

// ── 定时任务 ──
export interface ScheduledTask {
  id: string
  name: string
  enabled: boolean
  triggerType: TriggerType
  schedule: ScheduleConfig
  taskContent: TaskContent
  notification: NotificationConfig

  // 元数据
  createdAt: string           // ISO 8601
  updatedAt: string           // ISO 8601
  lastRunAt: string | null    // ISO 8601 或 null
  lastRunStatus: 'success' | 'failed' | null
  nextRunAt: string | null    // ISO 8601 预测值或 null(暂停时)
  runCount: number
}

// ── 执行结果 ──
export interface ExecutionResult {
  taskId: string
  taskName: string
  success: boolean
  content: string | null
  tokensUsed: number
  executedAt: string
  errorMessage: string | null
}

// ── 预设模板 ──
export interface TaskTemplate {
  id: string
  name: string
  icon: string               // emoji
  description: string
  defaultTriggerType: TriggerType
  defaultSchedule: ScheduleConfig
  defaultExpertType?: string
  defaultSkillName?: string
  defaultPrompt: string
  category: string           // 分类标签
}

/** MVP 6个预设模板 */
export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl_daily_briefing',
    name: '每日晨报',
    icon: '📊',
    description: '每天早上自动生成本日经营要点',
    defaultTriggerType: 'daily',
    defaultSchedule: { hour: 9, minute: 0 },
    defaultExpertType: 'ops',
    defaultSkillName: 'L1-qscv-standard',
    defaultPrompt: `请帮我生成今日经营晨报，包含以下内容：
1. 昨日经营复盘要点
2. 今日重点关注事项（3-5条）
3. 天气对经营的影响提醒
4. 特殊注意事项（节假日/活动等）
5. 今日建议优先处理的TOP3事项`,
    category: '日常运营',
  },
  {
    id: 'tpl_weekly_analysis',
    name: '每周经营分析',
    icon: '📈',
    description: '每周一上午汇总本周数据分析',
    defaultTriggerType: 'weekly',
    defaultSchedule: { hour: 10, minute: 0, weekDays: [1] },
    defaultExpertType: 'finance',
    defaultSkillName: 'fn-cost-control',
    defaultPrompt: `请分析本周经营状况，输出以下报告：
1. 营收趋势概览（同比/环比变化）
2. 毛利率分析及异常项
3. 人效对比与优化建议
4. 成本控制亮点和风险点
5. 下周经营建议（3条可执行措施）`,
    category: '数据分析',
  },
  {
    id: 'tpl_hot_monitor',
    name: '热点监控',
    icon: '🔥',
    description: '定期抓取行业热点和竞品动态',
    defaultTriggerType: 'daily', // D1选A：MVP不做custom interval，先用daily多次配置模拟
    defaultSchedule: { hour: 12, minute: 0 },
    defaultExpertType: 'marketing',
    defaultSkillName: 'catering-trend-monitor',
    defaultPrompt: `请搜索近期餐饮行业热点新闻、竞品动态、政策变化。
筛选出与我店铺品类相关的3-5条重要信息，每条包含：
- 标题和来源
- 核心内容摘要（2-3句话）
- 对我的店铺可能的影响和建议`,
    category: '市场情报',
  },
  {
    id: 'tpl_menu_review',
    name: '菜单月度体检',
    icon: '📋',
    description: '每月初分析菜品表现并给出调整建议',
    defaultTriggerType: 'monthly', // 前端映射为 weekly + day=1
    defaultSchedule: { hour: 9, minute: 0, weekDays: [1] }, // 每周一模拟"每月初"
    defaultExpertType: 'ops',
    defaultSkillName: 'L1-menu-pricing',
    defaultPrompt: `请基于近30天的销售数据进行菜单体检分析：
1. TOP5 畅销菜品（销量+贡献度）
2. 滞销菜品清单（建议淘汰/改良）
3. 新品上架建议（基于季节和趋势）
4. 定价合理性评估
5. 菜单结构调整方案`,
    category: '菜单管理',
  },
  {
    id: 'tpl_food_safety',
    name: '食安巡检提醒',
    icon: '🛡️',
    description: '每日开店前推送食安检查要点',
    defaultTriggerType: 'daily',
    defaultSchedule: { hour: 7, minute: 30 },
    defaultExpertType: 'ops',
    defaultSkillName: 'L1-food-safety',
    defaultPrompt: `生成今日食品安全巡检Checklist：
1. 原料验收重点检查项（当季高风险食材）
2. 冷链温度记录提醒
3. 加工制作关键控制点
4.餐具消毒确认
5. 从业人员健康状态检查
6. 店堂环境卫生巡查要点
请根据当前季节和天气特点调整检查重点。`,
    category: '食品安全',
  },
  {
    id: 'tpl_competitor_price',
    name: '竞品价格追踪',
    icon: '🎯',
    description: '定期追踪主要竞争对手定价策略',
    defaultTriggerType: 'weekly',
    defaultSchedule: { hour: 14, minute: 0, weekDays: [3] }, // 每周三
    defaultExpertType: 'waimai',
    defaultSkillName: 'L1-delivery-basics',
    defaultPrompt: `帮我调研主要竞争对手在外卖平台上的最新情况：
1. 竞品定价策略变化（涨价/降价/新套餐）
2. 近期促销活动力度和方式
3. 用户评价中的高频关键词（好评/差评焦点）
4. 我的应对策略建议（3条）`,
    category: '竞争分析',
  },
]

/** 触发方式的中文标签 */
export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  daily: '每天',
  weekly: '每周',
  once: '一次性',
}

/** 星期几中文映射 */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四',
  5: '周五', 6: '周六', 7: '周日',
}
