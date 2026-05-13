/**
 * 积分系统 API 客户端
 *
 * 所有与积分后端的 HTTP 通信封装在此，不经过 Rust invoke。
 * 前端直接 fetch 调用积分 API。
 */

const API_BASE = 'https://api.shaoziclaw.com';

const JWT_KEY = 'shaoziclaw_jwt_token';

const getAuthHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem(JWT_KEY) || ''}`,
});

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (json.code !== 0 && json.code !== undefined) {
    throw new Error(json.message || json.msg || `API error ${res.status}`);
  }
  return json.data ?? json;
}

// ========== 类型定义 ==========

interface SmsCodeResponse {
  debugCode?: string;
  message: string;
}

interface LoginResponse {
  token: string;
  user: { id: string; phone: string; pointsBalance: number };
}

interface PointsOverview {
  balance: number;
  membershipExp: string | null;
}

interface PointsBalance {
  balance: number;
}

interface TransactionList {
  items: any[];
  total: number;
  page: number;
  totalPages: number;
}

interface MembershipPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  points: number;
  durationDays: number;
  bonusPoints: number;
  isActive: boolean;
}

interface OrderResponse {
  id: string;
  orderNo: string;
  amount: number;
  points: number;
  qrCodeUrl: string;
  bankInfo: string;
}

interface MarkPaidResponse {
  success: boolean;
}

interface AiCostEstimate {
  estimatedCost: number;
  currentBalance: number;
  canAfford: boolean;
}

interface AiUsageRecord {
  pointsDeducted: number;
  newBalance: number;
}

// ========== 认证 ==========

/** 发送短信验证码（debug模式，验证码在响应中） */
export async function sendSmsCode(phone: string): Promise<SmsCodeResponse> {
  return request('/api/auth/code/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/** 验证码登录 */
export async function loginWithCode(phone: string, code: string): Promise<LoginResponse> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

// ========== 用户 ==========

/** 获取用户积分概览 */
export async function getPointsOverview(): Promise<PointsOverview> {
  return request('/api/user/points/overview');
}

/** 获取积分余额（轻量） */
export async function getPointsBalance(): Promise<PointsBalance> {
  return request('/api/points/balance');
}

// ========== 积分流水 ==========

/** 获取积分流水 */
export async function getTransactions(page = 1): Promise<TransactionList> {
  return request('/api/points/transactions', {
    method: 'POST',
    body: JSON.stringify({ page, pageSize: 20 }),
  });
}

// ========== 会员套餐 ==========

/** 获取套餐列表 */
export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  return request('/api/membership/plans');
}

// ========== 支付订单 ==========

/** 创建充值订单 */
export async function createOrder(planId: string): Promise<OrderResponse> {
  return request('/api/payment/order/create', {
    method: 'POST',
    body: JSON.stringify({ planId, paymentMethod: 'QR_CODE' }),
  });
}

/** 标记已付款 */
export async function markOrderPaid(orderId: string, payerAccount: string): Promise<MarkPaidResponse> {
  return request(`/api/payment/order/${orderId}/paid`, {
    method: 'POST',
    body: JSON.stringify({ payerAccount }),
  });
}

/** 查询订单列表 */
export async function getOrders(page = 1): Promise<TransactionList> {
  return request('/api/payment/orders', {
    method: 'POST',
    body: JSON.stringify({ page, pageSize: 20 }),
  });
}

// ========== AI 网关 ==========

/** 预估 AI 调用成本（发消息前调用） */
export async function estimateAiCost(modelId: string): Promise<AiCostEstimate> {
  return request('/api/ai/estimate', {
    method: 'POST',
    body: JSON.stringify({ modelId }),
  });
}

/** 记录 AI 消耗（前端直连AI后，精确扣减） */
export async function recordAiUsage(data: {
  modelId: string;
  inputLength: number;
  outputLength: number;
}): Promise<AiUsageRecord> {
  return request('/api/ai/record', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ========== 工具 ==========

/** 检查是否已登录积分系统 */
export function isPointsLoggedIn(): boolean {
  return !!localStorage.getItem(JWT_KEY);
}

/** 设置 JWT Token */
export function setJwtToken(token: string): void {
  localStorage.setItem(JWT_KEY, token);
}

/** 清除 JWT Token（退出登录） */
export function clearJwtToken(): void {
  localStorage.removeItem(JWT_KEY);
}
