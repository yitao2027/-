import { useState, useMemo } from 'react'
import {
  Search, ChevronDown, X, ArrowLeft, Check, Play,
  Palette, Star, ChefHat, Shield, Users, Megaphone,
  Package, Calculator, MapPin, Building, Monitor,
  AlertTriangle, Network, GitBranch, DollarSign, Scale, Plug,
  Wrench, Truck, Store, UserCog, Sparkles,
} from 'lucide-react'

/* ============================================
 * ShaoziClaw 技能市场 v4.3
 * 严格按《ShaoziClaw SKILL模块设计与技能分类2026042101》
 * 167个Skill × 15个ShaoziClaw模块 · 全部中文名+中文说明
 * 设计系统：品牌黄(#57CC86) · 暖白背景
 * ============================================ */

interface SkillItem {
  id: string
  name: string
  desc: string
}

interface ModuleGroup {
  code: string       // 模块编号
  name: string        // 模块中文简称
  fullName: string    // 模块中文全称
  iconName: string    // 图标组件名
  color: string       // 品牌色
  bgColor: string     // 浅色背景
  levelName: string   // 层级名
  skills: SkillItem[]
}

// ═══════════════════════════════════════════
// 全量167个Skill · 严格中文名+中文描述
// ═══════════════════════════════════════════

