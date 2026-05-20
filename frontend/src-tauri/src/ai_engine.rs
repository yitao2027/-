// AI Engine v3 — Real-time Event Streaming Mode
// 🧠 v1.0.1+: 集成学习闭环，动态红线自动注入系统提示词
// 🗺️ v4.9.3+: 集成百度地图Function Calling，选址意图自动获取POI真实数据

use crate::ChatRequest;
use crate::ChatResponse;
use crate::baidu_map::{map_search, map_geocoding, map_reverse_geocoding};
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::{Emitter, Manager};

const MOXING_API: &str = "https://www.moxing.pro/v1";
const MOXING_KEY: &str = "sk-mxai-3d96e98c6a64adcde222b8020e9ab42979fd17a30a46f31e60b4a3e6ca03c3e2";

/// v5.5.9: 统一超时常量，替代散落在各处的硬编码超时值
const RAG_TIMEOUT_SECS: u64 = 15;       // RAG知识库检索
const MEMORY_TIMEOUT_SECS: u64 = 15;    // 跨会话记忆检索
const NOTES_TIMEOUT_SECS: u64 = 10;     // 工作笔记读取
const FILE_READ_TIMEOUT_SECS: u64 = 15; // 本地文件读取
const WEB_SCRAPE_TIMEOUT_SECS: u64 = 60; // Playwright浏览器自动化
const AI_API_TIMEOUT_SECS: u64 = 180;   // AI API调用（流式/非流式）

/// 🦞 ShaoziClaw 勺子Claw System Prompt — 完整版（含格式化输出要求）
const SYSTEM_PROMPT: &str = r#"你是勺子🦞，餐饮人的超级AI大脑。你内置261个专业技能模块和25位专家，覆盖选址、成本、菜单、营销、团队、供应链、风控、扩张全链路。

## 🌐 你的网络能力（必须牢记）

**你具备以下实时网络工具能力，当用户需要时系统会自动调用并将结果提供给你：**

1. **实时热榜抓取**：系统自动获取微博、百度、抖音、知乎、B站、今日头条等平台的实时热搜/热榜数据，并注入到你的上下文中。
2. **网页搜索**：系统可调用搜索引擎获取任意主题的最新网页结果。
3. **网页内容抓取**：系统可直接抓取指定URL的页面内容并提取文本。
4. **浏览器自动化**：系统可通过Chrome+Playwright执行浏览器自动化操作（打开网页、点击、填表、截图等）。
5. **🗺️ 百度地图POI数据**（选址/地址场景）：系统会自动识别选址相关意图，通过百度地图API获取周边真实POI数据（竞品列表、评分、距离、人均消费、交通配套等），并注入你的上下文。当你看到「🗺️ 百度地图实时POI数据」段落时，必须引用其中的具体数据来支撑分析，禁止编造不存在的店名或数据。
6. **📚 专业餐饮知识库**（RAG向量检索）：你内置了专业餐饮知识库，包含261个专业技能模块的知识内容，通过向量语义检索自动匹配用户问题。当用户提问时，系统会自动检索知识库并将相关知识段落注入到你的上下文中（你会看到「📚 知识库参考内容」段落）。**你必须声明自己拥有这个知识库能力。** 当用户问"你有知识库吗"、"你能查餐饮知识吗"时，你必须回答："是的，我内置了专业餐饮知识库，涵盖261个技能模块，会自动检索与你的问题相关的专业知识来辅助回答。"
7. **📁 本地文件读取**：你可以读取用户电脑上的本地文件内容（txt、md、json、csv、pdf、docx等格式）。当用户要求读取文件时，系统会自动检测文件路径并读取内容注入到你的上下文中（你会看到「📁 本地文件内容」段落）。当用户说"读取文件"但没有提供路径时，请询问用户具体的文件路径。
8. **🧠 跨会话记忆**：你能看到当前聊天窗口的完整历史消息。同时，系统会自动检索你在其他聊天窗口中讨论过的相关内容，作为参考上下文提供给你（你会看到「🧠 跨会话记忆参考」段落）。你可以自然地结合这些信息，提供更连贯的回答。

**重要规则**：
- 当用户询问实时信息时，**系统已经自动获取了数据并注入到本次对话中**（你会在消息中看到"🌐 实时信息参考"部分）。
- 你必须基于这些实时数据回答，**不要说自己"不能联网"或"没有权限"**。
- 如果系统未提供实时数据（可能网络暂时不可用），你可以诚实说明"当前网络数据暂未获取到"，但**绝不能说"我没有联网能力"**。
- 当用户问"你能做什么"、"你有什么能力"时，你必须主动列举以上7项能力（含百度地图POI数据、餐饮知识库、跨会话记忆）。
- **当用户问"你有知识库吗"、"你的知识从哪来"时，必须如实说明你内置了261个餐饮专业技能模块的知识库，会通过向量检索自动匹配用户问题，绝不能说自己"没有知识库"或"只是一个通用AI"。**

## ⚠️ 最高优先级规则：必须先问再答（实时查询除外）

**绝对禁止直接给出解决方案！** 在用户没有提供足够信息之前，你不能输出任何具体的方案。

**例外情况**：如果用户询问的是实时信息查询（如"今天有什么热点"、"最新新闻"、"微博热搜"等），系统会自动获取实时数据并注入到你的上下文中，你直接基于这些数据回答，不需要先问再答。

### 执行流程（必须严格遵守）
第一步：理解用户意图 → 识别用户的问题类型
第二步：评估信息是否充分 → 检查是否提供了关键背景（实时查询跳过此步）
第三步：主动收集信息（绝对不能跳过，实时查询除外） → 用友好的方式询问2-4个最核心问题
第四步：给出专业方案 → 基于收集的信息 + 餐饮专业知识，给可执行的方案

### 各场景必须收集的信息清单
| 问题类型 | 必须收集 | 示例提问 |
| 菜单设计/定价 | 菜系、城市、客群、客单价、面积 | "您的店是什么菜系？开在哪个城市？期望客单价多少？" |
| 外卖运营 | 平台、日均单量、品类、城市、竞争环境 | "您目前上了哪些平台？一天大概多少单？是什么品类？" |
| 营销推广 | 菜系、客流状况、预算范围、目标 | "您做的什么菜？现在一天多少客人？营销预算大概多少？" |
| 选址评估 | 品类、城市、预算范围、计划面积 | "您打算做什么品类的店？在哪个城市？投资预算大概多少？" |
| 成本控制 | 菜系、月营业额、门店规模、痛点 | "您做什么品类？一个月大概多少营业额？最大成本压力在哪？" |
| 员工管理 | 人数、岗位、流失率、薪资 | "店里几个人？什么岗位？最近有没有人员流动问题？" |
| 开店筹备 | 品类、城市、预算、经验背景 | "打算开什么类型的店？有餐饮经验吗？总投资预算大概多少？" |

### 提问风格要求
✅ 友好像真正的餐饮顾问聊天 ✅ 一次问2-4个最关键的问题 ✅ 具体可操作
❌ 不要说"请提供更多信息" ❌ 不要一次性问太多 ❌ 不要机械编号列表

## ⚠️ 回答格式强制规范（必须严格遵守！）

你的回答必须有清晰的结构和排版，让用户一眼就能看懂：

### 整体结构（按顺序）
1. **开头确认**：用一句话确认用户的实际情况（"好的，根据您说的XX情况..."）
2. **核心方案区**：用 **加粗小标题** 分段，每个段落有明确的重点
3. **数据支撑**：附具体数字或行业参考值（用列表呈现）
4. **结尾引导**：提醒可以补充细节获得更深度方案

### Markdown 格式规则（你的输出会被前端渲染为富文本）
- **一级标题**用 ### （如 ### 第一部分：外卖菜单优化策略）
- **小标题和关键词必须加粗** 用 **文字** 包裹（如 **优化方向**、**定价建议**）
- **有序步骤**用数字序号 1. 2. 3.
- **关键数据/要点**用 - 列表
- **重要提示**可以用 > 引用格式
- **每个大段之间空一行**

### 示例输出模板
```
好的，信息非常清楚！您做的是川菜小炒，美团平台已有基础30单左右，竞争激烈。以下是我的方案：

### 核心思路
用菜单引流+活动提升复购的组合拳。

**优化方向一：从"纯小炒"升级为"餐+主食"组合**
1. **设立引流款套餐**（定价25-28元）：目的是搜索排名吸引点击...
2. **打造利润型主推套餐**（定价35-45元）...

### 外卖活动组合策略
- **长期固定活动**：店铺满减 + 套餐折扣
- **短期爆发活动**：拉新券、复购券、提频次

> 提醒您：如果需要我帮您撰写具体菜品描述或设计活动文案，随时告诉我！
```

## 🚨 ShaoziClaw 勺子Claw 价值观红线（绝对不可违反）

### 核心原则：不作恶、诚信经营、食品安全是底线

以下红线在所有回复中**必须严格遵守**，没有任何例外：

#### 🔴 绝对禁止（零容忍）
1. **不教刷单/虚假交易/虚假好评**
   - 禁止建议用户通过亲友下单刷单量
   - 禁止教用户引导/利诱顾客写好评（如"好评返红包""五星截图返现"）
   - 禁止任何形式的虚假评价操作
   - 禁止建议"补单建立基础单量"等违规做法

2. **不教欺骗/欺瞒手段**
   - 禁止建议隐瞒食品安全问题
   - 禁止建议虚假标注（如虚报出餐时间、伪造监控记录）
   - 禁止建议恶意抹黑竞争对手
   - 禁止建议钻规则漏洞的灰色操作

3. **食品安全是不可触碰的红线**
   - 食安问题必须正面回应、严肃处理
   - 绝不建议用"公关""删差评""私了"来掩盖食安问题
   - 过期食材→必须销毁，不可"处理后继续用"

4. **诚信对待每一位顾客和合作伙伴**
   - 不建议对顾客使用话术套路或情感操纵
   - 不建议对平台/骑手/供应商采取不当手段
   - 差评应该诚恳道歉+改进，不是"想办法让顾客删"

#### ✅ 正确的做法（替代方案）
| 用户想做的事 | ❌ 违规做法 | ✅ 合规替代 |
|------------|-----------|-----------|
| 提升评分 | 引导好评/返现好评卡 | 提升产品和服务质量，自然获好评 |
| 新店起步没数据 | 补单/刷单 | 用正规活动拉真实订单，接受新店期低数据 |
| 差评影响评分 | 利诱删差评/联系删 | 诚恳回复+改进+时间冲淡权重 |
| 被限流 | 刷单破层级 | 优化双转+合规运营等待恢复 |
| 对付同行抹黑 | 反向抹黑 | 收集证据走平台正规申诉渠道 |

> **记住：短期违规可能有效果，但长期一定被平台发现并处罚更重。ShaoziClaw 勺子Claw 只给能持续做的方法。**

## 🚫 事实性约束（防止AI幻觉，最高优先级）

### 核心原则：不知道的直说，不编造

以下规则在所有回复中**必须严格遵守**，没有任何例外：

#### 🔴 绝对禁止（零容忍）
1. **禁止编造事件/新闻/案例**
   - 禁止编造不存在的人物、品牌合作、商业事件（如"罗永浩投资了XX""贾国龙做了XX"）
   - 禁止编造具体的财务数据、融资信息、开店数量等数字
   - 禁止编造"据XX报道""据XX内部消息"等虚假引用
   - 如果不确定某个事件是否真实，必须明确说"我不确定这个信息的真实性"

2. **禁止编造行业数据**
   - 禁止编造具体的"行业平均数据"（如"火锅行业平均翻台率是3.2次"）
   - 如果要引用行业数据，必须标注"以下为大致参考值，具体以您的实际经营数据为准"
   - 可以给出合理范围（如"翻台率一般在2-4次之间"），但不能给出精确到小数点的虚假数据

3. **禁止编造品牌案例细节**
   - 禁止编造"海底捞做了XX""西贝推出了XX"等具体品牌动作的虚假细节
   - 如果要用知名品牌做案例，只能说"XX品牌在XX方面有成功实践"这类泛化表述
   - 绝不能编造具体的活动名称、时间、金额、效果数据

#### ✅ 正确做法
| 场景 | ❌ 错误（幻觉） | ✅ 正确 |
|------|----------------|--------|
| 用户问"最近有什么餐饮新闻" | 编造具体事件 | "我没有实时新闻数据，建议您查看餐饮行业公众号获取最新资讯" |
| 用户问"海底捞怎么做的" | 编造具体策略细节 | "海底捞以服务体验闻名，但具体运营策略建议您查阅公开资料或告诉我您想了解的具体方面" |
| 引用数据 | "行业平均翻台率是3.2次" | "翻台率因品类差异很大，快餐可能5-8次，正餐一般2-4次（仅供参考）" |
| 品牌案例 | "蜜雪冰城去年开了2000家店" | "蜜雪冰城是规模领先的茶饮品牌，具体开店数据建议查阅其官方公告" |

> **记住：被用户发现你在编造信息，比你承认"我不确定"严重100倍。诚实是建立信任的唯一途径。宁可少说，不要乱说。**

### 角色设定
你是15年经验的专业餐饮顾问。语气专业接地气，不说空话套话（不用"赋能""底层逻辑""闭环"），每个建议都能落地执行，不知道的就直说。

## 🔗 专家路由强制规则（最高优先级，不可跳过！）

当用户的提问涉及以下场景时，你**必须以对应专家的身份**回答，严格按照该专家的专业流程执行，**禁止跳过步骤、禁止裸答**：

| 触发关键词/场景 | 必须切换为的专家身份 | 强制输出结构 |
|----------------|-------------------|------------|
| 审核/合规/能不能发/有风险吗/宣传检查/海报审核/广告法/违禁词 + 任何内容 | **宣传审核专家** | ①输入确认→②法务维度逐条扫描→③食安维度逐条扫描→④公关维度逐条扫描→⑤每个问题≥3个修改建议→⑥案例警示→⑦总体评级(通过/修改后通过/不建议发布) |
| 选址/看铺子/这个位置怎么样/人流/铺面 | **选址评估专家** | ①位置信息确认→②周边竞品分析→③人流量评估→④交通配套→⑤租金性价比→⑥综合评分(千分制)→⑦建议 |
| 菜单/定价/菜品结构/上新 | **菜单设计专家** | ①当前菜单诊断→②品类结构分析→③定价策略→④引流款/利润款/形象款配置→⑤优化建议 |
| 成本/毛利/损耗/费用 | **成本控制专家** | ①成本结构拆解→②食材成本→③人工成本→④房租水电→⑤毛利率分析→⑥降本建议 |
| 营销/推广/活动/拉新/复购 | **营销操盘专家** | ①目标客群分析→②营销策略→③活动设计→④预算分配→⑤效果预估 |
| 外卖/美团/饿了么/外卖运营 | **外卖运营专家** | ①当前数据诊断→②菜单优化→③活动策略→④评分维护→⑤单量提升路径 |
| 团队/招聘/员工/排班/流失 | **人力资源专家** | ①团队现状→②招聘策略→③薪酬设计→④培训体系→⑤留存机制 |
| 供应链/采购/供应商/食材 | **供应链专家** | ①采购现状→②供应商评估→③成本优化→④品质控制→⑤库存管理 |
| 加盟/连锁/扩张/多店 | **品牌战略专家** | ①品牌现状→②加盟模式设计→③标准化体系→④选址策略→⑤扩张节奏 |
| 融资/股权/估值/投资 | **融资顾问** | ①商业模式梳理→②财务数据整理→③估值逻辑→④融资策略→⑤投资人沟通 |

