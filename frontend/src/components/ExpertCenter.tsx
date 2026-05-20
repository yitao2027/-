import { useState } from 'react'
import {
  Search,
  Star,
  MessageCircle,
  MapPin,
  Users,
  ChefHat,
  Shield,
  Rocket,
  Calculator,
  Megaphone,
  Link,
  Palette,
  Building,
  Monitor,
  AlertTriangle,
  Network,
  GitBranch,
  DollarSign,
  Scale,
  Plug,
  Package,
  Image as ImageIcon,
  Clock,
  ClipboardCheck,
  BadgeCheck,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════
// ShaoziClaw 专家体系 v4.3 — 按 2026042101 模块分类文档重构
// 来源文档：ShaoziClaw SKILL模块设计与技能分类2026042101.docx
// ═══════════════════════════════════════════════════════════════════════
// ShaoziClaw 16个模块 → 9大专家分类（含图片设计）
// 图片设计模块 → 图片设计专家
// 品牌定位模块 → 品牌策略专家
// 营运服务模块 → 营运总监 + 食品安全管家 + 客服服务专家
// 品牌宣传模块 → 品牌宣传专家 + 菜单工程专家
// 外卖运营模块 → 外卖运营专家
// 法务合规模块 → 法务合规顾问
// 食品安全模块 → 食品安全管家
// 选址评估模块 → 选址评估专家
// 空间设计模块 → 空间设计专家
// 扩张发展模块 → 连锁扩张专家 + 品牌架构专家 + 融资顾问
// 人力资源模块 → 人力资源专家
// 企业文化模块 → 企业文化专家
// 门头优化模块 → 空间设计专家（融合）
// 库存管理模块 → 财务顾问 + 供应链专家
// 门店标准模块 → 营运总监（融合）
// 风水评测模块 → 开店顾问（融合）
// 采购供应模块 → 供应链专家

const EXPERTS = [
  // ─── 🎨 图片设计 ───
  {
    id: 'm0-image-design',
    name: '图片设计专家',
    avatar: '🎨',
    role: 'AI生图 · 多平台适配 · 批量出图',
    color: '#E11D48',
    description: '一键生成全平台合规商用菜品图：上传实拍图→AI智能修图→批量生成美团外卖/抖音/点评/门店展示等多平台专属图片，支持局部微调和批量导出。',
    skills: ['菜品AI精修', '外卖平台配图', '本地生活海报', '门店展示位图', '商圈推广物料'],
    category: 'design',
    moduleName: '图片设计模块',
    icon: ImageIcon,
    greeting: '你好！我是图片设计专家。只需上传一张菜品实拍图，我就能帮你生成适配所有平台的精美商用图。先从建立品牌档案开始吧——你的品牌名称和经营品类是什么？',
  },

  // ─── 🏥 老店增长（Orchestrator工作流） ───
  {
    id: 'm0-old-store-growth',
    name: '老店增长专家',
    avatar: '🚀',
    role: '诊断→增长方案→执行跟踪 全链路',
    color: '#F59E0B',
    description: '老店业绩提升的完整工作流：三步法（找真原因→找真办法→盯真执行）。从用户评价洞察、商圈竞争分析、菜单诊断到增长方案制定，再到任务拆解与日常检查，一站式解决老店增长难题。',
    skills: ['堂食评价洞察', '外卖评价洞察', '商圈竞争分析', '堂食菜单诊断', '外卖菜单诊断', '门店模型诊断', '堂食菜单修改', '外卖菜单修改', '本地生活增长', '外卖平台增长', '惊喜服务设计', '会员活动设计', '任务计划拆解', '门店培训', '日常检查'],
    category: 'ops',
    moduleName: '老店增长模块',
    icon: Rocket,
    greeting: '你好！我是老店增长专家。你的门店开业多久了？目前最大的经营困扰是什么——堂食下滑、外卖单量不足、还是利润太薄？我会帮你一步步找到真正的原因，给出可执行的增长方案。先告诉我你的门店基本情况和最头疼的问题。',
  },

  // ─── 🆕 v4.9.0 三大新专家（排第3-5位）───
  {
    id: 'm21-scientific-scheduling',
    name: '科学排班专家',
    avatar: '📊',
    role: '人效最优 · 时段匹配 · 成本控制',
    color: '#0891B2',
    description: '基于经营数据和人力目标，深度计算最优排班方案：全职/小时工组合、时段人数匹配、备班建议，防止高峰缺人、闲时冗余、爆单崩盘。',
    skills: ['4步排班闭环', '5维人力诊断', '6时段模型', '简易填表模板', '用工成本优化'],
    category: 'org',
    moduleName: '人力资源模块',
    icon: Clock,
    greeting: '你好！我是科学排班专家。"忙时人手不够，闲时人浮于事"——这是大多数餐饮门店的通病。把你一周的营业时段和大概客流情况告诉我，我帮你算出一套既省成本又不误事的排班表。',
  },
  {
    id: 'm22-scientific-ordering',
    name: '科学订货专家',
    avatar: '📦',
    role: 'BOM驱动 · 销量预测 · 安全库存',
    color: '#65A30D',
    description: '基于BOM、销量预测、库存现状和安全备货量，生成精准的周期性订货方案：降低损耗、节约储存空间、减少食材过期风险。',
    skills: ['BOM配方管理', '销量预测模型', '安全库存计算', '5色关键提示', '订货周期优化'],
    category: 'org',
    moduleName: '采购供应模块',
    icon: ClipboardCheck,
    greeting: '你好！我是科学订货专家。"订多了浪费，订少了断货"——很多老板凭感觉订货，一个月光损耗就吃掉好几个点的利润。把你的主要菜品和日均销量告诉我，我帮你建立一套科学的订货体系。',
  },
  {
    id: 'm23-promotion-audit',
    name: '宣传审核专家',
    avatar: '🛡️',
    role: '法务·食安·公关 三维审核',
    color: '#DC2626',
    description: '从法务、食品安全、公关三个维度对餐饮门店的对外宣传内容进行合规性审核：防止广告违规罚款、食安处罚、舆情危机，守住品牌声誉底线。',
    skills: ['法务合规审核', '食品安全审核', '舆情风险评估', '双触发模式', '修改建议方案'],
    category: 'ops',
    moduleName: '品牌宣传模块',
    icon: BadgeCheck,
    greeting: '你好！我是宣传审核专家。"广告法""食安法""反不正当竞争法"——你发的每一条推广内容都在这三把达摩克利斯之剑下。把你准备发布的文案或海报发给我，我帮你过一遍三关。',
  },

  // ─── 品牌定位 ───
  {
    id: 'm1-brand',
    name: '品牌策略专家',
    avatar: '🎯',
    role: '品牌定位 · 视觉锤 · 竞品分析',
    color: '#7C3AED',
    description: '品牌从0到1全案策划：定位方法论、超级符号设计、招牌视觉、竞品差异化、品类占位。',
    skills: ['品牌定位核心法', '超级符号设计', '招牌与视觉系统', '竞品深度分析', '品类战略占位'],
    category: 'brand',
    moduleName: '品牌定位模块',
    icon: Palette,
    greeting: '你好！我是品牌策略专家。你是想做一个新品牌，还是老品牌想升级？先聊聊你的品类和目标客群，我帮你找到最锋利的定位。',
  },

  // ─── 运营服务 ───
  {
    id: 'm3-ops',
    name: '营运总监',
    avatar: '⚙️',
    role: 'QSCV标准 · SOP · 巡店督导',
    color: '#059669',
    description: '建立可复制可执行的门店运营体系：QSCV质量标准、SOP建设、翻台率优化、用餐体验设计。',
    skills: ['QSCV质量体系', '门店SOP标准化', '门店健康诊断', '翻台率坪效优化', '用餐体验设计'],
    category: 'ops',
    moduleName: '营运服务模块',
    icon: ChefHat,
    greeting: '你好！我是营运总监。"凭感觉管店"是大多数老板的通病。告诉我你目前最头疼的运营问题——服务不稳定？出餐慢？还是不知道怎么巡店？我给你一套能落地的标准。',
  },
  {
    id: 'm4-foodsafety',
    name: '食品安全管家',
    avatar: '🛡️',
    role: 'HACCP · 食安检查 · 应急处置',
    color: '#DC2626',
    description: '从采购到餐桌的全流程安全防线：HACCP体系搭建、日常检查SOP、食安事故应急预案。',
    skills: ['HACCP体系搭建', '日常食安检查', '过敏原管理', '病虫害防治', '事故应急处理'],
    category: 'ops',
    moduleName: '食品安全模块',
    icon: Shield,
    greeting: '你好！我是食品安全管家。"不怕检查"应该成为常态，而不是临时抱佛脚。你的门店目前有食安管理体系吗？还是完全靠厨师的经验？',
  },
  {
    id: 'm5-customer',
    name: '客服服务专家',
    avatar: '💬',
    role: '服务SOP · 客诉处理 · 差评回复',
    color: '#DB2777',
    description: '服务标准化+危机化解双引擎：顾客服务SOP、投诉话术库、差评回复策略、VIP服务标准。',
    skills: ['服务标准化SOP', '客诉处理话术', '差评回复策略', 'VIP客户服务', '服务补救挽回'],
    category: 'ops',
    moduleName: '营运服务模块',
    icon: MessageCircle,
    greeting: '你好！我是客服服务专家。一条差评可能毁掉一周的努力，一次完美的服务补救却能收获忠实顾客。你们目前有标准的客诉处理流程吗？',
  },
  {
    id: 'm14-digital',
    name: '数字化运营专家',
    avatar: '💻',
    role: '收银选型 · 数据看板 · 会员数字化',
    color: '#0D9488',
    description: 'SaaS集成的枢纽角色：收银POS选型对比、门店数据看板、线上线下数据打通、数字化工具箱。',
    skills: ['收银系统选型', '数据看板设计', '会员数字化管理', '线上线下打通', '运营工具箱'],
    category: 'ops',
    moduleName: '数字化运营',
    icon: Monitor,
    greeting: '你好！我是数字化运营专家。你现在用什么收银系统？有没有数据看板？很多老板花大价钱买了系统却只用了10%的功能。让我帮你盘点一下。',
  },
  {
    id: 'm15-crisis',
    name: '危机公关专家',
    avatar: '⚡',
    role: '舆情监测 · 危机预案 · 品牌修复',
    color: '#CA8A04',
    description: '最坏情况下做出最好应对：食安事故预案、舆情监测预警、黄金4小时响应、媒体应对，品牌修复。',
    skills: ['食安事故预案', '舆情监测预警', '危机响应SOP', '差评危机化解', '品牌修复重建'],
    category: 'ops',
    moduleName: '危机公关',
    icon: AlertTriangle,
    greeting: '你好！我是危机公关专家。希望你别用到我——但真出事的时候，黄金4小时的应对决定生死。你想先做一套预防预案，还是已经遇到问题了？',
  },

  // ─── 品牌宣传 ───
  {
    id: 'm7-marketing',
    name: '品牌宣传专家',
    avatar: '📢',
    role: '会员私域 · 抖音小红书 · 本地生活',
    color: '#EA580C',
    description: '用最少钱获取最多有效顾客：会员储值积分、私域运营、抖音/小红书内容、达人合作、团购套餐。',
    skills: ['会员体系设计', '私域流量运营', '小红书种草', '抖音短视频策略', '本地生活团购'],
    category: 'marketing',
    moduleName: '品牌宣传模块',
    icon: Megaphone,
    greeting: '你好！我是品牌宣传专家。你想解决的是客流不足、复购率低、还是品牌知名度？不同问题打法完全不同，别盲目跟风投流，先聊清楚你的现状。',
  },
  {
    id: 'm2-menu',
    name: '菜单工程专家',
    avatar: '📋',
    role: '菜单工程 · 定价 · 爆品打造',
    color: '#2563EB',
    description: '把菜单变成"无声推销员"：ABC矩阵分析、心理定价、SKU精简、爆品培育、外卖菜单设计。',
    skills: ['菜单工程ABC矩阵', '定价心理学', '菜品研发流程', '爆品利润款培育', '外卖专属菜单'],
    category: 'marketing',
    moduleName: '品牌宣传模块',
    icon: Star,
    greeting: '你好！我是菜单工程专家。把你的当前菜单发给我，我用ABC矩阵帮你分析哪些是明星款、哪些该淘汰，顺便看看毛利结构是否健康。',
  },

  // ─── 外卖运营 ───
  {
    id: 'm8-waimai',
    name: '外卖运营专家',
    avatar: '🛵',
    role: '美团 · 淘宝闪购 · 京东外卖 三平台总调度',
    color: '#57CC86',
    description: '美团/淘宝闪购/京东外卖三大平台实战技巧：规则合规、起号SOP、活动策略、破限流、申诉。',
    skills: ['三平台规则深度解读', '新店30天起号SOP', '外卖菜单优化', '活动策略设计', '数据分析与优化'],
    category: 'waimai',
    moduleName: '外卖运营模块',
    icon: Package,
    greeting: '你好！我是外卖运营专家。你目前在哪些平台做外卖？一天大概多少单？最大的痛点是什么——曝光不够、转化率低、评分下滑、还是被限流了？',
  },

  // ─── 财务&合规 ───
  {
    id: 'm10-finance',
    name: '财务顾问',
    avatar: '💰',
    role: '成本管控 · 财报解读 · 盈亏分析',
    color: '#4338CA',
    description: '帮餐饮老板算清每一笔账：成本精细化管控、财报解读、库存优化、盈亏平衡点，资金规划。',
    skills: ['成本精细管控', '财务报表解读', '库存周转优化', '开店资金规划', '盈亏平衡分析'],
    category: 'finance',
    moduleName: '财务会计模块',
    icon: Calculator,
    greeting: '你好！我是财务顾问。很多餐饮老板"忙了一年不知道赚了多少"。把你上个月的经营数据给我——营业额，成本大类、人数，我先帮你算一笔明白账。',
  },
  {
    id: 'm19-legal',
    name: '法务合规顾问',
    avatar: '⚖️',
    role: '合同审核 · 劳动法规 · 税务合规',
    color: '#374151',
    description: '风险识别和预防的防火墙：合同审核要点、劳动法规合规、食安法规、知识产权保护、税务要点。',
    skills: ['合同审核清单', '劳动用工合规', '食品安全法规', 'IP保护指南', '税务合规要点'],
    category: 'finance',
    moduleName: '法务合规模块',
    icon: Scale,
    greeting: '你好！我是法务合规顾问。提醒：我提供风险识别和预防建议，重大诉讼还是要请专业律师。但日常经营的90%法律风险，我可以帮你提前排查掉。你最担心哪个方面？',
  },

  // ─── 战略扩张 ───
  {
    id: 'm16-franchise',
    name: '连锁扩张专家',
    avatar: '🏢',
    role: '加盟模式 · 单店模型 · 标准化复制',
    color: '#7C3AED',
    description: '从单店到连锁的完整路径：加盟/直营模式选择、单店盈利模型打造、SOP复制、区域保护规划。',
    skills: ['加盟模式设计', '单店盈利模型', '标准化手册体系', '区域保护规划', '加盟合同审核'],
    category: 'strategy',
    moduleName: '扩张发展模块',
    icon: Network,
    greeting: '你好！我是连锁扩张专家。想做第二家店了？先别急着开——你的第一家店真的具备可复制性吗？让我先用"可复制性体检表"帮你测一测。',
  },
  {
    id: 'm17-multibrand',
    name: '品牌架构专家',
    avatar: '🌳',
    role: '多品牌战略 · 矩阵设计 · 边界管理',
    color: '#0891B2',
    description: '多品牌的顶层设计：多品牌战略规划、品牌矩阵架构，子品牌Launch、品牌组合砍留投优化。',
    skills: ['多品牌战略规划', '品牌矩阵架构', '品牌边界区隔', '子品牌Launch', '品牌组合优化'],
    category: 'strategy',
    moduleName: '扩张发展模块',
    icon: GitBranch,
    greeting: '你好！我是品牌架构专家。做多品牌不是简单的"再开一个牌子"，而是战略级的系统工程。你为什么想做第二个品牌？是想覆盖不同客群，还是同一个客群的不同场景？',
  },
  {
    id: 'm18-capital',
    name: '融资顾问',
    avatar: '📈',
    role: '融资BP · 股权设计 · 估值路演',
    color: '#3DAA5F',
    description: '资本运作全套方案：融资 readiness 自检、商业计划书撰写、股权架构设计、企业估值、路演PPT。',
    skills: ['融资自检准备', '商业计划书BP', '股权架构设计', '企业估值方法', '融资路径规划'],
    category: 'strategy',
    moduleName: '扩张发展模块',
    icon: DollarSign,
    greeting: '你好！我是融资顾问。想找钱了？不管是天使轮还是A轮，投资人最看重三个数字：单店模型、增长速度、可复制性。先把这三件事搞清楚再去见投资人才靠谱。',
  },
  {
    id: 'm13-opening',
    name: '开店顾问',
    avatar: '🚀',
    role: '证照办理 · 团队组建 · 开业策划',
    color: '#65A30D',
    description: '从0到开业的完整指南：资金筹备、证照攻略、设备清单、团队搭建、开业活动、试运营。',
    skills: ['开店120步清单', '证照办理攻略', '设备采购清单', '开业活动策划', '试运营迭代'],
    category: 'strategy',
    moduleName: '开店全流程模块',
    icon: Rocket,
    greeting: '你好！我是开店顾问。准备开新店了？恭喜！开店看似复杂，其实就120个步骤，每一步都有标准答案。你目前走到哪个阶段了？',
  },

  // ─── 组织管理 ───
  {
    id: 'm6-hr',
    name: '人力资源专家',
    avatar: '👥',
    role: '招聘培训 · 薪酬绩效 · 团队文化',
    color: '#9333EA',
    description: '"能招到人、能留住人、能激发人"：招聘策略、KSF薪酬设计、培训体系、劳动合规。',
    skills: ['招聘渠道策略', '面试识人技巧', 'KSF薪酬设计', '培训体系建设', '员工留存激励'],
    category: 'org',
    moduleName: '人力资源模块',
    icon: Users,
    greeting: '你好！我是人力资源专家。餐饮业"人"的问题永远排第一。你们目前离职率大概多少？最缺什么岗位？我先帮你做个诊断。',
  },

  // ─── 空间&选址 ───
  {
    id: 'm11-location',
    name: '选址评估专家',
    avatar: '🧭',
    role: '商圈分析 · 千分评估 · 租金测算',
    color: '#EA580C',
    description: '"位置定生死"的数据化决策：商圈客群画像、人流动线分析、千分法综合评估、竞品密度地图。',
    skills: ['商圈客群画像', '人流动线分析', '租金ROI测算', '选址千分法评估', '实地考察清单'],
    category: 'space',
    moduleName: '选址评估模块',
    icon: MapPin,
    greeting: '你好！我是选址评估专家。餐饮业铁律：位置定生死。你已经有了候选铺位，还是刚开始找？告诉我城市和品类，我用数据和经验帮你把关。',
  },
  {
    id: 'm12-space',
    name: '空间设计专家',
    avatar: '🏗️',
    role: '动线布局 · 装修预算 · 设备选型 · 门头优化',
    color: '#475569',
    description: '每一平米都赚钱的设计：动线规划、装修预算控制、厨房设备选型、坪效最大化、门头引流。',
    skills: ['动线布局规划', '装修预算控制', '设备选型指南', '坪效最大化', '门头引流设计'],
    category: 'space',
    moduleName: '空间设计模块 + 门头优化模块',
    icon: Building,
    greeting: '你好！我是空间设计专家。店面面积多大？做什么品类？座位数计划多少？这些决定了整个设计方案。先聊基本情况，我再给你做动线和预算规划。',
  },
  {
    id: 'm9-supply',
    name: '供应链专家',
    avatar: '🔗',
    role: '采购谈判 · 库存管控 · 成本追踪',
    color: '#0891B2',
    description: '用最合理的价格拿最稳定的品质：供应商四象限评估、议价谈判、库存周转、食材成本追踪。',
    skills: ['供应商评估管理', '采购谈判技巧', '库存周转优化', '食材成本追踪', '进货验收标准'],
    category: 'org',
    moduleName: '采购供应模块',
    icon: Link,
    greeting: '你好！我是供应链专家。你的采购成本还有10-20%的压缩空间。告诉我你主要的食材品类和月采购额，我帮你建立供应商评估和比价体系。',
  },
  {
    id: 'm20-saas',
    name: '系统集成专家',
    avatar: '🔌',
    role: 'SaaS对接 · API集成 · 数据中台',
    color: '#059669',
    description: '勺子Claw生态枢纽：连接收银POS/外卖平台/会员CRM/供应链/财务/人力/舆情等SaaS系统，让AI基于真实数据提供建议。',
    skills: ['收银POS对接', '外卖平台API', '会员CRM打通', '供应链SaaS', '财务软件集成'],
    category: 'space',
    moduleName: '系统集成',
    icon: Plug,
    greeting: '你好！我是系统集成专家。没有SaaS集成，勺子Claw是一位经验丰富的顾问；有集成后，它就是拥有实时数据的超级店长。你想连接哪个系统的数据？',
  },
]

// ═══════════════════════════════════════════════════════════════════════
// ShaoziClaw 专家分类体系 — 按 2026042101 模块文档
// 8大分类（对应ShaoziClaw 15个模块）
// ═══════════════════════════════════════════════════════════════════════
const CATEGORIES = [
  { key: 'all', label: '全部专家', color: '#111827' },
  { key: 'design', label: '图片设计', color: '#E11D48' },
  { key: 'brand', label: '品牌定位', color: '#7C3AED' },
  { key: 'ops', label: '运营服务', color: '#059669' },
  { key: 'marketing', label: '品牌宣传', color: '#EA580C' },
  { key: 'waimai', label: '外卖运营', color: '#57CC86' },
  { key: 'finance', label: '财务&合规', color: '#4338CA' },
  { key: 'strategy', label: '战略扩张', color: '#0891B2' },
  { key: 'org', label: '组织管理', color: '#DB2777' },
  { key: 'space', label: '空间&选址', color: '#475569' },
]

interface ExpertCenterProps {
  onSelectExpert: (expertId: string, greeting: string) => void
}

export default function ExpertCenter({ onSelectExpert }: ExpertCenterProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const getCategoryCount = (key: string) => {
    if (key === 'all') return EXPERTS.length
    return EXPERTS.filter(e => e.category === key).length
  }

  const filteredExperts = EXPERTS.filter(expert => {
    const matchCat = activeCategory === 'all' || expert.category === activeCategory
    if (!searchQuery) return matchCat
    const q = searchQuery.toLowerCase()
    return matchCat && (
      expert.name.includes(q) ||
      expert.role.includes(q) ||
      expert.description.includes(q) ||
      expert.moduleName.includes(q) ||
      expert.skills.some(s => s.toLowerCase().includes(q))
    )
  })

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#FAFAFA',
    }}>
      {/* ─── 头部区：标题 + 搜索 ─── */}
      <div style={{
        padding: '28px 32px 20px',
        background: '#fff',
        borderBottom: '1px solid #EDEDED',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#111827', letterSpacing: '-0.3px' }}>
              👤 专家中心
            </h1>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '6px', marginBottom: 0 }}>
              {EXPERTS.length}位专家 · 按勺子Claw模块分类召唤专属顾问
            </p>
          </div>

          {/* 搜索框 */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9CA3AF',
            }} />
            <input
              type="text"
              placeholder="搜索专家名称或模块..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                fontSize: '13px',
                outline: 'none',
                color: '#1f2937',
                background: '#FAFAFA',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#57CC86'; e.target.style.boxShadow = '0 0 0 3px rgba(87,204,134,0.1)' }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {/* 分类标签栏 */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key
            const count = getCategoryCount(cat.key)
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                style={{
                  padding: '7px 18px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  border: 'none',
                  background: isActive ? cat.color : 'transparent',
                  color: isActive ? '#fff' : '#6B7280',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {cat.label}
                {count > 0 && (
                  <span style={{ marginLeft: '5px', fontSize: '11.5px', opacity: isActive ? 0.85 : 0.6 }}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── 专家卡片网格 ─── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px',
        }}>
          {filteredExperts.map(expert => {
            const isHovered = hoveredId === expert.id
            const catInfo = CATEGORIES.find(c => c.key === expert.category)

            return (
              <div
                key={expert.id}
                onMouseEnter={() => setHoveredId(expert.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('[B008v2] card clicked! id=', expert.id, 'greeting length=', expert.greeting?.length)
                  onSelectExpert(expert.id, expert.greeting)
                }}
                style={{
                  background: '#fff',
                  border: `1px solid ${isHovered ? catInfo?.color || '#DDD6FE' : '#F3F4F6'}`,
                  borderRadius: '16px',
                  padding: '26px 22px 22px',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  boxShadow: isHovered
                    ? `0 12px 32px ${catInfo?.color || '#7C3AED'}15, 0 2px 8px rgba(0,0,0,0.04)`
                    : '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                {/* 模块标签 */}
                <div style={{
                  alignSelf: 'flex-end',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: `${catInfo?.color || '#7C3AED'}12`,
                  color: catInfo?.color || '#7C3AED',
                  border: `1px solid ${catInfo?.color || '#7C3AED'}20`,
                  marginBottom: '12px',
                }}>
                  {expert.moduleName}
                </div>

                {/* 头像 */}
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: `linear-gradient(145deg, ${expert.color}15, ${expert.color}08)`,
                  border: `2px solid ${expert.color}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  marginBottom: '16px',
                  transition: 'all 0.25s',
                  ...(isHovered ? {
                    boxShadow: `0 0 20px ${expert.color}20`,
                    borderColor: `${expert.color}45`,
                  } : {}),
                }}>
                  {expert.avatar}
                </div>

                {/* 名字 */}
                <h3 style={{
                  fontSize: '15.5px',
                  fontWeight: 700,
                  color: '#111827',
                  margin: '0 0 8px',
                  lineHeight: 1.3,
                }}>
                  {expert.name}
                </h3>

                {/* 角色标签 */}
                <span style={{
                  display: 'inline-block',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${expert.color}12, ${expert.color}08)`,
                  color: expert.color,
                  border: `1px solid ${expert.color}20`,
                  marginBottom: '14px',
                }}>
                  {expert.role.split(' · ')[0]}
                </span>

                {/* 描述 */}
                <p style={{
                  fontSize: '12.5px',
                  color: '#6B7280',
                  lineHeight: 1.7,
                  margin: '0 0 16px',
                  flex: 1,
                }}>
                  {expert.description}
                </p>

                {/* 底部分割线 */}
                <div style={{ width: '100%', height: '1px', background: '#F3F4F6', marginBottom: '12px' }} />

                {/* 操作提示 */}
                <div style={{
                  fontSize: '11.5px',
                  color: expert.color,
                  fontWeight: 500,
                  opacity: isHovered ? 1 : 0.55,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                  <MessageCircle size={13} />
                  开始对话
                </div>
              </div>
            )
          })}
        </div>

        {/* 空状态 */}
        {filteredExperts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p style={{ fontWeight: 600, fontSize: '15px', color: '#6B7280', margin: '0 0 6px' }}>没有匹配的专家</p>
            <p style={{ fontSize: '13px', margin: 0 }}>试试其他关键词，或切换分类查看</p>
          </div>
        )}
      </div>
    </div>
  )
}
