import { useState, useEffect } from 'react'
import {
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'

interface PlanInfo {
  id: string
  name: string
  price: number
  tokenLimit: number
  features: string[]
  recommended: boolean
}

export default function Subscription() {
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>('pro')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 模拟获取订阅方案
    setPlans([
      {
        id: 'free', name: '免费版', price: 0, tokenLimit: 50000,
        features: ['每月5万Token', '基础AI对话', '20个L1 Skills', '社区支持'],
        recommended: false,
      },
      {
        id: 'pro', name: '专业版', price: 198, tokenLimit: 1000000,
        features: [
          '每月100万Token(超量充值¥0.1/千)',
          '全部餐饮Skill解锁',
          '三模型自由切换(GLM/Qwen/DeepSeek)',
          '工具插件箱全开',
          '知识库完整访问',
          '优先技术支持',
          '自动更新',
        ],
        recommended: true,
      },
      {
        id: 'enterprise', name: '企业版', price: 498, tokenLimit: 5000000,
        features: [
          '每月500万Token(超量¥0.08/千)',
          '包含专业版所有功能',
          '多门店管理面板',
          '专属成功经理',
          '定制化Skill开发',
          '数据云同步',
          'API接入权限',
          'SLA保障99.9%',
        ],
        recommended: false,
      },
    ])
  }, [])

  const handleSubscribe = async (planId: string) => {
    setSelectedPlan(planId)
    setLoading(true)
    
    // TODO: 对接支付接口（微信/支付宝）
    // 模拟支付过程
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setLoading(false)
    alert(`🎉 感谢选择 ${plans.find(p => p.id === planId)?.name}！\n\n支付功能将在正式版对接微信/支付宝后开放。\n\n当前为演示模式，已自动激活专业版体验。`)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">选择你的 勺子Claw 订阅方案</h1>
          <p className="text-sm text-gray-500">餐饮人的超级AI大脑 + 20位AI专家 + 实用工具箱</p>
          
          {/* Token 用量指示器 */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>本月已用</span>
              <span>123,456 / 1,000,000 Tokens (12.3%)</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r to-[#57CC86] to-[#3DAA5F] rounded-full" style={{ width: '12.3%' }} />
            </div>
          </div>
        </div>

        {/* 方案卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border transition-all ${
                plan.recommended
                  ? 'border-[#57CC86] bg-[#E6F7EF] shadow-lg shadow-[#B8E6CD]/30 scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-[#B8E6CD]'
              }`}
            >
              {/* 推荐标签 */}
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r to-[#57CC86] to-[#3DAA5F] text-black text-xs font-semibold shadow-lg">
                  ⭐ 最受欢迎
                </div>
              )}

              <div className="p-6">
                {/* 方案名和价格 */}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-extrabold text-gray-900">¥{plan.price}</span>
                    <span className="text-sm text-gray-500">/月</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(plan.tokenLimit / 10000).toFixed(0)}万 Tokens/月
                  </p>
                </div>

                {/* 功能列表 */}
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <Check size={15} className={`shrink-0 mt-0.5 ${plan.recommended ? 'text-[#1A7D4E]' : 'text-green-500'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* 按钮 */}
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading && selectedPlan === plan.id}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.recommended
                      ? 'bg-gradient-to-r to-[#57CC86] to-[#3DAA5F] hover:from-[#6DD9A0] hover:to-[#57CC86] text-black shadow-lg shadow-[#B8E6CD]/30'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                  }`}
                >
                  {loading && selectedPlan === plan.id ? (
                    <>
                      <RefreshCw size={14} className="inline mr-2 animate-spin" /> 处理中...
                    </>
                  ) : plan.price === 0 ? (
                    '免费开始使用'
                  ) : (
                    <>立即订阅 ¥{plan.price}/月</>
                  )}
                </button>

                {/* 底部说明 */}
                <p className="mt-3 text-center text-[11px] text-gray-400">
                  随时取消 · 无绑定合约 · 未用Token可累积
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <section className="max-w-2xl mx-auto mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">常见问题</h2>
          <div className="space-y-3">
            {[
              { q: '什么是 Token？超了怎么办？', a: '每次与 AI 对话都会消耗 Token。专业版每月包含 100 万 Token，超出部分按 ¥0.1/千 Token 充值即可。' },
              { q: '可以随时取消吗？', a: '是的，随时可以取消订阅，当月剩余时间仍然可用。取消后不会自动续费。' },
              { q: '三模型有什么区别？', a: 'GLM-5.1 擅长中文理解和生成；Qwen 3.5 Max 综合能力最强；DeepSeek V3 在推理和分析上表现出色。可根据场景切换。' },
              { q: '企业版适合什么规模？', a: '拥有 5 家以上门店的连锁品牌、需要多店管理、定制化需求的企业用户推荐企业版。' },
            ].map((item, i) => (
              <details key={i} className="group bg-white rounded-xl border border-gray-200 overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-medium text-gray-700 group-open:text-[#1A7D4E]">{item.q}</span>
                  <ArrowRight size={14} className="text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="px-4 pb-4 text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