const SKILL_DATA: ModuleGroup[] = [
  // ── L0 通用工具 ──
  {
    code: 'L0', name: '通用工具', fullName: 'L0 通用工具',
    iconName: 'Wrench', color: '#78909C', bgColor: '#78909C15',
    levelName: 'L0 基础层',
    skills: [
      { id: 'catering-data-analyzer', name: '餐饮数据分析', desc: '多维度数据采集、清洗、分析与可视化呈现，支持经营决策' },
      { id: 'catering-document-generator', name: '餐饮文档生成', desc: '智能生成合同、报告、SOP等餐饮企业常用文档模板' },
      { id: 'catering-knowledge-base', name: '餐饮知识库查询', desc: '连接餐饮行业知识库，解答经营中的专业问题' },
      { id: 'catering-trend-monitor', name: '餐饮热点监测', desc: '实时追踪行业热点、竞品动态、政策变化，第一时间预警' },
      { id: 'ai-catering-toolkit', name: 'AI餐饮工具箱', desc: '集成多款AI工具，覆盖写作、设计、数据分析等日常办公场景' },
    ],
  },

  // ── 模块1：品牌定位 ──
  {
    code: 'M1', name: '品牌定位', fullName: '品牌定位模块',
    iconName: 'Palette', color: '#7C3AED', bgColor: '#7C3AED15',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'L1-brand-positioning', name: '品牌定位分析', desc: '餐饮品牌定位全案策划与诊断。覆盖品牌现状诊断、竞争格局分析、差异化机会识别、定位四步法执行、品牌原型应用与验证固化。' },
      { id: 'category-strategy', name: '品类战略与选择', desc: '餐饮品类战略规划与选择决策支持。覆盖2025-2026热门赛道分析、品类选择决策框架、品类创新方法论（细分/融合/升级/跨界）、品类陷阱识别。' },
      { id: 'super-symbol-implementation', name: '超级符号落地实战', desc: '从定位到符号创作，将差异化主张转化为视觉符号、品牌IP、听觉嗅觉符号的完整落地系统。' },
      { id: 'L2-super-symbol', name: '超级符号创作', desc: '超级符号是降低品牌营销成本的核武器——从定位主张到符号系统的创作方法论。' },
      { id: 'L2-signage-design', name: '门头设计法则', desc: '门头是餐厅的第一广告位，24小时免费流量入口——门头设计从定位到落地的完整法则。' },
      { id: 'brand-positioning', name: '品牌定位全案策划', desc: '特劳特定位理论在餐饮行业的实战应用——从品类选择到差异化落地的全链路服务。' },
    ],
  },

  // ── 模块2：营运服务 ──
  {
    code: 'M2', name: '营运服务', fullName: '营运服务模块',
    iconName: 'ChefHat', color: '#059669', bgColor: '#05966915',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'L1-store-standard', name: '门店标准化运营', desc: 'QSCV四维标准化体系（品质/服务/清洁/价值）的深度落地指南与日常执行手册。' },
      { id: 'store-operations', name: '门店运营标准化体系', desc: '餐饮门店运营标准化体系。覆盖开店/打烊完整SOP、QSCV四维深度落地、值班管理七步法、巡店检查评分卡。' },
      { id: 'L1-opening-checklist', name: '开店筹备清单', desc: '新店开业前必须完成的全流程筹备清单——从证照到人员到物料的系统化检查表。' },
      { id: 'L1-new-product-launch', name: '新品上市推广', desc: '从菜品研发到上市推广的完整流程——新品定位、定价、试销、正式上线的标准化指引。' },
      { id: 'L1-qscv-standard', name: 'QSCV标准化运营', desc: '品质Quality/服务Service/清洁Cleanliness/价值Value四维标准化体系的建设与执行标准。' },
      { id: 'store-manager-training', name: '店长培训与管理', desc: '餐饮店长从入门到精通的完整培训体系。覆盖店长能力模型、每日标准动作、团队管理实务、数据看板、客诉处理SOP。' },
      { id: 'mcdonalds-training-system', name: '麦当劳标准化培训', desc: '全球最强餐饮标准化培训体系的系统解密与落地适配。覆盖汉堡大学培训体系、岗位四步法、SOP编写规范、新人7天融入、值班管理。' },
      { id: 'duty-management-inspection', name: '值班管理与巡检', desc: '餐饮值班管理全流程SOP——从班前准备到班中执行到班后交接的完整操作规范。' },
      { id: 'sop-writing-standard', name: 'SOP编写标准', desc: '如何写出好SOP——SOP编写规范与最佳实践，让标准化文件真正可执行可传承。' },
      { id: 'L2-dining-experience', name: '用餐体验设计', desc: '顾客来吃饭不只是为了填饱肚子，更是为了获得一段愉快的时光——从环境到服务到细节的体验设计系统。' },
      { id: 'L2-table-turn', name: '翻台率优化专项', desc: '翻台率不是靠催促客人"快点吃"实现的，而是通过科学的产品结构、座位管理与时段运营提升翻桌效率。' },
      { id: 'breakfast-operation', name: '早餐时段运营', desc: '早上6点到9点，3小时决定你一天的利润底座——早餐时段的高效运营策略与产品设计。' },
      { id: 'late-night-operation', name: '夜宵时段运营', desc: '晚上10点到凌晨2点，是餐饮最被低估的赚钱时段——夜宵时段模式切换与酒水运营指南。' },
      { id: 'L2-breakfast-operation', name: '餐饮早餐运营', desc: '早餐档口运营全攻略——产品结构、时段人力配置、成本控制与出餐效率优化。' },
      { id: 'L2-late-night-operation', name: '餐饮夜宵运营', desc: '夜宵档口运营全攻略——含酒水管理、客群定位与深夜服务标准。' },
      { id: 'L2-store-health-check', name: '门店全面体检', desc: '用数据给门店做全面"体检"——营业额、客单价、菜品结构、人效、坪效的全维度诊断与改进方案。' },
      { id: 'L2-pitfall-diagnosis', name: '餐饮创业踩坑诊断', desc: '餐饮创业常见100个坑的系统诊断——从选址到产品到运营到财务的全面"排雷"指南。' },
      { id: 'L2-bbq-operations', name: '烧烤品类运营', desc: '烧烤品类专项运营指南——产品结构、腌制工艺、烤制标准化、夏季旺季运营策略。' },
      { id: 'L2-chinese-restaurant-operations', name: '中餐品类运营', desc: '中餐正餐专项运营指南——菜系选择、后厨管理、宴席运营与标准化平衡。' },
      { id: 'L2-fastfood-operations', name: '快餐品类运营', desc: '快餐品类专项运营指南——动线设计、出餐效率、标准化复制与翻台率优化。' },
      { id: 'L2-hotpot-operations', name: '火锅品类运营', desc: '火锅品类专项运营指南——锅底标准化、食材管理、分餐制体验与蘸料运营。' },
      { id: 'L2-teadrink-operations', name: '茶饮品类运营', desc: '茶饮品类专项运营指南——产品配方管理、水果保鲜、季节上新与供应链协同。' },
      { id: 'L2-product-development', name: '产品研发管理', desc: '从市场调研到新品上市的完整菜品研发流程——配方管理、成本控制与标准化落地。' },
      { id: 'L2-canteen-operation', name: '团餐运营', desc: '团餐专项运营指南——菜品结构设计、成本控制、卫生标准与大客户服务。' },
      { id: 'L2-cooking-standard', name: '出餐标准化体系', desc: '后厨出餐标准化全攻略——从配方到操作流程到时间管理的全面规范。' },
      { id: 'L2-kitchen-line', name: '后厨动线设计', desc: '后厨动线科学设计——减少无效移动、提升出餐速度、降低人力浪费的空间布局方法。' },
      { id: 'L2-delivery-only', name: '外卖专营店运营', desc: '纯外卖专营店的特殊运营模式——产品结构、动线设计、成本结构与传统门店的差异化策略。' },
      { id: 'L2-catering-robot', name: '餐饮智能化设备', desc: '餐饮机器人与智能设备的应用指南——炒菜机器人、传菜机器人、自助点餐机的选型与落地。' },
    ],
  },

  // ── 模块3：品牌宣传 ──
  {
    code: 'M3', name: '品牌宣传', fullName: '品牌宣传模块',
    iconName: 'Megaphone', color: '#EA580C', bgColor: '#EA580C15',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'marketing-methodology', name: '餐饮营销系统方法论', desc: '餐饮营销的底层逻辑与系统方法论——从战略到执行的完整营销框架，不是零散的促销技巧。' },
      { id: 'marketing-promotion', name: '营销活动全案策划', desc: '好的营销不是花钱买热闹，是投入产出可计算的精准打击——从诊断到策略到执行到复盘的完整活动策划系统。' },
      { id: 'promotion-toolbox', name: '促销活动百宝箱', desc: '餐饮促销活动全场景工具箱——引流型/提升客单价/清库存/提升复购四大类促销策略与365天营销日历。' },
      { id: 'L2-vip-membership', name: '会员体系设计与私域变现', desc: '帮助餐饮老板从0到1搭建"能赚钱的会员制"——不只是发张卡，而是构建持续增长的客户资产。' },
      { id: 'L2-community-operation', name: '私域运营与社群营销', desc: '把散落在各处的顾客"圈"起来，用社群建立持续互动关系，让每个客户变成回头客+传播者。' },
      { id: 'L2-ai-content', name: 'AI内容创作与运营', desc: '运用AI工具提升餐饮内容创作效率——从文案到图片到视频的规模化内容生产指南。' },
      { id: 'douyin-content-strategy', name: '抖音短视频内容创作', desc: '手机也能拍出获客爆款——餐饮抖音内容创意的实操方法论，内容比设备重要一万倍。' },
      { id: 'douyin-ads-management', name: '抖音广告投放管理', desc: '不会投放的内容创作者，等于在黑屋子里开演唱会——餐饮抖音广告投放的策略与优化。' },
      { id: 'kol-cooperation', name: '达人/KOC合作策略', desc: '达人合作的本质不是"花钱找人"，而是找到与品牌调性匹配的人——达人选择、谈判与合作的完整方法。' },
      { id: 'L1-kol-cooperation', name: '餐饮达人/KOC合作', desc: '餐饮达人合作全攻略——从达人筛选到合作形式到效果评估的标准化流程。' },
      { id: 'L1-local-life-operation', name: '本地生活运营', desc: '美团/抖音/大众点评本地生活平台全链路运营实操——团购套餐、达人探店、直播带货、评分优化。' },
      { id: 'local-life-operation', name: '本地生活运营全案', desc: '餐饮本地生活平台全链路运营实操——团购套餐设计、到店核销管理、达人探店合作、直播带货。' },
      { id: 'xiaohongshu-operation', name: '小红书种草运营', desc: '小红书是餐饮品牌的"种草神器"——从账号定位到内容策略到KOL合作的小红书运营全攻略。' },
      { id: 'L1-xiaohongshu-operation', name: '小红书种草运营', desc: '小红书餐饮品牌种草运营全攻略——内容策略、笔记创作、达人合作与数据优化。' },
      { id: 'L1-douyin-content', name: '抖音短视频内容创作', desc: '餐饮抖音内容创作全攻略——从脚本设计到拍摄剪辑到发布运营的完整指南。' },
      { id: 'L1-promotion', name: '促销活动策划', desc: '餐饮促销活动策划全攻略——引流/转化/复购/客单价各场景的活动设计模板与ROI计算。' },
      { id: 'L2-group-buying', name: '团购运营策略', desc: '餐饮团购运营策略——套餐设计、价格策略、平台选择与团购流量转化为私域资产的方法。' },
      { id: 'L2-holiday-marketing', name: '节日营销日历', desc: '餐饮全年节日营销日历——12个月每个节日的营销策略、备货计划与活动执行指南。' },
      { id: 'L2-off-season-strategy', name: '餐饮淡季策略', desc: '淡季不淡——餐饮淡季的市场策略、产品调整、营销激活与团队训练的完整应对方案。' },
      { id: 'L2-idle-time-marketing', name: '餐饮闲时营销', desc: '大多数餐厅的租金和人工按全天算，但真正赚钱的时间只有几小时——闲时时段营销激活方案。' },
      { id: 'L2-word-of-mouth', name: '口碑传播策略', desc: '最好的营销是让顾客帮你说话——餐饮口碑传播的触发机制、激励机制与社交裂变设计。' },
      { id: 'L2-member-referral', name: '会员裂变与老带新', desc: '老客户带新客户是最便宜最有效的获客方式——会员裂变活动的设计、执行与追踪系统。' },
      { id: 'vip-membership-system', name: 'VIP会员体系', desc: '不只发卡，而是构建持续增长的客户资产——会员体系设计、权益体系、积分系统与会员生命周期管理。' },
      { id: 'membership-marketing-tactics', name: '会员营销打法', desc: '不讲空泛理论，只给拿来即用的具体营销打法——充值方案/优惠券发放/沉默用户唤醒。' },
    ],
  },

  // ── 模块4：食品安全 ──
  {
    code: 'M4', name: '食品安全', fullName: '食品安全模块',
    iconName: 'Shield', color: '#DC2626', bgColor: '#DC262615',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'food-safety', name: '食品安全合规管理', desc: '食安无小事，一次事故足以毁掉一家店——从证照办理到日常运营、从预防体系到应急响应的完整合规管理。' },
      { id: 'L1-food-safety', name: '食品安全合规', desc: '食品安全合规管理全案——证照办理、食安法核心条款、日常三套检查SOP、员工健康证管理、食物中毒预防。' },
      { id: 'food-allergy-management', name: '食物过敏原管理', desc: '一次过敏事故足以毁掉一家店——过敏原识别、标识管理、培训要求与应急处理的完整体系。' },
      { id: 'food-safety-emergency', name: '食安事故应急处理', desc: '食安事故不是"会不会发生"的问题，而是"什么时候发生"的问题——有准备的企业把事故控制在萌芽状态。' },
      { id: 'haccp-implementation', name: 'HACCP体系实施', desc: 'HACCP（危害分析关键控制点）体系在餐饮企业的实施指南——7个原理12个步骤的完整落地。' },
      { id: 'pest-control-system', name: '虫害防治体系', desc: '一只蟑螂毁掉一家店的口碑只需要一条差评视频——虫害防治体系的建立与日常监控标准。' },
      { id: 'safety-training-inspection', name: '安全培训与检查', desc: '餐饮业80%以上的食安问题是"人"的问题——员工培训体系与日常安全检查标准。' },
      { id: 'crisis-sop-monitoring', name: '危机监测SOP', desc: '最好的危机处理是让危机不发生，次好的是危机刚冒头就发现——危机监测体系与预警机制。' },
      { id: 'crisis-statement-sop', name: '危机舆情声明SOP', desc: '危机舆情声明从分类到发布的完整应对指南——黄金4小时响应、声明撰写五要素、四级声明模板。' },
    ],
  },

  // ── 模块5：选址评估 ──
  {
    code: 'M5', name: '选址评估', fullName: '选址评估模块',
    iconName: 'MapPin', color: '#1A7D4E', bgColor: '#1A7D4E15',
    levelName: 'L2 进阶能力',
    skills: [
      { id: 'L1-location-traffic', name: '商圈人流分析', desc: '人流≠客流，会走路的人不一定是会进店的人——精准的人流测算与客流转化分析。' },
      { id: 'location-thousand-score', name: '千分选址法', desc: '选址不对，努力白费——用1000分制量化评估选址的科学决策系统，让每分投入都有据可依。' },
      { id: 'district-assessment', name: '商圈评估实战', desc: '商圈好不好，不是看它"大不大"，而是看它"适不适合你"——系统化的商圈调研与评估方法。' },
      { id: 'footfall-evaluation', name: '人流测算分析', desc: '蹲点计数法、多日对比分析、客群画像、竞争截留——精准人流测算与质量评估的完整方法。' },
      { id: 'site-inspection-checklist', name: '实地考察Checklist', desc: '选址不看铺等于盲婚——签约前必须核验的12大类130+检查项与PASS/FAIL判定标准。' },
      { id: 'rent-negotiation', name: '商铺租金谈判', desc: '谈下1元/平，一年可能省出一名员工工资——商铺租金谈判从准备到签约的完整策略体系。' },
      { id: 'L2-location-thousand-score', name: '千分选址法专项', desc: '千分选址方法论的深度应用——各维度打分标准、加权模型与选址决策树。' },
    ],
  },

  // ── 模块6：空间设计 ──
  {
    code: 'M6', name: '空间设计', fullName: '空间设计模块',
    iconName: 'Building', color: '#1A7D4E', bgColor: '#1A7D4E15',
    levelName: 'L2 进阶能力',
    skills: [
      { id: 'L2-space-efficiency', name: '空间效率设计', desc: '你的房租是固定的，但每平米的产出不是——用数据和科学方法，让每寸空间都产生最大价值。' },
      { id: 'L2-signage-design', name: '门头设计法则', desc: '门头是餐厅的第一广告位，24小时免费流量入口——一个好门头让路过的人进店率提升50-100%。' },
      { id: 'L2-renovation-budget', name: '餐饮装修预算与控制', desc: '90%的餐厅装修都会超支，平均超支率30-50%——用专业方法论把每一分钱都花在刀刃上。' },
      { id: 'L2-utilities-engineering', name: '餐饮水电工程', desc: '餐饮装修水电工程规范——从容量计算到管线布局到设备接电的安全标准与验收要点。' },
    ],
  },

  // ── 模块7：扩张发展 ──
  {
    code: 'M7', name: '扩张发展', fullName: '扩张发展模块',
    iconName: 'Network', color: '#0891B2', bgColor: '#0891B215',
    levelName: 'L2 进阶能力',
    skills: [
      { id: 'L2-new-store-opening', name: '新店筹备与开业引爆', desc: '系统规划新店从选址确定到开业引爆的全流程——确保开业即成功，不浪费任何营销投入。' },
      { id: 'license-permit-guide', name: '证照办理指南', desc: '"证照不全就开业，等于给自己埋地雷"——营业执照、食品经营许可证、消防许可的全流程办理指南。' },
      { id: 'store-opening-sop', name: '开店SOP全流程', desc: '"开一家店不难，难的是在预算内按时高质量地开起来"——新店开业全流程SOP。' },
      { id: 'L2-new-store-opening', name: '新店筹备专项', desc: '新店筹备全流程时间表——从签约到开业的关键里程碑、负责人分配与风险预警。' },
    ],
  },

  // ── 模块8：人力资源 ──
  {
    code: 'M8', name: '人力资源', fullName: '人力资源模块',
    iconName: 'Users', color: '#DB2777', bgColor: '#DB277715',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'hr-management-system', name: '餐饮HR管理体系', desc: '餐饮企业人力资源全流程管理——从"靠人管人"升级到"制度管人"，降低用人风险，提升团队战斗力。' },
      { id: 'staff-management', name: '团队招聘与用工管理', desc: '餐饮团队招聘与用工管理全案——招聘渠道对比、岗位画像、面试题库、试用期管理与劳动用工合规。' },
      { id: 'L1-recruitment', name: '招聘面试助手', desc: '餐饮招聘全攻略——10+招聘渠道效果对比、岗位画像撰写、结构化面试题库与入职首周SOP。' },
      { id: 'L1-labor-cost', name: '人力成本管控', desc: '餐饮人力成本管控——人效指标设计、排班联动优化、灵活用工模式与劳动法合规要点。' },
      { id: 'compensation-design', name: '薪酬绩效设计方案', desc: '餐饮薪酬体系与绩效考核完整方案——底薪/提成/奖金/福利组合逻辑、绩效考核指标设计与晋升通道。' },
      { id: 'staff-scheduling', name: '排班优化系统', desc: '餐饮排班全流程优化——人效最大化原则、不同时段人力配置模型、特殊日期排班与排班软件对比。' },
      { id: 'L2-compensation-design', name: '薪酬激励体系设计', desc: '餐饮薪酬激励体系设计——提成方案/计件制/计时制选择指南与薪酬合规要点。' },
      { id: 'L2-employee-retention', name: '员工留存管理', desc: '招到一个好员工需要2周，培养到熟练需要3个月，失去他只需要一句气话——员工流失分析与留存策略。' },
      { id: 'L2-team-culture', name: '餐饮团队文化建设', desc: '有灵魂的团队才能打硬仗——餐饮团队文化体系建设、价值观塑造与组织凝聚力提升。' },
      { id: 'L2-training-plan', name: '培训体系设计', desc: '麦当劳之所以能全球开4万家店，靠的是一套任何店长都能执行的标准化培训体系——餐饮培训体系设计。' },
    ],
  },

  // ── 模块9：企业文化 ──
  {
    code: 'M9', name: '企业文化', fullName: '企业文化模块',
    iconName: 'Sparkles', color: '#6366F1', bgColor: '#6366F115',
    levelName: 'L3 战略决策',
    skills: [
      { id: 'L2-team-culture', name: '餐饮团队文化建设', desc: '餐饮企业文化建设——核心价值观提炼、行为规范制定、团队活动设计与文化传承机制。' },
      { id: 'store-manager-training', name: '店长领导力培养', desc: '优秀店长是餐饮企业最重要的资产——从管理技能到领导力到经营思维的店长培养体系。' },
      { id: 'L3-boss-leadership', name: '餐饮老板领导力', desc: '老板的高度决定企业的高度——餐饮老板的战略思维、决策能力与领导力提升路径。' },
    ],
  },

  // ── 模块10：门头优化 ──
  {
    code: 'M10', name: '门头优化', fullName: '门头优化模块',
    iconName: 'Store', color: '#10B981', bgColor: '#10B98115',
    levelName: 'L2 进阶能力',
    skills: [
      { id: 'L2-signage-design', name: '门头设计法则', desc: '门头是餐厅的免费广告位——门头设计从品牌定位到材料选择到施工验收的完整指南。' },
      { id: 'L2-space-efficiency', name: '空间坪效优化', desc: '一平米多赚一千块——餐饮空间坪效分析、座位布局优化与翻台率联动策略。' },
    ],
  },

  // ── 模块11：库存管理 ──
  {
    code: 'M11', name: '库存管理', fullName: '库存管理模块',
    iconName: 'Package', color: '#8B5CF6', bgColor: '#8B5CF615',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'inventory-optimization', name: '库存管理与优化', desc: '让库存既不缺货也不过剩——仓储规划、库存分类、订货策略、损耗控制的科学管理体系。' },
      { id: 'L2-inventory-optimization', name: '库存优化与周转管理', desc: '建立科学的库存管理体系——食材损耗控制、先进先出执行、库存周转率提升与滞销品处理。' },
      { id: 'supply-chain-inventory', name: '供应链与库存周转', desc: '从单店库存到供应链网络——跨店调拨、中央厨房配送与供应链全局最优的库存管理。' },
      { id: 'L2-loss-control', name: '食材损耗控制体系', desc: '跑冒滴漏是餐饮最大的隐性成本之一——食材损耗的识别、监控与系统性控制方案。' },
    ],
  },

  // ── 模块12：门店标准 ──
  {
    code: 'M12', name: '门店标准', fullName: '门店标准模块',
    iconName: 'Star', color: '#3DAA5F', bgColor: '#3DAA5F15',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'store-operations', name: '门店运营标准化', desc: '餐饮门店运营标准化体系——QSCV四维深度落地指南、值班管理七步法、巡店检查评分卡、运营数据看板。' },
      { id: 'L1-store-standard', name: 'QSCV标准化运营', desc: 'Quality/Service/Cleanliness/Value四维标准化体系——从总部到门店的标准化执行与督导体系。' },
      { id: 'L1-qscv-standard', name: 'QSCV标准化', desc: 'QSCV标准化运营体系的建设与执行——品控标准、服务流程、卫生规范与价值呈现的统一标准。' },
      { id: 'L2-store-checkup', name: '门店巡检与神秘顾客', desc: '建立系统化的门店巡检体系——明检标准、神秘顾客暗访、问题追踪与改进闭环。' },
    ],
  },

  // ── 模块13：风水评测 ──
  {
    code: 'M13', name: '风水评测', fullName: '风水评测模块',
    iconName: 'GitBranch', color: '#9333EA', bgColor: '#9333EA15',
    levelName: 'L2 进阶能力',
    skills: [
      // 注：风水评测模块为新增模块，当前为占位
      { id: 'site-inspection-checklist', name: '选址环境评估', desc: '餐饮选址环境综合评估——地理位置、周边配套、人流动线与商业风水基础分析（不含迷信内容）。' },
    ],
  },

  // ── 模块14：采购供应 ──
  {
    code: 'M14', name: '采购供应', fullName: '采购供应模块',
    iconName: 'Truck', color: '#475569', bgColor: '#47556915',
    levelName: 'L1 日常运营',
    skills: [
      { id: 'procurement-practice', name: '采购实战指南', desc: '餐饮采购全流程实战指南——供应商寻源评估、谈判技巧、验收标准、成本控制与数字化升级。' },
      { id: 'procurement-supply', name: '采购与供应链管理', desc: '省出来的每一分钱都是纯利润——供应商全生命周期管理、战略采购、价格波动应对与供应链数字化。' },
      { id: 'L1-procurement', name: '采购谈判与供应链', desc: '餐饮采购谈判与供应链管理——供应商准入标准、账期谈判、验收流程与成本控制体系。' },
      { id: 'supply-chain-trends', name: '供应链趋势与策略', desc: '2025-2026餐饮供应链五大趋势（中央厨房/预制菜2.0/短链供应链/可溯源/AI补货）与实战应对策略。' },
      { id: 'supplier-evaluation-matrix', name: '供应商评估矩阵', desc: '供应商选得好，后厨没烦恼——供应商评估矩阵设计、全生命周期管理与淘汰机制。' },
      { id: 'L2-supply-chain-quality', name: '供应链品质管控体系', desc: '建立从源头到门店的食品安全与品质保障全链路管控——验收标准、品质追溯与供应商协同。' },
      { id: 'L2-equipment-procurement', name: '餐饮设备采购', desc: '设备选错，钱白花了——餐饮设备选型、性价比分析、采购合同签订与安装验收指南。' },
      { id: 'L2-negotiation', name: '餐饮谈判技巧', desc: '采购谈判不只是砍价——餐饮采购谈判从准备到签约的完整策略与话术指南。' },
      { id: 'L2-cross-industry-alliance', name: '餐饮异业联盟', desc: '用别人的客户做自己的生意——异业合作的对象选择、合作形式设计与共赢机制建立。' },
      { id: 'quality-inspection-inbound', name: '进货质量验收', desc: '不合格的食材绝不允许进入厨房——进货验收标准、质检流程与不合格品处理规范。' },
    ],
  },

  // ── 模块15：法务合规 ──
  {
    code: 'M15', name: '法务合规', fullName: '法务合规模块',
    iconName: 'Scale', color: '#37474F', bgColor: '#37474F15',
    levelName: 'L3 战略决策',
    skills: [
      { id: 'legal-full-process', name: '餐饮法务全流程', desc: '餐饮企业从开业到闭店的完整法律风险管理——租赁合同陷阱、证照办理、用工合规、食安法规、知识产权、加盟连锁法务。' },
      { id: 'legal-compliance', name: '法律合规专项SOP', desc: '餐饮企业日常法律合规操作标准化手册——合规检查清单、风险识别方法与整改流程。' },
      { id: 'legal-affairs-full-process-enhanced', name: '餐饮法务全流程增强版', desc: '餐饮企业完整法律风险管理体系的增强版——新增合同模板库（租赁/装修/加盟/用工）、最新法规更新。' },
      { id: 'catering-law-basics', name: '餐饮法务基础', desc: '"在中国开餐馆，你不需要成为律师，但你需要知道什么时候该找律师"——餐饮老板必须懂的法律常识。' },
      { id: 'contract-template-library', name: '合同模板库', desc: '餐饮常用合同模板集——租赁合同、采购合同、劳动合同、加盟合同的标准模板与填写指南。' },
      { id: 'labor-arbitration-response', name: '劳动仲裁应对指南', desc: '劳动仲裁不是"运气"，是可以提前预防的系统性风险——仲裁流程、应对策略与合规建议。' },
      { id: 'administrative-penalty-response', name: '行政处罚应对指南', desc: '接到行政处罚通知后的应对全流程——申辩材料撰写、听证程序、行政复议与整改方案。' },
      { id: 'L3-tax-compliance', name: '餐饮财税合规', desc: '帮你从"怕查"到"不怕查"——建立一套经得起检验的财税体系，在合法合规前提下优化税负。' },
      { id: 'L2-catering-tax', name: '餐饮税务筹划', desc: '餐饮企业税务筹划——增值税/所得税/个税的正确处理方式与合规避税方法。' },
      { id: 'L3-franchise-dispute', name: '加盟纠纷处理', desc: '加盟纠纷预防与处理——合同条款解读、常见纠纷类型、协商调解与诉讼应对的完整指南。' },
      { id: 'L2-license-renewal', name: '餐饮证照办理与续期', desc: '证照是餐饮合法经营的生命线——营业执照、食品经营许可证等证照的办理、年检与续期指南。' },
    ],
  },
]