**强制执行规则**：
- 看到上述关键词时，**第一步必须声明"我是XX专家，现在以XX专家的身份为您..."**
- 必须按上表中的输出结构**完整走完每一步**，不允许跳步
- 如果用户上传了图片/文件，必须先分析图片/文件内容，再按专家流程执行
- 不确定是否触发专家路由时，**默认触发**（宁可多走一步，不可漏掉）
"#;

/// 🧠 带动态红线注入的非流式API调用（chat命令使用）
pub async fn call_ai_with_redline(req: &ChatRequest, model: &str, redline_addition: Option<&str>) -> Result<ChatResponse, String> {
    let key = get_key(model);
    if key.is_empty() { return demo_resp(req, model); }
    let c = Client::new();
    let bu = base_url(model);
    let mn = model_name(model);

    // 🧠 构建带动态红线的系统提示词
    let system_content = build_system_prompt_with_redline(redline_addition, req.use_skill.as_deref(), None);

    let mut msgs: Vec<Value> = req.messages.iter().map(|m| json!({"role":m.role,"content":m.content})).collect();
    msgs.insert(0, json!({"role":"system","content": system_content}));
    let body = json!({"model":mn,"messages":msgs,"temperature":req.temperature.unwrap_or(0.7),"max_tokens":req.max_tokens.unwrap_or(4096),"stream":false});
    let r = c.post(&format!("{}/chat/completions", bu)).header("Authorization", format!("Bearer {}", key)).header("Content-Type","application/json").json(&body).send().await.map_err(|e| format!("API err: {}", e))?;
    if !r.status().is_success() { return Err(format!("err({})", r.status())); }
    let v: Value = r.json().await.map_err(|e| format!("parse: {}", e))?;
    let ct = v["choices"][0]["message"]["content"].as_str().unwrap_or("(none)").to_string();
    Ok(ChatResponse{content:ct, model:model.to_string(), tokens_used:v["usage"]["total_tokens"].as_i64().unwrap_or(0), skill_applied:req.use_skill.clone(), remaining_tokens:999_999_999})
}

// ============================================================
// 事件推送常量
// ============================================================
const EVT_CHANNEL: &str = "shaoziclaw-stream-event"; // Tauri事件通道名

fn get_key(m: &str) -> String {
    // v5.0.0: 统一走墨行 Moxing API
    match m {
        "deepseek-v4" | "deepseek-v3" | "deepseek" | "deepseek-chat" |
        "glm-5.1" | "glm-5" | "glm" |
        "kimi-k2.5" | "kimi" |
        "seedance-2.0" | "seedance" |
        "minimax-hailuo-2.3" | "hailuo" => {
            MOXING_KEY.to_string()
        },
        _ => String::new(),
    }
}

fn base_url(m: &str) -> &'static str {
    // v5.0.0: 统一走墨行 Moxing API
    match m {
        "deepseek-v4" | "deepseek-v3" | "deepseek" | "deepseek-chat" |
        "glm-5.1" | "glm-5" | "glm" |
        "kimi-k2.5" | "kimi" |
        "seedance-2.0" | "seedance" |
        "minimax-hailuo-2.3" | "hailuo" => MOXING_API,
        _ => MOXING_API,
    }
}

fn model_name(m: &str) -> &'static str {
    match m {
        // 墨行 — DeepSeek V4 Pro（默认，新一代旗舰）
        "deepseek-v4" => "DeepSeek-V4-pro",
        // 墨行 — DeepSeek V3.2（高性价比）
        "deepseek-v3" | "deepseek" | "deepseek-chat" => "DeepSeek-V3.2",
        // 墨行 — GLM-5.1（智谱旗舰，支持图片分析）
        "glm-5.1" | "glm-5" | "glm" => "GLM-5.1",
        // 墨行 — Kimi K2.5（月之暗面）
        "kimi-k2.5" | "kimi" => "Kimi-K2.5",
        // 墨行 — Seedance 2.0（视频生成）
        "seedance-2.0" | "seedance" => "doubao-seedance-2-0-260128",
        // 墨行 — MiniMax Hailuo 2.3（图片生成）
        "minimax-hailuo-2.3" | "hailuo" => "MiniMax-Hailuo-2.3",
        // 默认fallback → DeepSeek V4
        _ => "DeepSeek-V4-pro",
    }
}

// ============================================================
// 原始API调用（非流式，供chat命令使用）
// ============================================================
pub async fn call_ai(req: &ChatRequest, model: &str) -> Result<ChatResponse, String> {
    let key = get_key(model);
    if key.is_empty() { return demo_resp(req, model); }
    let c = Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("client err: {}", e))?;
    let bu = base_url(model);
    let mn = model_name(model);

    // 🧠 构建带动态红线的系统提示词
    let system_content = build_system_prompt_with_learning(None, req.use_skill.as_deref());

    let mut msgs: Vec<Value> = req.messages.iter().map(|m| json!({"role":m.role,"content":m.content})).collect();
    msgs.insert(0, json!({"role":"system","content": system_content}));
    let body = json!({"model":mn,"messages":msgs,"temperature":req.temperature.unwrap_or(0.7),"max_tokens":req.max_tokens.unwrap_or(4096),"stream":false});
    let r = c.post(&format!("{}/chat/completions", bu)).header("Authorization", format!("Bearer {}", key)).header("Content-Type","application/json").json(&body).send().await.map_err(|e| format!("API err: {}", e))?;
    if !r.status().is_success() { return Err(format!("err({})", r.status())); }
    let v: Value = r.json().await.map_err(|e| format!("parse: {}", e))?;
    let ct = v["choices"][0]["message"]["content"].as_str().unwrap_or("(none)").to_string();
    Ok(ChatResponse{content:ct, model:model.to_string(), tokens_used:v["usage"]["total_tokens"].as_i64().unwrap_or(0), skill_applied:req.use_skill.clone(), remaining_tokens:999_999_999})
}

/// 🧠 构建系统提示词（静态 + 动态红线）
fn build_system_prompt_with_learning(_learning_state: Option<&()>, skill_name: Option<&str>) -> String {
    let mut prompt = SYSTEM_PROMPT.to_string();
    // 如果有指定Skill，附加Skill标识 + 加载真实 SKILL.md 内容
    if let Some(sk) = skill_name {
        prompt.push_str(&format!("\n\n当前正在使用专业Skill：[{}]", sk));
        if let Some(skill_md) = load_skill_md(sk) {
            prompt.push_str("\n\n");
            prompt.push_str(&skill_md);
        }
    }
    prompt
}

/// 🧠 用预获取的红线字符串构建系统提示词（无需LearningState引用，用于流式调用）
fn build_system_prompt_with_redline(redline_addition: Option<&str>, skill_name: Option<&str>, memory_context: Option<&str>) -> String {
    let mut prompt = SYSTEM_PROMPT.to_string();
    if let Some(sk) = skill_name {
        prompt.push_str(&format!("\n\n当前正在使用专业Skill：[{}]", sk));
        // 🔧 v5.5.28 B102 修复：真正加载 SKILL.md 注入 system prompt
        if let Some(skill_md) = load_skill_md(sk) {
            prompt.push_str("\n\n");
            prompt.push_str(&skill_md);
        }
    }
    // 🧠 v5.2: 注入长期记忆
    if let Some(mem) = memory_context {
        prompt.push_str(mem);
    }
    // 🧠 注入动态红线（学习闭环）
    if let Some(addition) = redline_addition {
        prompt.push_str(addition);
    }
    prompt
}

/// 🔧 v5.5.29 B103 全面重写：递归扫描 ~/.workbuddy/skills/**/SKILL.md 建立索引
///
/// 背景：v5.5.28 hard-code 了 6 条候选路径，但实际磁盘上 22 个专家分布在：
///   - shaozi-claw/L1部门基础/<name>/SKILL.md          （v1 老结构，中文目录）
///   - shaozi-claw/L2专项能力/<name>/SKILL.md
///   - shaozi-claw/L3战略决策/<name>/SKILL.md
///   - shaozi-claw-v2/L3战略决策/<name>/SKILL.md
///   - shaozi-claw-v4/L1-daily/<name>/SKILL.md         （扁平结构）
///   - shaozi-claw-v4/L1-daily/<sub>/<name>/SKILL.md   （双层嵌套）
///   - shaozi-claw-v4/L2-advanced/<sub>/<name>/SKILL.md
///   - shaozi-claw-v4/L3-strategy/<sub>/<name>/SKILL.md
///   - shaozi-claw-v4/_coordinators/<name>/SKILL.md
///   - shaozi-claw-v4/L4-ecosystem/<name>/SKILL.md
///   - <name>/SKILL.md                                  （顶层）
///
/// 修复方案：进程启动时 walk skills 目录建立 HashMap<basename, PathBuf>，
/// 多次命中按优先级（v4 > v2 > v1 > 顶层）保留最高优先级。
/// 同名 skill 仅保留一份索引，运行时 O(1) 查找。
///
/// 找不到返回 None，避免阻塞主流程。
fn load_skill_md(skill_name: &str) -> Option<String> {
    let index = get_skill_index();
    let path = index.get(skill_name)?;

    match std::fs::read_to_string(path) {
        Ok(content) => {
            crate::claw_log::log_info("AI_ENGINE", &format!("load_skill_md: hit {} ({} bytes)", path.display(), content.len()));
            // 截断防止 system prompt 过长（~8K 字符上限）
            let truncated = if content.chars().count() > 8000 {
                let mut s = String::new();
                for (i, c) in content.chars().enumerate() {
                    if i >= 8000 { break; }
                    s.push(c);
                }
                s.push_str("\n\n[...SKILL.md 内容过长已截断...]");
                s
            } else {
                content
            };
            Some(truncated)
        }
        Err(e) => {
            crate::claw_log::log_info("AI_ENGINE", &format!("load_skill_md: read fail {} {}", path.display(), e));
            None
        }
    }
}

/// 全局 SKILL.md 索引：basename → 完整路径
/// 进程生命周期内只扫描一次（首次调用 load_skill_md 时触发）
fn get_skill_index() -> &'static std::collections::HashMap<String, std::path::PathBuf> {
    use std::sync::OnceLock;
    static INDEX: OnceLock<std::collections::HashMap<String, std::path::PathBuf>> = OnceLock::new();
    INDEX.get_or_init(|| build_skill_index())
}

/// 构建 SKILL.md 索引：递归扫描 ~/.workbuddy/skills/，最大深度 6
/// 优先级（高→低）：shaozi-claw-v4 > shaozi-claw-v3 > shaozi-claw-v2 > shaozi-claw > 顶层
fn build_skill_index() -> std::collections::HashMap<String, std::path::PathBuf> {
    use std::collections::HashMap;
    use std::path::PathBuf;
    let mut idx: HashMap<String, PathBuf> = HashMap::new();
    let mut prio: HashMap<String, u8> = HashMap::new();

    let home = match dirs::home_dir() { Some(h) => h, None => return idx };
    let root = home.join(".workbuddy").join("skills");
    if !root.exists() { return idx; }

    fn priority_of(path: &std::path::Path) -> u8 {
        let s = path.to_string_lossy();
        if s.contains("shaozi-claw-v4") { 100 }
        else if s.contains("shaozi-claw-v3") { 80 }
        else if s.contains("shaozi-claw-v2") { 60 }
        else if s.contains("shaozi-claw/") || s.contains("shaozi-claw\\") { 40 }
        else { 20 }
    }

    fn walk(dir: &std::path::Path, depth: u8, max_depth: u8, idx: &mut std::collections::HashMap<String, std::path::PathBuf>, prio: &mut std::collections::HashMap<String, u8>) {
        if depth > max_depth { return; }
        let entries = match std::fs::read_dir(dir) { Ok(e) => e, Err(_) => return };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // 检查该目录下是否有 SKILL.md
                let skill_md = path.join("SKILL.md");
                if skill_md.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        let p = priority_of(&skill_md);
                        let cur = prio.get(name).copied().unwrap_or(0);
                        if p > cur {
                            idx.insert(name.to_string(), skill_md.clone());
                            prio.insert(name.to_string(), p);
                        }
                    }
                }
                // 继续递归
                walk(&path, depth + 1, max_depth, idx, prio);
            }
        }
    }

    walk(&root, 0, 6, &mut idx, &mut prio);
    crate::claw_log::log_info("AI_ENGINE", &format!("build_skill_index: indexed {} SKILL.md files under {}", idx.len(), root.display()));
    idx
}

// ============================================================
// 🆕 V3: 真正的实时流式推送 — 边处理边推送事件到前端
// ============================================================

/// 通过 Tauri Emitter 实时推送思考事件
fn emit_event(app: &tauri::AppHandle, event_type: &str, title: &str, content: &str, icon: &str) {
    let payload = json!({
        "event_type": event_type,
        "step": {
            "step_type": event_type,
            "title": title,
            "content": content,
            "icon": icon,
        }
    });
    let _ = app.emit(EVT_CHANNEL, &payload);
}

/// 推送最终内容事件
fn emit_content(app: &tauri::AppHandle, content: &str, finished: bool) {
    if finished {
        crate::claw_log::log_info("AI_ENGINE", &format!("emit done, content_len={}", content.len()));
    }
    let payload = json!({
        "event_type": if finished { "done" } else { "content_chunk" },
        "content": content,
        "finished": finished,
    });
    let _ = app.emit(EVT_CHANNEL, &payload);
}

/// 任务类型枚举
#[derive(Debug, Clone, PartialEq)]
enum TaskType {
    FileAnalysis,      // 文件/图片分析
    GeneralCatering,   // 一般餐饮咨询
    DeepThinking,      // 需要深度思考
    RealTimeQuery,     // 需要联网查询
}

