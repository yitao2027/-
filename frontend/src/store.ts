import { create } from 'zustand';
import type { ScheduledTask, ExecutionResult } from './types/scheduled-task';

export interface ThinkingStep {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'running' | 'done' | 'error';
  stepType?: string;
  icon?: string;
  durationMs?: number;
}

export interface RAGSource {
  skillName: string;
  category: string;
  sourceFile: string;
  chunkIndex: number;
  score: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number | Date;  // 兼容Date和number
  skill?: string;
  skillName?: string;
  thinkingSteps?: ThinkingStep[];
  isThinkingComplete?: boolean;
  tokensUsed?: { prompt: number; completion: number };
  attachments?: UploadedFile[]; // 📎 文件附件
  ragSources?: RAGSource[];    // 📚 RAG知识库来源引用
}

export interface CustomModel {
  id: string;
  name: string;          // 用户自定义名称，如 "我的GPT-4"
  provider: string;       // openai / anthropic / deepseek / custom
  apiKey: string;         // 加密存储
  apiBase: string;        // API Base URL
  model: string;          // 模型名称，如 gpt-4o / claude-3.5-sonnet
  maxTokens?: number;     // 最大token数
  temperature?: number;   // 温度
  isActive: boolean;      // 是否当前激活使用
}

export interface WechatConfig {
  enabled: boolean;
  webhookUrl?: string;    // 企业微信webhook
  appId?: string;         // 微信公众号/小程序AppId（扫码用）
  corpId?: string;        // 企业微信企业ID
  agentId?: string;       // 企业微信应用ID
  lastConnected?: string;
}

export interface FeishuConfig {
  enabled: boolean;
  webhookUrl?: string;    // 飞书机器人webhook
  appId?: string;         // 飞书应用ID
  appSecret?: string;     // 飞书应用密钥
  lastConnected?: string;
}

// ========== 任务系统 ==========
export interface Task {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
}

export interface UserState {
  // 认证相关
  isAuthenticated: boolean;
  userEmail: string;
  userName: string;
  userId: string;               // 独立用户ID（用于客服定位，首次使用自动生成）
  isBetaUser: boolean;           // 是否内测用户
  redeemed: boolean;             // 兑换码是否已验证
  redeemCode?: string;           // 已使用的兑换码

  // 任务系统
  tasks: Task[];
  activeTaskId: string | null;
  taskSearchQuery: string;

  // 对话相关（兼容：当前活跃任务的消息）
  messages: Message[];
  currentSkill: string | null;
  selectedSkill: string | null;
  currentModel: string;
  
  // 生成状态（v5.2.2: generatingContext替代全局isGenerating，避免多窗口互相阻塞）
  isGenerating: boolean;  // 保留兼容，由generatingContext派生
  generatingContext: string | null;  // 当前正在生成的会话ID，null=空闲
  pendingAutoRun: string | null;  // v5.3.1: 待自动执行的定时任务内容
  tokenUsed: { prompt: number; completion: number };
  tokenLimit: number;
  
  // UI状态
  sidebarOpen: boolean;
  activeTab: 'chat' | 'experts' | 'settings' | 'onboarding' | 'scheduled';
  theme: 'dark' | 'light';
  
  // 自定义模型
  customModels: CustomModel[];
  activeModelId: string | null;  // null表示使用系统默认模型
  
  // 第三方集成
  wechatConfig: WechatConfig;
  feishuConfig: FeishuConfig;

  // ====== v4.3 新增：用户档案 & 专家会话 & 文件上传 ======
  userProfile: UserProfile;                // 用户档案（首次使用填写）
  uploadedFiles: UploadedFile[];           // 当前对话上传的文件
  expertSessions: ExpertSession[];          // 所有专家会话（多会话独立）
  activeExpertSessionId: string | null;    // 当前活跃专家会话ID
  activeExpertType: ExpertType;             // 当前专家类型（用于判断专家模式）

  // ⏰ 定时任务（v4.7.0 新增）
  scheduledTasks: ScheduledTask[];
  activeScheduledCount: number;            // 活跃任务数（用于Sidebar badge）

  // ⏰💬 任务会话（v4.9.9 — 复用ChatArea全屏窗口）
  taskSessions: TaskSession[];              // 所有任务会话
  activeTaskSessionId: string | null;       // 当前活跃任务会话ID

  // 💳 积分系统
  pointsBalance: number;
  isPointsLoggedIn: boolean;

  // 📚 RAG知识库（v5.1）
  kbStatus: 'unknown' | 'uninitialized' | 'ready' | 'loading';
  kbTotalChunks: number;
  kbIndexVersion: string | null;

  // Actions - 认证
  login: (email: string, password?: string) => void;
  logout: () => void;
  setBackendAuth: (userName: string, userId?: string) => void;  // 🔐 后端认证恢复
  setRedeemed: (code: string) => void;
  updateUserName: (name: string) => void;  // 用户可自行修改显示名

  // Actions - 任务系统
  createTask: (title: string) => string;
  deleteTask: (id: string) => void;
  switchTask: (id: string) => void;
  setTaskSearchQuery: (q: string) => void;
  getFilteredTasks: () => Task[];
  getActiveTask: () => Task | null;

  // Actions - 对话
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setCurrentSkill: (skill: string | null) => void;
  setSelectedSkill: (skill: string | null) => void;
  setIsGenerating: (val: boolean) => void;
  setGeneratingContext: (contextId: string | null) => void;
  setCurrentModel: (modelId: string) => void;
  getActiveMessages: () => Message[];

  // Actions - UI
  toggleSidebar: () => void;
  setActiveTab: (tab: 'chat' | 'experts' | 'settings' | 'onboarding' | 'scheduled') => void;

  // Actions - 自定义模型
  addCustomModel: (model: Omit<CustomModel, 'id'>) => void;
  removeCustomModel: (id: string) => void;
  updateCustomModel: (id: string, updates: Partial<CustomModel>) => void;
  setActiveModel: (id: string | null) => void;
  getActiveModel: () => CustomModel | null;

