import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Search,
  LayoutGrid,
  Star,
  BookOpen,
  Wrench,
  Crown,
  Sparkles,
  ShoppingBag,
  QrCode,
  TrendingUp,
  Users,
  GraduationCap,
  BarChart3,
  ChefHat,
  ShieldCheck,
  Palette,
  FileText,
} from 'lucide-react'
import { useAppStore } from '../store'

interface SkillItem {
  id: string
  name: string
  category: string
  subcategory: string
  description: string
  tags: string[]
  version: string
  has_references: boolean
}

// 专家Skill市场数据 — 餐饮行业名师命名的付费Skill
const expertSkills = [
  {
    id: 'expert-1',
    name: '曾姝骞·餐饮空间设计实战',
    author: '曾姝骞',
    avatar: '🎨',
    price: 49,
    originalPrice: 99,
    category: '空间设计',
    description: '从选址评估到动线规划，手把手教你打造高坪效餐饮空间。包含30+真实案例。',
    rating: 4.9,
    sales: 1280,
    icon: <Palette size={20} className="text-[#57CC86]" />,
    color: '#6366f1',
    badge: '热销',
    features: ['空间布局SOP', '灯光氛围指南', '装修预算控制', '30+案例库'],
  },
  {
    id: ' expert-2',
    name: '北北·连锁运营标准化体系',
    author: '北北',
    avatar: '🏢',
    price: 59,
    originalPrice: 129,
    category: '连锁运营',
    description: '从单店到百店的完整运营SOP。品控、培训、巡店、供应链全链路打通。',
    rating: 4.8,
    sales: 960,
    icon: <TrendingUp size={20} className="text-[#57CC86]" />,
    color: '#57CC86',
    badge: '专家级',
    features: ['单店盈利模型', '多店复制SOP', '区域管理手册', '人才梯队建设'],
  },
  {
    id: 'expert-3',
    name: '边江·爆款产品研发方法论',
    author: '边江',
    avatar: '🍳',
    price: 49,
    originalPrice: 89,
    category: '产品研发',
    description: '如何打造年销百万的招牌菜品？从创意筛选到成本优化的全流程方法。',
    rating: 4.9,
    sales: 1560,
    icon: <ChefHat size={20} className="text-[#57CC86]" />,
    color: '#ef4444',
    badge: '爆款',
    features: ['新品开发流程', '菜单工程', '口味测试SOP', '成本结构优化'],
  },
  {
    id: 'expert-4',
    name: '马姗·餐饮数字营销实战',
    author: '马姗',
    avatar: '📱',
    price: 59,
    originalPrice: 119,
    category: '数字营销',
    description: '抖音/小红书/本地生活全平台打法。从0到1搭建餐饮品牌流量池。',
    rating: 4.7,
    sales: 2100,
    icon: <Users size={20} className="text-[#57CC86]" />,
    color: '#ec4899',
    badge: '最火',
    features: ['抖音内容矩阵', '达人合作SOP', '团购套餐设计', '私域引流'],
  },
  {
    id: 'expert-5',
    name: '洪凤平·财税合规避坑指南',
    author: '洪凤平',
    avatar: '📊',
    price: 49,
    originalPrice: 79,
    category: '财税合规',
    description: '餐饮老板必学的财税知识：税筹、成本核算、风险预警、合规经营。',
    rating: 4.8,
    sales: 890,
    icon: <ShieldCheck size={20} className="text-[#57CC86]" />,
    color: '#06b6d4',
    badge: '实用',
    features: ['税务筹划方案', '成本核算模板', '风险自查清单', '合规经营手册'],
  },
  {
    id: 'expert-6',
    name: '余章荣·供应链采购优化',
    author: '余章荣',
    avatar: '🚛',
    price: 39,
    originalPrice: 69,
    category: '供应链',
    description: '降低采购成本15%的实操方法。供应商管理、库存周转、损耗控制全覆盖。',
    rating: 4.7,
    sales: 720,
    icon: <BarChart3 size={20} className="text-[#57CC86]" />,
    color: '#22c55e',
    badge: '性价比',
    features: ['供应商评估', '议价谈判技巧', '库存周转模型', '损耗控制'],
  },
  {
    id: 'expert-7',
    name: '朱姚清·品牌升级全攻略',
    author: '朱姚清',
    avatar: '✨',
    price: 49,
    originalPrice: 89,
    category: '品牌策划',
    description: '从品牌定位到视觉落地的完整方法论。让你的餐厅从"能吃"变成"想吃"。',
    rating: 4.8,
    sales: 650,
    icon: <Sparkles size={20} className="text-[#57CC86]" />,
    color: '#a855f7',
    badge: '新上',
    features: ['品牌定位工具', 'VI设计规范', '口碑传播策略', 'IP打造'],
  },
  {
    id: 'expert-8',
    name: '施琦·经营数据分析系统',
    author: '施琦',
    avatar: '📈',
    price: 39,
    originalPrice: 69,
    category: '数据分析',
    description: '看懂数据背后的经营真相。日报/周报/月报模板+关键指标预警机制。',
    rating: 4.6,
    sales: 580,
    icon: <FileText size={20} className="text-[#57CC86]" />,
    color: '#3b82f6',
    badge: '数据控',
    features: ['经营看板模板', '四效指标分析', '盈亏平衡计算', '数据预警'],
  },
]