// ═══════════════════════════════════════════
// 额外补充：财务、营销、外卖、数据等模块中
// 未被15大模块覆盖但有价值的专业技能
// ═══════════════════════════════════════════

const EXTRA_SKILLS: SkillItem[] = [
  // 外卖运营
  { id: 'L1-delivery-basics', name: '外卖运营基础', desc: '外卖运营基础知识——平台选择、开店流程、日常运营基础与常见问题处理。' },
  { id: 'L1-meituan-rules', name: '美团外卖平台规则', desc: '美团外卖平台规则权威解读——入驻流程、违规处罚、评分管理、活动规则的完整指南。' },
  { id: 'L1-jingdong-waimai-rules', name: '京东外卖平台规则', desc: '京东外卖平台规则权威解读——入驻要求、评分体系、违规处置与特色玩法。' },
  { id: 'L1-taobaoshangou-rules', name: '淘宝闪购平台规则', desc: '淘宝闪购（原饿了么）平台规则权威解读——阿里系即时零售双层规则体系。' },
  { id: 'L2-waimai-operation', name: '外卖精细化运营', desc: '外卖精细化运营——三大平台（美团/饿了么/京东）差异化运营策略与数据优化。' },
  { id: 'cross-platform-strategy', name: '三平台对比选择', desc: '美团/淘宝闪购/京东外卖三平台全面对比——基于114份官方文档的选平台决策模型。' },
  { id: 'jingdong-waimai', name: '京东外卖运营', desc: '京东外卖运营全攻略——京东好店认证、品质心智建设、Plus会员运营与京东生态联动。' },
  { id: 'taobaoshou-guide', name: '淘宝闪购运营指南', desc: '淘宝闪购运营全攻略——基于39份官方规则文档的平台运营与合规管理指南。' },
  { id: 'waimai-operation-system', name: '外卖运营实战系统', desc: '外卖不是堂食的"线上版"——外卖是独立生意，需要完全不同的产品结构、定价策略和运营打法。' },
  { id: 'waimai-compliance', name: '外卖平台合规运营', desc: '把41份官方规则文档变成"能直接帮老板省钱/避免罚款/提升排名"的实战手册。' },
  { id: 'waimai-consultation-diagnostic', name: '外卖诊断咨询', desc: '好的咨询不是"你问我答"，而是用系统化方法快速找到根因，给出可执行的方案。' },
  { id: 'waimai-menu-diagnostic', name: '外卖菜单诊断', desc: '你的菜单会说话——输入外卖店数据，从结构/定价/曝光/转化四维度全面诊断菜单问题。' },
  { id: 'waimai-activity-strategy', name: '外卖活动策略', desc: '活动不是降价——好的活动让顾客觉得赚了，同时你还有合理的利润。' },

  // 客户服务
  { id: 'customer-service', name: '客户投诉处理全案', desc: '把每一次投诉变成建立忠诚度的机会——30秒分级、全类型话术库、退赔偿标准与差评管理全链路。' },
  { id: 'L1-customer-complaint', name: '顾客投诉处理', desc: '餐饮顾客投诉处理与差评挽回——分级诊断、话术库、投诉升级路径与NPS提升闭环。' },
  { id: 'L1-service-mot', name: '顾客服务MOT设计', desc: '关键时刻（MOT）是餐饮服务体验的峰值设计——服务触点梳理、峰值体验设计与标准话术。' },
  { id: 'L2-customer-voice', name: '顾客之声系统', desc: '建立系统化的顾客反馈收集、分析与转化体系——将顾客声音转化为经营改进动力。' },
  { id: 'L2-dianping-management', name: '大众点评运营', desc: '大众点评运营全攻略——星级提升、好评引导、差评处理、必吃榜策略与榜单维护。' },
  { id: 'dianping-mastery', name: '大众点评精通', desc: '你的线上门面就是你的第二家店——在顾客推开门之前，他们已经通过点评决定了要不要来。' },
  { id: 'negative-review-recovery', name: '差评挽回全案', desc: '每一家餐饮店都会遇到差评，区别不在于"有没有"，而在于"怎么接"——差评处理与顾客挽回完整指南。' },
  { id: 'review-reputation-management', name: '口碑声誉管理', desc: '差评要会处理，好评更要会经营——线上口碑的系统化管理与品牌声誉维护。' },
  { id: 'customer-voice-analysis', name: '客户声音分析', desc: '每一个差评都是免费的改进顾问，每一句夸奖都是可复制的成功模板——客户声音深度分析。' },

  // 财务管控
  { id: 'accounting-system', name: '财务会计体系', desc: '餐饮财务会计完整体系——科目设置、日清月结、成本核算、报表解读与经营健康度诊断。' },
  { id: 'fn-cost-control', name: '成本精细化管控', desc: '餐饮成本精细化管控全案——采购五控法、标准成本卡、人力成本管控、租金能耗优化与降本ROI排序。' },
  { id: 'L1-cost-control', name: '食材成本管控', desc: '食材成本管控——采购五控法、标准成本卡、净料率追踪与损耗控制体系。' },
  { id: 'fn-financial-report', name: '财务报表解读', desc: '餐饮财务报表解读与经营分析——资产负债表/利润表/现金流量表解读与经营决策支持。' },
  { id: 'cash-flow-management', name: '现金流管理体系', desc: '"银行账户里的余额，比财务报表上的净利润更诚实"——现金流预测、缺口预警与应急应对方案。' },
  { id: 'L1-cash-flow', name: '现金流管理', desc: '餐饮现金流管理——周/月滚动预测、应付/应收账款管理、账期优化与现金缺口预警。' },
  { id: 'L1-fund-planning', name: '开店资金筹划', desc: '在花真金白银之前，先把账算清楚——开店总投资预算、资金来源规划与回本周期测算。' },
  { id: 'L1-settlement-analysis', name: '盈亏平衡分析', desc: '我的店到底能不能赚钱？——盈亏平衡点测算、经营杠杆分析与经营安全边际评估。' },
  { id: 'store-profit-model', name: '单店盈利模型计算器', desc: '在花真金白银开店之前，用数据回答"这店能赚多少钱、要亏多少、多久回本"四个核心问题。' },
  { id: 'data-dashboard', name: '餐饮经营数据看板', desc: '凭直觉做决定的老板和靠数据做决定的老板，区别不在于谁更聪明，而在于谁活得更久。' },
  { id: 'L1-data-dashboard', name: '餐饮经营数据看板', desc: '餐饮日常经营数据看板与分析体系——核心指标定义、日报/周报/月报模板与异常预警机制。' },
  { id: 'data-dashboard-designer', name: '经营分析数据仪表盘', desc: '餐饮经营数据指标体系与数据看板设计——指标定义、数据采集规范、看板布局设计与BI工具选型。' },
  { id: 'L1-digital-operation', name: '舆情监测分析', desc: '餐饮全网舆情监测——平台选择、关键词策略、预警机制与负面舆情应对流程。' },
  { id: 'L2-digital-transformation', name: '餐饮数字化转型', desc: '规划并实施餐饮企业数字化升级路径——从传统运营走向数据驱动，从经验主义到数据决策。' },
  { id: 'private-domain-scrm', name: '私域SCRM搭建', desc: '平台流量越来越贵，私域不是"可选项"，而是"生存项"——私域搭建从0到1的全链路指南。' },
  { id: 'member-system-setup', name: '会员体系搭建', desc: '开发一个新客户的成本是维护老客户的5-7倍——会员体系搭建、权益设计与生命周期运营。' },
  { id: 'pos-selection-guide', name: 'POS系统选型', desc: 'POS系统是餐饮店的大脑——选错了，每天都要为这个错误买单。选型标准与避坑指南。' },
  { id: 'data-dashboard-guide', name: '数据看板搭建指南', desc: '从数据采集到看板搭建到分析决策——餐饮BI系统建设的完整方法论与工具推荐。' },
  { id: 'data-dashboard-setup', name: '数据看板可视化搭建', desc: '可视化看板构建器——拖拽式数据看板搭建，零门槛做数据分析与经营可视化呈现。' },

  // 危机公关
  { id: 'L1-crisis-pr', name: '危机公关预案', desc: '危机公关预案体系建设——危机信号识别、响应流程、声明发布与舆情闭环管理。' },
  { id: 'L2-brand-recovery', name: '品牌修复与危机重生', desc: '危机不是终点，而是转折点——品牌受损评估、五阶段修复路线图与口碑修复实战六法。' },
  { id: 'L2-public-opinion-monitoring', name: '餐饮舆情监测', desc: '餐饮品牌全网舆情监测体系——7大平台监测、四级预警体系与黄金4小时危机响应checklist。' },
  { id: 'brand-communication', name: '品牌传播管理', desc: '品牌不是你说了算的，是消费者之间说了算的——品牌传播矩阵、口碑管理与舆情应对策略。' },
  { id: 'L3-crisis-plan', name: '餐饮危机预案体系', desc: '餐饮危机预案体系建设——危机分类、响应等级、处置流程与复盘改进机制。' },

  // 战略决策
  { id: 'business-model-design', name: '商业模式设计', desc: '餐饮商业模式设计与优化——10种已验证的餐饮商业模式与画布9要素的实战应用。' },
  { id: 'L3-multi-store-management', name: '多店管理', desc: '从"管好一家店"到"管好N家店"——标准化、督导体系与数据驱动的多店管理模式。' },
  { id: 'L3-regional-expansion', name: '区域扩张战略', desc: '制定科学的区域扩张战略——市场选择、节奏把控与有质量的规模化增长路径。' },
  { id: 'L2-multi-brand', name: '多品牌战略与管理', desc: '一个品牌打天下是理想，但现实往往需要多管齐下——何时做第二品牌、怎么做而不"左手打右手"。' },
  { id: 'L2-franchise-design', name: '加盟体系设计', desc: '赋能餐饮品牌从直营向加盟规模化扩张——加盟模式选择、体系设计、加盟商招募与管控。' },
  { id: 'L2-franchise-control', name: '加盟商管控', desc: '加盟是把双刃剑——加盟商管控体系、督导制度、违规处理与退出机制设计。' },
  { id: 'L2-area-protection', name: '区域保护政策', desc: '加盟的区域保护政策设计——保护范围设定、保护强度执行与窜货管控机制。' },
  { id: 'franchise-five-steps', name: '特许经营五步法', desc: '从0到100家特许经营体系的完整路线图——五步法体系设计与关键里程碑规划。' },
  { id: 'franchise-legal-cases', name: '特许经营法律风险45案', desc: '特许经营全生命周期法律风险防范——45个真实案例深度剖析与避坑指南。' },
  { id: 'competitor-analysis', name: '竞品分析方法论', desc: '系统化地识别、追踪、分析餐饮竞争对手——竞品地图、SWOT分析与差异化策略输出。' },
  { id: 'laojiji-ipo-casebook', name: '老乡鸡IPO案例库', desc: '中式快餐资本化路径深度拆解——老乡鸡从区域快餐到IPO的完整进化史与关键决策分析。' },
  { id: 'L3-brand-strategy', name: '品牌战略与资产管理', desc: '制定长期品牌战略——品牌资产积累、品牌延伸规则与品牌健康度评估体系。' },
  { id: 'L3-category-strategy', name: '品类战略决策', desc: '品类战略层面的深度决策——品类生命周期判断、品类边界定义与品类创新战略。' },
  { id: 'L3-competitive-strategy', name: '竞争战略制定', desc: '竞争战略的制定与执行——竞争定位、竞争策略选择与动态竞争应对机制。' },
  { id: 'L3-brand-licensing', name: '品牌授权与联名', desc: '品牌授权与联名合作——IP联名决策、授权合同设计、品牌保护与收益分成模式。' },
  { id: 'sub-brand-positioning', name: '子品牌定位方法', desc: '多品牌战略下的子品牌架构与定位——母子品牌关联、资源共享边界与区隔策略。' },

  // 融资资本
  { id: 'L3-investment-model', name: '餐饮投资模型', desc: '构建科学的餐饮项目投资评估模型——单店模型、连锁扩张模型与投资回报测算。' },
  { id: 'L3-capital-strategy', name: '餐饮资本运作', desc: '帮你回答"要不要融钱？什么时候融？找谁融？怎么融？"——餐饮资本运作完整作战地图。' },
  { id: 'L3-equity-design', name: '餐饮股权设计', desc: '把"兄弟式合伙"升级为"规则化合伙"——股权结构设计、合伙人机制与退出条款。' },
  { id: 'L3-financing-negotiation', name: '餐饮融资谈判', desc: '从"要不要融资"到"签下有利条款"——餐饮融资谈判从准备到签约的完整攻略。' },
  { id: 'L3-exit-planning', name: '餐饮退出与资产处置', desc: '帮你体面地、最大化价值地从餐饮生意中全身而退——主动转型或被动止损的最优退出路径。' },
  { id: 'L3-exit-strategy', name: '餐饮退出战略', desc: '如果说融资是"上车"，那退出就是"下车"——最合适的时间点、最好价格、最体面的方式。' },
  { id: 'L3-brand-valuation', name: '餐饮品牌估值', desc: '帮你回答"我的品牌到底值多少钱"——品牌估值方法与在融资/加盟/转让中的应用。' },
  { id: 'L3-franchise-strategy', name: '加盟战略决策', desc: '为餐饮品牌制定科学系统的加盟扩张战略——平衡扩张速度与品牌质量的最优路径。' },
  { id: 'L3-talent-strategy', name: '人才战略与组织发展', desc: '制定餐饮企业人才战略——关键岗位人才画像、引进策略、梯队建设与组织能力构建。' },
  { id: 'L2-investor-relation', name: '投资人与股东关系', desc: '融资只是开始，与投资人/股东的长期共处才是真正的考验——IR管理体系建设。' },
  { id: 'investment-readiness', name: '投资准备度评估', desc: '准备好融资了吗？——融资准备度评估、商业计划书撰写与投资人沟通策略。' },
  { id: 'equity-design', name: '股权设计方案', desc: '"大多数餐饮合伙关系的结束不是因为生意不好，而是因为当初没说清楚怎么分钱"——股权设计实战。' },

  // SaaS系统集成
  { id: 'saas-integration', name: 'SaaS系统集成指南', desc: '餐饮SaaS系统的"万能转接头"——如何把ShaoziClaw与POS/外卖平台/会员CRM/供应链系统打通。' },
]