  // Actions - 微信配置
  updateWechatConfig: (config: Partial<WechatConfig>) => void;
  testWechatConnection: () => Promise<boolean>;

  // Actions - 飞书配置
  updateFeishuConfig: (config: Partial<FeishuConfig>) => void;
  testFeishuConnection: () => Promise<boolean>;

  // ====== v4.3 Actions ======
  // 用户档案
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: (profile: UserProfile) => void;

  // 专家会话
  createExpertSession: (expertType: ExpertType, expertName: string, expertAvatar: string, title?: string, greeting?: string, skillName?: string) => string;
  switchExpertSession: (sessionId: string) => void;
  deleteExpertSession: (sessionId: string) => void;
  renameExpertSession: (sessionId: string, newTitle: string) => void;
  getActiveExpertSession: () => ExpertSession | null;

  // 文件上传
  addUploadedFile: (file: Omit<UploadedFile, 'id'>) => void;
  removeUploadedFile: (fileId: string) => void;
  clearUploadedFiles: () => void;

  // ⏰ 定时任务 Actions（v4.7.0）
  loadScheduledTasks: () => Promise<void>;
  createScheduledTask: (task: Omit<ScheduledTask, 'id'|'createdAt'|'updatedAt'|'runCount'|'nextRunAt'|'lastRunAt'|'lastRunStatus'>) => Promise<ScheduledTask>;
  updateScheduledTask: (id: string, updates: ScheduledTask) => Promise<void>;
  deleteScheduledTask: (id: string) => Promise<void>;
  toggleScheduledTask: (id: string, enabled: boolean) => Promise<void>;
  runScheduledTaskNow: (id: string) => Promise<{ success: boolean; result?: ExecutionResult }>;

  // ⏰💬 任务会话 Actions（v4.9.9 — 复用ChatArea全屏窗口）
  createTaskSession: (taskId: string, taskName: string, promptTemplate: string, skillName: string, greeting?: string, autoRun?: boolean) => string;
  switchTaskSession: (sessionId: string) => void;
  closeTaskSession: () => void;
  addMessageToTaskSession: (sessionId: string, message: Message) => void;
  updateTaskSessionMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  getActiveTaskSession: () => TaskSession | null;
  deleteTaskSession: (sessionId: string) => void;

  // 💳 积分系统 Actions
  setPointsBalance: (balance: number) => void;
  setPointsLogin: (isLoggedIn: boolean) => void;
  refreshPointsBalance: () => Promise<void>;

  // 📚 RAG知识库 Actions（v5.1）
  setKbStatus: (status: 'unknown' | 'uninitialized' | 'ready' | 'loading') => void;
  setKbInfo: (totalChunks: number, indexVersion: string | null) => void;
  refreshKbStatus: () => Promise<void>;
}

// ================================================================
// ShaoziClaw 勺子Claw v4.3 — 扩展功能（用户档案 + 专家会话 + 上传）
// 新增字段说明：
// - userProfile: 用户首次使用填写的基本资料（品牌名/品类/地区等）
// - expertSessions: 每个专家有独立会话（品牌/营运/营销/外卖/财务/法务）
// - uploadedFiles: 当前对话中上传的文件列表
// ================================================================

// ========== 用户档案 ==========
export interface UserProfile {
  // 基本信息
  userName: string;          // 用户昵称（Claw称呼用户的方式）
  brandName: string;          // 品牌名称
  brandStatus: 'planning' | 'running';  // 品牌状态：策划中 / 营业中
  category: string;           // 品牌所属品类（如：快餐/火锅/茶饮/烧烤/烘焙）
  region: string;             // 门店主要集中地区
  position: string;           // 所属岗位（如：老板/店长/厨师长/投资人）
  competitors: string;        // 对标品牌/竞争对手
  // 扩展信息（用户自愿填写）
  storeCount?: string;        // 门店数量
  avgCustomerPrice?: string;  // 客单价
  targetCustomers?: string;    // 目标客群
  openingDate?: string;        // 开业时间
  mainDish?: string;          // 核心主推产品
  painPoint?: string;         // 当前最大痛点
  // 元数据
  completed: boolean;         // 是否已完成首次资料填写
  updatedAt?: string;         // 最后更新时间
}

// ========== 专家会话 ==========
export type ExpertType =
  | 'image'      // 图片设计专家
  | 'brand'      // 品牌专家
  | 'ops'        // 营运专家
  | 'marketing'  // 营销专家
  | 'waimai'     // 外卖专家
  | 'finance'    // 财务专家
  | 'legal'      // 法务专家
  | 'hr'         // 人力专家
  | 'supply'     // 供应链专家
  | 'data'       // 数据专家
  | 'space'      // 🔧 v4.9.9: 空间&选址专家
  | 'strategy'   // 🔧 v4.9.9: 战略扩张专家
  | 'general';   // 综合助手（默认Claw助手）

export interface ExpertSession {
  id: string;
  expertType: ExpertType;
  expertName: string;         // 中文专家名（如：品牌策略师）
  expertAvatar: string;       // emoji头像
  title: string;              // 会话标题（如：新品牌定位讨论）
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  skill?: string;             // 当前关联的Skill ID（旧字段保留兼容）
  skillName?: string;         // 🔧 v5.5.22 Bug#2修复：专家关联的skill名（与TaskSession对齐，路由后端激活RAG）
}

