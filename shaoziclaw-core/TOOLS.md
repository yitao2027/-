# TOOLS.md — 勺子Claw 工具箱

> **最后更新**：2026-04-20 v4.0

## 一、内置工具清单

### 1. AI 模型
| 模型 | 用途 | 特点 |
|------|------|------|
| **GLM-5v-Turbo** 🧠 | 默认主模型 | 综合能力最强，中文优化，支持图片理解 |
| DeepSeek V3 | 备选模型 | 长文本处理优秀，逻辑推理强 |
| Qwen 3.5 Max | 备选模型 | 中文创作能力强 |

### 2. 办公文档生成（即用型）
| 工具 | 功能 | 典型场景 |
|------|------|---------|
| Word (.docx) | 图文一体文章/方案/报告 | 菜单方案、营销计划、经营报告 |
| PPT (.pptx) | 演示文稿 | 加盟路演、团队培训、投资人汇报 |
| PDF (.pdf) | 正式文档/合同模板 | SOP手册、员工手册、合规文件 |
| Excel (.xlsx) | 数据表格/计算表 | 成本核算表、排班表、盘点表 |

### 3. 图片生成
| 工具 | 功能 | 用途 |
|------|------|------|
| Seedream (腾讯云) | AI 图片生成 | 菜品配图、营销海报、场景图 |
| 内置 image_gen | 本地AI出图 | 配图快速生成 |

### 4. 数据采集
| 工具 | 功能 | 用途 |
|------|------|------|
| 新榜 (newrank.cn) | 公众号热度追踪 | 行业热点捕捉 |
| 微博热搜 | 实时热点 | 社会话题/舆情监测 |
| 百度搜索 | 深度内容搜索 | 竞品调研/行业数据 |
| B站视频转录 | 视频转文字(Whisper) | 专家访谈/行业知识采集 |
| 金融数据插件 | A股/基金/宏观 | 餐饮上市公司分析 |

### 5. 浏览器自动化
| 工具 | Profile | 用途 |
|------|---------|------|
| Playwright | openclaw | 网页操作、自动发布（微博/X/公众号） |

### 6. 餐饮专用计算器
| 计算器 | 功能 | 输入→输出 |
|--------|------|----------|
| **成本计算器** | 单品/月度成本核算 | 食材+人工+房租+能耗 → 总成本&毛利率 |
| **租金ROI计算** | 房租投入产出分析 | 月租金×面积 → 保本营业额&回本周期 |
| **盈亏平衡计算** | 保本点分析 | 固定成本+变动成本 → 日均保本营业额 |
| **人效计算** | 员工效率分析 | 营业额÷工时 → 人效值&行业对比 |
| **翻台率计算** | 座位周转分析 | 客流量÷座位数 → 翻台率&提升建议 |

---

## 二、Skill调用体系（261个专业Skill，四代累计）

### 按使用频率分级

#### 🔥 高频（日常必备）
| Skill名 | 一句话功能 |
|---------|-----------|
| menu-engineering-pricing | 菜单定价与毛利优化 |
| fn-cost-control | 成本精细化管控 |
| waimai-operation-system | 外卖全链路运营 |
| meituan-rules-compliance | 美团平台规则解读 |
| marketing-campaign-planner | 营销活动策划 |
| store-operations-standard | 门店运营SOP |
| L1-data-dashboard | 经营数据看板 |

#### ⚡ 中频（专项问题）
| Skill名 | 一句话功能 |
|---------|-----------|
| location-thousand-score | 千分选址评估 |
| staff-management-recruitment | 招聘与用工管理 |
| customer-complaint-handling | 投诉处理与差评挽回 |
| inventory-optimization | 库存管理与损耗控制 |
| private-domain-scrm | 私域流量搭建 |
| promotion-activity-box | 促销活动百宝箱 |
| rent-negotiation | 租金谈判策略 |

#### 🎯 低频（战略级）
| Skill名 | 一句话功能 |
|---------|-----------|
| L3-franchise-strategy | 连锁扩张战略 |
| L3-capital-strategy | 融资与资本运作 |
| L3-brand-strategy | 品牌顶层设计 |
| L3-equity-design | 股权结构设计 |
| crisis-sop-monitoring | 危机监测SOP |

---

## 三、外部 API / 服务配置

```env
# === AI 模型 ===
GLM_API_KEY=<your-key>          # 主力模型
QWEN_API_KEY=<your-key>         # 备选
DEEPSEEK_API_KEY=<your-key>     # 备选

# === 图片生成（腾讯云）===
TENCENT_SECRET_ID=<id>
TENCENT_SECRET_KEY=<key>

# === 数据采集（用户自配）===
NEWRANK_COOKIE=<cookie>        # 新榜
WEIBO_COOKIE=<cookie>          # 微博

# === 金融数据（可选）===
FINANCE_DATA_PLUGIN=enabled    # A股/基金/宏观数据
```

> ⚠️ 以上密钥由用户在 App 设置页自行配置，勺子Claw 默认不内置任何密钥。

---

## 四、工作流引擎（5条标准流程）

| 工作流 | 适用场景 | 步骤数 |
|--------|---------|--------|
| 外卖诊断流程 | 外卖店铺问题诊断 | 7步 |
| 菜单诊断流程 | 菜单结构/定价问题诊断 | 6步 |
| 选址千分评估 | 新店选址决策 | 12步 |
| 危机响应流程 | 突发危机处理 | 5步 |
| 内容生产流程 | 营销文案/文章生产 | 8步 |

---

_工具是爪子，但用工具的是脑子。先想清楚再动手。🦞_