// 总技能数（15大模块 + 额外技能）
const MODULE_TOTAL = SKILL_DATA.reduce((sum, m) => sum + m.skills.length, 0)
const EXTRA_COUNT = EXTRA_SKILLS.length

// 图标映射
const ICON_MAP: Record<string, any> = {
  Palette, Star, ChefHat, Shield, Users, Megaphone,
  Package, Calculator, MapPin, Building, Monitor,
  AlertTriangle, Network, GitBranch, DollarSign, Scale, Plug,
  Wrench, Truck, Store, UserCog, Sparkles,
}

// 层级颜色
const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  'L0 基础层':   { bg: '#37474F15', text: '#607D8B' },
  'L1 日常运营': { bg: '#2196F315', text: '#2196F3' },
  'L2 进阶能力': { bg: '#9C27B015', text: '#9C27B0' },
  'L3 战略决策': { bg: '#F4433615', text: '#F44336' },
  'L4 生态对接': { bg: '#00796B15', text: '#00796B' },
}

interface SkillsPageProps {
  onSkillSelect: (skillName: string) => void
}

export default function SkillsPage({ onSkillSelect }: SkillsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['M2']))
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('modules')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)

  // 🔥 新增：详情视图模式
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')
  const [detailSkill, setDetailSkill] = useState<SkillItem | null>(null)
  const [detailFromExtra, setDetailFromExtra] = useState(false)  // 标记是否来自专项技能库

  const toggleModule = (code: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }

  // 🔥 新增：查找技能所属模块
  const findSkillModule = (skillId: string): ModuleGroup | undefined => {
    return SKILL_DATA.find(m => m.skills.some(s => s.id === skillId))
      || EXTRA_SKILLS.find(s => s.id === skillId) ? { code: 'EXTRA', name: '专项技能库', fullName: '专项技能库', iconName: 'Package', color: '#6366F1', bgColor: '#6366F115', levelName: '专项技能', skills: EXTRA_SKILLS } : undefined
  }

  // 🔥 新增：进入技能详情
  const handleSkillClick = (skill: SkillItem, isExtra = false) => {
    setDetailSkill(skill)
    setDetailFromExtra(isExtra)
    setViewMode('detail')
    setSelectedSkill(skill.id)  // 同时高亮选中
  }

  // 🔥 新增：返回列表
  const handleBackToList = () => {
    setViewMode('list')
    setDetailSkill(null)
    setSelectedSkill(null)
  }

  // 🔥 新增："试一试" → 切换到Claw聊天并注入skill
  const handleTrySkill = () => {
    if (detailSkill) {
      onSkillSelect(detailSkill.id)
      // 导航由onSkillSelect回调处理（App.tsx中已设置为setCurrentPage('chat')）
    }
  }

  // 过滤后的模块数据
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return SKILL_DATA
    const q = searchQuery.toLowerCase()
    return SKILL_DATA.map(m => ({
      ...m,
      skills: m.skills.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      )
    })).filter(m => m.skills.length > 0)
  }, [searchQuery])

  // 过滤后的额外技能
  const filteredExtra = useMemo(() => {
    if (!searchQuery.trim()) return EXTRA_SKILLS
    const q = searchQuery.toLowerCase()
    return EXTRA_SKILLS.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const visibleCount = filteredModules.reduce((s, m) => s + m.skills.length, 0)
  const visibleExtraCount = filteredExtra.length

  // 快速标签
  const quickTags = [
    { key: '全部', tag: '' },
    { key: '品牌', tag: '品牌' },
    { key: '运营', tag: '运营' },
    { key: '营销', tag: '营销' },
    { key: '外卖', tag: '外卖' },
    { key: '食安', tag: '食安' },
    { key: '财务', tag: '财务' },
    { key: '选址', tag: '选址' },
    { key: '人力', tag: '人力' },
    { key: '法务', tag: '法务' },
    { key: '采购', tag: '采购' },
  ]

  return (
    <div className="h-full flex flex-col"
         style={{ background: '#FAFAFA', color: '#374151', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ═══ Header ═══ */}
      <div style={{ padding:'24px 28px 16px', borderBottom:'1px solid #EDEDED' }}>
        {/* 标题行 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <h1 style={{ fontSize:'22px', fontWeight:700, margin:0, color:'#111827', letterSpacing:'-0.02em' }}>技能市场</h1>
            <span style={{
              fontSize:'11px', color:'#57CC86', background:'#E6F7EF',
              padding:'3px 8px', borderRadius:'4px', fontWeight:600,
              border:'1px solid #B8E6CD'
            }}>v4.3</span>
          </div>
          <span style={{ fontSize:'13px', color:'#6B7280', background:'#F3F4F6', padding:'4px 12px', borderRadius:'6px' }}>
            {MODULE_TOTAL}个专业Skill + {EXTRA_COUNT}个专项技能
          </span>
        </div>

        {/* 搜索栏 */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'14px' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={16} style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }} />
            <input value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              placeholder="搜索技能名称或描述……"
              style={{
                width:'100%', paddingLeft:'40px', paddingRight:'12px', paddingBlock:'10px',
                borderRadius:'10px', border:'1px solid #E5E7EB', background:'#FAFAFA',
                color:'#374151', fontSize:'13.5px', outline:'none',
                transition:'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e)=>{ e.target.style.borderColor='#57CC8680'; e.target.style.boxShadow='0 0 0 3px rgba(87,204,134,0.1)' }}
              onBlur={(e)=>{ e.target.style.borderColor='#E5E7EB'; e.target.style.boxShadow='none' }}
            />
            {searchQuery && (
              <button onClick={()=>setSearchQuery('')}
                style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)',
                  background:'#E5E7EB', border:'none', borderRadius:'50%', width:'20px', height:'20px',
                  color:'#6B7280', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 快速标签 */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {quickTags.map(({ key, tag }) => {
            const isActive = !tag && !searchQuery || searchQuery === tag
            return (
              <button key={key}
                onClick={()=>setSearchQuery(tag)}
                style={{
                  padding:'4px 12px', borderRadius:'6px', fontSize:'11.5px', fontWeight:500,
                  border:`1px solid ${isActive ? '#57CC8660' : '#E5E7EB'}`,
                  background: isActive ? '#E6F7EF10' : '#F3F4F6',
                  color: isActive ? '#1A7D4E' : '#777',
                  cursor:'pointer', transition:'all 0.15s',
                }}>
                {key}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ 主内容区 ═══ */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>

        {/* ════════════ 技能详情视图（新增） ════════════ */ }
        {viewMode === 'detail' && detailSkill ? (
          <div style={{ maxWidth:'680px', margin:'0 auto', animation:'fadeIn 0.25s ease-out' }}>
            {/* 返回导航条 */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', cursor:'pointer' }}
              onClick={handleBackToList}>
              <div style={{
                width:32, height:32, borderRadius:8,
                background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center',
                color:'#666', transition:'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background='#e8e8ea'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}>
                <ArrowLeft size={16} />
              </div>
              <span style={{ fontSize:'14px', fontWeight:500, color:'#374151' }}>返回技能列表</span>
              <span style={{ fontSize:'12px', color:'#9CA3AF' }}>· 点击卡片查看详情</span>
            </div>

            {/* 详情卡片 */}
            <div style={{
              background:'#fff', borderRadius:'16px', border:'1px solid #E5E7EB',
              overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.06)',
            }}>
              {/* 头部：模块信息 + 技能名 */}
              {(() => {
                const mod = findSkillModule(detailSkill.id)
                const IconComp = mod ? ICON_MAP[mod.iconName] || Star : Star
                return (
                  <div style={{
                    background: mod ? `${mod.bgColor}` : '#f0f4ff',
                    padding:'24px 28px', borderBottom:'1px solid #E5E7EB',
                    display:'flex', alignItems:'center', gap:'14px',
                  }}>
                    <div style={{
                      width:48, height:48, borderRadius:'12px',
                      background: mod ? mod.color : '#6366F1',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      flexShrink:0,
                    }}>
                      <IconComp size={22} style={{ color:'#fff' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <h2 style={{ fontSize:'18px', fontWeight:700, color:'#111827', margin:0, lineHeight:'1.3' }}>
                          {detailSkill.name}
                        </h2>
                        {mod && (
                          <span style={{
                            padding:'3px 10px', borderRadius:'6px', fontSize:'11px',
                            fontWeight:600, background: mod.bgColor, color: mod.color,
                          }}>
                            {mod.code} · {mod.name}
                          </span>
                        )}
                        {!mod && (
                          <span style={{
                            padding:'3px 10px', borderRadius:'6px', fontSize:'11px',
                            fontWeight:600, background:'#F3F4F6', color:'#6366F1',
                          }}>
                            专项技能
                          </span>
                        )}
                      </div>
                      {mod && (
                        <p style={{ fontSize:'12px', color:'#888', margin:0 }}>{mod.fullName} · {mod.levelName}</p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* 主体内容 */}
              <div style={{ padding:'24px 28px' }}>
                {/* 技能描述 */}
                <div style={{ marginBottom:24 }}>
                  <h3 style={{ fontSize:'13px', fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em',
                    margin:'0 0 12px 0', display:'flex', alignItems:'center', gap:6 }}>
                    📋 技能介绍
                  </h3>
                  <p style={{ fontSize:'15px', color:'#374151', lineHeight:'1.7', margin:0,
                    whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                    {detailSkill.desc}
                  </p>
                </div>

                {/* 应用场景 */}
                <div style={{ marginBottom:24 }}>
                  <h3 style={{ fontSize:'13px', fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em',
                    margin:'0 0 12px 0', display:'flex', alignItems:'center', gap:6 }}>
                    🎯 应用场景
                  </h3>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {(detailSkill.desc.match(/[^，。！？]/g)?.slice(0, 4).map((keyword, i) => keyword && (
                      <span key={i} style={{
                        padding:'5px 12px', borderRadius:'16px',
                        background:'#E6F7EF10', color:'#1A7D4E', fontSize:'12px',
                        fontWeight:500, border:'1px solid #B8E6CD',
                      }}>
                        {keyword.trim()}
                      </span>
                    )) || (
                      <span style={{
                        padding:'5px 12px', borderRadius:'16px',
                        background:'#F3F4F6', color:'#666', fontSize:'12',
                      }}>餐饮运营</span>
                    ))}
                  </div>
                </div>

                {/* 擅长任务 */}
                <div style={{ marginBottom:24 }}>
                  <h3 style={{ fontSize:'13px', fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em',
                    margin:'0 0 12px 0', display:'flex', alignItems:'center', gap:6 }}>
                    ⚡ 擅长完成
                  </h3>
                  <div style={{
                    background:'#FAFAFB', borderRadius:'10px', padding:'16px',
                    border:'1px solid #F0F0F0',
                  }}>
                    <div style={{ fontSize:'13px', color:'#444', lineHeight:'1.8' }}>
                      • 调用该领域专业 Skill 进行深度分析<br/>
                      • 基于真实行业知识库提供可执行建议<br/>
                      • 自动适配您的店铺档案上下文<br/>
                      • 支持多轮追问与方案细化
                    </div>
                  </div>
                </div>

                {/* 元数据 */}
                <div style={{
                  display:'flex', gap:'12px', fontSize:'11.5px', color:'#AAA',
                  paddingTop:'16px', borderTop:'1px solid #F5F5F5',
                  flexWrap:'wrap',
                }}>
                  <span>📦 ID: <code style={{background:'#f5f5f5', padding:'2px 6px', borderRadius:4}}>{detailSkill.id}</code></span>
                  <span>🏷️ 类型: {detailFromExtra ? '专项技能' : (findSkillModule(detailSkill.id)?.levelName || '通用')}</span>
                </div>

                {/* 🔥 CTA按钮组 */}
                <div style={{
                  display:'flex', gap:'12px', marginTop:'8px', paddingTop:'20px',
                  borderTop:'1px solid #F0F0F0',
                }}>
                  <button
                    onClick={handleTrySkill}
                    style={{
                      flex:1, height:48, borderRadius:'12px',
                      border:'none', background:'linear-gradient(135deg, #57CC86, #3DAA5F)',
                      color:'#fff', fontSize:'15px', fontWeight:700,
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                      gap:8, transition:'opacity 0.15s', boxShadow:'0 4px 16px rgba(87,204,134,0.25)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                  >
                    <Play size={18} />
                    去试试这个技能
                  </button>
                  <button
                    onClick={handleBackToList}
                    style={{
                      height:48, paddingLeft:20, paddingRight:20, borderRadius:'12px',
                      border:'1px solid #E5E7EB', background:'#fff',
                      color:'#666', fontSize:'14px', fontWeight:500,
                      cursor:'pointer', display:'flex', alignItems:'center', gap:'6px',
                    }}
                  >
                    <ArrowLeft size={16} />
                    浏览其他
                  </button>
                </div>
              </div>
            </div>

            {/* 底部提示 */}
            <p style={{ textAlign:'center', fontSize:'12', color:'#BBB', marginTop:16 }}>
              💡 切换到「Claw聊天」自动激活此技能，直接开始对话
            </p>
          </div>
        ) : (

        /* ════════════ 原有列表视图 ════════════ */
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>

          {filteredModules.length === 0 && filteredExtra.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <p style={{ fontSize:'14px', color:'#6B7280', marginBottom:'12px' }}>没有找到匹配的技能</p>
              <button onClick={()=>setSearchQuery('')}
                style={{ color:'#57CC86', background:'none', border:'none', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>
                清除筛选条件
              </button>
            </div>
          )}

          {/* ── 15大模块 ── */}
          {filteredModules.map((mod) => {
            const IconComp = ICON_MAP[mod.iconName] || Star
            const isExpanded = expandedModules.has(mod.code)
            const lc = LEVEL_COLORS[mod.levelName] || LEVEL_COLORS['L1 日常运营']

            return (
              <div key={mod.code}
                style={{
                  borderRadius:'12px', overflow:'hidden',
                  background:'#fff', border:'1px solid #EDEDED',
                  transition:'border-color 0.2s'
                }}>
                {/* 模块头部 */}
                <button onClick={() => toggleModule(mod.code)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:'14px',
                    padding:'14px 18px', background:'none', border:'none',
                    color:'inherit', cursor:'pointer', textAlign:'left' }}>
                  {/* 图标 */}
                  <div style={{ width:'38px', height:'38px', borderRadius:'10px',
                    display:'flex', alignItems:'center', justifyContent:'center', shrink:0,
                    background: mod.bgColor }}>
                    <IconComp size={18} style={{ color: mod.color }} />
                  </div>
                  {/* 名称+信息 */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
                      <span style={{ fontSize:'14px', fontWeight:650, color:'#111827' }}>{mod.name}</span>
                      <span style={{
                        padding:'2px 8px', borderRadius:'4px', fontSize:'10px', fontWeight:600,
                        background: lc.bg, color: lc.text,
                      }}>{mod.code}</span>
                    </div>
                    <span style={{ fontSize:'11.5px', color:'#9CA3AF' }}>
                      {mod.fullName} · {mod.levelName} · {mod.skills.length}个技能
                    </span>
                  </div>
                  {/* 展开箭头 */}
                  <ChevronDown size={16} style={{ color:'#9CA3AF', transition:'transform 0.2s ease',
                    transform: isExpanded ? '' : 'rotate(-90deg)', shrink:0 }} />
                </button>

                {/* Skill 卡片网格 */}
                {isExpanded && (
                  <div style={{ padding:'0 18px 18px' }}>
                    <div style={{
                      display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))',
                      gap:'8px'
                    }}>
                      {mod.skills.map((skill) => {
                        const isSelected = selectedSkill === skill.id
                        return (
                          <button key={skill.id}
                            onClick={() => { handleSkillClick(skill, false) }}
                            style={{
                              display:'block', textAlign:'left', padding:'12px 14px',
                              borderRadius:'8px', border: `1px solid ${isSelected ? '#57CC8650' : '#E5E7EB'}`,
                              background: isSelected ? '#E6F7EF10' : '#F9FAFB',
                              cursor:'pointer', transition:'all 0.15s ease',
                            }}
                            onMouseEnter={(e)=>{ if(!isSelected){ e.currentTarget.style.borderColor='#D1D5DB'; e.currentTarget.style.background='#F3F4F6' } }}
                            onMouseLeave={(e)=>{ if(!isSelected){ e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.background='#F9FAFB' } }}>
                            {/* 名称 */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                              <span style={{
                                fontSize:'12.5px', fontWeight:600,
                                color: isSelected ? '#1A7D4E' : '#374151',
                                maxWidth:'75%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                              }}>
                                {skill.name}
                              </span>
                            </div>
                            {/* 描述 */}
                            <p style={{ fontSize:'11px', color:'#6B7280', lineHeight:'1.5',
                              margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                              overflow:'hidden' }}>
                              {skill.desc}
                            </p>
                            {/* hover提示 */}
                            <div style={{
                              marginTop:'7px', fontSize:'10px', fontWeight:500,
                              color:'#1A7D4E', opacity: isSelected ? 1 : 0,
                              transition:'opacity 0.15s'
                            }}>
                              → 在对话中使用此技能
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── 专项技能（外卖/财务/营销等） ── */}
          {filteredExtra.length > 0 && (
            <div style={{
              borderRadius:'12px', overflow:'hidden',
              background:'#fff', border:'1px solid #EDEDED',
            }}>
              <div style={{
                padding:'14px 18px', borderBottom:'1px solid #F3F4F6',
                display:'flex', alignItems:'center', gap:'10px'
              }}>
                <Package size={18} style={{ color: '#6366F1' }} />
                <span style={{ fontSize:'14px', fontWeight:650, color:'#111827' }}>专项技能库</span>
                <span style={{ fontSize:'11px', color:'#9CA3AF' }}>外卖运营 · 客户服务 · 财务管控 · 数据分析 · 危机公关 · 战略融资</span>
                <span style={{
                  marginLeft:'auto', padding:'2px 8px', borderRadius:'4px', fontSize:'10px',
                  background:'#6366F115', color:'#6366F1', fontWeight:600
                }}>{filteredExtra.length}个</span>
              </div>
              <div style={{ padding:'12px 18px' }}>
                <div style={{
                  display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))',
                  gap:'8px'
                }}>
                  {filteredExtra.map((skill) => {
                    const isSelected = selectedSkill === skill.id
                    return (
                      <button key={skill.id}
                        onClick={() => { handleSkillClick(skill, true) }}
                        style={{
                          display:'block', textAlign:'left', padding:'12px 14px',
                          borderRadius:'8px', border: `1px solid ${isSelected ? '#57CC8650' : '#E5E7EB'}`,
                          background: isSelected ? '#E6F7EF10' : '#F9FAFB',
                          cursor:'pointer', transition:'all 0.15s ease',
                        }}
                        onMouseEnter={(e)=>{ if(!isSelected){ e.currentTarget.style.borderColor='#D1D5DB'; e.currentTarget.style.background='#F3F4F6' } }}
                        onMouseLeave={(e)=>{ if(!isSelected){ e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.background='#F9FAFB' } }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                          <span style={{
                            fontSize:'12.5px', fontWeight:600,
                            color: isSelected ? '#1A7D4E' : '#374151',
                            maxWidth:'80%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                          }}>
                            {skill.name}
                          </span>
                        </div>
                        <p style={{ fontSize:'11px', color:'#6B7280', lineHeight:'1.5',
                          margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                          overflow:'hidden' }}>
                          {skill.desc}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        ) /* ← 关闭列表视图（三元表达式的else分支） */}
      </div>

      {/* ═══ 底部统计栏 ═══ */}
      <div style={{ padding:'14px 28px', borderTop:'1px solid #EDEDED',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        fontSize:'11.5px', color:'#9CA3AF', background:'#F3F4F6' }}>
        <span>
          <strong style={{color:'#374151'}}>{visibleCount}</strong> 个专业Skill
          {visibleExtraCount > 0 && <> + <strong style={{color:'#374151'}}>{visibleExtraCount}</strong> 个专项技能</>}
        </span>
        <span>基于《ShaoziClaw SKILL模块设计与技能分类 2026042101》</span>
      </div>
    </div>
  )
}