// ⏰💬 任务会话（v4.9.9 — 复用ChatArea全屏窗口，与专家会话一致）
export interface TaskSession {
  id: string;                    // 会话ID: taskchat_{timestamp}_{random}
  taskId: string;                // 关联的定时任务ID
  taskName: string;              // 任务名称
  promptTemplate: string;        // 任务Prompt模板
  skillName: string;             // 关联技能名
  title: string;                 // 会话标题
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// ========== 上传文件 ==========
export interface UploadedFile {
  id: string;
  name: string;               // 文件名
  type: 'image' | 'document' | 'pdf' | 'ppt' | 'other' | 'docx';
  size: number;               // 字节
  dataUrl?: string;           // Base64 DataURL（用于前端预览）
  content?: string;           // 解析后的文本内容（docx/pdf等）
  path?: string;              // Tauri读取后的本地路径
  uploadedAt: Date;
}

// ========== 档案持久化加载 ==========
const loadUserProfile = (): UserProfile => {
  try {
    const saved = localStorage.getItem('shaoziclaw_user_profile');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    userName: '',
    brandName: '',
    brandStatus: 'planning',
    category: '',
    region: '',
    position: '',
    competitors: '',
    completed: false,
  };
};

const loadExpertSessions = (): ExpertSession[] => {
  try {
    const saved = localStorage.getItem('shaoziclaw_expert_sessions');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
};

// v5.5.9: 使用 trySetItem 替代直接 localStorage.setItem，避免绕过配额保护
const saveExpertSessions = (sessions: ExpertSession[]) => {
  try {
    trySetItem('shaoziclaw_expert_sessions', JSON.stringify(sessions));
  } catch {}
};

// 🔧 v4.9.9 — 消息持久化：Date反序列化工具
function reviveDate(val: any): Date | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

const loadTasks = (): Task[] => {
  try {
    const saved = localStorage.getItem('shaoziclaw_tasks');
    if (saved) {
      const tasks: Task[] = JSON.parse(saved);
      return tasks.map(t => ({
        ...t,
        createdAt: reviveDate(t.createdAt),
        messages: (t.messages || []).map((m: any) => ({
          ...m,
          timestamp: reviveDate(m.timestamp),
        })),
      }));
    }
  } catch (e) {
    console.warn('[Store] 加载tasks失败:', e);
  }
  return [];
};

/**
 * 🔧 B088: localStorage 配额保护
 * 当写入失败（QuotaExceededError）时，自动清理旧数据释放空间
 */
const trySetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
      console.warn(`[Store] B088: localStorage配额溢出(key=${key}, size=${value.length})，尝试自动清理`);

      // 策略1：清理旧的主聊天消息（保留最近10条，更激进）
      try {
        const chatKey = 'shaoziclaw_chat_messages';
        const chatData = localStorage.getItem(chatKey);
        if (chatData) {
          const msgs = JSON.parse(chatData);
          if (Array.isArray(msgs) && msgs.length > 10) {
            const trimmed = msgs.slice(-10);
            localStorage.setItem(chatKey, JSON.stringify(trimmed));
            console.warn('[Store] B088: 清理主聊天消息', msgs.length, '→', trimmed.length);
            try {
              localStorage.setItem(key, value);
              return true;
            } catch { /* 继续 */ }
          }
        }
      } catch {}

      // 策略2：清理旧的任务会话（保留最近3个，每个5条消息）
      try {
        const tsKey = 'shaoziclaw_task_sessions';
        const tsData = localStorage.getItem(tsKey);
        if (tsData) {
          const sessions = JSON.parse(tsData);
          if (Array.isArray(sessions) && sessions.length > 0) {
            const trimmed = sessions.slice(0, 3).map(s => ({
              ...s,
              messages: s.messages.slice(-5)
            }));
            localStorage.setItem(tsKey, JSON.stringify(trimmed));
            console.warn('[Store] B088: 清理任务会话', sessions.length, '→', trimmed.length);
            try {
              localStorage.setItem(key, value);
              return true;
            } catch { /* 继续 */ }
          }
        }
      } catch {}

      // 策略3：清理专家会话（保留最近2个，每个5条消息）
      try {
        const esKey = 'shaoziclaw_expert_sessions';
        const esData = localStorage.getItem(esKey);
        if (esData) {
          const sessions = JSON.parse(esData);
          if (Array.isArray(sessions) && sessions.length > 0) {
            const trimmed = sessions.slice(0, 2).map(s => ({
              ...s,
              messages: s.messages.slice(-5)
            }));
            localStorage.setItem(esKey, JSON.stringify(trimmed));
            console.warn('[Store] B088: 清理专家会话', sessions.length, '→', trimmed.length);
            try {
              localStorage.setItem(key, value);
              return true;
            } catch { /* 继续 */ }
          }
        }
      } catch {}

      // 策略4：清理其他非关键localStorage项
      try {
        const keysToClear = ['shaoziclaw_user_memory', 'shaoziclaw_working_notes'];
        let cleared = 0;
        for (const k of keysToClear) {
          if (localStorage.getItem(k)) {
            localStorage.removeItem(k);
            cleared++;
          }
        }
        if (cleared > 0) {
          console.warn('[Store] B088: 清理非关键数据项', cleared);
          try {
            localStorage.setItem(key, value);
            return true;
          } catch { /* 继续 */ }
        }
      } catch {}

      console.error('[Store] B088: 所有清理策略均失败，数据无法持久化');
    } else {
      console.warn('[Store] ❌ 写入失败:', e?.name, e?.message);
    }
    return false;
  }
};

const saveTasks = (tasks: Task[]) => {
  const json = JSON.stringify(tasks);
  if (!trySetItem('shaoziclaw_tasks', json)) {
    console.warn('[Store] ❌ 保存tasks失败:', '任务数:', tasks.length, '预估大小:', json.length);
  }
};

const loadTaskSessions = (): TaskSession[] => {
  try {
    const saved = localStorage.getItem('shaoziclaw_task_sessions');
    if (saved) {
      const sessions: TaskSession[] = JSON.parse(saved);
      return sessions.map(s => ({
        ...s,
        createdAt: reviveDate(s.createdAt),
        updatedAt: reviveDate(s.updatedAt),
        messages: (s.messages || []).map((m: any) => ({
          ...m,
          timestamp: reviveDate(m.timestamp),
        })),
      }));
    }
  } catch (e) {
    console.warn('[Store] 加载taskSessions失败:', e);
  }
  return [];
};