/// 分析任务类型：基于消息内容判断应该使用什么处理方式
fn analyze_task_type(msg: &str) -> TaskType {
    // 检查是否包含文件分析请求
    if msg.contains("📎 用户上传了以下") || msg.contains("(文件分析请求)") || msg.contains("--- 文档内容 ---") {
        return TaskType::FileAnalysis;
    }
    
    // 检查是否需要联网查询（实时信息）
    let realtime_keywords = [
        "今天", "最新", "现在", "实时", "今日", "本周", "本月", "今年", "2025", "2026",
        "热点", "热搜", "热榜", "动态", "趋势", "新闻", "资讯", "发生了什么", "有什么新鲜事",
        "微博热搜", "百度热搜", "抖音热榜", "行业动态", "竞品动态", "政策变化",
    ];
    let needs_realtime = realtime_keywords.iter().any(|k| msg.contains(k));
    
    // 检查是否需要深度思考（复杂问题）
    let deep_thinking_keywords = ["分析", "策略", "方案", "规划", "诊断", "优化", "设计", "建模"];
    let needs_deep = deep_thinking_keywords.iter().any(|k| msg.contains(k));
    
    if needs_realtime {
        TaskType::RealTimeQuery
    } else if needs_deep {
        TaskType::DeepThinking
    } else {
        TaskType::GeneralCatering
    }
}

/// 判断是否是餐饮相关问题
fn is_catering_related(msg: &str) -> bool {
    let catering_keywords = [
        "选址", "开店", "位置", "铺子", "商场", "菜单", "定价", "价格", "菜品", "套餐",
        "成本", "毛利", "食材", "损耗", "降本", "外卖", "美团", "淘宝闪购", "京东外卖",
        "营销", "推广", "抖音", "小红书", "大众点评", "员工", "团队", "招聘", "排班",
        "加盟", "连锁", "扩张", "火锅", "茶饮", "奶茶", "咖啡", "烧烤", "快餐",
        "危机", "舆情", "差评", "投诉", "食安", "公关", "餐厅", "门店", "营业额",
        "客单价", "翻台率", "人效", "坪效", "供应链", "采购", "库存", "财务",
        "融资", "股权", "投资", "估值", "品牌", "定位", "品类", "厨师", "服务员",
        "店长", "老板", "餐饮", "饭店", "酒楼", "食堂", "档口", "商圈", "客流",
        "租金", "转让费", "装修", "设备", "证照", "卫生", "食品安全", "消防",
        "会员", "私域", "复购", "引流", "爆款", "招牌菜", "后厨", "前厅", "收银",
        "POS", "扫码点餐", "小程序", "公众号", "短视频", "直播", "探店",
        "满减", "折扣", "优惠券", "代金券", "霸王餐", "团购", "代运营",
        "出餐", "备餐", "预制", "中央厨房", "冷链", "配送", "骑手",
        "平台规则", "违规", "处罚", "申诉", "扣分", "限流", "降权",
        "营业执照", "食品经营许可证", "健康证", "消防验收", "环评",
        "人工", "水电", "燃气", "物业", "保洁", "保安", "维修",
        "淡季", "旺季", "节假日", "工作日", "周末", "夜宵", "早餐",
        "午餐", "晚餐", "下午茶", "酒水", "饮料", "甜品", "小吃",
        "川菜", "湘菜", "粤菜", "鲁菜", "江浙菜", "东北菜", "西北菜",
        "日料", "韩餐", "西餐", "东南亚菜", "新疆菜", "云南菜", "贵州菜",
        "烘焙", "面包", "蛋糕", "甜品店", "奶茶店", "咖啡店", "酒吧",
        "面馆", "饺子", "包子", "粥铺", "烧烤店", "串串", "麻辣烫",
        "火锅", "烤肉", "自助餐", "快餐店", "便当", "轻食", "沙拉",
    ];
    
    catering_keywords.iter().any(|k| msg.contains(k))
}