// 分类定义
const categories = [
  { id: 'market', label: '🔥 专家市场', icon: ShoppingBag, color: '#57CC86', isMarket: true },
  { id: '', label: '全部', icon: LayoutGrid, color: '#6b7280' },
  { id: 'L0核心层', label: 'L0 核心层', icon: Crown, color: '#57CC86' },
  { id: 'L1部门基础', label: 'L1 部门基础', icon: BookOpen, color: '#3b82f6' },
  { id: 'L2专项能力', label: 'L2 专项能力', icon: Wrench, color: '#22c55e' },
  { id: 'L3战略决策', label: 'L3 战略决策', icon: GraduationCap, color: '#a855f7' },
  { id: '通用办公', label: '📄 通用办公', icon: FileText, color: '#6b7280' },
]

export default function SkillCenter() {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('market')
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)
  const [selectedExpert, setSelectedExpert] = useState<typeof expertSkills[0] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentExpert, setPaymentExpert] = useState<typeof expertSkills[0] | null>(null)
  const { setSelectedSkill: setChatSkill } = useAppStore()

  useEffect(() => {
    if (activeCategory !== 'market') {
      loadSkills(activeCategory)
    }
  }, [activeCategory])

  async function loadSkills(category?: string) {
    setLoading(true)
    try {
      const res: any = await invoke('get_skills_list', { category: category || null })
      setSkills(res || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filteredSkills = skills.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredExperts = expertSkills.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.author.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  function handleUseSkill(skill: SkillItem) {
    setChatSkill(skill.id)
    alert(`已选择 Skill: ${skill.name}\n请切换到「AI 对话」页面开始使用！`)
  }

  // 打开支付弹窗
  function handleBuyExpert(expert: typeof expertSkills[0]) {
    setPaymentExpert(expert)
    setShowPayment(true)
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#fafafa',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", "PingFang SC", sans-serif',
    }}>
      {/* ========== 专家市场视图（默认）========== */}
      {activeCategory === 'market' ? (
        <div style={{ display: 'flex', height: '100%' }}>
          {/* 左侧：专家Skill卡片网格 */}
          <div style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            background: '#ffffff',
          }}>
            {/* 头部 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #57CC86, #3DAA5F)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px',
                }}>🔥</div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#111' }}>专家 Skill 市场</h2>
                  <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>行业名师独家方法论 · 扫码即装即用</p>
                </div>
              </div>

              {/* 搜索框 */}
              <div style={{ position: 'relative', maxWidth: '400px' }}>
                <Search size={16}
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索专家或技能..."
                  style={{
                    width: '100%', paddingLeft: '40px', paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px',
                    border: '1px solid #e5e5e5', borderRadius: '12px', fontSize: '14px',
                    outline: 'none', background: '#fff',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#57CC86')}
                  onBlur={(e) => (e.target.style.borderColor = '#e5e5e5')}
                />
              </div>
            </div>

            {/* 统计条 */}
            <div style={{
              display: 'flex', gap: '16px', marginBottom: '24px',
              padding: '16px 20px', borderRadius: '16px', background: 'linear-gradient(135deg, #FFFDE7, #FFF9C4)',
              border: '1px solid #F9A825',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#111' }}>8</div>
                <div style={{ fontSize: '11px', color: '#666' }}>位行业专家</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(0,0,0,0.08)' }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#111' }}>¥39-59</div>
                <div style={{ fontSize: '11px', color: '#666' }}>定价区间</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(0,0,0,0.08)' }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#111' }}>8740+</div>
                <div style={{ fontSize: '11px', color: '#666' }}>累计销量</div>
              </div>
              <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                <span style={{ fontSize: '13px', color: '#F57C00', fontWeight: 500 }}>
                  💡 购买后永久使用，免费更新
                </span>
              </div>
            </div>

            {/* 专家卡片网格 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}>
              {filteredExperts.map((expert) => (
                <div key={expert.id}
                  onClick={() => setSelectedExpert(expert)}
                  style={{
                    background: '#fff',
                    border: selectedExpert?.id === expert.id ? `2px solid ${expert.color}` : '1px solid #eee',
                    borderRadius: '16px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    boxShadow: selectedExpert?.id === expert.id ? `${expert.color}20 0 4px 16px` : 'none',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedExpert || selectedExpert.id !== expert.id) {
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
                      ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedExpert || selectedExpert.id !== expert.id) {
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                      ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                    }
                  }}
                >
                  {/* 徽章 */}
                  {expert.badge && (
                    <div style={{
                      position: 'absolute', top: '12px', right: '12px',
                      padding: '3px 10px', borderRadius: '20px',
                      fontSize: '11px', fontWeight: 600, color: '#fff',
                      background: expert.color,
                    }}>
                      {expert.badge}
                    </div>
                  )}

                  {/* 头部 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '14px',
                      background: `${expert.color}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px',
                    }}>{expert.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111', marginBottom: 2 }}>{expert.name}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>by {expert.author} · {expert.category}</div>
                    </div>
                  </div>

                  {/* 描述 */}
                  <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.6', marginBottom: '14px' }}>
                    {expert.description}
                  </p>

                  {/* 功能标签 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {expert.features.map(f => (
                      <span key={f} style={{
                        padding: '3px 10px', borderRadius: '8px',
                        fontSize: '11px', color: '#666',
                        background: '#f5f5f5',
                      }}>{f}</span>
                    ))}
                  </div>

                  {/* 底部信息 + 价格 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: '1px solid #f0f0f0', paddingTop: '14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#57CC86' }}>¥{expert.price}</span>
                      <span style={{ fontSize: '12px', color: '#bbb', textDecoration: 'line-through' }}>¥{expert.originalPrice}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#999' }}>
                      <Star size={13} fill="#57CC86" stroke="#57CC86" /> {expert.rating}
                      <span>·</span>
                      <span>{expert.sales}人购买</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* 更多专家占位卡 */}
              <div style={{
                background: '#f9f9f9',
                border: '2px dashed #ddd',
                borderRadius: '16px',
                padding: '32px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }} onClick={() => alert('更多专家即将入驻，敬请期待！')}>
                <GraduationCap size={36} style={{ color: '#ccc', marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#999', marginBottom: '4px' }}>更多专家</div>
                <div style={{ fontSize: '12px', color: '#bbb' }}>持续更新中...</div>
              </div>
            </div>
          </div>

          {/* 右侧：选中专家详情 + 支付区 */}
          <div style={{
            width: '380px', minWidth: '380px',
            background: '#fff', borderLeft: '1px solid #eee',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {selectedExpert ? (
              <>
                {/* 详情头部 */}
                <div style={{
                  background: `linear-gradient(135deg, ${selectedExpert.color}15, transparent)`,
                  padding: '28px 24px 24px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                    <div style={{
                      width: '64px', height: '64px', borderRadius: '18px',
                      background: `${selectedExpert.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '32px',
                    }}>{selectedExpert.avatar}</div>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: '#111' }}>{selectedExpert.author}</div>
                      <div style={{ fontSize: '13px', color: selectedExpert.color, fontWeight: 500 }}>{selectedExpert.category}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '12px', color: '#888' }}>
                        <Star size={12} fill="#57CC86" stroke="#57CC86" /> {selectedExpert.rating}
                        <span style={{ margin: '0 6px' }}>·</span>
                        {selectedExpert.sales} 人已购入
                      </div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#111' }}>
                    {selectedExpert.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.7', margin: 0 }}>
                    {selectedExpert.description}
                  </p>
                </div>

                {/* 包含内容 */}
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
                    📦 包含内容
                  </div>
                  {selectedExpert.features.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 0', borderBottom: i < selectedExpert.features.length - 1 ? '1px solid #f5f5f5' : 'none',
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: '#57CC8620', color: '#B8860B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, flexShrink: 0,
                      }}>{i + 1}</div>
                      <span style={{ fontSize: '13px', color: '#444' }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* 价格 + 购买按钮 — 固定底部 */}
                <div style={{
                  marginTop: 'auto', padding: '20px 24px',
                  borderTop: '1px solid #eee',
                  background: '#fafafa',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: '#111' }}>
                      ¥{selectedExpert.price}
                    </span>
                    <span style={{ fontSize: '15px', color: '#bbb', textDecoration: 'line-through' }}>
                      ¥{selectedExpert.originalPrice}
                    </span>
                    <span style={{
                      marginLeft: 'auto', fontSize: '12px', color: '#22c55e', fontWeight: 600,
                      padding: '3px 8px', borderRadius: '6px', background: '#22c55e10',
                    }}>
                      省¥{selectedExpert.originalPrice - selectedExpert.price}
                    </span>
                  </div>

                  <button
                    onClick={() => handleBuyExpert(selectedExpert)}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #57CC86, #3DAA5F)',
                      border: 'none', color: '#000', fontSize: '15px', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      transition: 'opacity 0.2s', boxShadow: '0 4px 16px rgba(87,204,134,0.35)',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                  >
                    <QrCode size={18} />
                    扫码购买 · 立即安装到 勺子Claw
                  </button>

                  <p style={{ textAlign: 'center', fontSize: '11px', color: '#aaa', marginTop: '10px', margin: '8px auto 0' }}>
                    🔒 安全支付 · 永久使用 · 免费更新
                  </p>
                </div>
              </>
            ) : (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px', textAlign: 'center',
              }}>
                <ShoppingBag size={48} style={{ color: '#ddd', marginBottom: '16px' }} />
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#999', marginBottom: '6px' }}>选择一个专家 Skill</div>
                <div style={{ fontSize: '13px', color: '#bbb' }}>点击左侧卡片查看详情和价格</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========== 传统Skill列表视图（非市场）========== */
        <>
          {/* 顶部搜索 + 分类 */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #eee', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Search size={16} style={{ color: '#aaa' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 Skills... (名称/标签/描述)"
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid #e5e5e5', borderRadius: '10px',
                  fontSize: '14px', outline: 'none', background: '#fafafa',
                }}
              />
            </div>

            {/* 分类Tab */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {categories.filter(c => c.id !== 'market').map((cat) => {
                const Icon = cat.icon
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', borderRadius: '10px',
                      border: activeCategory === cat.id ? `1.5px solid ${cat.color}` : '1px solid #e5e5e5',
                      background: activeCategory === cat.id ? `${cat.color}10` : '#fff',
                      color: activeCategory === cat.id ? cat.color : '#666',
                      fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Icon size={14} />
                    {cat.label}
                  </button>
                )
              })}

              {/* 返回市场的快捷入口 */}
              <button
                onClick={() => setActiveCategory('market')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '10px',
                  border: '1.5px solid #57CC86', background: '#FFFDE7', color: '#B8860B',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                <ShoppingBag size={14} />
                👈 专家市场
              </button>
            </div>
          </div>

          {/* 技能网格 */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '20px 24px',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '14px', alignContent: 'start',
          }}>
            {loading ? (
              <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: '3px solid #eee', borderTopColor: '#57CC86',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            ) : filteredSkills.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: '#999' }}>
                <LayoutGrid size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <div>没有找到匹配的 Skills</div>
              </div>
            ) : (
              filteredSkills.map((skill) => (
                <div key={skill.id}
                  onClick={() => setSelectedSkill(selectedSkill?.id === skill.id ? null : skill)}
                  style={{
                    background: '#fff',
                    border: selectedSkill?.id === skill.id ? '2px solid #57CC86' : '1px solid #eee',
                    borderRadius: '14px',
                    padding: '18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: selectedSkill?.id === skill.id ? '0 4px 16px rgba(87,204,134,0.2)' : 'none',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>{skill.name}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontWeight: 500,
                      background:
                        skill.category.includes('L0') ? '#E6F7EF' :
                        skill.category.includes('L1') ? '#dbeafe' :
                        skill.category.includes('L2') ? '#dcfce7' :
                        skill.category.includes('通用') ? '#f3f4f6' : '#f3e8ff',
                      color:
                        skill.category.includes('L0') ? '#1A7D4E' :
                        skill.category.includes('L1') ? '#2563eb' :
                        skill.category.includes('L2') ? '#16a34a' :
                        skill.category.includes('通用') ? '#6b7280' : '#9333ea',
                    }}>
                      {skill.category.replace(/(部门基础|专项能力|战略决策|核心层)/g, '')}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#666', lineHeight: '1.5', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {skill.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#aaa' }}>
                    <span>v{skill.version}</span>
                    {skill.has_references && <><BookOpen size={10} /><span>参考资料</span></>}
                    <span style={{ marginLeft: 'auto' }}>
                      {skill.tags.slice(0, 2).join(' · ')}
                    </span>
                  </div>

                  {selectedSkill?.id === skill.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUseSkill(skill); }}
                      style={{
                        width: '100%', marginTop: '12px', padding: '10px', borderRadius: '10px',
                        background: '#57CC86', border: 'none', color: '#000',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ✨ 在对话中使用此 Skill
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ========== 支付弹窗 ========== */}
      {showPayment && paymentExpert && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowPayment(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '24px', padding: '36px',
              width: '420px', textAlign: 'center',
              boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
              animation: 'fadeInUp 0.3s ease',
            }}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowPayment(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                width: '32px', height: '32px', borderRadius: '50%',
                border: 'none', background: '#f5f5f5', fontSize: '18px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>

            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{paymentExpert.avatar}</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0' }}>
              {paymentExpert.author} · {paymentExpert.category}
            </h2>
            <p style={{ fontSize: '14px', color: '#666', margin: '0 0 20px 0' }}>
              {paymentExpert.name}
            </p>

            {/* 二维码区域 */}
            <div style={{
              width: '200px', height: '200px', margin: '0 auto 20px',
              borderRadius: '16px', background: '#fff',
              border: '2px dashed #ddd',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '8px',
            }}>
              <QrCode size={64} style={{ color: '#ccc' }} />
              <span style={{ fontSize: '12px', color: '#999' }}>扫码付款</span>
              <span style={{ fontSize: '11px', color: '#bbb' }}>微信/支付宝</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '36px', fontWeight: 800, color: '#57CC86' }}>¥{paymentExpert.price}</span>
              <span style={{ fontSize: '16px', color: '#bbb', textDecoration: 'line-through' }}>¥{paymentExpert.originalPrice}</span>
            </div>

            <div style={{
              padding: '14px 24px', borderRadius: '12px', background: '#FFFDE7',
              fontSize: '13px', color: '#B8860B', marginBottom: '20px',
            }}>
              💰 付款成功后，Skill 将自动安装到你的 勺子Claw 中<br/>
              🔄 后续更新永久免费
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPayment(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid #e5e5e5', background: '#fff',
                  fontSize: '14px', fontWeight: 500, color: '#666', cursor: 'pointer',
                }}
              >取消</button>
              <button
                onClick={() => {
                  alert('支付功能对接中...\n\n实际部署后将接入微信/支付宝扫码支付')
                  setShowPayment(false)
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: 'none', background: '#57CC86', color: '#000',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >确认支付</button>
            </div>
          </div>
        </div>
      )}

      {/* 内联动画样式 */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