// 从localStorage恢复状态
const loadCustomModels = (): CustomModel[] => {
  try {
    const saved = localStorage.getItem('shaoziclaw_custom_models');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const loadWechatConfig = (): WechatConfig => {
  try {
    const saved = localStorage.getItem('shaoziclaw_wechat_config');
    return saved ? { ...defaultWechatConfig, ...JSON.parse(saved) } : defaultWechatConfig;
  } catch { return defaultWechatConfig; }
};

const loadFeishuConfig = (): FeishuConfig => {
  try {
    const saved = localStorage.getItem('shaoziclaw_feishu_config');
    return saved ? { ...defaultFeishuConfig, ...JSON.parse(saved) } : defaultFeishuConfig;
  } catch { return defaultFeishuConfig; }
};

const defaultWechatConfig: WechatConfig = {
  enabled: false,
  webhookUrl: '',
  appId: '',
  corpId: '',
  agentId: '',
};

const defaultFeishuConfig: FeishuConfig = {
  enabled: false,
  webhookUrl: '',
  appId: '',
  appSecret: '',
};

// 生成或恢复用户ID（首次使用自动生成，之后持久化）
const getOrCreateUserId = (): string => {
  const saved = localStorage.getItem('shaoziclaw_user_id');
  if (saved) return saved;
  const newId = 'CC' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
  localStorage.setItem('shaoziclaw_user_id', newId);
  return newId;
};

export const useStore = create<UserState>((set, get) => ({
  // 初始状态
  isAuthenticated: false,
  userEmail: '',
  userName: localStorage.getItem('shaoziclaw_user_name') || '',
  userId: getOrCreateUserId(),   // 独立用户ID，首次使用自动生成
  isBetaUser: true,
  redeemed: localStorage.getItem('shaoziclaw_redeemed') === 'true',
  redeemCode: localStorage.getItem('shaoziclaw_redeem_code') || undefined,

  // 任务系统 🔧 v4.9.9: 从localStorage恢复
  activeTaskId: localStorage.getItem('shaoziclaw_active_task_id') || null,
  tasks: (() => {
    const loaded = loadTasks();
    const savedId = localStorage.getItem('shaoziclaw_active_task_id');
    if (savedId) {
      const active = loaded.find(t => t.id === savedId);
      if (active) return loaded;
    }
    return loaded;
  })(),
  taskSearchQuery: '',

  // 🔧 v5.5.1: 优先恢复主聊天消息（独立持久化），否则从tasks恢复
  messages: (() => {
    // 先尝试恢复主聊天消息
    try {
      const saved = localStorage.getItem('shaoziclaw_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // 降级：从tasks恢复
    const loaded = loadTasks();
    const savedId = localStorage.getItem('shaoziclaw_active_task_id');
    if (savedId) {
      const active = loaded.find(t => t.id === savedId);
      if (active) return active.messages || [];
    }
    return loaded.length > 0 ? (loaded[0].messages || []) : [];
  })(),
  currentSkill: null,
  selectedSkill: null,
  currentModel: 'deepseek-v4',
  
  isGenerating: false,
  generatingContext: null,
  pendingAutoRun: null,
  tokenUsed: { prompt: 0, completion: 0 },
  tokenLimit: 100000,
  
  sidebarOpen: false,
  activeTab: 'chat',
  theme: 'dark',
  
  customModels: loadCustomModels(),
  activeModelId: localStorage.getItem('shaoziclaw_active_model_id'),
  
  wechatConfig: loadWechatConfig(),
  feishuConfig: loadFeishuConfig(),

  // ====== v4.3 新增初始状态 ======
  userProfile: loadUserProfile(),
  uploadedFiles: [],
  expertSessions: loadExpertSessions(),
  activeExpertSessionId: null,
  activeExpertType: 'general',

  // ⏰ 定时任务（v4.7.0 新增）
  scheduledTasks: [],
  activeScheduledCount: 0,

  // ⏰💬 任务会话（v4.9.9 — 从localStorage恢复）
  taskSessions: loadTaskSessions(),
  activeTaskSessionId: localStorage.getItem('shaoziclaw_active_task_session_id') || null,

  // 💳 积分系统
  pointsBalance: 0,
  isPointsLoggedIn: !!localStorage.getItem('shaoziclaw_jwt_token'),

  // 📚 RAG知识库（v5.1）
  kbStatus: 'unknown',
  kbTotalChunks: 0,
  kbIndexVersion: null,

  // ========== 认证 Actions ==========
  login: async (email, password) => {
    try {
      // 调用后端 Tauri command 同步登录状态到 Rust AppState
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('login', { request: { email, password: password || '' } });
      // 后端登录成功 → 设置前端状态
      const savedName = localStorage.getItem('shaoziclaw_user_name') || email.split('@')[0];
      set({
        isAuthenticated: true,
        userEmail: email,
        userName: savedName,
      });
    } catch (e) {
      console.error('[Store] 后端login调用失败:', e);
      // 后端失败时不设置isAuthenticated，避免前后端状态不一致
      throw e; // 向上层抛出错误
    }
  },

  /// 🔐 后端已认证时同步前端状态（启动恢复用）
  setBackendAuth: async (userName: string, userId?: string) => {
    set({
      isAuthenticated: true,
      userName: userName,
      userId: userId || getOrCreateUserId(),
    });
  },
  
  logout: () => {
    set({
      isAuthenticated: false,
      userEmail: '',
      messages: [],
      currentSkill: null,
      pointsBalance: 0,
      isPointsLoggedIn: false,
      // 注意：不清除 userId 和 userName — 用户ID持久化，用户名也保留
    });
    localStorage.removeItem('shaoziclaw_redeemed');
    localStorage.removeItem('shaoziclaw_redeem_code');
    localStorage.removeItem('shaoziclaw_jwt_token');
  },
  
  setRedeemed: (code) => {
    localStorage.setItem('shaoziclaw_redeemed', 'true');
    localStorage.setItem('shaoziclaw_redeem_code', code);
    set({ redeemed: true, redeemCode: code });
  },

  updateUserName: (name) => {
    localStorage.setItem('shaoziclaw_user_name', name);
    set({ userName: name });
  },

  // ========== 任务系统 Actions ==========
  createTask: (title) => {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newTask: Task = {
      id: taskId,
      title,
      createdAt: new Date(),
      messages: [],
    };
    set((state) => ({
      tasks: [newTask, ...state.tasks],
      activeTaskId: taskId,
      messages: [],
    }));
    // 🔧 v4.9.9: 持久化
    localStorage.setItem('shaoziclaw_active_task_id', taskId);
    saveTasks([newTask, ...get().tasks]);
    return taskId;
  },

  deleteTask: (id) => {
    set((state) => {
      const remaining = state.tasks.filter(t => t.id !== id);
      const newActiveId = state.activeTaskId === id
        ? (remaining.length > 0 ? remaining[0].id : null)
        : state.activeTaskId;
      return {
        tasks: remaining,
        activeTaskId: newActiveId,
        messages: newActiveId ? (remaining.find(t => t.id === newActiveId)?.messages || []) : [],
      };
    });
    // 🔧 v4.9.9: 持久化
    const state = get();
    if (state.activeTaskId) {
      localStorage.setItem('shaoziclaw_active_task_id', state.activeTaskId);
    } else {
      localStorage.removeItem('shaoziclaw_active_task_id');
    }
    saveTasks(state.tasks);
  },

  switchTask: (id) => {
    set((state) => {
      const task = state.tasks.find(t => t.id === id);
      return {
        activeTaskId: id,
        activeExpertSessionId: null,  // 🔧 v5.1.3: 切换普通任务时清除专家会话，防止ChatArea选错消息源
        activeExpertType: 'general',  // 🔧 v5.1.3: 重置专家类型
        messages: task?.messages || [],
      };
    });
    // 🔧 v4.9.9: 持久化
    localStorage.setItem('shaoziclaw_active_task_id', id);
  },

  setTaskSearchQuery: (q) => set({ taskSearchQuery: q }),

  getFilteredTasks: () => {
    const { tasks, taskSearchQuery } = get();
    if (!taskSearchQuery.trim()) return tasks;
    const q = taskSearchQuery.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.messages.some(m => m.content.toLowerCase().includes(q))
    );
  },

  getActiveTask: () => {
    const { tasks, activeTaskId } = get();
    return tasks.find(t => t.id === activeTaskId) || null;
  },

  renameTask: (id, newTitle) => {
    set((state) => ({
      tasks: state.tasks.map(t =>
        t.id === id ? { ...t, title: newTitle, updatedAt: new Date() } : t
      ),
    }));
    saveTasks(get().tasks);
  },

  // ========== 对话 Actions ==========
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  clearMessages: () => {
    set({ messages: [], currentSkill: null, selectedSkill: null });
    saveTasks(get().tasks);
  },
  setCurrentSkill: (skill) => set({ currentSkill: skill, selectedSkill: skill }),

  // ========== 兼容 ChatArea 的方法 ==========
  getActiveMessages: () => get().messages,
  addMessageToActive: (msg) => {
    set((state) => {
      const newMessages = [...state.messages, msg];
      const tasks = state.tasks.map(t =>
        t.id === state.activeTaskId ? { ...t, messages: newMessages } : t
      );
      return { messages: newMessages, tasks };
    });
    // 🔧 v5.5.1: 持久化主聊天消息 + tasks
    // 🔧 B088: 使用trySetItem自动处理配额溢出
    const json = JSON.stringify(get().messages);
    trySetItem('shaoziclaw_chat_messages', json);
    saveTasks(get().tasks);
  },
  updateMessageInActive: (id, updates) => {
    set((state) => {
      const newMessages = state.messages.map(m => m.id === id ? { ...m, ...updates } : m);
      const tasks = state.tasks.map(t =>
        t.id === state.activeTaskId ? { ...t, messages: newMessages } : t
      );
      return { messages: newMessages, tasks };
    });
    // 🔧 v5.5.1: 持久化主聊天消息
    // 🔧 B088: 使用trySetItem自动处理配额溢出
    const json = JSON.stringify(get().messages);
    trySetItem('shaoziclaw_chat_messages', json);
    saveTasks(get().tasks);
  },
  clearActiveMessages: () => {
    set((state) => {
      const tasks = state.tasks.map(t =>
        t.id === state.activeTaskId ? { ...t, messages: [] } : t
      );
      return { messages: [], currentSkill: null, tasks };
    });
    saveTasks(get().tasks);
  },
  
  setCurrentModel: (modelId) => set({ currentModel: modelId }),
  setIsGenerating: (val) => set({ isGenerating: val }),
  setGeneratingContext: (contextId) => set({ generatingContext: contextId, isGenerating: contextId !== null }),
  
  // 兼容 selectedSkill → 映射到 currentSkill
  setSelectedSkill: (skill) => set({ currentSkill: skill, selectedSkill: skill }),

  setCurrentModel: (modelId) => set({ currentModel: modelId }),

  // ========== UI Actions ==========
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ========== 自定义模型 Actions ==========
  addCustomModel: (modelData) => {
    const newModel: CustomModel = {
      ...modelData,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    };
    const updated = [...get().customModels, newModel];
    localStorage.setItem('shaoziclaw_custom_models', JSON.stringify(updated));
    set({ customModels: updated });
  },
  
  removeCustomModel: (id) => {
    const updated = get().customModels.filter(m => m.id !== id);
    localStorage.setItem('shaoziclaw_custom_models', JSON.stringify(updated));
    const newActiveId = get().activeModelId === id ? null : get().activeModelId;
    if (newActiveId === null) localStorage.removeItem('shaoziclaw_active_model_id');
    set({ customModels: updated, activeModelId: newActiveId });
  },
  
  updateCustomModel: (id, updates) => {
    const updated = get().customModels.map(m =>
      m.id === id ? { ...m, ...updates } : m
    );
    localStorage.setItem('shaoziclaw_custom_models', JSON.stringify(updated));
    set({ customModels: updated });
  },
  
  setActiveModel: (id) => {
    localStorage.setItem('shaoziclaw_active_model_id', id || '');
    set({ activeModelId: id });
  },
  
  getActiveModel: () => {
    const { customModels, activeModelId } = get();
    if (!activeModelId) return null;
    return customModels.find(m => m.id === activeModelId) || null;
  },

  // ========== 微信配置 Actions ==========
  updateWechatConfig: (config) => {
    const updated = { ...get().wechatConfig, ...config };
    localStorage.setItem('shaoziclaw_wechat_config', JSON.stringify(updated));
    set({ wechatConfig: updated });
  },
  
  testWechatConnection: async () => {
    const { wechatConfig } = get();
    if (!wechatConfig.webhookUrl) return false;
    
    try {
      const res = await fetch(wechatConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: '🔗 勺子Claw 连接测试成功' },
        }),
      });
      
      if (res.ok) {
        get().updateWechatConfig({ lastConnected: new Date().toISOString() });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // ========== 飞书配置 Actions ==========
  updateFeishuConfig: (config) => {
    const updated = { ...get().feishuConfig, ...config };
    localStorage.setItem('shaoziclaw_feishu_config', JSON.stringify(updated));
    set({ feishuConfig: updated });
  },
  
  testFeishuConnection: async () => {
    const { feishuConfig } = get();
    if (!feishuConfig.webhookUrl) return false;

    try {
      const res = await fetch(feishuConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: JSON.stringify({ text: '🔗 勺子Claw 连接测试成功' }),
        }),
      });

      if (res.ok) {
        get().updateFeishuConfig({ lastConnected: new Date().toISOString() });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  // ====== v4.3 Actions 实现 ======

  // 用户档案
  updateUserProfile: (updates) => {
    const newProfile = { ...get().userProfile, ...updates };
    try {
      localStorage.setItem('shaoziclaw_user_profile', JSON.stringify(newProfile));
    } catch {}
    set({ userProfile: newProfile });
  },

  completeOnboarding: (profile) => {
    const completed = { ...profile, completed: true, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem('shaoziclaw_user_profile', JSON.stringify(completed));
      localStorage.setItem('shaoziclaw_user_name', profile.userName || '');
      // 【7】将用户档案写入强制记忆系统（每次回答都携带上下文）
      const userMemory = {
        version: 1,
        updatedAt: new Date().toISOString(),
        userName: profile.userName || '用户',
        brandName: profile.brandName || '未填写',
        brandStatus: profile.brandStatus || '未知',
        category: profile.category || '未填写',
        region: profile.region || '未填写',
        position: profile.position || '未填写',
        competitors: profile.competitors || '未填写',
        // 生成自然语言描述，供AI参考
        contextPrompt: `用户档案：称呼${profile.userName||'用户'}，品牌"${profile.brandName||'未填写'}"，状态${profile.brandStatus==='running'?'已开业':'策划中'}，品类${profile.category||'未填'}，地区${profile.region||'未填'}，角色${profile.position||'未填'}，对标品牌${profile.competitors||'无'}。回答问题时请根据此档案提供个性化建议。`,
      };
      localStorage.setItem('shaoziclaw_user_memory', JSON.stringify(userMemory));
    } catch {}
    set({ userProfile: completed, userName: profile.userName || '' });
  },

  // 专家会话 🔧 v4.9.9: 添加去重检查
  createExpertSession: (expertType, expertName, expertAvatar, title, greeting, skillName) => {
    // 🔧 v4.9.9: 去重 — 如果已存在同专家名的会话，直接切换
    const existing = get().expertSessions.find(s => s.expertName === expertName);
    if (existing) {
      console.log('[v4.9.9] 专家会话去重: 已存在', expertName, '→ 切换到', existing.id);
      // 🔧 v5.5.22 Bug#2修复：去重切换时也要更新skillName（用户可能从不同入口进同一专家）
      if (skillName && existing.skillName !== skillName) {
        const sessions = get().expertSessions.map(s =>
          s.id === existing.id ? { ...s, skillName } : s
        );
        saveExpertSessions(sessions);
        set({
          expertSessions: sessions,
          activeExpertSessionId: existing.id,
          activeExpertType: expertType,
          activeTaskSessionId: null,
        });
      } else {
        set({
          activeExpertSessionId: existing.id,
          activeExpertType: expertType,
          activeTaskSessionId: null, // 🔧 v5.3.10: 切换专家会话时清除任务会话
        });
      }
      return existing.id;
    }

    const id = `expert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    // 🔧 B008修复：创建时直接写入greeting，消除window变量竞态
    console.log('[B008v2] createExpertSession called, greeting=', greeting ? greeting.substring(0, 50) : 'NONE', 'skillName=', skillName || 'NONE');
    const messages = greeting ? [{
      id: `expert-greeting-${Date.now()}`,
      role: 'assistant' as const,
      content: greeting,
      timestamp: new Date(),
      thinkingSteps: [],
    }] : [];
    console.log('[B008v2] messages count=', messages.length, 'id=', id);
    const newSession: ExpertSession = {
      id,
      expertType,
      expertName,
      expertAvatar,
      title: title || `与${expertName}的对话`,
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
      skillName, // 🔧 v5.5.22 Bug#2修复：写入skillName用于后端路由
    };
    const sessions = [newSession, ...get().expertSessions];
    saveExpertSessions(sessions);
    set({ expertSessions: sessions, activeExpertSessionId: id, activeExpertType: expertType, activeTaskSessionId: null }); // 🔧 v5.3.10: 创建专家会话时清除任务会话
    console.log('[B008v2] store updated, activeExpertSessionId=', id, 'total sessions=', sessions.length);
    return id;
  },

  switchExpertSession: (sessionId) => {
    const session = get().expertSessions.find(s => s.id === sessionId);
    if (session) {
      set({ activeExpertSessionId: sessionId, activeExpertType: session.expertType, activeTaskSessionId: null }); // 🔧 v5.3.10: 切换专家会话时清除任务会话
    }
  },

  deleteExpertSession: (sessionId) => {
    const remaining = get().expertSessions.filter(s => s.id !== sessionId);
    saveExpertSessions(remaining);
    const newActiveId = get().activeExpertSessionId === sessionId
      ? (remaining.length > 0 ? remaining[0].id : null)
      : get().activeExpertSessionId;
    set({
      expertSessions: remaining,
      activeExpertSessionId: newActiveId,
      activeExpertType: newActiveId
        ? (remaining.find(s => s.id === newActiveId)?.expertType || 'general')
        : 'general',
    });
  },

  renameExpertSession: (sessionId, newTitle) => {
    const sessions = get().expertSessions.map(s =>
      s.id === sessionId ? { ...s, title: newTitle, updatedAt: new Date() } : s
    );
    saveExpertSessions(sessions);
    set({ expertSessions: sessions });
  },

  getActiveExpertSession: () => {
    const { expertSessions, activeExpertSessionId } = get();
    return expertSessions.find(s => s.id === activeExpertSessionId) || null;
  },

  // 文件上传
  addUploadedFile: (fileData) => {
    const file: UploadedFile = {
      ...fileData,
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    };
    set(state => ({ uploadedFiles: [...state.uploadedFiles, file] }));
  },

  removeUploadedFile: (fileId) => {
    set(state => ({ uploadedFiles: state.uploadedFiles.filter(f => f.id !== fileId) }));
  },

  clearUploadedFiles: () => set({ uploadedFiles: [] }),

  // 【1】向专家会话添加消息
  addMessageToExpertSession: (sessionId: string, message: Message) => {
    const sessions = get().expertSessions.map(s =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, message], updatedAt: new Date() }
        : s
    );
    saveExpertSessions(sessions);
    set({ expertSessions: sessions });
  },

  // 【B010修复】更新专家会话中的消息（AI回复流式更新/完成/错误）
  updateExpertMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
    const sessions = get().expertSessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.map(m =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
        updatedAt: new Date(),
      };
    });
    saveExpertSessions(sessions);
    set({ expertSessions: sessions });
  },

  // ═══════════════════════════════
  // ⏰ 定时任务 Actions（v4.7.0）
  // ═══════════════════════════════

  loadScheduledTasks: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const tasks: ScheduledTask[] = await invoke('list_scheduled_tasks');
      const activeCount = tasks.filter(t => t.enabled).length;
      set({ scheduledTasks: tasks, activeScheduledCount: activeCount });
    } catch (e) {
      console.error('[Store] 加载定时任务失败:', e);
    }
  },

  createScheduledTask: async (taskData) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const task: ScheduledTask = await invoke('create_scheduled_task', { task: taskData });
      set((state) => ({
        scheduledTasks: [task, ...state.scheduledTasks],
        activeScheduledCount: state.scheduledTasks.filter(t => t.enabled).length + (taskData.enabled ? 1 : 0),
      }));
      return task;
    } catch (e) {
      console.error('[Store] 创建定时任务失败:', e);
      throw e;
    }
  },

  updateScheduledTask: async (id, updates) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updated: ScheduledTask = await invoke('update_scheduled_task', { taskId: id, updates });
      set((state) => {
        const tasks = state.scheduledTasks.map(t => t.id === id ? updated : t);
        return {
          scheduledTasks: tasks,
          activeScheduledCount: tasks.filter(t => t.enabled).length,
        };
      });
    } catch (e) {
      console.error('[Store] 更新定时任务失败:', e);
      throw e;
    }
  },

  deleteScheduledTask: async (id) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_scheduled_task', { taskId: id });
      set((state) => {
        const deletedTask = state.scheduledTasks.find(t => t.id === id);
        const tasks = state.scheduledTasks.filter(t => t.id !== id);
        return {
          scheduledTasks: tasks,
          activeScheduledCount: tasks.filter(t => t.enabled).length,
        };
      });
    } catch (e) {
      console.error('[Store] 删除定时任务失败:', e);
      throw e;
    }
  },

  toggleScheduledTask: async (id, enabled) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updated: ScheduledTask = await invoke('toggle_scheduled_task', { taskId: id, enabled });
      set((state) => {
        const tasks = state.scheduledTasks.map(t => t.id === id ? updated : t);
        return {
          scheduledTasks: tasks,
          activeScheduledCount: tasks.filter(t => t.enabled).length,
        };
      });
    } catch (e) {
      console.error('[Store] 切换定时任务状态失败:', e);
      throw e;
    }
  },

  runScheduledTaskNow: async (id) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result: ExecutionResult = await invoke('run_scheduled_task_now', { taskId: id });
      // 更新任务的 lastRun 状态（重新加载列表）
      get().loadScheduledTasks();
      return { success: result.success, result };
    } catch (e) {
      console.error('[Store] 手动执行定时任务失败:', e);
      return { success: false };
    }
  },

  // ═════════════════════════════════════════
  // ⏰💬 任务会话 Actions（v4.9.9）
  // 与专家会话一致的模式：创建会话→ChatArea全屏渲染
  // ═════════════════════════════════════════

  createTaskSession: (taskId, taskName, promptTemplate, skillName, greeting, autoRun) => {
    const id = `taskchat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    // 🔧 v5.3.9: greeting==promptTemplate时不添加问候消息，直接autoRun执行
    const isDirectRun = greeting && greeting === promptTemplate;
    const messages = (greeting && !isDirectRun) ? [{
      id: `task-greeting-${Date.now()}`,
      role: 'assistant' as const,
      content: greeting,
      timestamp: new Date(),
      thinkingSteps: [],
      isThinkingComplete: true,
    }] : [];
    const newSession: TaskSession = {
      id,
      taskId,
      taskName,
      promptTemplate,
      skillName,
      title: `与「${taskName}」的任务对话`,
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const sessions = [newSession, ...get().taskSessions];
    // 🔧 v5.3.9: direct run模式直接用promptTemplate
    // 🔧 v5.3.10: 创建任务会话时清除专家会话ID，避免消息路由混乱
    set({ taskSessions: sessions, activeTaskSessionId: id, activeExpertSessionId: null, pendingAutoRun: autoRun ? (isDirectRun ? promptTemplate : (greeting || promptTemplate)) : null });
    // 持久化到 localStorage
    // 🔧 B088: 使用trySetItem自动处理配额溢出
    trySetItem('shaoziclaw_task_sessions', JSON.stringify(sessions));
    try { localStorage.setItem('shaoziclaw_active_task_session_id', id); } catch {}
    console.log('[TaskSession] 创建成功:', id, '任务:', taskName);
    return id;
  },

  closeTaskSession: () => {
    set({ activeTaskSessionId: null });
    localStorage.removeItem('shaoziclaw_active_task_session_id');
  },

  switchTaskSession: (sessionId) => {
    const session = get().taskSessions.find(s => s.id === sessionId);
    // 🔧 B078: 如果任务会话没有有效的AI回复（只有greeting或空），自动设置pendingAutoRun重新执行
    // greeting消息以 '📋 执行任务：' 开头，不是真正的AI回复
    const hasRealAssistantReply = session?.messages.some(m =>
      m.role === 'assistant' && m.content && !m.content.startsWith('📋 执行任务：')
    );
    const shouldAutoRun = !hasRealAssistantReply && !!session?.promptTemplate;
    set({
      activeTaskSessionId: sessionId,
      activeExpertSessionId: null, // 🔧 v5.3.10: 切换任务会话时清除专家会话
      pendingAutoRun: shouldAutoRun ? session!.promptTemplate : null,
    });
    try { localStorage.setItem('shaoziclaw_active_task_session_id', sessionId); } catch {}
  },

  addMessageToTaskSession: (sessionId, message) => {
    set((state) => ({
      taskSessions: state.taskSessions.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, message], updatedAt: new Date() } : s
      ),
    }));
    // 🔧 B088: 同步持久化（使用trySetItem自动处理配额溢出）
    trySetItem('shaoziclaw_task_sessions', JSON.stringify(get().taskSessions));
  },

  updateTaskSessionMessage: (sessionId, messageId, updates) => {
    set((state) => ({
      taskSessions: state.taskSessions.map(s =>
        s.id === sessionId ? {
          ...s,
          messages: s.messages.map(m => m.id === messageId ? { ...m, ...updates } : m),
          updatedAt: new Date(),
        } : s
      ),
    }));
    // 同步持久化
    try { localStorage.setItem('shaoziclaw_task_sessions', JSON.stringify(get().taskSessions)); } catch {}
  },

  getActiveTaskSession: () => {
    const { taskSessions, activeTaskSessionId } = get();
    return taskSessions.find(s => s.id === activeTaskSessionId) || null;
  },

  deleteTaskSession: (sessionId) => {
    set((state) => {
      const newSessions = state.taskSessions.filter(s => s.id !== sessionId);
      const newActiveId = state.activeTaskSessionId === sessionId ? null : state.activeTaskSessionId;
      return { taskSessions: newSessions, activeTaskSessionId: newActiveId };
    });
    try {
      localStorage.setItem('shaoziclaw_task_sessions', JSON.stringify(get().taskSessions));
      if (get().activeTaskSessionId === null) {
        localStorage.removeItem('shaoziclaw_active_task_session_id');
      }
    } catch {}
  },

  // ========== 💳 积分系统 Actions ==========
  setPointsBalance: (balance) => set({ pointsBalance: balance }),

  setPointsLogin: (isLoggedIn) => set({ isPointsLoggedIn: isLoggedIn }),

  refreshPointsBalance: async () => {
    try {
      const { getPointsBalance } = await import('./services/pointsApi');
      const res = await getPointsBalance();
      set({ pointsBalance: res.balance, isPointsLoggedIn: true });
    } catch (e) {
      // token 过期或无效，清除登录状态
      console.warn('[积分] 刷新余额失败:', e);
      set({ isPointsLoggedIn: false });
      localStorage.removeItem('shaoziclaw_jwt_token');
    }
  },

  // ========== 📚 RAG知识库 Actions（v5.1）==========
  setKbStatus: (status) => set({ kbStatus: status }),

  setKbInfo: (totalChunks, indexVersion) => set({ kbTotalChunks: totalChunks, kbIndexVersion: indexVersion }),

  refreshKbStatus: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<any>('get_kb_status');
      set({
        kbStatus: status.initialized ? 'ready' : 'uninitialized',
        kbTotalChunks: status.totalChunks || 0,
        kbIndexVersion: status.indexVersion || null,
      });
    } catch (e) {
      console.warn('[KB] 获取知识库状态失败:', e);
      set({ kbStatus: 'unknown' });
    }
  },

}));

// 兼容别名：ChatArea等组件使用 useAppStore
export const useAppStore = useStore;
// 兼容别名：currentUser
export const currentUser = () => {
  const s = useStore.getState();
  return s.isAuthenticated ? { id: '1', name: s.userName, email: s.userEmail } : null;
};
