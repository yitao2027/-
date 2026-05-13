import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Brain,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ShieldAlert,
  Search,
  RefreshCw,
} from 'lucide-react'

interface LearningStats {
  totalFeedbacks: number
  positiveCount: number
  negativeCount: number
  activeNegativeCases: number
  totalMemories: number
  dynamicRedlines: number
  topViolations: Array<{ violationType: string; count: number }>
}

interface NegativeCase {
  id: number
  userQuery: string
  aiResponse: string
  violationType: string
  severity: string
  correctGuidance: string
  sourceSkill?: string
  count: number
  createdAt: string
  status: string
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-[#E6F7EF]0/20 text-[#57CC86] border-[#3DAA5F]/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: '🔴 严重',
  medium: '🟡 中等',
  low: '🔵 轻微',
}

const VIOLATION_LABELS: Record<string, string> = {
  fraud_or_cheating: '刷单/作弊',
  deceptive_practices: '欺骗手段',
  food_safety_violation: '食品安全违规',
  off_topic_response: '答非所问',
  general_quality_issue: '质量问题',
}

export default function LearningDashboard() {
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [cases, setCases] = useState<NegativeCase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'cases'>('overview')

  const fetchStats = async () => {
    setLoading(true)
    try {
      const s = await invoke('get_learning_stats')
      setStats(s as LearningStats)
    } catch (e) {
      console.error('获取学习统计失败:', e)
    }
    setLoading(false)
  }

  const fetchCases = async () => {
    try {
      const c = await invoke('get_negative_cases')
      setCases(c as NegativeCase[])
    } catch (e) {
      console.error('获取负面案例失败:', e)
    }
  }

  const resolveCase = async (caseId: number) => {
    try {
      await invoke('resolve_case', { caseId })
      setCases(cases.filter((c) => c.id !== caseId))
      fetchStats()
    } catch (e) {
      console.error('解决案例失败:', e)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (!stats) return null

  // 计算正面反馈率
  const positiveRate =
    stats.totalFeedbacks > 0
      ? Math.round((stats.positiveCount / stats.totalFeedbacks) * 100)
      : 0

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
          <Brain size={15} /> 🧠 学习闭环系统
        </h2>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#57CC86]' : 'text-gray-600'} />
        </button>
      </div>

      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">

        {/* Tab 切换 */}
        <div className="flex border-b border-[#1e1e2e] px-4 pt-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-medium transition-colors relative ${
              activeTab === 'overview' ? 'text-[#57CC86]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            📊 数据概览
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#57CC86]" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('cases')
              if (cases.length === 0) fetchCases()
            }}
            className={`px-4 py-2 text-xs font-medium transition-colors relative ${
              activeTab === 'cases' ? 'text-[#57CC86]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            ⚠️ 负面案例 ({stats.activeNegativeCases})
            {activeTab === 'cases' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#57CC86]" />
            )}
          </button>
        </div>

        {/* 概览 Tab */}
        {activeTab === 'overview' && (
          <div className="p-5 space-y-5">
            {/* 核心指标卡片 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 反馈总量 */}
              <div className="bg-[#0c0c12] rounded-lg p-3.5 border border-[#1a1a25]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Search size={14} className="text-purple-400" />
                  </div>
                  <span className="text-xs text-gray-500">总反馈数</span>
                </div>
                <p className="text-xl font-bold text-white">{stats.totalFeedbacks}</p>
              </div>

              {/* 正面反馈 */}
              <div className="bg-[#0c0c12] rounded-lg p-3.5 border border-[#1a1a25]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <ThumbsUp size={14} className="text-green-400" />
                  </div>
                  <span className="text-xs text-gray-500">👍 正面反馈</span>
                </div>
                <p className="text-xl font-bold text-green-400">{stats.positiveCount}</p>
              </div>

              {/* 负面反馈 */}
              <div className="bg-[#0c0c12] rounded-lg p-3.5 border border-[#1a1a25]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <ThumbsDown size={14} className="text-red-400" />
                  </div>
                  <span className="text-xs text-gray-500">👎 负面反馈</span>
                </div>
                <p className="text-xl font-bold text-red-400">{stats.negativeCount}</p>
              </div>

              {/* 动态红线 */}
              <div className="bg-[#0c0c12] rounded-lg p-3.5 border border-[#1a1a25]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#57CC86]/10 flex items-center justify-center">
                    <ShieldAlert size={14} className="text-[#57CC86]" />
                  </div>
                  <span className="text-xs text-gray-500">动态红线</span>
                </div>
                <p className="text-xl font-bold text-[#57CC86]">{stats.dynamicRedlines}</p>
              </div>
            </div>

            {/* 正面反馈率进度条 */}
            {stats.totalFeedbacks > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">回答质量评分</span>
                  <span className={`text-xs font-medium ${positiveRate >= 80 ? 'text-green-400' : positiveRate >= 60 ? 'text-[#57CC86]' : 'text-red-400'}`}>
                    {positiveRate}% 👍
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0c0c12] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${positiveRate >= 80 ? 'bg-gradient-to-r from-green-600 to-green-400' : positiveRate >= 60 ? 'bg-gradient-to-r from-[#3DAA5F] to-[#57CC86]' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
                    style={{ width: `${positiveRate}%` }}
                  />
                </div>
              </div>
            )}

            {/* 违规类型分布 */}
            {stats.topViolations.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2.5 flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-[#3DAA5F]" />
                  违规问题分布
                </p>
                <div className="space-y-2">
                  {stats.topViolations.map((v) => (
                    <div key={v.violationType} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-300 truncate">
                            {VIOLATION_LABELS[v.violationType] || v.violationType.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">{v.count}次</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#0c0c12] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#3DAA5F] to-[#57CC86] rounded-full"
                            style={{ width: `${Math.min(100, (v.count / stats.totalFeedbacks) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 记忆条目 */}
            <div className="flex items-center justify-between py-2 px-3 bg-[#0c0c12] rounded-lg border border-[#1a1a25]">
              <span className="text-xs text-gray-500">📝 已存储经验条目</span>
              <span className="text-sm font-medium text-blue-400">{stats.totalMemories}</span>
            </div>
          </div>
        )}

        {/* 案例 Tab */}
        {activeTab === 'cases' && (
          <div className="p-4 max-h-[480px] overflow-y-auto">
            {cases.length === 0 ? (
              <div className="text-center py-12">
                <ShieldAlert size={32} className="mx-auto text-gray-700 mb-3" />
                <p className="text-sm text-gray-500">暂无活跃负面案例</p>
                <p className="text-xs text-gray-700 mt-1">当用户给出👎负反馈时，案例会自动出现在这里</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#0c0c12] rounded-lg border border-[#1a1a25] p-3.5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${SEVERITY_COLORS[c.severity] || ''}`}>
                        {SEVERITY_LABELS[c.severity] || c.severity}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-600">×{c.count}</span>
                        <button
                          onClick={() => resolveCase(c.id)}
                          className="px-2.5 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[11px] font-medium transition-colors"
                        >
                          ✅ 解决
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mb-1.5 line-clamp-2">
                      💬 <strong>用户问</strong>：{c.userQuery.length > 80 ? c.userQuery.slice(0, 80) + '...' : c.userQuery}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-2">
                      类型：{VIOLATION_LABELS[c.violationType] || c.violationType} · {c.createdAt.slice(5, 16)}
                    </p>
                    {c.sourceSkill && (
                      <p className="text-[11px] text-gray-600 mt-1">
                        来源 Skill：{c.sourceSkill}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-700 mt-2 pl-1">
        💡 所有数据存储在本地 SQLite 数据库中，完全离线运行。每次负反馈都会让 勺子Claw 更聪明。
      </p>
    </section>
  )
}