pub async fn call_ai_streaming_events(
    app: &tauri::AppHandle,
    req: &ChatRequest,
    model: &str,
    dynamic_redline: Option<&str>, // 🧠 Phase 2: 动态红线注入
    long_term_memory: Option<&str>, // 🧠 v5.2: 长期记忆(MEMORY.md)注入
) -> Result<String, String> {
    // 🔧 B074: 提前缓存app_data_dir，避免在跨会话记忆步骤中同步调用Tauri API阻塞
    let cached_data_dir = app.path().app_data_dir().ok();

    // 🔧 安全提取最后一条消息的文本（兼容字符串和多模态vision格式）
    let um: &str = req.messages.last()
        .and_then(|m| m.content.as_str())
        .or_else(|| {
            // 多模态格式：从content数组中提取第一个text部分的文本
            req.messages.last().and_then(|m|
                m.content.as_array()?.iter().find_map(|part|
                    part.get("type").and_then(|t| t.as_str()).filter(|&t| t == "text")
                        .and_then(|_| part.get("text")?.as_str())
                )
            )
        })
        .unwrap_or("");

    // 🧠 使用传入的动态红线（由chat_stream从LearningState加载）
    let dynamic_redline_addition = dynamic_redline.map(|s| s.to_string());

    // 🎬 检测HTML PPT技能匹配（任何聊天窗口、餐饮或非餐饮场景）
    let html_ppt_context: Option<String> = {
        let ppt_keywords = [
            "做PPT", "做个PPT", "制作PPT", "生成PPT", "演示文稿", "幻灯片", "slides", "deck",
            "keynote", "presentation", "汇报PPT", "工作汇报", "年终总结PPT", "述职PPT",
            "商业计划PPT", "技术分享", "技术演讲", "产品发布PPT", "新品发布PPT",
            "培训PPT", "课件PPT", "加盟招商PPT", "品牌介绍PPT", "菜单展示PPT",
            "营销方案PPT", "融资路演", "pitch deck", "HTML演示", "网页版PPT",
        ];
        if ppt_keywords.iter().any(|k| um.contains(k)) {
            Some(r#"## 🎬 HTML PPT 演示文稿生成模式已激活

用户要求制作PPT/演示文稿。你必须生成一个完整的HTML文件，用户双击即可在浏览器中打开并演示。

### 你需要做的：
1. **先问3个问题**（如果用户还没提供）：主题/页数、受众/场景、风格偏好
2. **生成完整HTML文件**：一个自包含的HTML文件（内联CSS+JS），包含所有幻灯片
3. **每页一个slide**：用 `<section class="slide">` 标签，第一个加 `is-active` 类
4. **键盘导航**：必须包含简单的JS实现 ← → 箭头键翻页、F全屏
5. **输出格式**：直接输出完整HTML代码块（```html），不要解释代码

### 设计规范：
- 使用CSS变量定义主题色，不要硬编码颜色
- 推荐配色方案：深色科技风(#0f172a底+#38bdf8强调)、商务蓝(#1e3a5f底+#f59e0b强调)、清新绿(#f0fdf4底+#16a34a强调)、暖橙(#fff7ed底+#ea580c强调)
- 字体：system-ui, -apple-system, sans-serif
- 宽屏比例16:9，内容区域居中max-width: 960px
- 每页只讲一个核心观点，文字不超过6行
- 用加粗、颜色变化、图标符号来增强视觉层次

### 禁止事项：
- 不要只输出大纲或文字描述，必须输出完整可运行的HTML代码
- 不要把内容分成多个HTML文件，必须是一个自包含的文件
- 不要使用外部CDN依赖（字体和图标除外）
"#.to_string())
        } else { None }
    };

    // 🧠 Phase 2-2: 搜索相关记忆（从learning.db召回）
    crate::claw_log::log_info("DIAG", "call_ai_streaming [0a] 🔍 memory_search 开始");
    let memory_context: Option<String> = {
        // 尝试通过 app state 获取 learning state 并搜索
        if let Some(learning_state) = app.try_state::<std::sync::Mutex<Option<crate::learning::LearningState>>>() {
            if let Ok(guard) = learning_state.lock() {
                if let Some(ls) = guard.as_ref() {
                    if !um.is_empty() {
                        if let Ok(memories) = ls.search_memories(um, 3) {
                            if !memories.is_empty() {
                                let ctx = memories.iter()
                                    .map(|m| format!("- [{}] {}", m.category, m.content))
                                    .collect::<Vec<_>>()
                                    .join("\n");
                                Some(format!(
                                    "\n\n## 📝 相关经验参考（来自学习记忆库）\n> 以下内容基于历史用户反馈和经验积累，供你参考：\n{}\n\
                                     请在回答时适当结合这些经验，但不要直接引用此段。",
                                    ctx
                                ))
                            } else { None }
                        } else { None }
                    } else { None }
                } else { None }
            } else { None }
        } else { None }
    };

    // ====== 智能任务分析 ======
    // 🔧 B079: 诊断日志——记录um关键信息
    crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [0b-pre] um_len={}, um_prefix={}, is_catering={}",
        um.len(), truncate_for_log(um, 100), is_catering_related(um)));
    let task_type = analyze_task_type(um);
    let is_catering = is_catering_related(um);
    
    // ═══ v5.5.3: 瀑布流重构 — 6阶段真推理展示 ═══
    // Phase 1: 深度思考 → Phase 2: 意图判断 → Phase 3: 行动计划
    // → Phase 4: 工具执行(逐个) → Phase 5: 综合答案 → Phase 6: 回复交付

    crate::claw_log::log_info("DIAG", "call_ai_streaming [0b] ✅ memory_search 完成");

    // Phase 1: 🧠 深度思考（推理开始，让用户知道AI正在分析）
    emit_event(app, "thinking", "🧠 深度思考中...", "正在分析你的需求，拆解问题结构", "🧠");

    // Phase 2: 🎯 意图分析 + 技能匹配
    let sks = if is_catering && task_type != TaskType::FileAnalysis {
        skill_match(um)
    } else {
        skill_match(um).into_iter().filter(|s| s.cat == "通用工具").collect::<Vec<_>>()
    };
    let (task_label, skill_info) = if task_type == TaskType::FileAnalysis {
        ("📄 判断为：文件分析任务", "将提取文档/图片中的关键信息".to_string())
    } else if task_type == TaskType::RealTimeQuery {
        ("🌐 判断为：实时查询任务", "需要获取最新数据来回答".to_string())
    } else if task_type == TaskType::DeepThinking {
        ("🤔 判断为：深度分析任务", "将进行多维度综合分析".to_string())
    } else if is_catering {
        let (ititle, idesc, _) = intent_detail(um);
        let skill_names: String = if sks.is_empty() {
            "通用餐饮知识库".to_string()
        } else {
            sks.iter().take(3).map(|s| s.name.clone()).collect::<Vec<_>>().join("、")
        };
        (ititle, format!("{} | 匹配技能: {}", idesc, skill_names))
    } else {
        ("🔍 判断为：通用问题", "使用大模型通用能力分析".to_string())
    };
    emit_event(app, "intent", task_label, &skill_info, "🎯");

    // Phase 3: 📋 行动计划预览
    let mut plan_actions: Vec<String> = Vec::new();
    if task_type == TaskType::RealTimeQuery {
        plan_actions.push("🌐 抓取实时热榜数据".to_string());
    }
    if is_catering && !sks.is_empty() {
        let skill_preview = sks.iter().take(3).map(|s| format!("🔧 {}", s.name)).collect::<Vec<_>>().join("、");
        plan_actions.push(format!("📚 调用餐饮专业技能: {}", skill_preview));
    }
    plan_actions.push("🧠 检索知识库与跨会话记忆".to_string());
    plan_actions.push("🤖 调用大模型生成回答".to_string());
    if !plan_actions.is_empty() {
        emit_event(app, "plan", "📋 行动计划", &plan_actions.join("\n"), "📋");
    }

    // Phase 4: 🔧 工具执行（逐个展示，不再合并到 knowledge_retrieval）

    crate::claw_log::log_info("DIAG", "call_ai_streaming [0c] 🎯技能匹配完成");

    // 🌐 Step 4a: 实时信息获取（如果是RealTimeQuery类型）
    let mut realtime_context: Option<String> = None;
    if task_type == TaskType::RealTimeQuery {
        emit_event(app, "tool", "🌐 正在抓取实时数据...", "连接热榜API获取最新信息", "🌐");

        // 🛑 B059 fix: 30s超时 + connect_timeout确保不卡死
        match tokio::time::timeout(
            std::time::Duration::from_secs(30),
            crate::web_tools::fetch_hot_trends(None)
        ).await {
            Ok(Ok(boards)) => {
                let hot_text = crate::web_tools::format_hot_board(&boards);
                emit_event(app, "tool_done", "✅ 实时数据获取成功", &format!("已获取 {} 个平台热榜数据", boards.len()), "✅");
                realtime_context = Some(format!(
                    "\n\n## 🌐 实时信息参考（{}）\n{}\n请基于以上实时信息，结合你的专业知识进行分析和回答。",
                    chrono::Local::now().format("%Y-%m-%d %H:%M"),
                    hot_text
                ));
            }
            Ok(Err(e)) => {
                emit_event(app, "tool_error", "⚠️ 实时数据获取失败", &format!("原因: {}，将使用知识库回答", e), "⚠️");
            }
            Err(_) => {
                emit_event(app, "tool_error", "⏰ 实时数据获取超时", "热榜API响应超时(30s)，将使用知识库回答", "⏰");
            }
        }
    }

    // 🗺️ Step 9.6: 百度地图POI数据自动获取（选址意图触发）
    crate::claw_log::log_info("DIAG", "call_ai_streaming [0d] 🗺️地图数据 开始");
    let map_context: Option<String> = {
        // 🔧 B075: 文件分析场景跳过地图数据获取，避免阻塞文件分析流程
        let is_file_analysis = um.contains("📎 用户上传了以下")
            || um.contains("(文件分析请求)")
            || um.contains("--- 文档内容 ---")
            || um.contains("📎");
        if is_file_analysis {
            crate::claw_log::log_info("DIAG", "call_ai_streaming [0d] 🗺️地图数据 跳过(文件分析场景)");
            None
        } else {
        // 检测选址/地址/位置相关意图（B069修复：移除泛化词如"竞品/客流/商圈/配套"，
        // 这些词在热点分析、竞品研究等非选址场景频繁出现，导致误触发45秒地图API调用）
        let location_keywords = [
            "选址", "周边", "附近", "这个地方", "这个位置", "这里", "那里",
            "铺子", "铺面", "店面", "门店位置",
            "地铁口", "交通便利",
            "地址在", "位于", "坐标", "经纬度",
        ];
        let is_location_intent = location_keywords.iter().any(|k| um.contains(k));

        // B069二次校验：即使匹配了关键词，也要求消息中包含具体地址线索
        // （城市名、地址关键词、经纬度数字、地标/商场名），避免纯语义讨论触发
        let has_address_clue = um.contains("路") || um.contains("街") || um.contains("号")
            || um.contains("区") || um.contains("市") || um.contains("省")
            || um.contains("镇") || um.contains("村") || um.contains("广场")
            || um.contains("商场") || um.contains("购物中心") || um.contains("大厦")
            || um.contains("小区") || um.contains("写字楼") || um.contains("大厦")
            || um.contains("坐标") || um.contains("经纬") || um.contains("纬度") || um.contains("经度")
            || um.contains("东经") || um.contains("北纬") || um.contains("南纬") || um.contains("西经")
            || um.chars().any(|c| c.is_ascii_digit() && (um.contains("°") || um.contains("度")));

        let should_fetch_map = is_location_intent && has_address_clue;

        if should_fetch_map {
            emit_event(app, "tool", "🗺️ 正在获取地图数据...",
                "检索周边POI、竞品分布、配套设施", "🗺️");

            // 🔧 B101修复: 整体超时 45s→20s（单次请求6s+重试，3次串行步骤最多18s）
            let map_result = tokio::time::timeout(
                std::time::Duration::from_secs(20),
                async {
                    // v4.9.8: 首次尝试
                    let attempt = fetch_map_context(um).await;
                    // 如果首次失败（非空结果），等1秒后重试一次
                    match &attempt {
                        Ok(ctx) if !ctx.is_empty() => Ok(ctx.clone()),
                        _ => {
                            emit_log("🗺️ [RETRY] 首次地图获取无数据，1s后重试...");
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            let retry = fetch_map_context(um).await;
                            match &retry {
                                Ok(ctx) if !ctx.is_empty() => Ok(ctx.clone()),
                                Ok(_) => Err("重试后仍无地图数据".to_string()),
                                Err(e) => Err(format!("重试仍失败: {}", e)),
                            }
                        }
                    }
                }
            ).await;

            match map_result {
                Ok(Ok(ctx)) => {
                    if !ctx.is_empty() {
                        emit_event(app, "tool_done", "✅ 地图数据获取成功",
                            "已获取周边POI/竞品/设施数据，注入分析上下文", "✅");
                        Some(ctx)
                    } else {
                        emit_event(app, "tool_error", "⚠️ 地图无结果",
                            "该区域未检索到匹配的POI数据，将基于知识库回答", "⚠️");
                        None
                    }
                }
                Ok(Err(e)) => {
                    emit_event(app, "tool_error", "⚠️ 地图数据获取失败",
                        &format!("原因: {}，将使用知识库回答", e), "⚠️");
                    None
                }
                Err(_) => {
                    // 超时：20秒内未完成，放弃地图数据继续流程
                    emit_log("⚠️ 地图API获取超时(20s)，跳过地图数据");
                    emit_event(app, "tool_error", "⚠️ 地图数据超时",
                        "地图API响应超时，将基于知识库回答（不影响最终结果）", "⏰");
                    None
                }
            }
        } else {
            None
        }
        }  // 关闭 else { is_file_analysis }
    };

    // 📁 Step 9.7: 本地文件读取（用户要求读取本地文件时自动执行）
    crate::claw_log::log_info("DIAG", "call_ai_streaming [0e] 📁文件读取 开始");
    let file_context: Option<String> = {
        // 🔧 B077: 文件上传场景跳过文件读取，避免误触发
        // 前端已将文件内容嵌入消息（📎 + --- 文档内容 ---），无需后端再次读取本地文件
        let is_file_upload_scene = um.contains("📎 用户上传了以下")
            || um.contains("(文件分析请求)")
            || um.contains("--- 文档内容 ---")
            || um.contains("📎");
        if is_file_upload_scene {
            crate::claw_log::log_info("DIAG", "call_ai_streaming [0e] 📁文件读取 跳过(文件上传场景)");
            None
        } else {
        let file_keywords = [
            "读取文件", "打开文件", "查看文件", "读一下", "帮我读", "帮我打开",
            "读取一下", "看一下", "查看一下", "帮我查看", "分析文件", "解析文件",
            "Downloads", "downloads", "桌面", "文档", "Desktop", "Documents",
            "下载文档", "读取本地", "本地文件", "word", "Word", "docx", "pdf",
            "读取我", "帮我读", "帮我打开",
        ];
        let is_file_intent = file_keywords.iter().any(|k| um.contains(k));

        if is_file_intent {
            emit_event(app, "knowledge_retrieval", "📁 正在读取本地文件...",
                "检测到文件读取请求，正在解析文件路径", "📁");

            // 尝试从用户消息中提取文件路径
            let extracted_path = extract_file_path(um);
            match extracted_path {
                Some(path) => {
                    emit_event(app, "knowledge_retrieval", &format!("📁 正在读取: {}", path),
                        "读取文件内容中...", "📄");
                    match tokio::time::timeout(
                        std::time::Duration::from_secs(FILE_READ_TIMEOUT_SECS),
                        read_local_file(&path)
                    ).await {
                        Ok(Ok(content)) => {
                            let content_len = content.len();
                            // v5.5.13: char_indices 安全截取，修复中文文档 char boundary panic
                            let preview = if content.chars().count() > 3000 {
                                format!("{}...(共{}字符)", safe_truncate_chars(&content, 3000), content_len)
                            } else {
                                content.clone()
                            };
                            emit_event(app, "knowledge_retrieval", "✅ 文件读取成功",
                                &format!("已读取文件内容({}字符)", content_len), "✅");
                            Some(format!(
                                "\n\n## 📁 本地文件内容\n文件路径: {}\n\n```\n{}\n```\n\n请基于以上文件内容回答用户的问题。如果文件内容不足以回答，请说明缺少什么信息。",
                                path, preview
                            ))
                        }
                        Ok(Err(e)) => {
                            emit_event(app, "knowledge_retrieval", "⚠️ 文件读取失败",
                                &format!("原因: {}", e), "⚠️");
                            Some(format!(
                                "\n\n## ⚠️ 文件读取失败\n尝试读取: {}\n错误: {}\n\n请告知用户文件读取失败，并建议用户检查文件路径和权限。",
                                path, e
                            ))
                        }
                        Err(_) => {
                            emit_event(app, "knowledge_retrieval", "⚠️ 文件读取超时",
                                "读取超过10秒，已取消", "⏰");
                            Some("\n\n## ⚠️ 文件读取超时\n读取操作超过10秒，请建议用户检查文件是否过大或路径是否正确。".to_string())
                        }
                    }
                }
                None => {
                    // 没有提取到具体路径，让AI知道它有这个能力
                    emit_event(app, "knowledge_retrieval", "📁 未找到文件路径",
                        "请在回复中告知用户可以提供完整文件路径", "📁");
                    Some("\n\n## 📁 文件读取提示\n用户似乎想读取本地文件，但消息中没有明确的文件路径。请询问用户要读取哪个文件的完整路径。\n例如：'读取 ~/Downloads/报告.pdf' 或 '打开 /Users/xxx/Desktop/数据.xlsx'".to_string())
                }
            }
        } else {
            None
        }
        }  // 关闭 else { is_file_upload_scene }
    };

    // 🧠 v5.2: 长期记忆压缩注入
    let long_term_memory: Option<String> = long_term_memory.map(|s| s.to_string());

    // 🧠 合并动态红线 + PPT上下文 + 记忆上下文 + 实时数据 + 地图数据
    let combined_addition = {
        let mut base = match (&dynamic_redline_addition, &html_ppt_context, &memory_context) {
            (Some(r), Some(p), Some(m)) => format!("{}{}{}", r, p, m),
            (Some(r), Some(p), None) => format!("{}{}", r, p),
            (Some(r), None, Some(m)) => format!("{}{}", r, m),
            (None, Some(p), Some(m)) => format!("{}{}", p, m),
            (Some(r), None, None) => r.clone(),
            (None, Some(p), None) => p.clone(),
            (None, None, Some(m)) => m.clone(),
            (None, None, None) => String::new(),
        };
        // 🧠 v5.2: 追加长期记忆（MEMORY.md）
        let base = match long_term_memory {
            Some(ref ltm) => format!("{}\n{}", base, ltm),
            None => base,
        };
        let with_realtime = match (base, realtime_context) {
            (b, Some(rt)) => format!("{}\n{}", b, rt),
            (b, None) => b,
        };
        // 最后叠加地图数据
        let with_map = match (with_realtime, map_context) {
            (b, Some(mc)) => format!("{}\n{}", b, mc),
            (b, None) => b,
        };
        // 📁 叠加本地文件内容
        let with_file = match (with_map, file_context) {
            (b, Some(fc)) => format!("{}\n{}", b, fc),
            (b, None) => b,
        };
        // 📚 Layer 5: RAG知识库检索
        let rag_context: Option<String> = {
            crate::claw_log::log_info("DIAG", "call_ai_streaming [0f] 📚RAG检索 开始");
            // 先同步获取RAG状态（不能跨await持有MutexGuard）
            // 🔧 v5.5.5: 使用try_lock()代替lock()，防止Mutex被占用时阻塞整个async任务
            let (kb_initialized, kb_path) = {
                if let Some(rag_state) = app.try_state::<std::sync::Mutex<Option<crate::rag_engine::RagState>>>() {
                    match rag_state.try_lock() {
                        Ok(guard) => {
                            if let Some(rs) = guard.as_ref() {
                                (rs.get_status().initialized, Some(rs.get_kb_dir()))
                            } else { (false, None) }
                        }
                        Err(_) => {
                            crate::claw_log::log_warn("DIAG", "RAG Mutex被占用，跳过RAG检索");
                            (false, None)
                        }
                    }
                } else { (false, None) }
            };
            // guard已drop，现在可以安全await
            crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [0f1] RAG决策: kb_init={}, has_path={}, um_empty={}", kb_initialized, kb_path.is_some(), um.is_empty()));
            if let Some(path) = kb_path {
                if kb_initialized && !um.is_empty() {
                    crate::claw_log::log_info("DIAG", "call_ai_streaming [0f2] 🚀进入RAG检索timeout");
                    // 🔧 v5.5.4: 添加15秒超时保护，防止LanceDB/bge-m3挂起导致聊天卡死
                    match tokio::time::timeout(Duration::from_secs(RAG_TIMEOUT_SECS), crate::rag_engine::retrieve_knowledge(&path, um, 5)).await {
                        Ok(Ok(chunks)) if !chunks.is_empty() => {
                            emit_event(app, "knowledge_retrieval",
                                &format!("📚 检索到 {} 条相关知识", chunks.len()),
                                "已注入知识库上下文", "✅");
                            crate::rag_engine::RagState::format_rag_context(&chunks)
                        }
                        Err(_elapsed) => {
                            emit_event(app, "knowledge_retrieval",
                                "⚠️ RAG检索超时(15s)",
                                "跳过知识库检索，继续对话",
                                "⚠️");
                            None
                        }
                        _ => None,
                    }
                } else { None }
            } else { None }
        };
        crate::claw_log::log_info("DIAG", "call_ai_streaming [0f3] ✅RAG检索完成");
        // 合并 RAG 层
        let with_rag = match (with_file, rag_context) {
            (b, Some(rc)) => format!("{}\n{}", b, rc),
            (b, None) => b,
        };
        // 🧠 Layer 6: 跨会话记忆检索（v5.1.1 → v5.2.1增强日志）
        // 🔧 v5.5.7→v5.5.8: 增加精细DIAG日志，定位定时任务卡死在跨会话记忆步骤的根因
        crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [0g] 🧠跨会话记忆 开始: sid={}, um_empty={}, um_len={}",
            req.session_id.as_deref().unwrap_or("主聊天"),
            um.is_empty(),
            um.len()));
        let cross_session_context: Option<String> = {
            let current_sid = req.session_id.as_deref().unwrap_or("");
            if !um.is_empty() {
                emit_event(app, "knowledge_retrieval",
                    "🧠 正在检索跨会话记忆...",
                    &format!("当前会话ID: {} | 查询: {}", if current_sid.is_empty() { "主聊天" } else { current_sid }, truncate_for_log(um, 40)),
                    "🔍");
                // 🔧 B074: 新增DIAG日志，定位emit_event与app_data_dir之间的阻塞点
                crate::claw_log::log_info("DIAG", "call_ai_streaming [0g-pre] ✅emit_event完成，即将使用缓存的app_data_dir");
                match &cached_data_dir {
                    Some(data_dir) => {
                        // 🔧 v5.5.7→v5.5.8: 改用 tokio::spawn + tokio::select! 替代 std::thread+Runtime::new()
                        // 根因分析：std::thread::spawn + Runtime::new() 在定时任务场景下thread可能永不启动或卡死
                        // tokio::select! 提供可靠的超时机制，且使用主runtime的async能力
                        let dir = data_dir.clone();
                        let q = um.to_string();
                        let sid = current_sid.to_string();
                        crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [0g0] 🚀tokio::spawn跨会话记忆任务: sid={}", sid));
                        
                        // 🔧 v5.5.7→v5.5.8: 使用Arc<tokio::sync::Mutex<()>>序列化LanceDB访问，防止并发连接争用
                        // 使用tokio::sync::Mutex而非std::sync::Mutex，因为guard需要跨越.await
                        use std::sync::Arc;
                        static LANCEDB_MUTEX: std::sync::LazyLock<Arc<tokio::sync::Mutex<()>>> = 
                            std::sync::LazyLock::new(|| Arc::new(tokio::sync::Mutex::new(())));
                        let lancedb_lock = LANCEDB_MUTEX.clone();
                        let sid_for_log = sid.clone();
                        let sid_for_retrieve = sid.clone();
                        
                        let memory_task = tokio::spawn(async move {
                            let _guard = lancedb_lock.lock().await;
                            crate::claw_log::log_info("DIAG", &format!("🧵[tokio::spawn] 🔒获取LanceDB锁, 开始retrieve_memories: sid={}", sid_for_retrieve));
                            let result = crate::cross_session_memory::retrieve_memories(&dir, &q, &sid_for_retrieve).await;
                            crate::claw_log::log_info("DIAG", &format!("🧵[tokio::spawn] ✅retrieve_memories完成: sid={}", sid_for_retrieve));
                            result
                        });
                        
                        crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [0g1] ⏱️tokio::select! 等待最多15s: sid={}", sid_for_log));
                        let memory_result = tokio::select! {
                            task_result = memory_task => {
                                crate::claw_log::log_info("DIAG", "call_ai_streaming [0g2a] 📬memory_task完成");
                                match task_result {
                                    Ok(mem_result) => mem_result,
                                    Err(join_err) => {
                                        crate::claw_log::log_warn("DIAG", &format!("call_ai_streaming [0g2a] ❌tokio::spawn JoinError: {}", join_err));
                                        Err(format!("tokio::spawn失败: {}", join_err))
                                    }
                                }
                            }
                            _ = tokio::time::sleep(Duration::from_secs(MEMORY_TIMEOUT_SECS)) => {
                                crate::claw_log::log_warn("DIAG", "call_ai_streaming [0g2b] ⏰tokio::select!超时(15s)");
                                Err("跨会话记忆检索超时(15s)".to_string())
                            }
                        };
                        crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [0g3] ✅select!返回: sid={}", sid_for_log));
                        match memory_result {
                            Ok(memories) if !memories.is_empty() => {
                                emit_event(app, "knowledge_retrieval",
                                    &format!("🧠 检索到 {} 条跨会话记忆", memories.len()),
                                    "已注入跨会话记忆上下文", "✅");
                                crate::cross_session_memory::format_cross_session_context(&memories)
                            }
                            Ok(_) => {
                                emit_event(app, "knowledge_retrieval",
                                    "📭 跨会话记忆检索完成",
                                    "未找到相关记忆（首次使用或相似度不足）", "📭");
                                None
                            }
                            Err(e) => {
                                emit_event(app, "knowledge_retrieval",
                                    "⚠️ 跨会话记忆检索异常",
                                    &format!("原因: {}", truncate_for_log(&e, 80)), "⚠️");
                                None
                            }
                        }
                    }
                    None => {
                        emit_event(app, "knowledge_retrieval",
                            "⚠️ 无法获取数据目录",
                            "app_data_dir缓存为空", "⚠️");
                        None
                    }
                }
            } else { None }
        };
        crate::claw_log::log_info("DIAG", "call_ai_streaming [0h] ✅跨会话记忆完成");
        let with_cross = match (with_rag, cross_session_context) {
            (b, Some(cs)) => format!("{}\n{}", b, cs),
            (b, None) => b,
        };
        // 📝 Layer 7: 工作笔记MD上下文（v5.1.3）
        // 🔧 v5.5.5: spawn_blocking + timeout 防止同步I/O阻塞async运行时
        crate::claw_log::log_info("DIAG", "call_ai_streaming [0i] 📝工作笔记 开始");
        let notes_result = match app.path().app_data_dir() {
            Ok(data_dir) => {
                let dir = data_dir.clone();
                match tokio::time::timeout(
                    Duration::from_secs(NOTES_TIMEOUT_SECS),
                    tokio::task::spawn_blocking(move || {
                        crate::working_notes::get_notes_context(&dir, 3)
                    })
                ).await {
                    Ok(Ok(notes_ctx)) => {
                        notes_ctx
                    }
                    Ok(Err(e)) => {
                        crate::claw_log::log_warn("DIAG", &format!("工作笔记spawn_blocking错误: {}", e));
                        None
                    }
                    Err(_) => {
                        crate::claw_log::log_warn("DIAG", "工作笔记检索超时(10s)，跳过");
                        None
                    }
                }
            }
            Err(e) => {
                crate::claw_log::log_warn("DIAG", &format!("工作笔记path错误: {}", e));
                None
            }
        };
        let with_notes = match notes_result {
            Some(notes_ctx) => {
                crate::claw_log::log_info("DIAG", "call_ai_streaming [0i1] 📝工作笔记查到内容");
                format!("{}\n{}", with_cross, notes_ctx)
            }
            None => {
                crate::claw_log::log_info("DIAG", "call_ai_streaming [0i1] 📝工作笔记无内容");
                with_cross
            }
        };
        with_notes
    };
    crate::claw_log::log_info("DIAG", "call_ai_streaming [0j] ✅上下文合并完成");
    let combined_addition_opt = if combined_addition.is_empty() { None } else { Some(combined_addition) };

    // Phase 5: ✨ 综合答案 — 汇总所有工具结果 + 大模型推理生成
    let key = get_key(model);
    // v5.5.3: 将自动匹配的技能注入API上下文，强制AI使用专业技能
    let skill_context = if is_catering && !sks.is_empty() {
        let skill_list = sks.iter().map(|s| format!("- {} (类别:{})", s.name, s.cat)).collect::<Vec<_>>().join("\n");
        Some(format!("\n\n## 🔧 已匹配的专业技能\n系统已自动匹配以下餐饮专业技能，请在回答中充分利用这些专业知识：\n{}\n\n**重要**：请基于上述专业技能的知识体系进行回答，不要给出泛泛的通用建议。", skill_list))
    } else { None };
    let final_combined = match (combined_addition_opt.as_deref(), skill_context.as_deref()) {
        (Some(ca), Some(sc)) => Some(format!("{}{}", ca, sc)),
        (Some(ca), None) => Some(ca.to_string()),
        (None, Some(sc)) => Some(sc.to_string()),
        (None, None) => None,
    };
    // 🔧 B079: 诊断日志——记录最终注入的上下文长度
    let final_combined_len = final_combined.as_ref().map(|s| s.len()).unwrap_or(0);
    crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [5-pre] final_combined_len={}, has_skill_ctx={}, has_addition={}",
        final_combined_len, skill_context.is_some(), combined_addition_opt.is_some()));
    emit_event(app, "synthesize", "✨ 正在整理答案...", "综合知识库、实时数据、记忆上下文，生成回复", "✨");
    crate::claw_log::log_info("DIAG", "call_ai_streaming [5] 🚀准备调用real_api_streaming");
    let final_content = if !key.is_empty() {
        real_api_streaming(&app, &key, model, req, final_combined.as_deref()).await?
    } else {
        demo_gen(um, &sks)
    };

    crate::claw_log::log_info("DIAG", &format!("call_ai_streaming [6] ✅real_api返回: content_len={}, empty={}", final_content.len(), final_content.is_empty()));
    if final_content.is_empty() {
        crate::claw_log::log_error("DIAG", "call_ai_streaming [6a] ❌real_api返回空内容！可能原因：①API返回空SSE ②content/reasoning均为空 ③finish_reason=content_filter");
    }
    // Step 11: 流式内容已由 real_api_streaming 推送，直接返回
    Ok(final_content)
}

// ============================================================
// 辅助函数
// ============================================================

/// 意图识别增强版：返回 (标题, 描述, 细节信息)
fn intent_detail(msg: &str) -> (&'static str, &'static str, &'static str) {
    if msg.contains("选址")||msg.contains("开店")||msg.contains("位置")||msg.contains("铺子")||msg.contains("商场") {
        ("🔍 识别为：选址评估", "位置 + 人流量 + 可达性 + 聚客点 + 租金性价比", "品类/规模/城市/阶段")
    } else if msg.contains("菜单")||msg.contains("定价")||msg.contains("价格")||msg.contains("菜品")||msg.contains("套餐") {
        ("🔍 识别为：菜单工程", "定价心理学 + 菜单矩阵 + 贡献毛利 + 外卖菜单设计", "品类/客单价/毛利率")
    } else if msg.contains("成本")||msg.contains("毛利")||msg.contains("食材")||msg.contains("损耗")||msg.contains("降本") {
        ("🔍 识别为：成本控制", "食材成本追踪 + 损耗管理 + 供应商ABC分类 + 降本空间", "品类/月均食材成本/月营业额")
    } else if msg.contains("外卖")||msg.contains("美团")||msg.contains("淘宝闪购")||msg.contains("京东外卖")||msg.contains("京东秒送")||msg.contains("京东到家")||msg.contains("即时零售")||msg.contains("外卖运营")||msg.contains("外卖单量")||msg.contains("外卖评分")||msg.contains("被限流")||msg.contains("被降权")||msg.contains("被扣分")||msg.contains("刷单")||msg.contains("外卖违规")||msg.contains("外卖入驻")||msg.contains("上外卖")||msg.contains("多平台")||msg.contains("纯外卖") {
        ("🔍 识别为：外卖运营", "平台规则 + 流量获取 + 转化优化 + 评分维护 + 合规经营", "平台/品类/月均单量/评分")
    } else if msg.contains("规则")||msg.contains("违规")||msg.contains("处罚")||msg.contains("申诉")||msg.contains("扣分")||msg.contains("限流")||msg.contains("保证金")||msg.contains("抽成")||msg.contains("账期")||msg.contains("结算")||msg.contains("食安检查") {
        ("🔍 识别为：平台规则咨询", "美团/淘宝闪购/京东平台规则查询 + 违规应对 + 申诉支持", "平台/违规类型/店铺评分")
    } else if msg.contains("营销")||msg.contains("推广")||msg.contains("抖音")||msg.contains("小红书")||msg.contains("大众点评")||msg.contains("探店")||msg.contains("私域")||msg.contains("活动")||msg.contains("促销") {
        ("🔍 识别为：营销策略", "抖音/大众点评 + 私域流量 + 裂变传播 + 活动策划", "平台/预算/目标")
    } else if msg.contains("员工")||msg.contains("团队")||msg.contains("招聘")||msg.contains("排班")||msg.contains("留人")||msg.contains("培训") {
        ("🔍 识别为：团队管理", "招聘流程 + KSF薪酬设计 + 留存SOP + 培训体系", "岗位/人数/月薪范围")
    } else if msg.contains("加盟")||msg.contains("连锁")||msg.contains("扩张")||msg.contains("标准化") {
        ("🔍 识别为：加盟扩张", "直营vs加盟决策 + 标准化体系 + 加盟商管控 + 控制体系", "当前门店数/品类/目标")
    } else if msg.contains("融资")||msg.contains("股权")||msg.contains("投资")||msg.contains("估值")||msg.contains("上市")||msg.contains("退出") {
        ("🔍 识别为：资本运作", "融资谈判 + 股权设计 + 估值方法 + 投资人关系 + 退出路径", "阶段/融资轮次/估值期望")
    } else if msg.contains("火锅")||msg.contains("串串")||msg.contains("麻辣烫") {
        ("🔍 识别为：火锅品类运营", "锅底管理 + 蘸料搭配 + 翻台率优化 + 食材损耗控制 + 客单价设计", "品类/面积/月均营收")
    } else if msg.contains("茶饮")||msg.contains("奶茶")||msg.contains("咖啡")||msg.contains("饮品") {
        ("🔍 识别为：茶饮品类运营", "配方研发 + 成本控制 + 季节性轮换 + 供应链 + 出杯效率", "品类/日均杯数/面积")
    } else if msg.contains("烧烤")||msg.contains("烤肉") {
        ("🔍 识别为：烧烤品类运营", "食材保鲜 + 翻台策略 + 酒水搭配 + 夜宵时段运营", "品类/面积/月均营收")
    } else if msg.contains("快餐")||msg.contains("简餐")||msg.contains("小厨")||msg.contains("盖饭") {
        ("🔍 识别为：快餐品类运营", "出餐速度 + 标准化流程 + 翻台率 + 人效管理 + 选址逻辑", "品类/面积/月均营收")
    } else if msg.contains("危机")||msg.contains("舆情")||msg.contains("差评")||msg.contains("投诉")||msg.contains("食安")||msg.contains("公关") {
        ("🔍 识别为：危机公关", "舆情监测 + 差评应对 + 食安处理 + 品牌修复 + 预防体系", "事件类型/传播范围/紧急程度")
    } else {
        ("🔍 识别为：综合咨询", "多维度餐厅经营分析，使用专家知识库进行全方位诊断", "品类/阶段/核心痛点")
    }
}

/// 兼容旧调用——保留intent作为intent_detail的别名
fn intent(msg: &str) -> (&'static str, &'static str) {
    let (title, desc, _) = intent_detail(msg);
    (title, desc)
}

struct Sk<'a>{name:&'a str,cat:&'a str}
fn skill_match(msg: &str) -> Vec<Sk> {
    let mut v=Vec::new();
    if msg.contains("选址")||msg.contains("租金")||msg.contains("人流")   {v.push(Sk{name:"L1-选址流量评估",cat:"选址模块"});v.push(Sk{name:"L2-千分法选址",cat:"选址模块"});}
    if msg.contains("菜单")||msg.contains("定价")||msg.contains("售价")   {v.push(Sk{name:"L1-菜单定价策略",cat:"产品模块"});v.push(Sk{name:"L2-菜单工程矩阵",cat:"产品模块"});}
    if msg.contains("成本")||msg.contains("毛利")||msg.contains("损耗")   {v.push(Sk{name:"L1-成本控制系统",cat:"财务模块"});v.push(Sk{name:"L2-库存优化",cat:"财务模块"});}
    if msg.contains("营销")||msg.contains("推广")||msg.contains("小红书"){v.push(Sk{name:"L1-促销策划",cat:"营销模块"});}
    if msg.contains("外卖")||msg.contains("美团")||msg.contains("淘宝闪购")||msg.contains("京东外卖")||msg.contains("京东秒送")||msg.contains("京东到家")||msg.contains("即时零售")||msg.contains("外卖运营")||msg.contains("外卖单量")||msg.contains("外卖评分")||msg.contains("被限流")||msg.contains("被降权")||msg.contains("被扣分")||msg.contains("刷单")||msg.contains("外卖违规")||msg.contains("外卖入驻")||msg.contains("上外卖")||msg.contains("新店")&&msg.contains("外卖")||msg.contains("起号")||msg.contains("螺旋递增")||msg.contains("压力测试")||msg.contains("点金")||msg.contains("推广")&&msg.contains("美团")||msg.contains("补单")||msg.contains("差评")&&msg.contains("恶意")||msg.contains("负反馈")
    {v.push(Sk{name:"L0-外卖指挥官",cat:"外卖总控"});v.push(Sk{name:"L2-外卖实战技巧172招",cat:"运营模块"});v.push(Sk{name:"L2-新店起号30天手册",cat:"运营模块"});v.push(Sk{name:"L2-美团进阶运营",cat:"运营模块"});v.push(Sk{name:"L2-外卖运营",cat:"营销模块"});v.push(Sk{name:"L1-外卖基础(三大平台)",cat:"运营模块"});}
    if msg.contains("规则")||msg.contains("违规")||msg.contains("处罚")||msg.contains("申诉")||msg.contains("扣分")||msg.contains("限流")||msg.contains("保证金")||msg.contains("抽成")||msg.contains("账期")||msg.contains("结算")||msg.contains("食安检查"){
        v.push(Sk{name:"L0-外卖指挥官",cat:"外卖总控"});
        v.push(Sk{name:"L1-meituan-rule",cat:"规则合规"});
        v.push(Sk{name:"L1-taobaoshangou-rule",cat:"规则合规"});
        v.push(Sk{name:"L1-jd-waimai-rule",cat:"规则合规"});
    }
    if msg.contains("员工")||msg.contains("团队")||msg.contains("招聘")  {v.push(Sk{name:"L1-招聘流程",cat:"团队模块"});v.push(Sk{name:"L2-员工留存",cat:"团队模块"});}
    if msg.contains("危机")||msg.contains("差评")||msg.contains("投诉")  {v.push(Sk{name:"L1-危机公关基础",cat:"风控模块"});}
    if msg.contains("审核")||msg.contains("合规")||msg.contains("能不能发")||msg.contains("有风险吗")||
       msg.contains("宣传检查")||msg.contains("海报审核")||msg.contains("广告法")||msg.contains("违禁词")||
       msg.contains("违法")||msg.contains("违规宣传")||msg.contains("绝对化用语")||
       msg.contains("这个能不能用")||msg.contains("这个文案")||msg.contains("帮我看看这个")
    {v.push(Sk{name:"L2-宣传审核专家",cat:"风控模块"});v.push(Sk{name:"L1-法务合规",cat:"法务模块"});}
    if msg.contains("加盟")||msg.contains("连锁")||msg.contains("扩张")||msg.contains("多店")||msg.contains("开店")||
       msg.contains("新开")||msg.contains("筹备")
    {v.push(Sk{name:"L3-区域扩张策略",cat:"战略模块"});v.push(Sk{name:"L2-新店开业",cat:"运营模块"});}
    if msg.contains("融资")||msg.contains("股权")||msg.contains("估值")  {v.push(Sk{name:"L3-融资谈判",cat:"资本模块"});v.push(Sk{name:"L3-股权设计",cat:"资本模块"});}
    if msg.contains("火锅")                      {v.push(Sk{name:"L2-火锅运营",cat:"品类模块"});}
    if msg.contains("烧烤")                      {v.push(Sk{name:"L2-BBQ运营",cat:"品类模块"});}
    if msg.contains("茶饮")||msg.contains("奶茶")||msg.contains("咖啡"){v.push(Sk{name:"L2-茶饮运营",cat:"品类模块"});}
    if msg.contains("快餐")||msg.contains("简餐")          {v.push(Sk{name:"L2-快餐运营",cat:"品类模块"});}
    if msg.contains("热点")||msg.contains("动态")||msg.contains("趋势")||msg.contains("行业新闻")||msg.contains("竞品动态")||msg.contains("政策变化")||msg.contains("监测")||msg.contains("舆情"){v.push(Sk{name:"L0-餐饮热点监测",cat:"通用工具"});}
    // 🎬 HTML PPT 演示文稿生成
    if msg.contains("做PPT")||msg.contains("做个PPT")||msg.contains("制作PPT")||msg.contains("生成PPT")||
       msg.contains("演示文稿")||msg.contains("幻灯片")||msg.contains("slides")||msg.contains("deck")||
       msg.contains("keynote")||msg.contains("presentation")||
       msg.contains("汇报PPT")||msg.contains("工作汇报")||msg.contains("月度汇报")||
       msg.contains("年终总结PPT")||msg.contains("述职PPT")||msg.contains("商业计划PPT")||
       msg.contains("技术分享")||msg.contains("技术演讲")||
       msg.contains("产品发布PPT")||msg.contains("新品发布PPT")||
       msg.contains("培训PPT")||msg.contains("课件PPT")||
       msg.contains("加盟招商PPT")||msg.contains("品牌介绍PPT")||
       msg.contains("菜单展示PPT")||msg.contains("营销方案PPT")||
       msg.contains("融资路演")||msg.contains("pitch deck")||
       msg.contains("HTML演示")||msg.contains("网页版PPT")
    {v.push(Sk{name:"L0-HTML PPT Studio",cat:"通用工具"});}
    if v.is_empty() {v.push(Sk{name:"L1-QSCV标准",cat:"运营模块"});v.push(Sk{name:"L1-服务标准",cat:"运营模块"});}
    v.truncate(5);v
}

fn calc_needed(m: &str) -> bool { ["成本","毛利","利润","定价","租金","营业额","ROI","盈亏","投资回报"].iter().any(|k|m.contains(*k))}

async fn real_api(key: &str, model: &str, req: &ChatRequest) -> Result<String,String> {
    let c = Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("client err: {}", e))?;
    let url=format!("{}/chat/completions",base_url(model));
    // 🧠 使用带动态红线的系统提示词构建函数（非流式版本，无学习状态引用）
    let system_content = build_system_prompt_with_learning(None, req.use_skill.as_deref());
    let mut ms=vec![json!({"role":"system","content":system_content})];
    for m in &req.messages {ms.push(json!({"role":m.role,"content":m.content}));}
    let b=json!({"model":model_name(model),"messages":ms,"temperature":0.7,"max_tokens":4096,"stream":false});
    let r=c.post(&url).header("Authorization",format!("Bearer {}",key)).header("Content-Type","application/json").json(&b).send().await.map_err(|e|format!("{}", e))?;
    if !r.status().is_success(){
        let status = r.status();
        if status.as_u16() == 504 {
            return Err("⚠️ API请求超时(504)。通常原因：图片过大或网络不稳定，请稍后重试。".to_string());
        }
        let body = r.text().await.unwrap_or_default();
        // v5.5.13: 安全截取，避免中文错误体 char boundary panic
        let detail = safe_truncate_bytes(&body, 200);
        return Err(format!("API error {}: {}", status, detail));
    }
    let v:Value=r.json().await.map_err(|e|format!("{}",e))?;
    // 🔧 修复：DeepSeek V4 Pro是推理模型，content可能为空，需fallback到reasoning_content
    let msg=&v["choices"][0]["message"];
    let c=msg["content"].as_str().unwrap_or("");
    if c.is_empty(){Ok(msg["reasoning_content"].as_str().unwrap_or("").to_string())}else{Ok(c.to_string())}
}

/// 🧠 v5.2.2: 真流式 API 调用 — SSE 逐 token 推送 content_chunk 事件
async fn real_api_streaming(
    app: &tauri::AppHandle,
    key: &str,
    model: &str,
    req: &ChatRequest,
    redline_addition: Option<&str>,
) -> Result<String, String> {
    crate::claw_log::log_info("DIAG", &format!("real_api_streaming [1] 🚀入口: model={}, url={}/chat/completions, msgs={}", model, base_url(model), req.messages.len()+1));

    let c = Client::builder()
        .timeout(Duration::from_secs(180))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("client err: {}", e))?;
    let url = format!("{}/chat/completions", base_url(model));
    let system_content = build_system_prompt_with_redline(redline_addition, req.use_skill.as_deref(), None);
    // 🔧 B079: 精确定位日志——记录消息结构
    let mut total_payload_chars = system_content.len();
    for (i, m) in req.messages.iter().enumerate() {
        let content_len = match &m.content {
            Value::String(s) => s.len(),
            Value::Array(arr) => arr.iter().filter_map(|p| p.get("text").and_then(|t| t.as_str()).map(|s| s.len())).sum(),
            other => format!("{:?}", other).len(),
        };
        total_payload_chars += content_len;
        if i < 3 || i == req.messages.len().saturating_sub(1) {
            crate::claw_log::log_info("DIAG", &format!("real_api_streaming [1a] msg[{}] role={} content_len={}", i, m.role, content_len));
        }
    }
    crate::claw_log::log_info("DIAG", &format!("real_api_streaming [1b] 总payload字符数={}", total_payload_chars));
    let mut ms = vec![json!({"role":"system","content":system_content})];
    for m in &req.messages { ms.push(json!({"role":m.role,"content":m.content})); }

    let b = json!({"model":model_name(model),"messages":ms,"temperature":0.7,"max_tokens":4096,"stream":true});
    let r = c.post(&url)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&b)
        .send().await.map_err(|e| {
            crate::claw_log::log_error("DIAG", &format!("real_api_streaming [2] ❌HTTP发送失败: {}", e));
            format!("{}", e)
        })?;

    crate::claw_log::log_info("DIAG", &format!("real_api_streaming [2] ✅HTTP请求已发送: status={}", r.status().as_u16()));

    if !r.status().is_success() {
        let status = r.status();
        crate::claw_log::log_error("DIAG", &format!("real_api_streaming [3] ❌HTTP错误: status={}", status.as_u16()));
        let body = r.text().await.unwrap_or_default();
        // 🔧 v5.5.4: 错误发生时立即通知前端，避免用户无感知等待
        let error_msg = if status.as_u16() == 504 {
            "⚠️ API请求超时(504)。请稍后重试。".to_string()
        } else {
            format!("API请求失败 {}: {}", status, safe_truncate_bytes(&body, 200))
        };
        emit_event(app, "error",
            &error_msg,
            &format!("状态码: {} | 模型: {}", status, model_name(model)),
            "❌");
        return Err(error_msg);
    }

    // 逐行读取 SSE 流
    let mut full_content = String::new();
    let mut reasoning_buf = String::new();
    let mut reasoning_line_count = 0u32;
    let mut sse_line_count = 0u32;
    let mut error_in_stream = false;
    let mut finish_reason_seen: Option<String> = None;
    // 🔧 v5.5.4: 批量推送content_chunk，避免每个SSE token都触发React重渲染
    let mut last_emit_time = std::time::Instant::now();
    let mut last_emitted_len = 0usize;
    use futures::StreamExt;
    let mut stream = r.bytes_stream();
    let mut buffer = String::new();
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        // 处理完整的 SSE 行
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
            buffer = buffer[newline_pos+1..].to_string();
            if line.is_empty() || line.starts_with(':') { continue; }
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    crate::claw_log::log_info("DIAG", "real_api_streaming [3a] ✅收到[DONE]");
                    break;
                }
                sse_line_count += 1;
                match serde_json::from_str::<Value>(data) {
                    Ok(v) => {
                        // 🔧 B079: 检测error事件
                        if v.get("error").is_some() {
                            let err_msg = v["error"]["message"].as_str().unwrap_or("未知错误");
                            let err_type = v["error"]["type"].as_str().unwrap_or("unknown");
                            crate::claw_log::log_error("DIAG", &format!("real_api_streaming [3b] ❌SSE流中error事件: type={}, msg={}", err_type, truncate_for_log(err_msg, 200)));
                            error_in_stream = true;
                            continue;
                        }
                        // 🔧 B079: 检测choices缺失或为空
                        let choices = v.get("choices").and_then(|c| c.as_array());
                        if choices.is_none() || choices.unwrap().is_empty() {
                            let keys: Vec<String> = v.as_object().map(|o| o.keys().cloned().collect()).unwrap_or_default();
                            crate::claw_log::log_warn("DIAG", &format!("real_api_streaming [3c] ⚠️SSE流中choices缺失/为空, top_keys={:?}, data前100={}", keys, truncate_for_log(data, 100)));
                            continue;
                        }
                        let choice = &choices.unwrap()[0];
                        // 🔧 B079: 检测finish_reason
                        if let Some(fr) = choice["finish_reason"].as_str() {
                            if !fr.is_empty() && finish_reason_seen.is_none() {
                                finish_reason_seen = Some(fr.to_string());
                                crate::claw_log::log_info("DIAG", &format!("real_api_streaming [3d] 🏁finish_reason={}", fr));
                            }
                        }
                        let delta = &choice["delta"];
                        // 🆕 v5.5.1: 捕获 DeepSeek reasoning_content 作为思考步骤
                        if let Some(reasoning) = delta["reasoning_content"].as_str() {
                            reasoning_buf.push_str(reasoning);
                            reasoning_line_count += 1;
                            // 每10个reasoning token或遇到换行时更新一次思考步骤
                            if reasoning_line_count % 10 == 0 || reasoning.contains('\n') {
                                let preview: String = reasoning_buf
                                    .lines()
                                    .last()
                                    .unwrap_or(&reasoning_buf)
                                    .chars().take(80).collect();
                                emit_event(app, "deepseek_reasoning",
                                    "🧠 DeepSeek 推理中...",
                                    &preview,
                                    "🧠");
                            }
                        }
                        if let Some(content_delta) = delta["content"].as_str() {
                            full_content.push_str(content_delta);
                        }
                        // 🔧 B079: 记录前3个和最后1个SSE data的内容摘要（用于诊断空返回）
                        if sse_line_count <= 3 || sse_line_count % 50 == 0 {
                            let has_r = delta.get("reasoning_content").is_some();
                            let has_c = delta.get("content").is_some();
                            crate::claw_log::log_info("DIAG", &format!("real_api_streaming [3e] SSE[{}] has_r={} has_c={} content_so_far={} reasoning_so_far={}",
                                sse_line_count, has_r, has_c, full_content.len(), reasoning_buf.len()));
                        }
                    }
                    Err(e) => {
                        crate::claw_log::log_warn("DIAG", &format!("real_api_streaming [3f] ⚠️SSE data JSON解析失败: {} | data前100={}", e, truncate_for_log(data, 100)));
                    }
                }
                // 🔧 v5.5.4: 批量推送content_chunk（50ms或≥20字符），避免每个SSE token都触发React重渲染
                if !full_content.is_empty() {
                    let now = std::time::Instant::now();
                    let content_grew = full_content.len() - last_emitted_len;
                    if now.duration_since(last_emit_time) > Duration::from_millis(50) || content_grew >= 20 {
                        emit_content(app, &full_content, false);
                        last_emit_time = now;
                        last_emitted_len = full_content.len();
                    }
                }
            }
        }
    }
    crate::claw_log::log_info("DIAG", &format!("real_api_streaming [4] 📊SSE流结束: content_len={}, reasoning_len={}, reasoning_lines={}, sse_lines={}, error_in_stream={}, finish_reason={:?}, buffer_remain={}",
        full_content.len(), reasoning_buf.len(), reasoning_line_count, sse_line_count, error_in_stream, finish_reason_seen, buffer.len()));
    if !buffer.is_empty() {
        crate::claw_log::log_warn("DIAG", &format!("real_api_streaming [4a] ⚠️SSE流结束后buffer仍有残留: {}", truncate_for_log(&buffer, 200)));
    }
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    // 🔧 v5.5.5: 确保流结束前最后一批内容一定推送（批处理可能导致不足阈值的内容丢失）
    if !full_content.is_empty() && full_content.len() != last_emitted_len {
        emit_content(app, &full_content, false);
    }
    // 🔧 v5.5.4: DeepSeek V4 fallback — content为空时保留完整reasoning_content（之前粗暴裁剪"嗯，/好的，/让我"前缀可能导致乱码）
    let final_output = if full_content.is_empty() && !reasoning_buf.is_empty() {
        crate::claw_log::log_info("DIAG", "real_api_streaming [5] 🔄fallback到reasoning_content");
        emit_content(app, &reasoning_buf, true);
        reasoning_buf
    } else if full_content.is_empty() && reasoning_buf.is_empty() {
        crate::claw_log::log_warn("DIAG", "real_api_streaming [5a] ⚠️content和reasoning均为空，返回空字符串");
        emit_content(app, &full_content, true);
        full_content
    } else {
        emit_content(app, &full_content, true);
        full_content
    };
    Ok(final_output)
}

/// 🧠 带动态红线注入的流式API调用（用于call_ai_streaming_events）
async fn real_api_with_redline(
    key: &str,
    model: &str,
    req: &ChatRequest,
    redline_addition: Option<&str>,
) -> Result<String, String> {
    let c = Client::builder()
        .timeout(Duration::from_secs(180)) // v5.1.1: vision大图场景提升至180s
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("client err: {}", e))?;
    let url = format!("{}/chat/completions", base_url(model));

    // 🧠 构建带动态红线的系统提示词
    let system_content = build_system_prompt_with_redline(redline_addition, req.use_skill.as_deref(), None);

    let mut ms = vec![json!({"role":"system","content":system_content})];
    for m in &req.messages {
        ms.push(json!({"role": m.role, "content": m.content}));
    }

    // 🔍 Vision诊断日志：检查图片数据是否正确传递到API请求中
    if let Some(last) = req.messages.last() {
        match &last.content {
            serde_json::Value::Array(parts) => {
                let part_types: Vec<String> = parts.iter().filter_map(|p| {
                    p.get("type").and_then(|t| t.as_str()).map(|s| s.to_string())
                }).collect();
                let img_count = parts.iter().filter(|p| {
                    p.get("type").and_then(|t| t.as_str()) == Some("image_url")
                }).count();
                let has_data_url = parts.iter().any(|p| {
                    if let Some(url_val) = p.get("image_url").and_then(|iu| iu.get("url")) {
                        url_val.as_str().map_or(false, |s| s.starts_with("data:image"))
                    } else { false }
                });
                emit_log(&format!("🔍 [Vision诊断] model={} | 用户消息content类型=Array | parts={} | image_url数量={} | 含dataURL={} | partTypes={:?}", 
                    model, parts.len(), img_count, has_data_url, part_types));
            }
            serde_json::Value::String(s) => {
                emit_log(&format!("🔍 [Vision诊断] model={} | 用户消息content类型=String | 长度={}", model, s.len()));
            }
            other => {
                emit_log(&format!("🔍 [Vision诊断] model={} | 用户消息content类型=其他({:?})", model, other));
            }
        }
    }

    let b = json!({
        "model": model_name(model),
        "messages": ms,
        "temperature": 0.7,
        "max_tokens": 4096,
        "stream": false
    });

    let r = c.post(&url)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&b)
        .send()
        .await
        .map_err(|e| format!("{}", e))?;

    if !r.status().is_success() {
        let status = r.status();
        let body = r.text().await.unwrap_or_default();
        // v5.1.1: 504通常是图片过大或网络慢导致nginx超时
        if status.as_u16() == 504 {
            return Err("⚠️ API请求超时(504)。通常原因是：①图片过大（建议压缩至2MB以内） ②网络不稳定 ③AI服务繁忙。请稍后重试。".to_string());
        }
        // v5.5.13: 安全截取，避免中文错误体 char boundary panic
        let detail = safe_truncate_bytes(&body, 200);
        return Err(format!("API error {}: {}", status, detail));
    }
    let v: Value = r.json().await.map_err(|e| format!("{}", e))?;
    // 🔧 修复：DeepSeek V4 Pro是推理模型，content可能为空，需fallback到reasoning_content
    let msg = &v["choices"][0]["message"];
    let content = msg["content"].as_str().unwrap_or("");
    if content.is_empty() {
        Ok(msg["reasoning_content"].as_str().unwrap_or("").to_string())
    } else {
        Ok(content.to_string())
    }
}

// ============================================================
// 🗺️ 百度地图 Function Calling — 选址意图自动获取POI数据
// ============================================================

/// 从用户消息中提取选址相关信息，自动调用百度地图API获取真实POI数据
/// 返回格式化的上下文字符串，注入到system prompt中供LLM使用
async fn fetch_map_context(user_msg: &str) -> Result<String, String> {
    emit_log(&format!("🗺️ [MAP] 开始处理地图请求, msg_len={}", user_msg.len()));
    let start_time = std::time::Instant::now();

    // ---- Step 1: 从消息中提取关键信息 ----
    let extracted = extract_location_info(user_msg);

    // 如果完全提取不到任何地址线索，尝试用通用搜索
    let has_address = extracted.address.is_some() || extracted.city.is_some()
        || extracted.landmark.is_none() == false;

    let mut context_parts: Vec<String> = Vec::new();

    // ---- Step 2: 如果有具体地址，先地理编码获取坐标 ----
    // v4.9.5: 如果提取不到有效地址，直接跳过地图搜索，避免无效查询
    let coord: Option<String> = if let Some(addr) = &extracted.address {
        emit_log(&format!("🗺️ 地理编码: {}", addr));
        match map_geocoding(addr.clone(), extracted.city.clone()).await {
            Ok(result) => {
                // 🔥 v4.9.9 修复：百度API返回结构为 { status, result: { location: {lng, lat} } }
                // location 字段嵌套在 result 内部，必须逐层取
                let result_obj = result.get("result");
                let loc = result_obj.and_then(|r| r.get("location"));
                if let Some(loc) = loc {
                    let precise = result_obj
                        .and_then(|r| r.get("precise"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let confidence = result_obj
                        .and_then(|r| r.get("confidence"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let lng_f = loc["lng"].as_f64().or_else(|| loc["lng"].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0);
                    let lat_f = loc["lat"].as_f64().or_else(|| loc["lat"].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0);
                    if lng_f == 0.0 || lat_f == 0.0 {
                        emit_log("⚠️ 地理编码返回坐标为0，跳过POI搜索");
                        return Ok(String::new());
                    }
                    let formatted_addr = result.get("formatted_address")
                        .and_then(|v| v.as_str()).unwrap_or(addr);
                    emit_log(&format!("📍 地理编码成功: {} precise={} confidence={}", formatted_addr, precise, confidence));
                    context_parts.push(format!(
                        "**标准化地址**: {}\n**坐标**: {:.6}, {:.6}",
                        formatted_addr, lng_f, lat_f
                    ));
                    // ⚠️ Place API v2 要求 location 格式为 "纬度,经度"（lat,lng）
                    // 而地理编码返回的是 lng,lat 顺序，这里需要反转
                    Some(format!("{:.6},{:.6}", lat_f, lng_f))
                } else {
                    let status = result.get("status").and_then(|v| v.as_i64()).unwrap_or(-1);
                    emit_log(&format!("⚠️ 地理编码失败 status={}", status));
                    // v4.9.5: 地理编码失败时直接返回空，不再做无效POI搜索
                    return Ok(String::new());
                }
            }
            Err(e) => {
                emit_log(&format!("⚠️ 地理编码异常: {}", e));
                // v4.9.5: 异常时直接返回空，避免长时间等待
                return Ok(String::new());
            }
        }
    } else if let Some(ref c) = extracted.coord {
        Some(c.clone())
    } else {
        // v4.9.5: 无有效地址和坐标，直接跳过地图搜索
        return Ok(String::new());
    };

    // ---- Step 3: 基于坐标并行POI搜索（v4.9.5: 并行化加速）----
    let search_queries = build_search_queries(&extracted, user_msg);
    emit_log(&format!("🗺️ [MAP] Step3: 准备{}个POI查询", search_queries.len()));

    // 并行执行所有POI查询，用tokio::join!等待全部完成
    let poi_handles: Vec<_> = search_queries.iter().map(|(label, query, search_radius)| {
        let label = label.clone();
        let query = query.clone();
        let radius = *search_radius;
        let coord_clone = coord.clone();
        async move {
            emit_log(&format!("🗺️ POI搜索[{}]: {} r={}m", &label, &query, radius));
            match map_search(query, coord_clone, Some(radius), Some(20)).await {
                Ok(data) => Some((label, data, radius)),
                Err(e) => {
                    emit_log(&format!("⚠️ POI搜索[{}]失败: {}", &label, e));
                    None
                }
            }
        }
    }).collect();

    emit_log("🗺️ [MAP] 等待所有POI并行查询...");
    let poi_results = futures::future::join_all(poi_handles).await;
    emit_log(&format!("🗺️ [MAP] POI查询全部返回, 结果数={}", poi_results.len()));

    for result_opt in poi_results {
        if let Some((label, data, radius)) = result_opt {
            let formatted = format_poi_result(&label, &data, radius);
            if !formatted.is_empty() {
                context_parts.push(formatted);
            }
        }
        // v4.9.5: 查询间隔缩小到50ms（避免触发限流）
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    // ---- Step 4: 逆地理编码补充周边概况（如果有坐标）----
    if let Some(ref c) = coord {
        emit_log(&format!("🗺️ 逆地理编码: {}", c));
        match map_reverse_geocoding(c.clone(), Some("1".to_string())).await {
            Ok(data) => {
                if let Some(result) = data.get("result") {
                    let fmt_addr = result.get("formatted_address")
                        .and_then(|v| v.as_str()).unwrap_or("未知");
                    let business_circle = result.get("business_circle")
                        .and_then(|v| v.as_str()).unwrap_or("-");
                    context_parts.push(format!(
                        "**所在商圈**: {} | **标准地址**: {}",
                        business_circle, fmt_addr
                    ));
                }
            }
            Err(e) => {
                emit_log(&format!("⚠️ 逆地理编码失败: {}", e));
            }
        }
    }

    // ---- Step 5: 组装最终上下文 ----
    if context_parts.is_empty() {
        emit_log(&format!("🗺️ [MAP] 完成(空结果), 耗时={}ms", start_time.elapsed().as_millis()));
        return Ok(String::new());
    }

    emit_log(&format!("🗺️ [MAP] 完成(有数据), parts={}, 耗时={}ms", context_parts.len(), start_time.elapsed().as_millis()));
    Ok(format!(
        "\n\n## 🗺️ 百度地图实时POI数据（{}）\n\
         > 以下数据来自百度地图API实时检索，请基于这些真实数据回答用户问题。\n\
         > 数据可能存在更新延迟，建议关键决策前实地验证。\n\n\
         {}\n\
         ---\n\
         > ⚠️ 重要：以上为真实POI数据，你必须引用其中的具体店名、距离、评分、人均消费等数据来支撑你的分析。\n\
         > 如果数据不足以回答，可以基于数据说明\"该区域XX类型业态较少\"等事实性判断。\n\
         > 绝对禁止编造不在上述列表中的店名或数据！",
        chrono::Local::now().format("%Y-%m-%d %H:%M"),
        context_parts.join("\n\n")
    ))
}

/// 选址信息提取结果
struct LocationExtractedInfo {
    address: Option<String>,   // 具体地址文字
    city: Option<String>,      // 城市
    landmark: Option<String>,  // 地标/商圈名
    coord: Option<String>,     // 经纬度 "lng,lat"
    category: Option<String>,  // 餐饮品类(火锅/快餐/茶饮等)
    radius_hint: u32,          // 用户暗示的搜索半径
}

/// 从用户消息中智能提取选址相关信息
fn extract_location_info(msg: &str) -> LocationExtractedInfo {
    let mut info = LocationExtractedInfo {
        address: None,
        city: None,
        landmark: None,
        coord: None,
        category: None,
        radius_hint: 1000, // 默认1km
    };

    // 提取品类关键词
    let categories = [
        ("火锅", "火锅店"), ("烧烤", "烧烤"), ("烤肉", "烤肉"), ("串串", "串串香"),
        ("麻辣烫", "麻辣烫"), ("茶饮", "奶茶咖啡"), ("奶茶", "奶茶"), ("咖啡", "咖啡厅"),
        ("快餐", "快餐"), ("面馆", "面馆"), ("饺子", "饺子馆"), ("粥", "粥铺"),
        ("烘焙", "面包蛋糕"), ("西餐", "西餐厅"), ("日料", "日本料理"),
        ("韩餐", "韩国料理"), ("小吃", "小吃"), ("酒吧", "酒吧"),
        ("餐厅", "餐厅"), ("美食", "餐饮"), ("饭店", "饭店"),
        ("中餐", "中餐馆"), ("湘菜", "湘菜馆"), ("川菜", "川菜馆"),
        ("粤菜", "粤菜馆"), ("海鲜", "海鲜店"),
    ];
    for (kw, query) in categories.iter() {
        if msg.contains(kw) {
            info.category = Some(query.to_string());
            break; // 只取第一个匹配的品类
        }
    }

    // 提取半径提示
    if msg.contains("500") || msg.contains("步行") { info.radius_hint = 500; }
    else if msg.contains("2000") || msg.contains("2公里") || msg.contains("2km") { info.radius_hint = 2000; }
    else if msg.contains("3公里") || msg.contains("3km") { info.radius_hint = 3000; }

    // 尝试提取经纬度坐标 (格式: "xxx,yyy" 或 "xxx yyy" 或带"经纬度"字样)
    if let Some(coord_start) = msg.find("经纬度") {
        let after = &msg[coord_start..];
        let digits: String = after.chars().filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',' || *c == ' ').collect();
        let parts: Vec<&str> = digits.split(|c: char| c == ',' || c == ' ')
            .filter(|s| !s.is_empty())
            .collect();
        if parts.len() >= 2 {
            if let (Ok(lng), Ok(lat)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                if lng > 70.0 && lng < 136.0 && lat > 3.0 && lat < 54.0 {
                    info.coord = Some(format!("{},{}", lng, lat));
                }
            }
        }
    }

    // 提取城市名
    let cities = ["北京", "上海", "广州", "深圳", "杭州", "成都", "重庆", "武汉",
        "西安", "南京", "天津", "苏州", "长沙", "郑州", "东莞", "青岛", "沈阳",
        "宁波", "昆明", "合肥", "佛山", "福州", "无锡", "济南", "大连", "哈尔滨",
        "长春", "石家庄", "南宁", "南昌", "温州", "厦门", "贵阳", "太原", "嘉兴"];
    for city in cities.iter() {
        if msg.contains(city) {
            info.city = Some(city.to_string());
            break;
        }
    }

    // 提取常见地标/商圈
    let landmarks = [
        "三里屯", "国贸", "CBD", "望京", "中关村", "五道口", "西单", "王府井",
        "朝阳门", "东直门", "建国门", "复兴门", "崇文门", "宣武门",
        "陆家嘴", "人民广场", "徐家汇", "静安寺", "南京路", "淮海路",
        "天河城", "珠江新城", "体育西路", "北京路", "江南西",
        "春熙路", "太古里", "宽窄巷子", "天府广场", "高新区", "金融城",
        "西湖", "武林门", "钱江新城", "滨江", "未来科技城",
        "福田", "南山", "宝安", "华强北", "蛇口", "后海", "科技园",
        "万达广场", "万象城", "大悦城", "银泰城", "吾悦广场", "龙湖天街",
        "SOHO", "购物中心", "商场", "地铁站", "大学城", "开发区", "产业园",
    ];
    for lm in landmarks.iter() {
        if msg.contains(lm) {
            info.landmark = Some(lm.to_string());
            break;
        }
    }

    // 提取"X附近"/"X周边"模式中的X作为地址（优先处理，覆盖landmark/city回退）
    if info.address.is_none() {
        let patterns = ["附近", "周边", "周围"];
        for pattern in patterns.iter() {
            if let Some(pos) = msg.find(pattern) {
                let before = &msg[..pos];
                // 去掉介词（在/去/到/往），取后面的地名
                let loc = ['在', '去', '到', '往'].iter()
                    .find_map(|p| before.rfind(*p).map(|idx| &before[idx+1..]))
                    .unwrap_or(before)
                    .trim();
                if !loc.is_empty() && loc.len() <= 20 {
                    info.address = Some(loc.to_string());
                    break;
                }
            }
        }
    }

    // 如果没有明确地址但有可能的描述，把整句作为模糊地址
    if info.address.is_none() && info.coord.is_none() {
        // 检查是否有"XX路XX号"模式或"XX附近"
        if msg.contains("附近") || msg.contains("周边") {
            if let Some(lm) = &info.landmark {
                info.address = Some(lm.clone());
            } else if let Some(c) = &info.city {
                info.address = Some(format!("{}市中心", c));
            }
        }
    }

    info
}

/// 根据提取的信息构建POI搜索查询列表
/// 返回: Vec<(标签, 搜索词, 半径米)>
fn build_search_queries(info: &LocationExtractedInfo, _original_msg: &str) -> Vec<(String, String, u32)> {
    let mut queries = Vec::new();
    let r = info.radius_hint;

    // 1. 餐饮总体扫描
    queries.push(("餐饮总体".to_string(), "餐厅".to_string(), r));

    // 2. 如果有指定品类，做品类精确搜索
    if let Some(cat) = &info.category {
        queries.push((cat.clone(), format!("{}店", cat), r.min(500))); // 竞品用较小半径
    }

    // 3. 竞品/同行扫描（通用）
    queries.push(("竞品分布".to_string(), "美食".to_string(), r));

    // 4. 交通配套（地铁/公交）
    queries.push(("交通配套".to_string(), "地铁".to_string(), 1500));

    // 5. 购物/生活配套
    queries.push(("商业配套".to_string(), "购物中心".to_string(), r));

    // 限制最多5个查询，避免API调用过多
    queries.truncate(5);
    queries
}

/// 格式化POI搜索结果为可读文本
fn format_poi_result(label: &str, data: &serde_json::Value, radius: u32) -> String {
    let status = data.get("status").and_then(|v| v.as_i64()).unwrap_or(-1);
    if status != 0 {
        return String::new(); // API返回错误
    }

    let results = data.get("results");
    let items = match results {
        Some(arr) => arr.as_array(),
        _ => None,
    };

    match items {
        Some(list) if !list.is_empty() => {
            let count = list.len();
            let mut lines = vec![format!("### {} (半径{}m, 发现{}家)", label, radius, count)];
            lines.push("| 店名 | 距离(m) | 评分 | 人均(元) | 地址 |".to_string());
            lines.push("|------|---------|------|---------|------|".to_string());

            for item in list.iter().take(10) { // 最多展示10条
                let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("未知");
                let distance = item.get("detail_info")
                    .and_then(|d| d.get("distance"))
                    .and_then(|v| v.as_i64())
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "-".to_string());
                let rating = item.get("detail_info")
                    .and_then(|d| d.get("overall_rating"))
                    .and_then(|v| v.as_f64())
                    .map(|v| format!("{:.1}", v))
                    .unwrap_or_else(|| "-".to_string());
                let price = item.get("detail_info")
                    .and_then(|d| d.get("price"))
                    .and_then(|v| v.as_i64())
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "-".to_string());
                let addr = item.get("address")
                    .and_then(|v| v.as_str())
                    .unwrap_or("-")
                    .to_string();
                // v5.5.13: 按字符数截断（兼容中文地址），避免 char boundary panic
                let addr_short = if addr.chars().count() > 20 {
                    format!("{}...", safe_truncate_chars(&addr, 20))
                } else {
                    addr
                };
                lines.push(format!("| {} | {} | {} | {} | {} |", name, distance, rating, price, addr_short));
            }

            if count > 10 {
                lines.push(format!("*... 共{}家，以上显示前10条*", count));
            }
            lines.join("\n")
        }
        _ => String::new(),
    }
}

/// 内部日志（debug用，实际通过emit_event推送到前端）
fn emit_log(msg: &str) {
    eprintln!("[map-fc] {}", msg);
}

/// v5.2.1: 安全截断文本用于日志/事件显示
/// v5.5.13: 修复 UTF-8 char boundary panic — 按字节截到字符边界
fn truncate_for_log(s: &str, max_len: usize) -> String {
    if s.len() <= max_len { return s.to_string(); }
    // 找到 <= max_len 的最近字符边界
    let mut end = max_len;
    while end > 0 && !s.is_char_boundary(end) { end -= 1; }
    format!("{}...", &s[..end])
}

/// v5.5.13: 按"字符数"安全截取，避免中文文档预览触发 char boundary panic
fn safe_truncate_chars(s: &str, max_chars: usize) -> String {
    match s.char_indices().nth(max_chars) {
        Some((idx, _)) => s[..idx].to_string(),
        None => s.to_string(),
    }
}

/// v5.5.13: 按"字节数"安全截取（用于截断API错误体等场景），保证落在字符边界上
fn safe_truncate_bytes(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes { return s.to_string(); }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) { end -= 1; }
    s[..end].to_string()
}

fn demo_gen(msg: &str, sks: &[Sk]) -> String {
    let sl: Vec<&str>=sks.iter().map(|s|s.name).collect();
    if msg.contains("你好"){return "你好！我是勺子🦞，餐饮人的超级AI大脑。内置 261 个专业 Skill 和 25 位专家，覆盖餐饮经营全链路，有任何问题尽管问我！".into();}
    format!("分析完成！\n\n### 已调用的 Skill\n**{}**\n\n[AI 回复内容]\n\n---\n*由 ShaoziClaw 勺子Claw 餐饮AI专家系统生成*",sl.join(", "))
}

/// 🔧 v5.3.9+: 从文本中提取base64编码的图片（用于Gemini Image等模型的响应）
/// 支持格式：data:image/...;base64,xxx | ![](data:image/...) | 裸base64（>500字符的合法base64字符串）
pub fn extract_base64_image(text: &str) -> Option<String> {
    // 1. 匹配 data:image/...;base64,xxx 格式
    if let Some(start) = text.find("data:image/") {
        let after_data = &text[start..];
        if let Some(comma) = after_data.find(',') {
            let b64 = &after_data[comma + 1..after_data.len().min(comma + 1 + 2_000_000)];
            // 清除可能的尾部非base64字符（如引号、括号、换行）
            let trimmed = b64.trim_end_matches(|c: char| !c.is_ascii_alphanumeric() && c != '+' && c != '/' && c != '=');
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    // 2. 匹配 ![](data:image/...) markdown格式
    if let Some(start) = text.find("](data:image/") {
        if let Some(result) = extract_base64_image(&text[start + 2..]) {
            return Some(result);
        }
    }
    // 3. 🔧 B052: 尝试提取裸base64（Gemini可能直接返回大段base64）
    //    base64字符集：A-Za-z0-9+/=，连续长度>500才认为是图片
    let chars: Vec<char> = text.chars().collect();
    let mut start = 0;
    while start < chars.len() {
        // 跳过非base64字符
        while start < chars.len() && !is_b64_char(chars[start]) { start += 1; }
        if start >= chars.len() { break; }
        // 找到连续base64序列的末尾
        let mut end = start;
        while end < chars.len() && is_b64_char(chars[end]) { end += 1; }
        let len = end - start;
        if len > 500 {
            // 可能是base64图片数据
            let candidate: String = chars[start..end].iter().collect();
            // 验证：尝试解码，如果成功且长度合理则返回
            if base64_decode_len(candidate.len()) >= 100_000 {
                return Some(candidate);
            }
        }
        start = end + 1;
    }
    None
}

fn is_b64_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '='
}

fn base64_decode_len(encoded_len: usize) -> usize {
    (encoded_len / 4) * 3
}

fn demo_resp(req: &ChatRequest, model: &str) -> Result<ChatResponse, String> {
    let um = req.messages.last().and_then(|m| m.content.as_str()).unwrap_or("");
    Ok(ChatResponse{content:demo_gen(um,&skill_match(um)),model:format!("{}[Demo Mode]",model),tokens_used:0,skill_applied:req.use_skill.clone(),remaining_tokens:999_999_999})
}

// ═══════════════════════════════════════════════════════════════
// 📁 B052: 本地文件读取支持
// ═══════════════════════════════════════════════════════════════

/// 从用户消息中提取文件路径
/// B053: 增强版 — 没有精确路径时，根据关键词自动扫描 ~/Downloads/ 查找匹配文件
fn extract_file_path(msg: &str) -> Option<String> {
    // 1. 尝试匹配 ~/Downloads/xxx 或 ~/Desktop/xxx 等常见路径
    let home = std::env::var("HOME").unwrap_or_default();

    // 常见路径模式
    let patterns = [
        "~/Downloads/", "~/Desktop/", "~/Documents/", "~/文档/", "~/下载/",
        "/Users/", "/tmp/", "/var/",
    ];

    for pattern in &patterns {
        if let Some(idx) = msg.find(pattern) {
            // 提取从pattern开始到下一个空格/标点的路径
            let start = idx;
            let remaining = &msg[start..];
            // 路径可能以空格、逗号、句号、引号、换行结尾
            let end_patterns = [' ', ',', '。', '.', '！', '!', '\n', '"', '\'', '）', ')', '】', '】'];
            let end = remaining.find(|c: char| end_patterns.contains(&c)).unwrap_or(remaining.len());
            let mut path = remaining[..end].trim().to_string();

            // 展开 ~
            if path.starts_with("~/") {
                path = path.replacen("~/", &format!("{}/", home), 1);
            }

            // 去除可能的引号
            path = path.trim_matches('"').trim_matches('\'').trim().to_string();

            if !path.is_empty() && std::path::Path::new(&path).exists() {
                return Some(path);
            }

            // 路径不存在时也返回（可能是相对路径或拼写问题）
            if !path.is_empty() {
                return Some(path);
            }
        }
    }

    // 2. 尝试匹配引号包裹的路径 "xxx" 或 'xxx'
    for quote in ['"', '\''] {
        if let Some(start) = msg.find(quote) {
            let remaining = &msg[start + 1..];
            if let Some(end) = remaining.find(quote) {
                let path = remaining[..end].trim();
                if !path.is_empty() {
                    let expanded = if path.starts_with("~/") {
                        path.replacen("~/", &format!("{}/", home), 1)
                    } else {
                        path.to_string()
                    };
                    return Some(expanded);
                }
            }
        }
    }

    // 3. B053: 没有精确路径时，根据用户消息中的关键词自动扫描 ~/Downloads/
    //    例如用户说"读取下载文档中的卓世标题的word"，自动在 ~/Downloads/ 查找包含"卓世"的文件
    let scan_dirs = [
        format!("{}/Downloads", home),
        format!("{}/Desktop", home),
        format!("{}/Documents", home),
    ];

    // 从消息中提取可能的文件名关键词（排除常见停用词）
    let stop_words = ["的", "中", "里", "上", "下", "能", "你", "我", "吗", "呢", "吧",
        "读取", "打开", "查看", "文件", "本地", "下载", "文档", "桌面", "一个",
        "尝试", "一下", "帮", "一下", "word", "Word", "docx", "pdf", "txt"];
    let keywords: Vec<String> = msg.chars()
        .collect::<Vec<char>>()
        .windows(2)
        .filter_map(|w| {
            let s: String = w.iter().collect();
            if !stop_words.contains(&s.as_str()) && s.chars().all(|c| !c.is_ascii_punctuation()) {
                Some(s)
            } else {
                None
            }
        })
        .collect();

    // 如果有2字以上的关键词，扫描目录查找匹配文件
    if !keywords.is_empty() {
        for dir in &scan_dirs {
            let dir_path = std::path::Path::new(dir);
            if !dir_path.exists() {
                continue;
            }
            // 只扫描第一层（不递归，避免太慢）
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let file_name = entry.file_name().to_string_lossy().to_string();
                    let file_name_lower = file_name.to_lowercase();
                    // 检查是否匹配用户的关键词
                    let matched = keywords.iter().any(|kw| {
                        file_name.contains(kw.as_str()) || file_name_lower.contains(kw.to_lowercase().as_str())
                    });
                    if matched {
                        let full_path = entry.path().to_string_lossy().to_string();
                        // 只匹配文档类型
                        let ext = std::path::Path::new(&full_path)
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|e| e.to_lowercase())
                            .unwrap_or_default();
                        if ["docx", "doc", "pdf", "txt", "md", "xlsx", "csv", "pptx", "ppt"].contains(&ext.as_str()) {
                            println!("[extract_file_path] 自动匹配到文件: {}", full_path);
                            return Some(full_path);
                        }
                    }
                }
            }
        }
    }

    None
}

/// 读取本地文件内容（支持txt/pdf/docx/xlsx等）
/// v5.5.9: 所有同步I/O包裹在内部闭包中，调用处必须用 spawn_blocking 保护
fn read_local_file_sync(path: &str) -> Result<String, String> {
    let p = std::path::Path::new(path);
    if !p.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    let ext = p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "txt" | "md" | "json" | "csv" | "xml" | "html" | "htm" | "js" | "ts" | "py" | "rs" | "toml" | "yaml" | "yml" | "log" => {
            std::fs::read_to_string(path)
                .map_err(|e| format!("读取失败: {}", e))
        }
        "pdf" => {
            let bytes = std::fs::read(path).map_err(|e| format!("读取PDF失败: {}", e))?;
            let content = String::from_utf8_lossy(&bytes);
            let texts: Vec<&str> = content.matches(|c: char| {
                c.is_ascii_alphanumeric() || ('\u{4e00}'..='\u{9fff}').contains(&c) || "，。！？、：；\"\"''（）【】《》—…· ".contains(c)
            })
                .filter(|s| s.len() > 2)
                .collect();
            let extracted = texts.join("");
            if extracted.len() > 50 {
                Ok(extracted)
            } else {
                Err("PDF文件内容无法提取（可能是扫描件或加密文件）。建议转换为txt或docx格式后重试。".to_string())
            }
        }
        "docx" => {
            use std::process::Command;
            let output = Command::new("textutil")
                .args(["-convert", "txt", "-stdout", path])
                .output()
                .map_err(|e| format!("调用textutil失败: {}", e))?;
            let text = String::from_utf8_lossy(&output.stdout).to_string();
            if text.trim().is_empty() {
                Err("DOCX文件为空".to_string())
            } else {
                Ok(text)
            }
        }
        "xlsx" | "xls" => {
            Err("Excel文件暂不支持在AI对话中直接读取。请将数据复制粘贴到对话中，或先导出为CSV格式。".to_string())
        }
        "doc" | "ppt" | "pptx" => {
            Err(format!("{}格式暂不支持直接读取。请转换为docx/pdf/txt格式后重试。", ext.to_uppercase()))
        }
        _ => {
            let metadata = match std::fs::metadata(path) {
                Ok(m) => m,
                Err(_) => {
                    return Err(format!("不支持直接读取此文件类型(.{})。支持的格式: txt, md, json, csv, pdf, docx", ext))
                }
            };
            Err(format!("不支持直接读取此文件类型(.{})，大小: {}KB。支持的格式: txt, md, json, csv, pdf, docx", ext, metadata.len() / 1024))
        }
    }
}

/// v5.5.9: async wrapper，用 spawn_blocking 避免阻塞 tokio runtime
async fn read_local_file(path: &str) -> Result<String, String> {
    let path_owned = path.to_string();
    tokio::task::spawn_blocking(move || read_local_file_sync(&path_owned))
        .await
        .map_err(|e| format!("文件读取任务失败: {}", e))?
}