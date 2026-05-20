import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Calendar,
  Grid3x3,
  MapPin,
  Scale,
  Megaphone,
  Package,
  FileText,
  Copy,
  Wrench,
} from 'lucide-react'

interface ToolInfo {
  id: string
  name: string
  category: string
  description: string
  icon: string
}

const iconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Calculator, TrendingUp, DollarSign, Calendar,
  Grid3x3, MapPin, Scale, Megaphone, Package, FileText,
}

function getIcon(name: string) {
  return (iconMap as any)[name] || Calculator
}

export default function ToolBox() {
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)
  const [toolResult, setToolResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    invoke('list_tools').then((res: any) => setTools(res || [])).catch(console.error)
  }, [])

  async function handleExecute(toolId: string, params?: any) {
    setLoading(true)
    setToolResult(null)
    try {
      const res = await invoke('execute_tool', { tool_id: toolId, params: params || {} })
      setToolResult(res)
    } catch (e: any) {
      setToolResult({ error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  // 按分类分组
  const toolsByCategory = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = []
    acc[tool.category].push(tool)
    return acc
  }, {} as Record<string, ToolInfo[]>)

  return (
    <div className="flex-1 flex h-screen">
      {/* 左侧：工具列表 */}
      <div className="w-[380px] min-w-[380px] border-r border-gray-200 bg-white flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">🛠️ 工具插件箱</h2>
          <p className="text-xs text-gray-500 mt-1">{tools.length} 个实用工具</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                {category}
              </h3>
              <div className="space-y-1.5">
                {categoryTools.map(tool => {
                  const Icon = getIcon(tool.icon)
                  return (
                    <button
                      key={tool.id}
                      onClick={() => { setSelectedTool(tool); setToolResult(null); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                        selectedTool?.id === tool.id
                          ? 'bg-[#E6F7EF] border border-[#B8E6CD]'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#E6F7EF] flex items-center justify-center shrink-0">
                        <Icon size={17} className="text-[#1A7D4E]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{tool.name}</p>
                        <p className="text-xs text-gray-500 truncate">{tool.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-200 text-[11px] text-gray-400">
          所有计算均在本地完成，数据不会上传
        </div>
      </div>

      {/* 右侧：工具操作区 */}
      <div className="flex-1 overflow-y-auto bg-white">
        {!selectedTool ? (
          /* 空状态 */
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-8 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-[#E6F7EF] flex items-center justify-center mx-auto mb-4">
                <Wrench size={28} className="text-[#1A7D4E]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">选择一个工具开始使用</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                工具箱提供了餐饮经营中最常用的计算器、模板和分析工具。
                所有结果可一键复制，直接用于你的工作场景。
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-2xl mx-auto animate-fade-in">
            {/* 工具标题 */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                {(() => { const Icon = getIcon(selectedTool.icon); return <Icon size={24} className="text-[#57CC86]" /> })()}
                <h1 className="text-2xl font-bold text-gray-900">{selectedTool.name}</h1>
              </div>
              <p className="text-sm text-gray-500">{selectedTool.description}</p>
            </div>

            {/* 动态表单 */}
            <ToolForm tool={selectedTool} onRun={handleExecute} loading={loading} />

            {/* 结果展示 */}
            {toolResult && (
              <div className="mt-6 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">计算结果</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(toolResult, null, 2))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs text-gray-500 transition-colors"
                  >
                    <Copy size={12} /> 复制结果
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 overflow-x-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {JSON.stringify(toolResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 工具动态表单组件
function ToolForm({ tool, onRun, loading }: {
  tool: ToolInfo
  onRun: (id: string, params?: any) => void
  loading: boolean
}) {
  // 根据不同工具渲染不同的输入表单
  switch (tool.id) {
    case 'cost-calculator':
      return <CostCalculatorForm onRun={onRun} loading={loading} />
    case 'rent-roi':
      return <RentRoiForm onRun={onRun} loading={loading} />
    case 'breakeven':
      return <BreakevenForm onRun={onRun} loading={loading} />
    default:
      return (
        <button
          onClick={() => onRun(tool.id)}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#57CC86] to-[#3DAA5F] text-white font-semibold text-sm hover:from-[#3DAA5F] hover:to-[#57CC86] disabled:opacity-50 transition-all shadow-lg shadow-[#57CC86]/15 flex items-center justify-center gap-2"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 计算中...</>
          ) : (
            <>▶ 执行 {tool.name}</>
          )}
        </button>
      )
  }
}

function CostCalculatorForm({ onRun, loading }: { onRun: any, loading: boolean }) {
  const [foodCost, setFoodCost] = useState('')
  const [margin, setMargin] = useState('30')
  
  return (
    <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">食材成本（元）</label>
        <input
          type="number"
          value={foodCost}
          onChange={(e) => setFoodCost(e.target.value)}
          placeholder="例如: 12.50"
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">目标毛利率 (%)</label>
        <input
          type="number"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          placeholder="30"
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400"
        />
        <p className="mt-1.5 text-[11px] text-gray-600">行业建议值：快餐 35-45% / 正餐 55-65% / 饮品 70-80%</p>
      </div>
      <button
        onClick={() => onRun('cost-calculator', { foodCost: parseFloat(foodCost), target_margin: parseFloat(margin) })}
        disabled={loading || !foodCost || !margin}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#57CC86] to-[#3DAA5F] text-white font-semibold text-sm hover:from-[#3DAA5F] hover:to-[#57CC86] disabled:opacity-50 transition-all"
      >
        {loading ? '计算中...' : '🧮 计算建议售价'}
      </button>
    </div>
  )
}

function RentRoiForm({ onRun, loading }: { onRun: any, loading: boolean }) {
  const [rent, setRent] = useState('')
  const [revenue, setRevenue] = useState('')
  
  return (
    <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">月租金（元）</label>
        <input type="number" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="例如: 25000" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">预计月营收（元）</label>
        <input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="例如: 150000" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400" />
      </div>
      <button onClick={() => onRun('rent-roi', { monthly_rent: parseFloat(rent), expected_revenue: parseFloat(revenue) })} disabled={loading || !rent || !revenue} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#57CC86] to-[#3DAA5F] text-white font-semibold text-sm hover:from-[#3DAA5F] hover:to-[#57CC86] disabled:opacity-50 transition-all">
        {loading ? '分析中...' : '📊 分析租金ROI'}
      </button>
    </div>
  )
}

function BreakevenForm({ onRun, loading }: { onRun: any, loading: boolean }) {
  const [fixedCost, setFixedCost] = useState('')
  const [avgCheck, setAvgCheck] = useState('')
  const [variableRate, setVariableRate] = useState('55')

  return (
    <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">月固定成本（元）</label>
        <input type="number" value={fixedCost} onChange={(e) => setFixedCost(e.target.value)} placeholder="房租+人工+水电+其他固定支出" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">客单价（元）</label>
        <input type="number" value={avgCheck} onChange={(e) => setAvgCheck(e.target.value)} placeholder="平均每客消费金额" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">变动成本率 (%)</label>
        <input type="number" value={variableRate} onChange={(e) => setVariableRate(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400" />
        <p className="mt-1.5 text-[11px] text-gray-600">包含食材成本+包装+耗材等随销量变动的成本</p>
      </div>
      <button onClick={() => onRun('breakeven', { fixed_cost: parseFloat(fixedCost), avg_check: parseFloat(avgCheck), variable_rate: parseFloat(variableRate) / 100 })} disabled={loading || !fixedCost || !avgCheck} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#57CC86] to-[#3DAA5F] text-white font-semibold text-sm hover:from-[#3DAA5F] hover:to-[#57CC86] disabled:opacity-50 transition-all">
        {loading ? '计算中...' : '⚖️ 盈亏平衡分析'}
      </button>
    </div>
  )
}
