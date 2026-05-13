---
name: shaoziclaw-product-commander
description: 勺子Claw产品指挥官。勺子Claw桌面App的全生命周期管理者——涵盖代码架构、UI设计语言、内置模型、页面结构、Bug历史、开发工作流、记忆系统、macOS+Windows打包发布。每次与勺子Claw相关的开发任务（新功能、Bug修复、UI改版、打包发布）都从此入口开始，先读取记忆再执行工作，完成后更新记忆。发版/部署任务自动转发shaoziclaw-release-pipeline（12步强制流水线）。触发词：Shaoziclaw产品指挥官、Shaoziclaw开发、Shaoziclaw改Bug、Shaoziclaw前端、Shaoziclaw打包、Shaoziclaw更新、Shaoziclaw新功能、产品指挥官、Claw开发、shaoziclaw代码、shaoziclaw项目、Shaoziclaw Windows、Shaoziclaw DMG、Shaoziclaw安装包、发版流水线、DMG发版、上架、release、deploy、部署、公证
install_type: skill
env_vars: []
no_external_credentials: true
scope: project_directory_only
---

# 勺子Claw 产品指挥官 🏛️

> **定位**：勺子Claw 桌面App的**全生命周期知识中枢**——不是餐饮业务skill，是**产品工程**skill。
> **核心价值**：所有勺子Claw相关开发任务的**唯一入口**。先读记忆 → 理解需求 → 执行工作 → 更新记忆。
> **强制规则**：凡是涉及勺子Claw App的开发/修改/Bug/打包/发布，**必须先调用本skill**。
> **🔴🔴🔴 2026-05-04 涛哥铁律**：任何修改/新增功能给勺子Claw，**必须先经产品指挥官调度**！不允许绕过产品指挥官直接改代码。违反=严重事故。

---

## 一、唤醒词（触发条件）

| 唤醒词 | 触发场景 |
|--------|---------|
| "Shaoziclaw产品指挥官" / "产品指挥官" | 直接调用 |
| "Shaoziclaw开发" / "Claw开发" / "shaoziclaw代码" | 新功能开发 |
| "Shaoziclaw改Bug" / "Shaoziclaw有bug" / "Shaoziclaw报错" | Bug修复 |
| "Shaoziclaw前端" / "Shaoziclaw UI" / "Shaoziclaw界面" | UI/前端改动 |
| "Shaoziclaw打包" / "Shaoziclaw DMG" / "Shaoziclaw发布" / "Shaoziclaw安装包" | 打包发布 |
| "Shaoziclaw Windows" / "Windows版" / "exe" | Windows平台打包 |
| "Shaoziclaw更新" / "升级Shaoziclaw" / "Shaoziclaw新功能" | 版本迭代 |
| "给Shaoziclaw做个xxx" / "在Shaoziclaw里加xxx" | 功能新增 |
| **"发版"/"上传DMG"/"服务器运维"/"minisign签名"/"SSL证书"** | **→ 转发 shaoziclaw-ops-manual** |
| **"发版流水线"/"DMG发版"/"上架"/"release"/"deploy"/"部署"/"公证"/"标准发版"** | **→ 转发 shaoziclaw-release-pipeline（12步强制流水线，不可跳步）** |

---

## 二、产品概览

### 2.1 基本信息

| 属性 | 值 |
|------|-----|
| **产品名** | 勺子Claw（Shaoziclaw 勺子Claw） |
| **定位** | 餐饮AI专家桌面应用 |
| **技术栈** | Tauri 2.0 (Rust) + React 19 + TypeScript + Tailwind CSS + Zustand |
| **版本** | **v5.5.16（2026-05-13 B092修复：TDZ诊断代码const/let声明顺序错误导致ChatArea组件崩溃+发送按钮失效。⚠️教训：useEffect回调引用的变量必须定义在useEffect之前，同一个坑不能踩两次！）|
| **品牌色** | **#57CC86**（薄荷绿）⚠️ v4.5起从黄色#FFD600更换！|
| **包名** | com.shaoziclaw.app |
| **支持平台** | macOS (Apple Silicon + Intel) / Windows x64 |
| **产物格式** | macOS: .dmg / Windows: .exe (NSIS) |

### 2.2 项目目录结构

```
~/WorkBuddy/20260328104847/shaoziclaw-app/
├── shaoziclaw-core/                    # Rust后端核心（Tauri 2.0）
│   └── src-tauri/src/
│       ├── main.rs                  # 入口 + AppState + Tauri commands
│       ├── ai_engine.rs             # AI引擎（3模型match + 流式输出 + Skill匹配）
│       ├── auth.rs                  # 认证模块（本地登录/注册）
│       ├── user_store.rs            # 用户数据存储（JSON文件）
│       ├── skill_manager.rs         # Skill管理（加载v4目录下的SKILL.md）
│       ├── learning.rs              # 学习闭环系统（feedback/negative-cases/memories）
│       ├── rag_engine.rs             # 📚 RAG知识库引擎（v5.1 LanceDB+Embedding+检索）
│       ├── subscription.rs          # 订阅管理
│       ├── tools.rs                 # 工具执行器
│       └── config/                  # 配置文件（如有）
├── frontend/                        # React前端
│   ├── src/
│   │   ├── App.tsx                  # 主应用壳（路由+认证检查）
│   │   ├── main.tsx                 # React入口
│   │   ├── store.ts                 # Zustand全局状态（核心！）
│   │   ├── index.css                # 全局样式
│   │   ├── components/
│   │   │   ├── Sidebar.tsx          # 左侧导航栏（278px固定宽）
│   │   │   ├── ChatArea.tsx         # 聊天主区域（气泡+输入+思考面板+Markdown渲染）
│   │   │   ├── ExpertCenter.tsx     # 专家中心（M1-M20模块展示）
│   │   │   ├── SkillsPage.tsx       # 技能库页面
│   │   │   ├── Settings.tsx         # 设置页（模型配置+提供商+自定义模型+📚知识库）
│   │   │   ├── KnowledgeBasePanel.tsx # 📚 知识库管理面板（v5.1 RAG下载/初始化/状态）
│   │   │   ├── LoginScreen.tsx      # 登录/注册/兑换码页面
│   │   │   ├── HomeScreen.tsx       # 首页
│   │   │   ├── LearningDashboard.tsx # 学习仪表盘
│   │   │   ├── Subscription.tsx     # 订阅页
│   │   │   ├── ToolBox.tsx          # 工具箱
│   │   │   ├── SkillCenter.tsx      # 技能中心
│   │   │   └── ...
│   │   └── assets/                  # 静态资源（logo.svg等）
│   ├── DESIGN.md                    # ⭐ 设计规范宪法（必读！）
│   ├── dist/                        # 构建产物
│   └── package.json
└── frontend/src-tauri/
    ├── tauri.conf.json              # Tauri配置（窗口/签名/Bundle设置/目标平台）
    ├── icons/                       # 图标资源（icns + ico + png全套）
    └── target/release/bundle/       # 打包产物
        ├── dmg/                     # macOS DMG
        ├── macos/                   # .app本体
        └── nsis/                    # Windows安装包（如有）

### 2.3 产品架构总览图（⭐ 核心视图）

> **重要**：每次架构变更后必须更新此图。架构图是产品语言的核心——所有开发、沟通、决策都基于此图。

**PNG 版本（推荐查看）**：
```
generated-images/shaoziclaw-product-arch.png
```
（1920px 宽度，Claude Official 风格，f8f6f3 暖白背景）

**SVG 源文件（可编辑）**：
```
generated-images/shaoziclaw-architecture.svg
```

**五层架构说明**：

| 层级 | 名称 | 核心职责 | 技术组件 |
|------|------|---------|---------|
| L1 | 用户层 | 触达目标用户 | 餐饮老板/连锁店长/厨师/投资人/开发者 |
| L2 | 应用层 | 跨平台桌面应用 | Tauri 2.0 Shell + React 19 前端 + 页面组件 |
| L3 | AI 引擎编排层 | 对话编排 + 状态管理 | AI Engine + 认证 + 订阅 + 记忆 + 工具执行器 |
| L4 | 技能与知识层 | 专业能力来源 | 261 Skills (M1-M20) + 知识库 (931份/10.7GB) + 学习闭环 |
| L5 | 外部模型层 | 推理能力 | DeepSeek V3 / Qwen-Max / Qwen3-32B |

**箭头语义**：
- 🔵 实线蓝箭头 → 用户操作 / 主数据流
- 🟢 实线绿箭头 → 技能触发 / 反馈循环
- 🟣 实线紫箭头 → 知识检索 / 嵌入处理
- ⚪ 虚线灰箭头 → 异步事件 / 后台通信

**架构设计原则**：
1. **层间隔离**：每层只依赖下层，不跨层调用
2. **技能独立**：Skill系统与AI引擎解耦，便于扩展
3. **知识沉淀**：931份原始资料持续训练，专业壁垒
4. **学习进化**：用户反馈闭环，持续提升回答质量
```

---

## 三、内置大模型配置

### 3.1 当前4个内置模型（v5.0.0: 统一走墨行 Moxing API）

| 模型 | id | API模型名 | 用途 | Key位置 |
|------|----|----------|------|---------|
| 墨行·DeepSeek V4 | `deepseek-v4`（默认）| DeepSeek-V4-pro | 深度推理旗舰 | ai_engine.rs MOXING_KEY |
| 墨行·GLM-5.1 | `glm-5.1` | GLM-5.1 | 智谱旗舰，支持图片分析 | 同上 |
| 墨行·Kimi K2.5 | `kimi-k2.5` | Kimi-K2.5 | 长文本，月之暗面 | 同上 |
| 墨行·Seedance 2.0 | `seedance-2.0` | doubao-seedance-2-0-260128 | 视频生成，豆包 | 同上 |

### 3.2 后端模型路由（ai_engine.rs三个match函数）

```rust
// v5.0.0: 统一走墨行
const MOXING_API: &str = "https://www.moxing.pro";
const MOXING_KEY: &str = "sk-mxai-3d96e98c6a64adcde222b8020e9ab42979fd17a30a46f31e60b4a3e6ca03c3e2";

// get_key(m) → 全部返回 MOXING_KEY
// base_url(m) → 全部返回 MOXING_API
// model_name(m) → 映射到墨行实际模型名
```

**默认模型**：`deepseek-v4`（DeepSeek-V4-pro）
**注意**：DeepSeek V4 Pro 返回 `reasoning_content`（思考链），代码已有 fallback 逻辑。

### 3.3 Embedding（RAG知识库用，独立于AI对话）
- **当前**：硅基流动 `BAAI/bge-m3`（免费，1024维，多语言）
- **未来**：等墨行上架Embedding模型后迁过去

---

## 四、前端UI设计语言（DESIGN.md精华）

### 4.1 核心设计哲学
**「专业感 × 温暖感 × 高效」** — 品牌绿(#57CC86)为唯一强调色，白色/灰色为主基调。⚠️ v4.6起全面去绿色化，改用**中性灰**作为主色调（见4.6 UI大重构详情）。

### 4.2 页面主题分布
| 页面 | 主题 | 背景 |
|------|------|------|
| 聊天页(ChatArea) | **纯亮色** | #FFFFFF |
| 专家中心(ExpertCenter) | 深色 | #0C0C0E |
| 技能库(SkillsPage) | 深色 | #0C0C0E |
| 设置(Settings) | 深色/亮色混合 | #0C0C0E |
| 登录(LoginScreen) | 自定义暗色 | 渐变暗底 |

### 4.3 关键颜色令牌（⚠️ v4.6 UI大重构后，品牌绿仅用于极少量场景）

```
#57CC86        → 品牌色（仅LOGO图形/极少强调）— 不再作为主色调！
#333333        → 主按钮/新建任务/深色文字（替代绿色）
#E6F7EF/#F5FAF7→ 用户消息气泡（极淡绿底）
#f8f8f8        → AI思考过程容器背景（替代绿底）
#eaeaea        → 思考过程边框（替代绿色）
#ccc/ddd       → Markdown h2/h3 border-bottom（替代绿色）
#999           → 打字动画点（替代绿色#57CC86）
gray-50        → 全局hover态（统一浅灰）
gray-100       → 选中态背景（替代#E6F7EF浅绿）
#FFFFFF        → 页面背景(聊天)/卡片/弹窗
#FAFAFA        → 侧边栏/标题栏/输入区
#1A1A1A/#333   → 主文字（h2/h3必须用深色！白色不可见）
#666/#AAA      → 次要文字
#22C55E        → 成功（有帮助按钮）
#EF4444        → 错误（需改进按钮）
```

**v4.6 UI设计原则（严格遵循设计诊断文档2026042701）**：
- 三级字体层级：标题18px semibold / 正文14px / 辅助13px
- 品牌色克制：绿色只出现在 LOGO + 用户气泡淡底 + 成功状态
- 选中态统一用灰色而非绿色（Sidebar导航、任务卡片等）
- hover态统一用gray-50
- 圆角8px | 间距栅格4px | 动效0.2s淡入淡出

### 4.4 布局铁律
- **Sidebar**: 278px固定宽，flex流中自然占位
- **Main区域**: flex:1，**绝不设marginLeft**！（双重偏移bug）
- 外层容器背景根据currentPage动态切换
- 圆角默认8px(lg)，气泡18px(一角4px)

### 4.5 组件文件映射

| 组件 | 文件 | 主题 | 关键元素 |
|------|------|------|---------|
| App壳 | App.tsx | 动态 | 认证检查、页面路由 |
| 侧边栏 | Sidebar.tsx | 亮色 | 导航、任务列表、用户面板 |
| 聊天区 | ChatArea.tsx | **亮色** | 气泡、输入框、思考面板、Markdown |
| 专家中心 | ExpertCenter.tsx | 深色 | M1-M20卡片网格 |
| 技能页 | SkillsPage.tsx | 深色 | Skill详情、模块树 |
| 设置 | Settings.tsx | 深色 | 模型配置、提供商列表 |
| 登录 | LoginScreen.tsx | 自定义 | 登录表单、兑换码 |
| 学习仪表盘 | LearningDashboard.tsx | 亮色 | 图表、统计卡片 |
| **自动更新** | **UpdateNotifier.tsx** | **全局底部条** | **WorkBuddy风格底部条：新版本就绪/更新日志/重启升级（v4.6.2重构）** |

### 4.6 ⚠️ 历史踩坑清单（禁止重犯）

| # | 坑 | 正确做法 |
|---|-----|---------|
| 1 | 用户气泡用#2a2500褐色脏块 | 用#FFF9E6淡黄白 |
| 2 | onMouseLeave写死深色值#151515 | 恢复白色原始态 |
| 3 | 给Main设marginLeft导致缝隙 | Sidebar在flex流中自然占位 |
| 4 | 延伸问题按钮hover变深色 | 用#FFFBEB浅色 |
| 5 | JSX style属性缺少}}闭合 | 必须完整闭合 |
| **6** 🔴 | **安装新App后不重启=用户永远看到旧版** | **打包安装后必须 `pkill -f "勺子Claw" && open /Applications/勺子Claw.app`，否则旧进程内存中的旧代码永远不会被替换。源码对✅、编译对✅、DMG对✅、安装对✅——进程没重启=一切白费！这是v4.3.4排查4轮才确定的根因。** |
| **7** 🔴🔴🔴 | **官网下载链接用相对路径→用户下载到旧版/404（2026-05-02 血的教训，2026-05-12 再次犯错！）** | 官网 www.shaoziclaw.com 的下载按钮用了相对路径 `darwin-aarch64.dmg` → 用户实际访问的是 `www.shaoziclaw.com/darwin-aarch64.dmg`（旧文件/缓存），而新DMG部署在 `https://releases.shaoziclaw.com/`（另一个Vercel项目）！**深层根因①：产品思维缺失——没把"官网→用户获取App"当关键链路保护，只关注代码/打包，不关心分发管道。②：发版检查清单缺失端到端验证步骤——验证了生产链条却漏了最后一公里。③：旧版本DMG残留未清理——发版流程无"删除旧版"步骤。🔴 2026-05-12再次犯错：发版更新了releases.shaoziclaw.com但忘记更新www.shaoziclaw.com（两个独立Vercel项目），用户看到官网仍是旧版本。铁律：①官网统一口径=www.shaoziclaw.com ②所有下载链接必须绝对路径指向releases.shaoziclaw.com ③每次发版必须执行Step8(端到端下载验证)+Step9(旧版清理) ④两个Vercel项目不共享静态资源，相对路径必出错！⑤发版最后一步=curl验证www.shaoziclaw.com版本号！** |
| **8** 🔴🔴 | **Rust改了字符串常量后cargo build不一定重编（2026-05-04）** | 改了ai_engine.rs中的DeepSeek API Key后直接`npm run tauri build`，但cargo增量编译认为该文件"没变化"（可能因时间戳/哈希缓存），导致DMG中的二进制仍含旧Key！**修复**：改Rust代码后如果构建结果不对→先`cargo clean --manifest-path src-tauri/Cargo.toml`（删除~4GB缓存）→再全量重编。**铁律：改Rust代码构建结果不符预期时，第一步永远先cargo clean！** |
| **9** 🔴🔴 | **hdiutil挂载残留导致DMG"资源忙"（2026-05-04）** | `hdiutil info`显示8个残留DMG挂载（v4.4.0/v4.6.0/v4.7.0/v4.8.0），跨版本残留导致新DMG无法创建/挂载。**修复**：`hdiutil detach -force /dev/diskX`逐个清理 + `rm -rf bundle/macos/`。**铁律：每次打包前先`hdiutil info | grep /dev/disk`检查并清理残留挂载！** |
| **10** 🔴🔴 | **DMG内App名是中文名"勺子Claw.app"，不是ShaoziClaw.app（2026-05-04）** | tauri.conf.json的productName为"勺子Claw"，所以DMG产物内App名为`勺子Claw.app`。如果一直`cp`到`/Applications/ShaoziClaw.app`（旧v4.6.0残留路径），用户运行的永远是旧版！**修复**：安装前先`rm -rf "/Applications/勺子Claw.app" /Applications/ShaoziClaw.app`→`cp -R "勺子Claw.app" /Applications/`。**铁律：安装App前先ls确认DMG内App的实际名称，必须安装到/Applications/下同名路径！** |
| **11** 🔴 | **跨组件状态传递禁止用window变量中转（2026-05-04）** | React 18自动批处理下，在事件处理器中更新zustand store后立即触发页面切换，新组件的useEffect可能在store更新commit之前就执行。用window变量（`__pendingGreeting`等）在组件间传递数据是时序竞态的高危模式。**铁律：状态传递必须通过zustand store或props，禁止window变量中转！** |
| **12** 🔴 | **localStorage持久化时Date反序列化陷阱（2026-05-09）** | Date对象经JSON.stringify→JSON.parse后变成ISO字符串，不再有Date方法（getTime/toISOString等）。如果直接使用会导致时间比较/格式化失败。**铁律：从localStorage读取含Date字段的对象时，必须用reviveDate()工具函数将字符串还原为Date对象**。不使用zustand/middleware/persist避免影响isGenerating等瞬态字段。 |
| **13** 🔴🔴 | **产品指挥官版本号滞后=开发混乱（2026-05-11）** | 产品指挥官SKILL.md版本号停在v5.2.2，实际已开发到v5.3.9，差7个小版本。Bug历史缺B041-B051，踩坑经验未同步。**铁律：每次发版/修复后必须同步产品指挥官（版本号+Bug历史+踩坑清单），否则后续开发基于过时信息→重复踩坑→更多Bug**。 |
| **14** 🔴 | **Tauri command参数camelCase≠snake_case（2026-05-10）** | ChatArea.tsx invoke用camelCase（sessionId），main.rs #[tauri::command]要求snake_case（session_id）。Tauri v2不做自动大小写转换→参数全部丢失→静默失败。**铁律：Tauri command参数名必须snake_case，前端invoke也必须snake_case，精确匹配**。 |
| **15** 🔴 | **OnceLock不是全局变量（2026-05-11）** | 以为`static ABORT_FLAG: OnceLock<AtomicBool>`是全局共享的，实际上OnceLock是lazy初始化器——每个调用`ABORT_FLAG.get_or_init()`的地方如果独立使用会创建新实例。**铁律：OnceLock必须通过单一getter函数（如get_abort_flag()）访问，确保全局单例**。 |
| **16** 🔴 | **React闭包旧值陷阱（2026-05-11）** | 事件回调中捕获的props/state是闭包旧值，异步回调（如setTimeout、event listener）执行时读取的是过时的state。**铁律：异步回调中需用getState()实时读取最新状态，不能用解构出来的state值**。 |
| **17** 🔴 | **localStorage 5MB配额超限（2026-05-11）** | 200+skill + 聊天记录 + 任务会话 + 专家会话撑爆5MB配额→QuotaExceededError→数据保存失败。**铁律：localStorage只存关键配置，大数据量（聊天记录/文档）必须存IndexedDB或Rust端文件系统**。 |
| **18** 🔴 | **前端超时 < 后端超时 = 用户看到超时但后端还在跑（2026-05-11）** | 图片生成前端120秒超时，后端串行尝试3个模型×2次=可能等6次请求。前端已超时报错，后端还在跑→资源浪费+用户体验差。**铁律：前端超时必须≥后端最大可能耗时，或后端改为并行+快速失败**。 |

---

## 五、页面结构与导航

### 5.1 一级导航（Sidebar顶部）

| 导航项 | 页面组件 | 图标 |
|--------|---------|------|
| 🦞 Claw | ChatArea（聊天） | Logo图标 |
| 👤 专家 | ExpertCenter | 人物图标 |
| ⚙️ 技能 | SkillsPage | 工具图标 |
| 🔧 任务 | （待实现） | 任务图标 |

### 5.2 底部用户面板（Sidebar底部）
- 用户头像（圆形渐变紫蓝）
- 用户ID（如 DCMO79S88R1XP6）
- 点击展开：昵称编辑 + 设置入口

### 5.3 聊天页子功能区（ChatArea内部）
- **工具栏Tabs**：Craft模式选择 / 模型切换 / Skills开关
- **输入区**：文本框 + 发送按钮 + 占位提示
- **快捷问题**：3列网格推荐问题
- **延伸问题**：AI回复后的追问按钮

---

## 六、后端核心架构

### 6.1 AppState（全局状态）

```rust
pub struct AppState {
    pub is_authenticated: bool,      // 认证状态（启动时自动恢复！）
    pub current_user: Option<UserInfo>,
    pub subscription: Option<SubscriptionInfo>,
}
```

**⚠️ 重要**：AppState在setup()中通过`restore_auth_state()`自动恢复认证状态，不再依赖前端login调用。

### 6.2 核心Tauri Commands

| Command | 功能 | 参数 |
|---------|------|------|
| `chat_stream` | 流式对话（主要使用！）| ChatRequest{messages, model, stream} |
| `chat` | 非流式对话 | 同上 |
| `login` | 登录 | LoginRequest{email, password} |
| `logout` | 登出 | 无 |
| `get_app_state` | 获取后端状态 | 无 |
| `get_skills_list` | 获取Skill列表 | category(Optional) |
| `get_skill_detail` | 获取Skill详情 | skill_id |
| `submit_feedback` | 提交👍👎反馈 | FeedbackRequest |
| `search_memories` | FTS5搜索记忆 | query |
| `check_subscription` | 检查订阅状态 | 无 |
| **`check_update`** | **检查新版本（v4.6新增）** | **无** |
| **`download_and_install_update`** | **DMG自动安装+重启（v4.6.2重写，替代旧install）** | **dmg_url(String), on_progress(Channel<i32>)** |

### 6.3 AI引擎流程（ai_engine.rs）

```
用户发消息 → chat_stream command
  → 检查认证状态 ✅
  → 提取动态红线（学习闭环Phase2）
  → call_ai_streaming_events()
    → base_url(model) 获取API地址
    → get_key(model) 获取API key
    → model_name(model) 获取实际模型名
    → 构建请求（system prompt + 红线注入 + 历史消息）
    → SSE流式接收 → 实时事件推送前端
    → skill_match(msg) 匹配Skill标签
```

### 6.4 认证系统（2026-04-20修复后）

**启动流程**：
```
App启动 → setup()
  → restore_auth_state()
    → 策略1: 从~/.shaoziclaw/session.json恢复
    → 策略2: 自动注册默认用户user@shaoziclaw.cn
    → 设AppState.is_authenticated = true
    → 保存session供下次启动恢复

前端启动 → useEffect
  → invoke('get_app_state')
  → 后端已认证 → setBackendAuth同步到Zustand
  → 显示主界面（跳过登录页）
```

**数据存储位置**：
- 用户数据：`~/.shaoziclaw/users.json`
- Session：`~/.shaoziclaw/session.json`
- 学习数据库：Tauri app data目录下 `learning.db`

---

## 七、Bug历史记录

### 7.1 已解决的Bug

| # | 时间 | Bug描述 | 根因 | 修复方式 |
|---|------|---------|------|---------|
| B001 | 2026-04-20 | 发消息返回"请先登录" | 后端AppState.is_authenticated硬编码false + 前端login吞错误 | main.rs加restore_auth_state() + store.ts修login + App.tsx加启动同步 |
| B002 | 2026-04-20 | 延伸问题按钮hover变黑 | onMouseLeave写死深色值#151515 | 改为#FFFBEB浅色 |
| B003 | 2026-04-19 | 👍按钮Array.reverse()失效 | 直接reverse原数组而非展开拷贝 | 改用展开运算符[...arr].reverse() |
| B004 | 2026-04-19 | 去原作者化违规（7处） | 代码中含人名+书名组合 | 全部替换为"行业最佳实践" |
| B005 | 2026-04-20 | 专家开场白显示为用户气泡 | ChatArea.tsx用handleSend(greeting)把开场白当用户消息发送 | 改为addMessageToActive({role:'assistant'})直接插入AI消息 |
| B006 | 2026-04-22 | 安装新版App后UI完全没变化（4轮排查） | 新版安装到/Applications但**旧进程未退出**，内存加载的是旧代码 | **铁律：打包安装后必须 pkill旧进程再open新版**。已写入踩坑清单#6和MEMORY.md |
| B007 | 2026-05-02 | 官网下载的DMG没有图片设计专家（本地DMG有）→宋宣拿到v4.7.0旧版 | 官网 index.html 的下载链接用相对路径 `darwin-aarch64.dmg`，解析到 www.shaoziclaw.com 域名下（旧文件），而新DMG在 releases.shaoziclaw.com（另一个Vercel项目）。**深层根因：①产品思维缺失——未将"用户获取App"视为关键链路 ②发版检查清单缺端到端验证步骤 ③旧版DMG残留未清理。已新增Step8(下载验证)+Step9(旧版清理)到标准发版流程。写入踩坑清单#7** |
| B008 | 2026-05-04 | 专家中心greeting竞态 | React 18批处理竞态导致开场白丢失 | store.ts greeting参数化，写入踩坑清单#9 |
| B009 | 2026-05-04 | 检查更新显示"更新失败" | 后端未区分有更新/无更新/错误三状态 | Settings.tsx checkResult四状态内联UI |
| B010 | 2026-05-04 | 版本号不一致（4.6/4.7/4.8三处不同） | 多处硬编码版本号 + getVersion()未使用 | 三处统一4.8.0 + UI动态读取getVersion() |
| B011 | 2026-05-04 | 关于页面出现"燕雀智能" | 遗留旧文案未清理 | Settings.tsx改为"勺子Claw" |
| B012 | 2026-05-05 | 专家中心对话无法接收AI回复（可发消息无回复）| Zustand store缺少updateExpertMessage函数，ChatArea.tsx 5处调用全部TypeError | store.ts L770-779补全updateExpertMessage实现 |
| B013 | 2026-05-05 | 左栏「专家」显示（20）实际已有25位专家 | Sidebar.tsx第112行badge硬编码'20'，新增专家后未同步更新 | badge: '20' → '25'，⚠️铁律：新增/删除专家必须同步更新Sidebar badge数量 |
| B014 | 2026-05-05 | 专家角色持久化失效：首句后失去人设变普通聊天 | ChatArea.tsx handleSend() 构建API消息时未注入专家角色system prompt，AI模型不知道自己应以什么身份回答 | 新增 EXPERT_SYSTEM_PROMPTS 映射表 + activeExpertSessionId 时注入角色prompt到 apiMessages 首部 |
| B015 | 2026-05-05 | 3位新专家（排班/订货/审核）左栏显示"餐饮专家"而非正确名称 | App.tsx expertIdMap 缺少 m21/m22/m23 三个新ID映射，fallback 到 {type:'general', title:'餐饮专家'} | expertIdMap 补全3个新专家条目（含 type/skillName 映射） |
| B016 | 2026-05-05 | 二级页面导航阻断：专家中心/定时任务页无法直接切回聊天 | Sidebar.tsx 任务/会话点击有 onNavigate('chat') 但缺少 setActiveTab('chat') 导致状态不一致 | ✅ **v4.9.2根因修复**：App.tsx 新增 useEffect 监听 activeTaskId/activeExpertSessionId 变化，自动从二级页面跳回聊天（useRef + prev值对比） |
| B017 | 2026-05-05 | 全局Slogan "我是ShaoziClaw 你的专业AI顾问" 需替换 | ai_engine.rs L16 SYSTEM_PROMPT + L749 打招呼消息中使用旧品牌Slogan | 两处统一替换为 "我是勺子🦞，餐饮人的超级AI大脑" |
| B018 | 2026-05-05 | 首页右栏空状态 "你的私人餐饮智囊团" 需替换 | ChatArea.tsx L533 空状态描述文案与主Slogan不一致 | 替换为以 "餐饮人的超级AI大脑" 为主标题的统一表述 |
| B019 | 2026-05-05 | Claw按钮未定义为全局主聊天入口 | 点击Claw只切换页面未重置专家会话状态，导致可能停留在专家模式 | Claw按钮点击时额外重置 activeExpertSessionId=null + activeExpertType='general' |
| B020 | 2026-05-05 | 官网下载按钮404（index.html指向旧版DMG） | index.html下载链接仍为 `ShaoziClaw_4.8.0_aarch64.dmg`（旧文件已删除），发版后未同步更新官网下载链接 | ✅ 已更新为 v4.9.2 + 重新部署官网。⚠️铁律：每次发版必须检查并更新官网index.html下载链接！ |
| B021 | 2026-05-06 | POI地图搜索卡死3-5分钟 | ①HTTP超时15秒过长；②5个POI查询串行执行；③地理编码失败后继续做无效POI搜索 | ✅ **v4.9.5**：超时降至5秒；POI搜索并行化（futures::join_all）；地理编码失败提前退出；总等待从3-5分钟降至10秒内 |
| B022 | 2026-05-06 | 每日餐饮热点在非chat页面误触发，聊天窗口不可用 | ChatArea.tsx事件监听在非chat页面响应，handleSend调用失败导致聊天窗口状态异常 | ✅ **v4.9.5**：App.tsx协调模式——Sidebar导航→chat→ChatArea挂载→prefill，完全解耦跨页面状态 |
| B023 | 2026-05-06 | 每日餐饮热点位置错误 | 热点卡片在任务列表区域，而非"定时任务"区域，与"系统定时任务"语义不符 | ✅ **v4.9.5**：热点卡片从任务列表移至定时任务区域，符合功能定位 |
| B024 | 2026-05-07 | 定时任务聊天面板UI丑陋 | MessageBubble完全重写对齐ChatArea标准：AI头像(#fff圆底logo)+用户气泡#F5FAF7+AI气泡#fff+Markdown渲染+思考过程面板+时间戳操作栏；提取renderMarkdownEnhanced到utils/markdown.ts共享 | ✅ **v4.9.9补丁** |
| B025 | 2026-05-09 | Moxing API "error decoding response body" | ai_engine.rs MOXING_API常量缺/v1前缀，请求打到HTML页面而非API端点 | MOXING_API从`https://www.moxing.pro`改为`https://www.moxing.pro/v1` |
| B025 | 2026-05-07 | 地图API静默失败（根因修复） | 百度地图返回嵌套结构{result:{location:{lng,lat}}}，原代码result.get("location")永远返回None→修正为逐层提取result→result.location。ECS代理验证正常（地理编码+POI搜索均通） | ✅ **v4.9.9补丁** |
| **Win01** | **2026-05-07** | **🪟 Windows v4.9.8 双平台正式发布** — NSIS安装包(5.9MB)上传releases.shaoziclaw.com，latest.json新增windows-x64平台，changelog已更新，官网已部署，与macOS DMG同步v4.9.8 | Windows交叉编译在另一台电脑完成，exe通过微信传输；MD5: 1d580c7ac5ce39543d3654357b013755 | **✅ 已发布**：`https://releases.shaoziclaw.com/ShaoziClaw_4.9.8_x64-setup.exe` |
| **B026** | **2026-05-09** | **主聊天消息重启后消失** | `messages`和`tasks`数组纯内存（Zustand store未使用persist），无localStorage持久化，关闭客户端即丢失 | ✅ **v4.9.9**：新增loadTasks/saveTasks函数，createTask/addMessageToActive/deleteTask/switchTask/renameTask/clearMessages均调用saveTasks，初始化从localStorage恢复 |
| **B027** | **2026-05-09** | **任务会话(taskSessions)重启后消失** | 有save（写入localStorage）但无load恢复（store.ts:408初始化为空数组） | ✅ **v4.9.9**：新增loadTaskSessions函数，初始化时从localStorage恢复taskSessions |
| **B028** | **2026-05-09** | **专家会话重复创建** | createExpertSession无去重检查，每次点击专家卡片都创建新会话 | ✅ **v4.9.9**：按expertName去重，已存在则切换到现有会话 |
| **B029** | **2026-05-09** | **ExpertType缺少space/strategy** | store.ts ExpertType联合类型只有11种，缺少'space'和'strategy'，导致6位专家的system prompt fallback到general | ✅ **v4.9.9**：ExpertType扩展space和strategy |
| **B030** | **2026-05-09** | **Sidebar删除专家会话绕过store** | Sidebar.tsx:403直接操作localStorage和setState，未调用deleteExpertSession方法 | ✅ **v4.9.9**：替换为deleteExpertSession调用 |
| **B031** | **2026-05-09** | **activeTaskId刷新后丢失** | 刷新页面后activeTaskId=null，messages=[]，用户回到白屏 | ✅ **v4.9.9**：activeTaskId和对应messages从localStorage恢复 |
| **B032** | **2026-05-09** | **CSP缺siliconflow导致RAG Embedding静默失败** | tauri.conf.json CSP connect-src缺少https://api.siliconflow.cn，RAG Embedding请求被浏览器安全策略拦截 | ✅ **v5.1**：CSP添加api.siliconflow.cn |
| **B033** | **2026-05-10** | **App启动SIGABRT崩溃（macOS 26.4 Tahoe）** | main.rs用`tokio::spawn()`在Tauri `.setup()`中初始化RAG，但setup不在Tokio runtime上下文 → "no reactor running" panic → abort() | ✅ **v5.1.0**：`tokio::spawn` → `tauri::async_runtime::spawn`。GUI模式看不到panic message，需CLI运行二进制排查 |
| **B034** | **2026-05-10** | **跨会话记忆写入路径断裂（QA发现）🔴** | ChatArea.tsx L527 invoke参数用camelCase（sessionId/sessionTitle/userQuery/aiResponse），main.rs `#[tauri::command]`要求snake_case。Tauri v2 command参数精确JSON key匹配，不做自动大小写转换 → 4个参数全部丢失 → store_cross_session_memory静默失败 → LanceDB无数据 → 检索永远为空 | ✅ **v5.1.0修复**：改为snake_case（session_id/session_title/user_query/ai_response）。⚠️教训：Tauri command函数参数不像serde struct那样自动rename |
| **B035** | **2026-05-10** | **底部"更新检查失败"永久显示** | tauri.conf.json 配置pubkey但latest.json无签名 → minisign验证失败 → 重试3次后setCheckFailed(true) → 错误条永久停留底部 | ✅ **v5.1.1修复**：清空pubkey。正式发版前需配置完整minisign签名流程 |
| **B036** | **2026-05-10** | **504 Gateway Timeout（大图片上传）🔴** | FileUploader.tsx零压缩，4.2MB PNG→~5.6MB base64直发墨行API → nginx proxy_read_timeout超时返回504 | ✅ **v5.1.1修复**：FileUploader新增Canvas压缩(max1536px+JPEG 0.82)；超时120s→180s；504提示优化 |
| **B037** | **2026-05-10** | **侧边栏专家会话点击不切换页面 🔴** | Sidebar.tsx L389 `setActiveTab('chat')`未从useStore解构，运行时报TypeError → onNavigate('chat')永远不执行。App.tsx的useEffect异步兜底但有延迟 | ✅ **v5.1.2修复**：改为`useStore.getState().setActiveTab('chat')` |
| **B038** | **2026-05-10** | **跨会话记忆主聊天不存储 🔴** | ChatArea.tsx L530 `currentSessionId = activeExpertSessionId \|\| activeTaskSessionId \|\| activeTaskId \|\| null` → 主聊天时全部null → if(currentSessionId)跳过存储 → LanceDB永远无主聊天数据 | ✅ **v5.1.2修复**：fallback从null改为"main"，移除if(currentSessionId)守卫，确保主聊天也写入跨会话记忆 |
| **B039** | **2026-05-10** | **PDF/Excel/PPT文件上传后发送乱码给AI** | FileUploader.tsx对PDF/XLS/PPT等二进制文件用FileReader.readAsDataURL() → ChatArea.tsx用atob()解码二进制→乱码发送给AI | ✅ **v5.1.2修复**：pdfjs-dist提取PDF文本、SheetJS解析Excel表格、DOC/PPT仅报告文件名不尝试解码 |
| **B040** | **2026-05-10** | **无Excel导出+保存路径不告知用户** | documentGenerator.ts缺少exportToXlsx函数+saveFile只返回boolean无法显示路径 | ✅ **v5.1.2修复**：新增exportToXlsx函数（SheetJS生成）、saveFile返回保存路径、toast显示完整路径
| **✨ FEATURE** | **2026-05-11** | **工作记忆MD自动笔记（v5.1.3）** | AI回复中自动检测有价值内容（>800字+结构化），保存为本地MD笔记到`{app_data}/notes/`；下次对话时自动检索最近3条笔记注入系统提示 | ✅ **v5.1.3实现**：新增working_notes.rs模块、save_working_note+get_recent_notes命令、ai_engine.rs Layer 7注入、ChatArea.tsx自动保存
| **✨ FEATURE** | **2026-05-11** | **停止按钮+任务续接（v5.2.0）** | 新增：①发送按钮在AI生成中变为红色停止按钮(Square图标)可随时中断 ②后端tokio::select+oneshot channel abort竞速机制 ③停止后保留部分内容和思考步骤不丢失 ④新增abort_generation Tauri命令 ⑤修复P0 Bug: abort后错误消息覆盖友好提示 | ✅ **v5.2.0实现**：main.rs新增abort_generation命令+tokio::select竞速、ChatArea.tsx按钮逻辑+handleStop+aborted事件处理、AbortManagedState管理
| **B041** | **2026-05-11** | **停止按钮不工作（v5.3.1根因修复）** | OnceLock在多个函数中各自初始化=多个独立AtomicBool=不共享。模块级static OnceLock + get_abort_flag()全局单例 | ✅ **v5.3.1修复**：改为模块级static OnceLock + get_abort_flag()全局单例。⚠️教训：OnceLock不是全局变量，是lazy初始化器，每个调用点独立初始化
| **B042** | **2026-05-11** | **多窗口互锁** | isGenerating全局状态阻塞所有ChatArea窗口，一个窗口生成中其他窗口无法发送 | ✅ **v5.3.1修复**：generatingContext per-window，每个窗口独立跟踪生成状态
| **B043** | **2026-05-11** | **任务对话丢失** | 数据持久化到localStorage但无UI入口，刷新后任务会话消失 | ✅ **v5.3.1修复**：Sidebar+taskSessions列表+switchTaskSession，任务会话在侧边栏显示并可切换
| **B044** | **2026-05-11** | **DOCX解析卡死** | mammoth在Tauri WebView中hang，解析大文档时UI冻结 | ✅ **v5.3.1修复**：mammoth→JSZip解压+<w:t>标签提取，异步不阻塞UI
| **B045** | **2026-05-11** | **文档导出失败** | docx:toBase64String+atob, pptx:arraybuffer降级base64，Blob.arrayBuffer在WebView不可用 | ✅ **v5.3.1修复**：docx用toBase64String+atob解码，pptx改为arraybuffer传输
| **B046** | **2026-05-11** | **▶按钮根因（v5.3.5修复）** | App.tsx有activeTab(store)和currentPage(state)两套导航，▶按钮只更新store.activeTab但currentPage没变→ChatArea不渲染 | ✅ **v5.3.5修复**：加useEffect同步activeTab→currentPage
| **B047** | **2026-05-11** | **文档保存IPC超限** | Array.from(Uint8Array)→JSON巨大数组→IPC超限→Rust收不到数据 | ✅ **v5.3.6修复**：改用base64传数据，避免IPC传巨大JSON数组
| **B048** | **2026-05-11** | **▶按钮内容到主窗口** | 流式事件回调listen()三处只检查curExpertId，完全没检查activeTaskSessionId→任务消息路由到主聊天 | ✅ **v5.3.6修复**：content_chunk/done/thinkingSteps都加了curTaskSesId路由
| **B049** | **2026-05-11** | **图片设计专家信息不保存** | localStorage QuotaExceededError（200+skill撑爆5MB配额）+ 保存条件太严格(需brandName+category同时非空) | ✅ **v5.3.8修复**：放宽保存条件+配额超限检测和错误提示
| **B050** | **2026-05-11** | **图片设计专家AI修图超时** | 前端超时120秒，后端串行尝试3个模型，实际等6次请求 | ✅ **v5.3.8修复**：前端超时180秒+后端3模型并行(tokio::join!)+友好超时提示
| **B051** | **2026-05-11** | **热点监控匹配错Skill** | tpl_hot_monitor模板缺defaultSkillName字段+ai_engine.rs skill_match()无热点关键词 | ✅ **v5.3.8修复**：模板加defaultSkillName='catering-trend-monitor'+skill_match()加热点关键词
| **✨ FEATURE** | **2026-05-11** | **龙虾级本地权限（v5.3.9）** | 对标OpenClaw Gateway的Unix用户权限：entitlements.plist加com.apple.security.files.all+capabilities扩展fs:read-all+local_fs.rs 9 Commands | ✅ **v5.3.9实现**：local_read_text_file/local_read_binary_file/local_write_text_file/local_write_binary_file/local_list_directory/local_create_directory/local_remove/local_path_info/local_get_home_dir/local_get_common_dirs
| **B052** | **2026-05-12** | **热点抓取不生效** | analyze_task_type的realtime_keywords缺少"热点/热搜/热榜"等常用词→用户说"热点"无法触发realtime任务 | ✅ **v5.4.0修复**：realtime_keywords补充16个关键词（热点/热搜/热榜/动态/趋势/新闻/资讯等）
| **B053** | **2026-05-12** | **图片生成失败（墨行AI不可用）** | moxing.pro /v1/images/generations返回404，chat/completions返回500→API提供商宕机 | ✅ **v5.4.0修复**：替换为硅基流动Kolors模型(api.siliconflow.cn)，复用已有API Key，下载URL转base64
| **B054** | **2026-05-12** | **读取本地文档无回复** | 用户说"读取下载文档中的xxx"但未提供路径→extract_file_path返回None→AI不读取 | ✅ **v5.4.0修复**：新增自动扫描~/Downloads+Desktop+Documents，提取消息关键词模糊匹配文件名
| **B055** | **2026-05-12** | **图片设计专家生成图片无法下载** | downloadSingle()用<a href="data:"> + .click()→Tauri WebView不支持data:URL下载 | ✅ **v5.5.0修复**：改用@tauri-apps/plugin-dialog save()弹窗 + save_file_to_disk Rust command
| **✨ FEATURE** | **2026-05-12** | **瀑布流渲染（v5.5.0）** | 替换思考步骤的简单fadeIn，正文逐块淡入动画。marked自定义Renderer包裹块级元素→CSS animation-delay递增(0.04s)→流式传输时启用，完成后一次性显示 | ✅ **v5.5.0实现**：utils/markdown.ts 改写marked Renderer + 新增sc-md-waterfall/sc-md-done容器类 + ChatArea.tsx MessageBubble内判断isThisMessageStreaming
| **B056** | **2026-05-12** | **DeepSeek V4推理内容丢弃→content_len=0→永久thinking** | ai_engine.rs解析SSE时只取content字段，DeepSeek的reasoning_content（思考链）被静默丢弃，导致done事件传空字符串→前端content_len=0 | ✅ **v5.5.2修复**：新增deepseek_reasoning事件类型，每10 token推送一次；done事件传实际full_content
| **B057** | **2026-05-12** | **记忆压缩>200字门槛过高→压缩永不触发** | memory_compressor.rs硬编码>200字符才触发压缩，短但有价值的对话（如偏好、决策）被跳过 | ✅ **v5.5.2修复**：移除字符门槛，让LLM自行判断价值；问候类返回空数组[]
| **B058** | **2026-05-12** | **🔴 ChatArea渲染崩溃 ReferenceError: Cannot access 'j' before initialization** | **真正根因**：MessageBubble子组件中`isThinkingActive`/`hasThinkingDone`（第1330行）在useEffect（第1216行）之后声明→TDZ。minified后变量名变j/M。修复：移到useEffect之前。**踩坑#26：排查方法=读minified定位crash位置变量映射→反查源码** |
| **B059** | **2026-05-12** | **🔴 餐饮热点抓取卡死5分钟+停止按钮无效+重启崩溃** | **根因①**：fetch_hot_trends HTTP请求无connect_timeout，API慢响应导致TCP连接长时间等待（OS级超时可达分钟级）。**根因②**：process_user_message内部无超时保护，外部180s超时被阻塞的TCP连接绕开。**根因③**：skill_match匹配的技能未注入API上下文，导致回答质量差。修复：web_tools.rs加connect_timeout(5s)；ai_engine.rs加tokio::time::timeout(30s)包裹fetch_hot_trends；自动匹配技能注入system prompt |
| **FEATURE-059** | **2026-05-12** | **瀑布流6阶段重构** | 从3步抽象管道改为6阶段真推理展示：🧠深度思考→🎯意图判断→📋行动计划→🔧工具执行(逐个可展开)→✨综合答案→💬回复交付。每阶段不同颜色(紫/蓝/橙/绿/红/粉)。tool_done覆盖tool卡片避免冗余。CSS新增wf-phase-*系列类 |
| **B060** | **2026-05-12** | **P0 RAG & 跨会话记忆检索无超时→聊天卡死** | call_ai_streaming_events中retrieve_knowledge()和retrieve_memories()无tokio::time::timeout包裹。LanceDB或bge-m3嵌入API挂起时，整个聊天流程无限期阻塞。 | ✅ **v5.5.4修复**：两处加`tokio::time::timeout(Duration::from_secs(15))`，超时后emit warning事件并跳过，继续对话 |
| **B061** | **2026-05-12** | **P0 API错误不通知前端→用户无感知等待** | real_api_streaming中API返回非200状态码时直接return Err(...)，不emit任何事件到前端。用户看到空白等待，不知道发生了什么。 | ✅ **v5.5.4修复**：错误分支新增emit_event("error", ...)，携带状态码和模型名，再返回Err |
| **B062** | **2026-05-12** | **P0 DeepSeek V4 reasoning_content粗暴裁剪→可能乱码** | real_api_streaming中reasoning_buf.replace("嗯，", "").replace("好的，", "").replace("让我", "")盲目去中文前缀——若reasoning_content不包含这些前缀，完全无效；若包含其他前缀（如"首先、"），仍残留。 | ✅ **v5.5.4修复**：移除replace链，保留完整reasoning_content作为fallback输出 |
| **B063** | **2026-05-12** | **P1 content_chunk每个SSE token都发全量→2000+React重渲染** | real_api_streaming中每收到一个SSE token就emit_content(app, &full_content, false)，full_content是累积内容。2000 token的响应=2000次emit→2000次React re-render。 | ✅ **v5.5.4修复**：批量推送——50ms或≥20字符才emit一次，大幅减少前端re-render |
| **B064** | **2026-05-12** | **🔴 P0 批量推送导致内容不显示** | v5.5.4批处理(50ms/20字符)引入新Bug：短回复(<20字符)或快速回复(<50ms)导致content_chunk从不触发→finalContent为空→done事件也不带内容。**根因**：前端done事件只依赖变量finalContent（由content_chunk设置），完全忽略done事件自身的payload.content。 | ✅ **v5.5.5修复**：①前端done事件加`payload.content`兜底；②后端done前强制flush剩余的content_chunk(`full_content.len() != last_emitted_len`) |
| **B065** | **2026-05-12** | **🔴 P0 工作笔记同步I/O阻塞async运行时→聊天彻底卡死(180s超时无效)** | `call_ai_streaming_events`中Layer 7工作笔记`get_notes_context()`是同步函数，内部有`fs::read_dir`→`.metadata()`→`fs::read_to_string`三段阻塞I/O，直接在tokio async线程上调用，导致整个运行时被阻塞——**所有await/tokio::time::timeout失效**，外部180s超时也无效（超时本身就是通过tokio调度实现的）。**诊断手段**：DIAG链`[0]→[0a]→[0b]→[0c]→[0d]→[0e]→[0f]→[0f1]→[0f2]→[0f3]→[0g]→[0h]→[0i]→…`逐节点埋点，5轮缩小范围后定位到`[0i]`（工作笔记开始）后无`[0i1]`。 | ✅ **修复**：包一层`tokio::task::spawn_blocking`将同步I/O移到专用线程池+10s超时。这是**v5.5.5系列第三个同类型Bug**（B060 RAG超时、B059 热点抓取超时、B065 工作笔记阻塞），共性根因：**同步阻塞I/O在async上下文中调用**。 |
| **B066** | **2026-05-13** | **🔴 P0 跨会话记忆检索LanceDB同步阻塞→定时任务窗口聊天卡死(94s)** | `call_ai_streaming_events`中Layer 6跨会话记忆检索`retrieve_memories()`虽标记async且外部有`tokio::time::timeout(15s)`，但**LanceDB 0.27内部存在同步阻塞操作卡住tokio工作线程→timeout timer也失效**。日志证据：`[0g]跨会话记忆开始`后94秒完全空白，15s timeout完全未触发。**同类Bug第四例**（B059/B060/B065/B066），共性根因：**外部库的内部同步阻塞绕开async超时机制**。 | ✅ **v5.5.6修复**：`spawn_blocking` + `Handle::block_on`包裹整个`retrieve_memories`调用。但**此修复不完整**。 |
| **B067** | **2026-05-13** | **🔴 P0 v5.5.6 spawn_blocking修复不完整→任务会话+主聊天仍卡死** | v5.5.6用`Handle::current().block_on()`在spawn_blocking中运行async代码，**Handle::current()在独立线程中不稳定**。日志证据：主聊天第3条消息卡59s，任务会话01:13卡死至今。`Handle::current()`在高负载(62条消息)或非主线程上下文下可能失效→block_on死锁。 | ✅ **v5.5.7修复**：改为`std::thread::spawn` + 独立`Runtime::new()` + `tokio::sync::oneshot` channel。创建完全隔离的OS线程和新tokio runtime，彻底避免与主runtime的竞争/死锁。timeout在oneshot receiver上等待15s，全程可靠。 |
| **B068** | **2026-05-13** | **🔴 P0 v5.5.7独立线程方案仍不稳定→定时任务跨会话记忆依然卡死** | 日志证据：定时任务在`[0g]跨会话记忆开始`后44秒无`[0h]`，15s timeout未触发。交叉验证：主聊天/专家会话正常。根因：①`std::thread::spawn`+`Runtime::new()`在高并发下OS线程创建可能延迟/失败 ②LanceDB并发连接无序列化→争用文件锁 ③`oneshot` timeout在特定场景下不响应。**修复(B068)**: ①改用`tokio::spawn`+`tokio::select!`替代`std::thread::spawn`+`Runtime::new()`（使用主runtime的async能力，timout通过select!实现）②新增`LazyLock<Arc<tokio::sync::Mutex>>`序列化LanceDB访问 ③新增精细DIAG日志追踪独立线程生命周期（`[0g0]`spawn前、`[0g1]`select!前、`[0g2a/b]`结果、`[0g3]`完成）④`retrieve_memories`内部每步埋CROSS日志 ⑤修复工作笔记`preview[..200]`UTF-8 byte边界panic ⑥localStorage保存失败增加错误日志。**产品指挥官按铁律更新至v5.5.8。** | ✅ **v5.5.8修复**：tokio::spawn+select!替代std::thread+Runtime::new()，LanceDB序列化，DIAG日志全链路覆盖。 |
| **B092** | **2026-05-13** | **🔴 P0 发送按钮完全无反应+ChatArea整体崩溃** | v5.5.15中添加B092诊断代码时，`nativeClickHandler`用const在useEffect之后定义，但useEffect内部引用了它。JavaScript const的TDZ（暂时性死区）导致组件初始化时抛出`ReferenceError: Cannot access 'a' before initialization`（minified变量名a=handleSend）。React事件系统整体崩溃，onClick/onChange全部失效。**同一个坑第二次踩！**（B058已犯过TDZ错误）。**⚠️教训**：①useEffect回调引用的所有const/let变量必须定义在useEffect之前 ②诊断代码不是"随便加的"，它也遵循JS执行规则 ③minified后变量名不可读，定位TDZ需从`Cannot access 'X' before initialization`的X反查源码 | ✅ **v5.5.16修复**：将nativeClickHandler定义移到useEffect之前。**🔴 2026-05-13 涛哥铁律升级**：产品指挥官新增§14诊断代码安全铁律、Bug反馈模板、Git版本控制强制规则、分模块开发规则。** |

### 7.2 已知限制/待处理

| # | 问题 | 优先级 | 说明 |
|---|------|--------|------|
| L001 | ~~硅基流动reasoning_content未解析~~ | ~~P2~~ | ✅ B056已修复：新增deepseek_reasoning事件 |
| L002 | DMG bundle_dmg.sh AppleScript失败 | P2 | CI环境无GUI，需手动hdiutil创建 |
| L003 | 后端skill_manager.rs仍硬编码~120个 | P1 | 未同步v4的261个全量架构 |
| L004 | DESIGN.md第17行还写着Skills=深色 | P3 | 实际已全改浅色，文档滞后 |
| L005 | Windows交叉编译未验证 | P1 | 需要CI或Wine环境测试 |
| L006 | **releases.shaoziclaw.com 更新服务器** | **✅ 已完成** | **完整运维手册见 §7.5.4（2026-04-28）** |
| L007 | **图片设计专家Skill全面优化（6项）** | ✅ **v4.9.2已完成** | **①品牌档案持久化(localStorage) ②Logo上传(SVG) ③VI/风格加跳过按钮 ④平台尺寸规格对齐(PLATFORMS嵌构) ⑤单选+全选双模式 ⑥智能修图红线** |
| L008 | **二级页面导航阻断根因修复** | ✅ **v4.9.2已完成** | App.tsx useEffect + useRef 监听 activeTaskId/activeExpertSessionId，自动从二级页面跳回聊天 |
| L007 | **AI Gateway 大模型API集成（服务端代码就绪，暂停客户端集成）** | ⏸️ **等厂商测试端口** | aiProviders.ts已完成(DeepSeek/Qwen/SiliconFlow)，aiGateway.ts已对接。⚠️ 涛哥明确要求：**先不集成到客户端，等大模型API集成厂商给测试端口、测试通过后再集成**。服务端.env中Key为占位符。客户端保持现有硬编码直连模式不变。（2026-04-30） |
| **R1** | **AI调度引擎** | **P2** | **LangGraph意图分类+Skill强制调用**——当前Skill调用率约30%，目标95%以上。单Skill直接路由，复合问题拆解为子任务链式调用 |
| **R2** | **全局用户上下文（跨会话记忆）** | ✅ **v5.1.1已完成** | 见R7。原方案ChromaDB/Pinecone已改为复用LanceDB，更轻量 |
| **R3** | **结构化输出+文件交互** | **P2** | **JSON Schema模板化输出+文件上传下载**——前端需集成Tesseract.js(OCR)+pdf.js，Skill输出按Schema渲染为卡片+导出PDF/Excel |
| **R4** | **侧边栏按项目聚合** | **P2** | **同一项目下的对话聚合展示**——当前平铺式按时间倒序，应改为按项目名称分组 |
| **R5** | **文生图集成** | **P2** | 接入图片生成API，支持菜单效果图/门店布局图输出 |
| **R6** | **向量数据库知识库** | ✅ **v5.1已完成** | **LanceDB 0.27嵌入式向量库 + 硅基流动bge-m3 Embedding + 261个SKILL.md自动检索注入**。知识库管理面板(Settings→📚知识库)。首次启动自动初始化，支持手动下载/重初始化。RAG作为第5层上下文（地图数据之后）自动注入AI回答。 |
| **R7** | **跨会话记忆（Brain）** | ✅ **v5.1.1已完成** | 复用RAG基础设施（bge-m3+LanceDB），独立表cross_session_vectors。AI回复后自动写入→下次提问时语义检索其他窗口内容注入system prompt。MAX=500条/MIN_SCORE=0.4/TOP_K=3。⚠️ B034：前端invoke参数名camelCase/snake_case不匹配导致写入断裂，v5.1.0已修复 |
| **L009** | **图片识别(OCR) + Vision模型智能路由** | **✅ v5.1.1 Vision路由已完成，OCR待接API** | Vision智能路由：ChatArea.tsx检测到图片且当前模型不支持vision时自动切GLM-5.1（用户无感知）。纯文本继续走DeepSeek V4。精确OCR（发票/证件/手写体）后续接百度OCR API |

### 7.3 宋宣用户反馈追踪（2026-04-27）

> 来源：`副本勺子Claw产品修改意见0427.docx` — 真实用户体验视角

| # | 反馈项 | 状态 | 处理方式 | 日期 |
|---|--------|------|---------|------|
| F01 | 思考过程步骤重复 | ✅ **已修复** | title级去重，同名step更新content | 2026-04-28 |
| F02 | 思考过程太长/内容太多 | ✅ **已修复** | 实时显示≤5步 + 内容截断(80/120字符) + 紧凑布局 | 2026-04-28 |
| F03 | 流式输出体验差 | ✅ **已修复** | 去掉绿色box-shadow/动画，中性灰紧凑风 | 2026-04-28 |
| F04 | 任务标题栏多余 | ✅ **已删除** | 移除整个任务栏+清理死代码 | 2026-04-28 |
| F05 | 客观定量问题应先答后问 | ⏳ **待涛哥确认** | 需改后端prompt逻辑顺序 | — |
| F06 | 定时任务功能 | ⏳ **需产品定义** | 左侧栏入口+cron调度系统 | — |
| F07 | 舆情监测分级分类 | ⏳ **依赖F06** | 定时任务基础完成后才能做 | — |
| F08 | 小红书/微博数据抓取 | ⏳ **待测试Firecrawl** | 明天实测反爬可行性 | — |

---

## 七·五、🔄 自动更新系统（v4.6新增，v4.6.2彻底重构）

> **⚠️ 2026-04-29 v4.6.2 重构要点**：
> - **旧版**：Tauri原生`download_and_install()` → 只支持 NSIS/.app.zip，**不支持DMG**
> - **新版**：自实现 DMG 完整流程（HTTP下载→hdiutil挂载→cp复制.app→detach卸载→open重启）
> - **UI重构**：从Sidebar左下角弹窗 → **App.tsx全局底部条**（WorkBuddy风格）

### 7.5.1 架构（v4.6.2 最新）

```
App启动 → 3秒后后台静默调用 check_update
    ↓
├── 无更新/错误/检查中 → return null（完全不渲染UI，静默）
│
└── 有新版本 → UpdateNotifier.tsx 全局底部条（<main>底部）
        ↓
   ┌──────────────────────────────────────────────┐
   │ 🔄 新版本就绪  v4.x.x  [更新日志] [重启升级] ✕ │  ← 底部条
   └──────────────────────────────────────────────┘
        ↓                    ↓           ↓
  打开canclaw.cn/     download_and_install    关闭通知
  changelog.html      _update(Rust命令)     (下次启动再提示)
                       ├─ HTTP下载DMG(10%→50%)
                       ├─ hdiutil attach(60%)
                       ├─ cp .app到/Applications(75%)
                       ├─ hdiutil detach(90%)
                       └─ open新版本 + exit(0)(100%)
```

### 7.5.2 后端实现（main.rs）— v4.6.2

| Command | 功能 | 参数 | 返回值 |
|---------|------|------|--------|
| `check_update` | 检查是否有新版本 | 无 | `UpdateInfo { available, version, body, date, download_url }` |
| `download_and_install_update` | DMG自动安装+重启 | `dmg_url: String`, `on_progress: Channel<i32>` | `Result<(), String>` |

**⚠️ 核心变更（vs v4.6.0旧版）**：
- **删除**：`install_update_and_restart`（用Tauri插件，不支持DMG格式）
- **新增**：`download_and_install_update` — 自实现完整DMG安装流程
- **新增字段**：`UpdateInfo.download_url`（前端"重启升级"按钮需要下载地址）

**关键实现细节**：
- 使用 `tauri-plugin-updater = "2"` 插件（仅用于 check_update 查询 latest.json）
- `app.updater()` 返回 `Result<Updater, Error>`，**必须先 `?` 解包**
- `update.date` 类型是 `time::OffsetDateTime`
- **Channel导入路径**：`use tauri::{ipc::Channel, Manager};`（Tauri 2.0 正确写法）
- **reqwest** 用于HTTP下载DMG（已在 Cargo.toml）
- **tokio::time::sleep** 用于延迟退出（让前端收到100%进度）
- **std::process::exit(0)** 退出当前进程，**open 启动新版本**

**⚠️ 踩坑经验（v4.6.2实测）**：
1. Tauri 原生 updater 的 `download_and_install()` **只支持 NSIS 和 .app.zip**，不支持 DMG 磁盘映像
2. macOS DMG 自动更新必须自己实现：下载→hdiutil attach→cp→detach→open
3. `tauri::Channel` 在 Tauri 2.0 中路径是 `tauri::ipc::Channel`
4. 前端 invoke 时传 Channel：`{ onProgress: new Promise(...) }`

### 7.5.3 前端实现（UpdateNotifier.tsx）— v4.6.2

- **位置**：**App.tsx 的 `<main>` 底部**（不是 Sidebar！所有页面全局可见）
- **触发时机**：App启动后3秒自动检查 + 每20分钟后台轮询
- **UI样式**：**WorkBuddy风格全局底部条**
  - 背景 #fafafa / 顶边框 #e8e8e8 / 圆角0
  - 左侧：🔄 图标 + "新版本就绪 v{x.x.x}" 或 "正在下载... x%"
  - 右侧：[更新日志](canclaw.cn/changelog.html) + [重启升级] + [✕关闭]
  - 主按钮薄荷绿 #57CC86 / 次按钮灰色边框
- **静默规则**：error/checking/无更新 → 全部 return null，不渲染任何 UI
- **用户操作**：「更新日志」→ 打开官网changelog(www.shaoziclaw.com) / 「重启升级」→ 调用Rust DMG安装命令（带进度条）/ 「✕」→ 关闭

### 7.5.4 更新服务器 & Changelog 页面

> **📖 运维操作已拆分为独立skill → shaoziclaw-ops-manual**
>
> 本节仅保留客户端配置摘要。发版/签名/服务器管理/故障排查等全部运维操作请调用 **运维手册SKILL.md**。

**客户端配置（tauri.conf.json）**：
```json
"updater": {
  "endpoints": ["https://releases.shaoziclaw.com/latest/{{target}}/{{current_version}}"],
  "dialog": false,
  "pubkey": "RWSZKk0d0r9wJrAa2ba2JSi2kV4O3f+LQ+nAY9ANOT2R8JDn7Xw79oeL"
}
```
**CSP白名单**：必须包含 `https://releases.shaoziclaw.com`

**🌐 Changelog 更新日志页面（v4.6.2 新增）**：
- **URL**：`https://www.shaoziclaw.com/changelog.html`
- **设计**：深色主题（与官网统一）+ 左侧快速导航 + 版本卡片
- **功能**：IntersectionObserver 滚动高亮当前章节
- **内容覆盖**：v4.6.2 → v4.6.0 → v4.5.0 → v4.3~v4.4 → v4.0~v4.2

**调用分工**：
```
开发/打包/UI/Bug     → 产品指挥官（本SKILL.md §八·五）
上传/签名/部署/运维   → shaoziclaw-ops-manual SKILL.md（§八 发版6步流程）
```

### 7.5.5 LOGO资源（v4.6统一）

| 文件 | 用途 | 格式 |
|------|------|------|
| `frontend/public/logo-graphic.svg` | 全局LOGO（纯图形，无文字，白底圆角容器） | SVG矢量 |
| `frontend/src-tauri/icons/icon.png` | Tauri图标源文件 | 512x512 PNG |
| `frontend/src-tauri/icons/icon.icns` | macOS应用图标 | ICNS |
| `frontend/src-tauri/icons/icon.ico` | Windows应用图标 | ICO |

> **设计规范**：白色圆角矩形背景 + #57CC86 薄荷绿勺子图形（无文字）

---

## 八、🏗️ AI辅助开发工程方法论（VibeCoding 标准工作流）

> **核心观点**：问题不在AI能力，而在于缺乏工程流程，导致代码越写越乱形成"屎山"。
> **本质**：用工程思维驯服AI的创造力——既不让代码变成"屎山"，也不让人类沦为AI的复读机。
> **来源**：2026-05-05 涛哥分享的VibeCoding标准化攻略 + Google agent-skills设计模式。
> **🔴 新增（2026-05-09）**：从Google agent-skills仓库（36.8k stars，Addy Osmani）提炼的6个质量强化模式已集成到下方§8.1~8.6。这些模式不只是给新skill学习用的——**更重要的是让参考消化并内化到每次开发决策中，加强写代码的能力。**

### 8.0 开发前9步（分三阶段）

#### 📐 阶段一：定图纸

| # | 步骤 | 要点 | 铁律 |
|---|------|------|------|
| **1** | **需求描述（聊天式）** | 像跟朋友聊天一样向AI描述痛点、目标用户、使用场景和核心功能 | 信息量要足，不需严谨但覆盖面要全 |
| **2** | **输出PRD文档** | 让AI输出结构化产品需求文档 | ⚠️ 重点补充**验收标准**——如"登录成功"必须明确：失败提示样式？是否锁定账户？跳转路径？否则AI会发散 |
| **3** | **锁定视觉框架** | 提前确定UI风格方案 | 找2-3个参考网站或让AI提供风格方案；明确导航栏布局、页面区分度、整体气质；**避免AI边写功能边推翻UI** |

#### 🏗️ 阶段二：打地基

| # | 步骤 | 要点 | 铁律 |
|---|------|------|------|
| **4** | **明确项目边界** | 回答三个关键问题 | ①本地自用还是公开上线？②有无数据隐私合规要求？③性能/成本上限是多少？ |
| **5** | **锁定技术栈** | 不追求"越主流越好"，追求**"越可验证越好"** | 选型标准：文档齐全 → 社区活跃 → 能跑测试 → 可进CI/CD；避免选用资料稀缺的新框架 |
| **6** | **产出轻量架构草案** | 让AI定义目录结构、核心模块、数据模型和服务端必要逻辑 | 允许迭代并记录变更原因（非宪法式固定） |

#### 📋 阶段三：立规矩

| # | 步骤 | 要点 | 铁律 |
|---|------|------|------|
| **7** | **创建三份核心文档** | PRD.md（功能清单+验收标准）、ARCH.md（架构说明）、PROJECT.md（当前进度/已知问题/下一步计划） | **每次重大修改必须同步更新三份文档** |
| **8** | **定开发规范 + 建参考样例库** | 硬性规定：TypeScript强制使用、组件命名规则、文件大小上限等 | 建立 `reference/` 文件夹存放你认可的按钮/表单/弹窗标准实现样例，**让AI有"照着抄"的标准**，防止每次都"创新"出不一致的UI元素 |
| **9** | **设置Git + 质量闸门** | Git = 项目安全带，飞了能一键回溯；质量闸门防止低级错误堆积 | **写第一行代码前必须完成！** 多分支并行推进不冲突 |

### 8.0 开发中5个关键点（执行命脉）

| # | 关键点 | 说明 | 违规后果 |
|---|--------|------|---------|
| **1** | **🔬 小步迭代MVP法则** | 不要让AI一次性写大量代码！按"页面能打开→提交表单→服务端保存→权限校验→列表展示"小切片推进 | 一次写太多→出了问题不知道在哪→全部重写 |
| | | 每完成一个可验证环节就：跑测试 → 过lint → git提交 | | |
| **2** | **🧩 人类必须介入模块拆分** | 绝不允许所有代码塞进同一文件！初期就要规划好模块边界 | 后期在混乱代码中找功能会崩溃 |
| **3** | **🚫 禁止AI越权操作** | 每次任务结尾必须强调：**"只改指定文件和范围，不要顺手重构，不要改UI风格，不要动无关逻辑"** | AI会好心办坏事，改了一堆你没要求的 |
| | | 用状态摘要管理上下文，避免AI重写整个页面 | | |
| **4** | **🔒 死守安全底线** | API Key绝不能进前端（极易被窃取）；服务端必须做输入校验和授权校验；绝不信任前端传来的数据 | 这些不是口号，是必须落实的检验项 |
| **5** | **🔧 科学应对报错机制（三步法）** | ①最小化复现（压缩问题输入范围）②加日志断点追踪关键变量③编写针对性测试用例锁定异常行为 | **若AI连续两次未能提供有效修复证据（非猜测性修改），立即停止调试，通过Git回滚至上一稳定节点，避免错误扩散** |

### 8.0 与勺子Claw现有工作流的映射关系

> 本方法论是**通用工程框架**，勺子Claw的具体工具链和操作细节见 §8.1~8.5。

| 通用方法论 | 勺子Claw具体落地 |
|-----------|----------------|
| Step 1-3 定图纸 | §二 产品概览 + §四 UI设计语言(DESIGN.md) + §十二 产品文档体系6问 |
| Step 4-6 打地基 | §二.3 架构总览图 + §六 后端架构 + §三 内置模型配置 |
| Step 7-9 立规矩 | §九 记忆系统 + `frontend/DESIGN.md`(设计宪法) + Git(本地仓库) |
| 关键点1 MVP迭代 | §九.4 标准工作流 Step 4-5（最小化修改+逐步验证） |
| 关键点2 模块拆分 | §二.2 项目目录结构 + 组件文件映射(§4.5) |
| 关键点3 禁止越权 | karpathy-guidelines skill（手术刀式修改，不重构无关代码） |
| 关键点4 安全底线 | API Key硬编码在ai_engine.rs(Rust后端)，绝不进前端 |
| 关键点5 排障机制 | visual-bug-hunter skill + §七 Bug历史表 + Git回滚 |
| **🆕 agent-skills模式** | **见下方§8.1~8.6（6个质量强化模式，从Google仓库提炼）** |

---

### 8.1 🔴 反合理化模式（Anti-Rationalization）

> **来源**：Google agent-skills 的核心设计模式。每个步骤都预判AI会找什么借口跳过，然后提供反驳。
> **本质**：AI（和人一样）会自动合理化"跳过验证"的行为。通过预判并反驳这些借口，强制执行质量标准。

**勺子Claw开发场景的反合理化表**：

| 借口 | 反驳 |
|------|------|
| "这个改动很小不需要tsc检查" | 小改动引入类型错误的概率和大改动一样。B009就是useMemo依赖的小改动导致整个ChatArea不渲染 |
| "cargo check通过了就行不需要build" | cargo check不跑beforeBuildCommand（npm run build/vite），前端错误会漏过去 |
| "先改完代码再一起验证" | 改完10个文件后发现第一个就有错→全部返工。每改一步验证一步（增量验证） |
| "这个文件我之前改过，没问题" | 上次没问题不代表这次没问题。你改的其他文件可能影响了这个文件的依赖 |
| "用户不会注意到这个UI不一致" | 用户一定会注意到。B020官网下载404就是"用户不会在意旧版本"的翻版 |
| "先发布hotfix，文档明天补" | "明天"永远不会来。B007→B020→B026反复证明"补文档"会被遗忘 |
| "这个组件自己测试过能用" | 单组件测试≠集成测试。B008专家开场白单测正常但React批处理竞态下失败 |
| "不加这个检查也没什么" | 每个检查都有对应的血泪教训。CSP漏域名=B032静默失败；版本号漏=B026更新无效 |

**使用规则**：每次AI提出"跳过/简化/合并"步骤时，先查此表。如果借口在表里→直接拒绝。

---

### 8.2 🔴 红旗警告模式（Red Flags）

> **来源**：Google agent-skills。可观察的信号列表，当出现时说明开发流程正在出问题。

**勺子Claw开发红旗信号**：

| # | 红旗 | 含义 | 应对 |
|---|------|------|------|
| 🚩1 | 单次改动超过3个文件 | 改动面太宽，回归风险高 | 拆分为多个MVP增量 |
| 🚩2 | 超过100行代码没跑过验证 | v4.9.7回退教训：改ChatArea核心渲染链→全面崩溃 | 每改一个函数就`npx tsc --noEmit` |
| 🚩3 | "顺手改了XX" | 范围蔓延（scope creep），改了需求之外的东西 | VibeCoding铁律：只改指定文件和范围 |
| 🚩4 | useMemo依赖中用了store方法 | Zustand+useMemo陷阱（B009），引用永远不变 | 依赖数组必须用解构的state值 |
| 🚩5 | 用window变量传递组件间状态 | React 18批处理竞态（B008） | 用zustand store或props |
| 🚩6 | 删除代码"应该没问题" | Chesterton's Fence——不理解用途就删除 | 先确认代码存在的原因 |
| 🚩7 | "我在context耗尽前快速改完" | 赶工导致质量下降 | 停下来，记录进度，下次继续 |
| 🚩8 | 连续2次修改都没解决问题 | 可能方向错了 | 停止修改，回到问题定义 |
| 🚩9 | store.ts新增状态字段 | v4.9.7教训：store是全App状态枢纽 | 新增字段必须考虑和原有状态的冲突 |
| 🚩10 | "先不写测试了" | Beyonce Rule | 最少做一次回归验证 |

---

### 8.3 🔴 停线规则（Stop-the-Line）

> **来源**：Google agent-skills debugging模式。

```
1. STOP    → 停止所有修改，不做任何"顺手"改动
2. PRESERVE → 保留现场（错误信息、截图、当前代码状态）
3. DIAGNOSE → 用visual-bug-hunter定位根因（不是症状）
4. FIX     → 修复根因。AI连续两次没修好→Git回退到上一稳定节点
5. VERIFY  → 验证修复：前端build + 后端check + 端到端测试
6. RESUME  → 只在验证通过后继续
```

**铁律**：不要带着已知Bug继续开发——错误会叠加。"它现在能跑了"不等于修好了。

---

### 8.4 🔴 三级边界系统（Three-Tier Boundary System）

> **来源**：Google agent-skills安全分级。所有开发操作零歧义分级。

| 级别 | 规则 | 示例 |
|------|------|------|
| **🟢 永远做** | 无例外 | tsc零错误/cargo check通过/每功能验证渲染/新API域名加CSP/产品指挥官先调用 |
| **🟡 必须先问** | 需用户确认 | 修改store.ts状态结构/删除"看似无用"代码/改tauri.conf.json/跨3文件改动 |
| **🔴 绝对不做** | 硬红线 | 绕过产品指挥官/改3+文件不做MVP/workspace根目录跑cargo tauri build/window变量传状态/删store渲染链核心代码 |

---

### 8.5 🔴 增量修改规则（~100 Lines + MVP）

> **来源**：Google agent-skills增量实现 + 涛哥VibeCoding融合。

- **每次修改不超过100行**（纯新增文件除外）
- **每次只做一件事**——一个Bug或一个功能
- **每改一步验证一步**：tsc → cargo check → 功能验证
- **改动超3个文件→先做MVP验证**
- **高危文件**：store.ts（全App状态枢纽）、ChatArea.tsx messages useMemo（最核心渲染链）、App.tsx路由映射

---

### 8.6 🔴 怀疑剧检测（Doubt Theater Detection）

> **来源**：Google agent-skills doubt-driven-development。

**检测信号**：
- 验证"通过"但没运行实际命令
- "看起来应该没问题"就通过
- 修改后只验证编译通过，不验证功能正常

**应对**：要求提供每个验证步骤的具体命令输出 + 端到端测试。

---

### 8.7 🔴 DIAG链式二分定位法（Binary-Chop Debugging）

> **来源**：B065工作笔记阻塞Bug调试实战（2026-05-12）。**聊天空卡死、180s超时无效、无任何错误日志**——这种"黑盒卡死"Bug的通用解法。

**适用场景**：
- async函数某处阻塞，外部超时失效（因为超时本身依赖async运行时调度）
- 无报错、无panic、无超时日志——纯"卡死"
- 调用链深（10+层），无法肉眼判断卡在哪一步

**核心方法**：
```
1. 在最外层入口和出口各加 log_info("DIAG", "[A] 入口") / log_info("DIAG", "[B] 出口")
2. 发消息触发 → 看日志确认卡在[A]和[B]之间
3. 在[A]和[B]之间找"中点"，加 [MID]
4. 再次触发 → 看[MID]是否出现
   - 出现了 → 卡在[MID]和[B]之间，继续二分
   - 没出现 → 卡在[A]和[MID]之间，继续二分
5. 每轮范围减半，重复直到定位到具体行号
```

**关键原则**：
- DIAG 标识用 `[0] [0a] [0b] ... [5]` 字母+数字体系，最后一轮精确到 `[0f1] [0f2] [0f3]`
- 所有 DIAG 用 `[DIAG]` 统一标记，方便 `grep "DIAG"` 一键提取全链路
- 每轮至少 2 个新 DIAG（不能只加 1 个——只看"是否出现"无法判断"之后"）
- 先加粗粒度（入口/出口），再加细粒度（子步骤），不要一次加 20 个
- **DIAG 始终加在步骤"之前"**——如果最后出现的 DIAG 是 [X]，卡在 [X] 到下一个 DIAG 之间

**B065 实战全链路示例**：
```
[A] chat_stream入口
[0] call_ai_streaming_events入口
[0a] memory_search开始 → [0b] 完成
[0c] 技能匹配完成
[0d] 地图数据开始 → [0e] 文件读取开始
[0f] RAG检索开始 → [0f1] RAG决策 → [0f2] 进入timeout → [0f3] 完成
[0g] 跨会话记忆开始 → [0h] 完成
[0i] 工作笔记开始 → ❌ 卡住（无[0i1]）
[0j] 上下文合并完成
[5] 准备调用real_api → [6] 返回 → [B] chat_stream出口
```
第 1 轮：`[A] ✅ → [B] ❌` → 卡在 call_ai_streaming_events 里
第 2 轮：`[0] ✅ → [5] ❌` → 卡在预处理阶段
第 3 轮：`[0f] ✅ → [0f1] ✅ → ... → [0f3] ✅ → [5] ❌` → RAG过了
第 4 轮：`[0g] ✅ → [0h] ✅ → [5] ❌` → 跨会话记忆过了
第 5 轮：`[0i] ✅ → [0i1] ❌` → **定位到 get_notes_context() 第878行**

**注意**：此方法需要反复构建-部署-测试，在 Rust/Tauri 项目中每次约 20s（增量编译），完整重编约 3.5min。配合 `claw_log::log_info("DIAG", ...)` 使用，关闭后 `#[cfg(debug_assertions)]` 可自动移除。

**🛡️ 反面教训（~100 lines 增量修改规则同样适用调试）**：
- ❌ 一次加 10 个 DIAG → 范围从 450 行缩到 50 行，还需要第二轮
- ✅ 每次 2-3 个 DIAG，范围减半 → 5 轮精确定位
- ❌ 用 `strings` 验证编译产物（函数调用不产生字符串字面量，等于没验证）
- ✅ 用 `grep` 验证源码，编译时看完整输出（不要 `| tail -10`）

---

## 八·二、开发工具链与工作流

### 8.7 写代码 → karpathy-guidelines skill

- **位置**：`~/.workbuddy/skills/karpathy-guidelines/`
- **风格**：极简、手术刀式修改
- **唤醒词**："写代码"、"改后端"、"加功能"

### 8.8 改UI/做设计 → awesome-design-md skill

- **位置**：`~/.workbuddy/skills/awesome-design-md/`
- **内容**：69个真实网站的DESIGN.md设计规范
- **用法**：选参考风格 → 读DESIGN.md → 按规范改UI
- **⚠️ 勺子Claw有专属DESIGN.md**：`shaoziclaw-app/frontend/DESIGN.md`（**最高优先级**，是"设计宪法"）
- **唤醒词**："改UI"、"改设计"、"换风格"、"好看点"、"界面美化"

### 8.9 改BUG → visual-bug-hunter skill

- **位置**：`~/.workbuddy/skills/visual-bug-hunter/`
- **工作流**：截图 → AI视觉分析 → 定位区域 → 代码级排查 → 修复 → 再截图验证
- **核心原则**：不猜 → 先读完整布局结构 → 画DOM树 → 找矛盾点
- **唤醒词**："有BUG"、"bug"、"界面有问题"、"视觉异常"、"样式错了"

### 8.10 浏览器操作 → playwright skill

- **位置**：`~/.workbuddy/skills/playwright/`
- **配置**：profile="openclaw"，不用CDP调试模式
- **用途**：自动化测试、截图验证

---

## 八·三、📦 打包发布系统（macOS + Windows）

> **这是勺子Claw产品交付的核心流程。每次打包前必须走完整检查清单。**

### 8.5.0 环境依赖（打包前置条件）

| 工具 | 版本要求 | 用途 | 检查命令 |
|------|---------|------|---------|
| Rust (rustup) | stable | Tauri后端编译 | `rustup show` |
| Node.js | >=18 | 前端构建 | `node --version` |
| npm | >=10 | 包管理 | `npm --version` |
| Xcode CLI | 已安装 | macOS签名/链接 | `xcode-select -p` |
| **Windows交叉编译** | 见8.5.4 | Windows包需要 | `rustup target list \| grep windows` |

**当前主机环境（2026-04-20）**：
```
Rust: aarch64-apple-darwin (Apple Silicon Mac)
Node: v22.12.0
npm: 10.9.0
Tauri: 2.x (@tauri-apps/cli)
```

### 8.5.1 打包前检查清单（⚠️ 必须逐项确认）

```
□ 前端编译通过：cd frontend && npm run build （零error）
□ 后端编译通过：cd src-tauri && cargo check    （零error）
□ 版本号已更新：tauri.conf.json 的 "version" 字段
□ 图标资源完整：icons/ 下有 icns(Mac) + ico(Win) + png全套
□ CSP配置正确：如新增外部API需更新 connect-src
□ 功能自测通过（dev模式）：
  - [ ] 启动后自动登录（不弹登录页）
  - [ ] 发消息能正常收到AI回复
  - [ ] 切换模型能正常工作
  - [ ] 专家中心/Skills页面正常展示
```

### 8.5.2 macOS 打包（DMG）—— 主力平台

#### 方式一：cargo tauri build（优先尝试）

```bash
cd ~/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src-tauri
cargo tauri build
```

**产物路径**：
```
target/release/bundle/dmg/勺子Claw_{version}_aarch64.dmg   # Apple Silicon DMG
target/release/bundle/macos/勺子Claw.app                     # .app本体
```

**已知问题**：`bundle_dmg.sh` 的 AppleScript 在非GUI环境下可能失败。
- 错误表现：`osascript: can't open default component` 或超时无响应
- 解决方案：见下方方式二

#### 方式二：手动 hdiutil 创建 DMG（⭐ 推荐备用方案）

当 `cargo tauri build` 的DMG步骤失败时，用此方案：

```bash
# ===== 勺子Claw 手动DMG打包（复制即用）=====
APP_PATH="$HOME/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src-tauri/target/release/bundle/macos/勺子Claw.app" && \
DMG_OUT="$HOME/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src-tauri/target/release/bundle/dmg/勺子Claw_1.0.0_aarch64.dmg" && \
TMPDIR=$(mktemp -d) && \
cp -R "$APP_PATH" "$TMPDIR/" && \
ln -s /Applications "$TMPDIR/Applications" && \
hdiutil create -volname "勺子Claw" -srcfolder "$TMPDIR" -ov -format UDZO -imagekey zlib-level=9 "$DMG_OUT" && \
rm -rf "$TMPDIR" && \
ls -lh "$DMG_OUT"
```

**安装方式**：双击DMG → 拖拽勺子Claw.app到Applications文件夹

> **🔴 安装后强制步骤（B006教训）**：
> ```bash
> # 必须执行！否则用户看到的永远是旧版！
> pkill -f "勺子Claw" 2>/dev/null; sleep 1; open "/Applications/勺子Claw.app"
> ```

#### 方式三：分步执行（调试用）

```bash
# Step 1: 只编译（不打包）
cd ~/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src-tauri
cargo build --release

# Step 2: 确认.app已生成
ls target/release/bundle/macos/CAN\ Claw.app

# Step 3: 手动创建DMG（同方式二的命令）
```

### 8.5.3 macOS Intel版本（可选，兼容旧Mac）

```bash
# 安装Intel target
rustup target add x86_64-apple-darwin

# 交叉编译
cd ~/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src-tauri
cargo tauri build --target x86_64-apple-darwin
```

> ⚠️ 纯交叉编译可能遇到链接器问题。推荐：
> - 在 Intel Mac 上原生编译，或
> - 使用 GitHub Actions CI（见8.5.6）

**产物**：`target/x86_64-apple-darwin/release/bundle/dmg/勺子Claw_{version}_x64.dmg`

### 8.5.4 Windows 打包（NSIS安装程序）—— 从Mac交叉编译

#### Step 1: 安装 Windows 交叉编译工具链

```bash
# 添加 Windows 目标平台
rustup target add x86_64-pc-windows-msvc

# 安装 Wine（运行Windows打包工具）
brew install --cask wine-stable

# 验证
wine --version
rustup target list --installed | grep windows
```

#### Step 2: 修改 tauri.conf.json targets

编辑 `frontend/src-tauri/tauri.conf.json`，将 `bundle.targets` 扩展：

```json
{
  "bundle": {
    "active": true,
    "targets": ["dmg", "nsis"],
    "icons": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

> **注意**：打Windows包时targets改为 `["nsis"]`，打Mac时改回 `["dmg"]`。或同时保留两者。

#### Step 3: 执行 Windows 打包

```bash
cd ~/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src-tauri

# 完整构建（编译 + NSIS打包）
cargo tauri build --target x86_64-pc-windows-msvc
```

**产物路径**：
```
target/x86_64-pc-windows-msvc/release/bundle/nsis/勺子Claw_{version}_x64-setup.exe   # NSIS安装包
target/x86_64-pc-windows-msvc/release/shaoziclaw-app.exe                                # exe本体（免安装）
```

#### ⚠️ Windows 交叉编译常见问题速查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `link.exe not found` | 缺少MSVC Build Tools | 用GitHub Actions替代本地打包（推荐） |
| `wine` 无法运行NSIS脚本 | Wine版本/权限问题 | 升级wine或使用CI |
| 图标ico格式报错 | 需要真正的多尺寸.ico | 用ImageMagick: `convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico` |
| 中文路径/文件名乱码 | 编码问题 | 确保所有路径为ASCII |

### 8.5.5 版本号管理规范

```
格式：v{主版本}.{次版本}.{补丁}
示例：v1.0.0 → v1.0.1（小修）→ v1.1.0（新功能）→ v2.0.0（大重构）
```

**更新步骤（每次打包前必做）**：
1. 编辑 `tauri.conf.json` → `"version": "x.y.z"`
2. 同步更新本SKILL.md §十（版本日志）
3. 在 daily log 中记录变更

**当前版本**：`v5.5.8`（tauri.conf.json）/ 产品代号 **v5.5.8**（2026-05-13 B068修复：tokio::spawn+select!替代std::thread+Runtime::new()，LanceDB序列化，DIAG全链路日志）
> ⚠️ 版本号管理铁律：发版前必须先调用运维skill确认版本号，四地同步更新（运维skill/产品指挥官/MEMORY.md/changelog）

### 8.5.6 🚀 推荐：GitHub Actions CI 双平台自动打包（最佳实践）

> **强烈建议设置CI流水线**，自动打出 macOS + Windows 双平台安装包。

```yaml
# .github/workflows/release.yml
name: Release 勺子Claw

on:
  push:
    tags: ['v*']

jobs:
  release-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rust-lang/setup-rust-toolchain@v1
        with:
          toolchain: stable
          target: aarch64-apple-darwin
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci
      - name: Build Tauri app
        working-directory: frontend/src-tauri
        run: cargo tauri build
      - name: Upload DMG artifact
        uses: actions/upload-artifact@v4
        with:
          name: macos-dmg
          path: src-tauri/target/release/bundle/dmg/*.dmg
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: src-tauri/target/release/bundle/dmg/*.dmg

  release-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rust-lang/setup-rust-toolchain@v1
        with:
          toolchain: stable
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        working-directory: frontend
        run: npm ci
      - name: Build Tauri app (Windows)
        working-directory: frontend/src-tauri
        run: cargo tauri build
      - name: Upload EXE artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows-exe
          path: src-tauri/target/release/bundle/nsis/*.exe
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: src-tauri/target/release/bundle/nsis/*.exe
```

**触发方式**：
```bash
git tag v1.0.1
git push origin v1.0.1
```

### 8.5.7 打包产物交付记录模板（每次必须写入daily log）

```markdown
## 勺子Claw 打包 v{x.y.z} [日期时间]

### 产物清单
| 平台 | 文件 | 大小 | SHA256 |
|------|------|------|--------|
| macOS (ARM) | 勺子Claw_{v}_aarch64.dmg | {size} | {hash} |
| Windows | 勺子Claw_{v}_x64-setup.exe | {size} | {hash} |

### 本次变更摘要（自上一版本）
- ...

### 测试状态
- [ ] macOS: 启动正常 / 自动登录正常 / AI对话正常 / 模型切换正常
- [ ] Windows: 启动正常（如有）
- [ ] 专家中心 / Skills页面正常
```

### 8.5.8 签名与公证（✅ 已配置，v4.6起生效）

**当前状态**：已配置Apple Developer签名 + 公证流程

| 项目 | 状态 | 详情 |
|------|------|------|
| Apple Developer ID | ✅ 已有 | Developer ID Application: tao yi (7LKY65K92Q) |
| 代码签名 | ✅ 自动 | tauri.conf.json → signingIdentity |
| Apple公证 | ✅ 通过 | notarytool submit + staple |
| **🔑 Apple凭据** | **永久有效** | **ID: 182378252@qq.com / Team: 7LKY65K92Q / 密码: rwvx-qrxc-clrb-bawi** |
| Windows代码签名 | ⏳ 待配置 | Certum OV证书已购(¥800/年)，企业:向上大树科技) |

**macOS标准打包流程（v4.6验证通过）**：
```bash
# 1. 取消Apple环境变量，Tauri只签名不公证
unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID
cd frontend && npm run tauri build

# 2. 手动对DMG单独公证
xcrun notarytool submit <dmg> \
  --apple-id "182378252@qq.com" \
  --password "rwvx-qrxc-clrb-bawi" \
  --team-id "7LKY65K92Q" --wait

# 3. 钉固公证票据
xcrun stapler staple <dmg>
```

**⚠️ 踩坑经验**：
- `app.updater()` 返回 `Result<Updater, Error>`，必须先 `?` 解包再调 `.check()`
- `update.date` 字段类型是 `time::OffsetDateTime`（不是 chrono）
- **⚠️ v4.6.2 新增**：Tauri 原生 `download_and_install()` **只支持 NSIS/.app.zip，不支持 DMG**！macOS 必须自实现 DMG 安装流程（HTTP下载→hdiutil attach→cp→detach→open→exit(0)）
- **⚠️ v4.6.2 新增**：Tauri 2.0 的 Channel 导入路径是 `tauri::ipc::Channel`（不是 `tauri::Channel`）

---

## 九、🧠 记忆系统（核心机制）

### 9.1 为什么需要记忆系统

勺子Claw是一个持续迭代的产品。每次开发任务完成后，如果不记录：
- 下次不知道改了什么
- 不知道为什么这么改
- 可能重复犯同样的错
- 新上下文的AI不知道产品全貌

**本skill的记忆系统就是产品的「活文档」**。

### 9.2 记忆层级

#### L1: 本Skill自身（SKILL.md）
- 产品架构、代码映射、设计语言、Bug历史、打包流程
- **每次重大变更时手动更新此文件**

#### L2: WorkBuddy Daily Log
- **路径**：`~/.workbuddy/memory/YYYY-MM-DD.md`
- 每次完成开发任务后追加一条记录
- 格式：`## [任务类型] [时间]` + 变更摘要

#### L3: WorkBuddy MEMORY.md（长期记忆）
- **路径**：`~/.workbuddy/memory/MEMORY.md`
- 只记录跨会话的重要决策和技术事实
- 如：模型配置变更、架构决策、技术栈变化、打包配置

### 9.3 强制记忆写入规则（⚠️ 最高优先级）

**以下情况必须写入记忆：**

| 触发条件 | 写到哪里 | 写什么 |
|---------|---------|--------|
| 完成Bug修复 | 当日daily log | Bug编号+根因+修复方案 |
| 新增功能 | 当日daily log + 本SKILL.md | 功能描述+涉及文件+测试结果 |
| 修改模型配置 | MEMORY.md + 本SKILL.md §三 | 新模型/key/URL |
| 修改UI/设计 | 当日daily log | 改了哪个组件+设计令牌变化 |
| 打包发布 | 当日daily log + MEMORY.md | 版本号+产物大小+平台+关键变更 |
| 发现新坑/踩坑 | 本SKILL.md §四.6 或 §八·五 | 坑描述+正确做法 |
| 架构变更 | MEMORY.md + 本SKILL.md | 变更原因+新旧对比 |
| 打包流程变更 | 本SKILL.md §八·五 | 新流程/新命令/新问题 |

### 9.4 每次任务的标准工作流

```
┌─────────────────────────────────────────────┐
│         勺子Claw 开发任务标准工作流            │
├─────────────────────────────────────────────┤
│                                             │
│  Step 1: 读取记忆                            │
│    ├─ 读取当日 daily log                      │
│    ├─ 读取 MEMORY.md 中 Shaoziclaw 相关段落        │
│    └─ 理解当前产品状态                        │
│                                             │
│  Step 2: 理解需求                            │
│    ├─ 明确要做什么                           │
│    ├─ 影响哪些文件                           │
│    └─ 是否需要读 DESIGN.md / ai_engine.rs     │
│                                             │
│  Step 3: 选择工具链                          │
│    ├─ 写后端 → karpathy-guidelines           │
│    ├─ 改UI → awesome-design-md + DESIGN.md   │
│    ├─ 改BUG → visual-bug-hunter             │
│    ├─ 打包 → 本SKILL.md §八·五              │
│    └─ 测试验证 → playwright 截图             │
│                                             │
│  Step 4: 执行修改                            │
│    ├─ 读相关源码                             │
│    ├─ 最小化修改（不无关重构）                │
│    └─ 保持代码风格一致                       │
│                                             │
│  Step 5: 验证                               │
│    ├─ 前端: npm run build                    │
│    ├─ 后端: cargo check                      │
│    ├─ API测试: curl 测试模型连通性            │
│    └─ UI测试: 启动App截图验证                │
│                                             │
│  Step 6: 打包（如需要）                       │
│    ├─ macOS: cargo tauri build 或 hdiutil    │
│    └─ Windows: cargo tauri build --target .. │
│                                             │
│  Step 7: 【强制】写入记忆                     │
│    ├─ 追加到当日 daily log                   │
│    ├─ 重要变更 → 更新 MEMORY.md              │
│    ├─ Bug/坑 → 更新本SKILL.md               │
│    └─ 架构变更 → 更新本SKILL.md对应章节       │
│                                             │
│  🔴🔴🔴 Step 8: 【新增·强制】端到端下载验证   │
│    ├─ 从官网首页提取下载链接URL               │
│    ├─ curl -sI 该URL → 对比content-length     │
│    │   → 必须与本地DMG大小完全一致！           │
│    ├─ 验证文件名中的版本号 = 当前版本          │
│    └─ ❌ 不一致 → 绝对不能宣布发版完成！        │
│                                             │
│  🔴🔴🔴 Step 9: 【新增·强制】旧版清理         │
│    ├─ 删除releases目录中所有非当前版本的DMG    │
│    ├─ 删除对应的.minisig签名文件              │
│    ├─ 重新部署releases服务器                  │
│    └─ 验证旧版本URL返回404                    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 十、版本更新日志

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1.0 | 2026-04-03 | 初始版，71个Skill |
| v2.0 | 2026-04-03 | 20个新Skill，质检79.4分 |
| v3.0 | 2026-04-10 | 25个Skill，质检88.9分 |
| v4.0 | 2026-04-19 | 大型重构，141+1个Skill，宋宣20模块体系 |
| v4.1 | 2026-04-20 | 内置模型替换（3个中国模型）+ 认证Bug修复 + 产品指挥官Skill创建 |
| v4.2 | 2026-04-20 | **产品指挥官升级：新增完整的macOS+Windows打包工作流（§八·五）** |
| v4.3 | 2026-04-22 | fireworks-tech-graph集成 + 产品架构总览图(PNG) + 产品文档体系6问（§十二） |
| v4.3·1 | 2026-04-22 | 10项功能升级：技能市场(15模块/167skill全中文)、实时思考过程、问题答案分离、永久对话记忆、文件拖拽上传、专家对话多开、用户档案首次引导、模块→专家角色映射 |
| v4.5.0 | 2026-04-26 | UI定版版：品牌色更换为薄荷绿#57CC86 + 全套图标重生成 + DESIGN.md建立 |
| **v4.8.0** | **2026-05-02** | **🎨 图片设计专家(gpt-image-2 7步向导) + 🐛 8项Bug修复 + Apple公证 + Vercel部署** |
| **v4.9.9** | **2026-05-09** | **🔧 消息持久化(B026-B031) + 专家会话去重 + ExpertType扩展 + Sidebar修复 + 本地DMG测试** |
| **v4.7.0** | **2026-05-01** | **🐛 删除品牌档案栏 + 定时任务保存按钮修复 + 定时任务编辑器优化** |
| **v4.6.2** | **2026-04-29** | **✨ 定时任务调度器 + 更新系统重构(底部条UI)** |
| v4.6.1 | 2026-04-29 | Bug修复：图片vision + 专家ID映射 + 专家greeting + UpdateNotifier右下角浮窗 |
| **v4.6.0** | **2026-04-27** | **LOGO优化(纯图形SVG) + UI大重构(~50处去绿色化→中性灰) + 自动更新(Rust+React) + 应用名中文化"勺子Claw" + 全套高清图标 + 签名公证+官网部署 + Windows打包包封装** |

---

## 十一·二 fireworks-tech-graph 图生成工具集成

### 11.1 工具概况

| 属性 | 内容 |
|------|------|
| **名称** | fireworks-tech-graph |
| **来源** | GitHub: yizhiyanhua-ai/fireworks-tech-graph |
| **本地位置** | `~/.workbuddy/skills/fireworks-tech-graph/` |
| **License** | MIT |
| **依赖** | librsvg (rsvg-convert) — 已安装: `rsvg-convert version 2.62.1` |

### 11.2 核心功能

- **自然语言生成技术图**：输入描述 → 输出 SVG + PNG
- **14种图类型**：架构图/数据流图/Agent图/Memory图/UML全系列/ER图等
- **7种视觉风格**：扁平/暗黑/蓝图/Notion/玻璃态/Claude官方/OpenAI官方
- **语义化图形词汇**：不同形状代表不同实体（LLM=圆角矩形/Memory=圆柱/向量库=带网格圆柱）

### 11.3 典型用法

**生成架构图（用于产品文档/PPT/官网）**：
```
用户："画一张 勺子Claw 架构图，Claude 官方风格，输出到 ./output/arch.svg"
→ fireworks-tech-graph 自动识别为架构图类型
→ 应用 Claude Official Style (暖白#f8f6f3背景)
→ 生成语义化 SVG
→ rsvg-convert 导出 1920px PNG
```

**生成流程图（用于 SOP/工作流文档）**：
```
用户："画一张用户登录→技能匹配→AI推理→反馈闭环的流程图"
→ fireworks-tech-graph 识别为 Flowchart 类型
→ 自动布局 + 语义化箭头（蓝=主数据流/绿=技能触发）
```

### 11.4 快速生成命令

```bash
# 安装依赖（已安装）
brew install librsvg  # macOS

# 生成 PNG
rsvg-convert --width 1920 input.svg -o output.png

# 验证 SVG 语法
rsvg-convert input.svg -o /dev/null 2>&1 && echo "Valid"
```

### 11.5 用于 勺子Claw 产品指挥官

| 场景 | 生成的图类型 | 适用对象 |
|------|------------|---------|
| 产品架构总览 | Architecture Diagram | 全体成员/投资人/合作方 |
| 子系统交互 | Data Flow Diagram | 开发团队 |
| AI 推理流程 | Agent Architecture | 开发团队/AI 爱好者 |
| Skill 匹配流程 | Flowchart | 开发团队 |
| 用户旅程 | Timeline / Mind Map | 产品经理/运营 |
| 知识库检索流 | Memory Architecture | 开发团队 |
| 版本 Roadmap | Gantt / Timeline | 全体成员 |

> **规则**：每次重大架构变更后，必须用 fireworks-tech-graph 更新对应架构图，并同步更新本 SKILL.md §二.3 的 PNG 引用路径。

---

## 十二、产品文档体系（6个核心问题）

> **目的**：建立统一的产品语言，确保所有成员（易涛/参考/开发者/投资人）对产品有一致的认知。
> **维护规则**：每个问题回答后如有变更，必须同步更新本章节。

---

### 12.1 勺子Claw 是什么？

**一句话定位**：
> 勺子Claw（勺子Claw）是一款专为**餐饮从业者**打造的 AI 专家桌面应用——让每个餐饮人都有一个"懂行、有经验、能干活"的 AI 助手。

**展开描述**：
- **目标用户**：餐饮老板、连锁店长、厨师长、投资人、供应商
- **核心价值**：不是通用聊天机器人，而是**带专业深度**的餐饮 AI——回答基于真实的餐饮行业知识库和261个专业 Skills
- **差异化**：有记忆（学习闭环）、有专业边界（不是什么都聊）、有工具调用能力（能执行、能生成文档）
- **使用场景**：经营决策参考、技能学习、方案生成、数据分析、风险预警

---

### 12.2 有哪些子系统？各自的职责边界是什么？

**五层子系统架构**（详见 §二.3 架构图）：

| 子系统 | 职责边界 | 内部组件 |
|--------|---------|---------|
| **L2 应用层** | 跨平台桌面应用外壳，用户交互入口 | Tauri Shell（系统集成）+ React 前端（页面组件）|
| **L3 AI 引擎编排层** | 对话调度、状态管理、Skill 匹配、记忆调用 | AI Engine（对话）+ Auth（认证）+ Subscription（订阅）+ Memory（记忆）+ Tools（工具）|
| **L4 技能与知识层** | 专业能力的来源和持续进化 | 261 Skills（模块化专业技能）+ 知识库（931份原始资料）+ 学习闭环（反馈进化）|
| **L5 外部模型层** | 推理能力（不自有模型，调用第三方 API）| DeepSeek V3（默认）+ Qwen-Max + Qwen3-32B |

**边界规则**：
- L3 只调用 L4 和 L5，不直接调用 L2
- Skill 系统独立于 AI 引擎，Skill 变更不触发 AI 引擎重构
- 知识库是只读训练素材，不做实时联网检索

---

### 12.3 子系统之间怎么交互？

**核心数据流**（按用户发消息的顺序）：

```
用户输入 → L2前端（React）→ Tauri IPC → L3 AI引擎（Rust）
                                        ↓
                                  L4 Skill匹配（判断是否触发专业Skill）
                                        ↓
                                  L5 大模型推理（3选1，基于质量和成本）
                                        ↓
                                  L4 知识库检索（如需，RAG增强）
                                        ↓
                                  L4 学习闭环（记录本次交互用于进化）
                                        ↓
                                  L3 流式响应 → Tauri IPC → L2前端展示
```

**关键交互原则**：
- **Skill 匹配**：用户消息 → L3 AI引擎自动识别 Skill 标签 → 调用对应 Skill 的 system prompt
- **知识 RAG**：Skill 调用时 → L4 知识库检索相关段落 → 注入 context → L5 推理
- **反馈闭环**：用户点击 👍/👎 → L4 记录到 learning.db → L3 动态调整红线 → 下次推理时生效
- **订阅校验**：每次对话前 → L3 检查 Subscription 状态 → 未订阅用户受限

---

### 12.4 当前版本的技术栈是什么？

**核心技术栈（2026-04-22 当前）**：

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| 桌面框架 | Tauri | 2.x | 比 Electron 轻量，Rust 后端 |
| 前端框架 | React | 19 | 最新 React，含 Concurrent Features |
| 语言 | TypeScript | 5.x | 类型安全 |
| 样式 | Tailwind CSS | 3.x | 原子化 CSS |
| 状态管理 | Zustand | 4.x | 轻量状态库 |
| 后端语言 | Rust | stable | 高性能、安全、内存小 |
| 数据库 | SQLite (via rusqlite) | — | learning.db 本地存储 |
| 模型 API | DeepSeek / 阿里百炼 / 硅基流动 | — | 不自研模型，调第三方 |
| 打包 | hdiutil (macOS) / gnu交叉编译 (Windows) | — | 双平台分发 |

| **技术债务/待升级项**： |
| --- | --- |
| - L001：后端 skill_manager.rs 仍硬编码 ~120 个 Skill，未同步 v4 全量 261 个 ⚠️ P1 |
| - L002：Windows EXE ✅ 已上线（v4.6.0，2026-04-28）|
| - L003：苹果签名/公证 ✅ 已配置（v4.6，见§8.5.8）|
| - L004：暂无 GitHub Actions CI 双平台自动打包 ⚠️ P2 |
| - **L006：更新服务器 ✅ 已完成（见§7.5.4完整运维手册）** |

---

### 12.5 未来三个版本的方向是什么？

**v5.0（预计 2026-Q2）—— 技能市场 & 联网模式**

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **技能市场** | 内置 Skill 下载中心，支持：① 原装 Skill（持续迭代）② 第三方专家 Skill（联合开发，付费下载）③ 用户自创 Skill（开放生态） | P0 |
| **联网模式** | 突破当前"纯 Skill+知识库+大模型"的非实时限制，支持：① 实时热点采集（餐饮行业新闻/政策）② 实时数据查询（平台规则/榜单）③ 联网搜索补充 RAG | P0 |
| **Skill 原价绑定** | 每个 Skill 绑定来源作者，支持版本管理和收益分成 | P1 |
| **订阅分层** | Free / Pro / Team 三档，差异化 Skill 访问权限 | P1 |

**v6.0（预计 2026-Q3）—— 多模态 & 移动端**

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **图片识别** | 上传菜单/门店图 → AI 分析 → 优化建议 | P1 |
| **语音对话** | 语音输入 → AI 语音回复（解放双手，适合厨房场景）| P1 |
| **移动端 App** | iOS/Android 同步，知识库同步，移动端轻量版 | P2 |
| **微信小程序** | 低门槛入口，扫码即用，无需下载 | P2 |

**v7.0（预计 2026-Q4）—— 行业垂直深度**

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **品类专属版** | 快餐版 / 火锅版 / 茶饮版，深度定制 Skills + 知识库 | P1 |
| **企业版** | 多门店管理、权限体系、数据看板、SaaS 部署 | P1 |
| **API 开放** | 开放 勺子Claw AI 能力给第三方 SaaS（POS/点评/外卖平台）| P2 |
| **私有知识库** | 餐饮企业上传自己的 SOP/菜单/数据，训练专属 AI | P2 |

---

### 12.6 团队与分工

**当前团队（2026-04-22）**：

| 角色 | 姓名 | 职责范围 |
|------|------|---------|
| **产品负责人 / 决策者** | 易涛 | 产品方向、优先级、商业模式、对外合作 |
| **产品指挥官 / AI 助手** | 参考（WorkBuddy Agent）| 技术实现、架构维护、文档管理、打包发布 |

**职责分工原则**：
- 易涛 负责"做什么"（需求/方向/决策）
- 参考 负责"怎么做"（技术方案/实现/维护）
- 重大决策（涉及架构变更、技术债务、技术选型）→ 易涛最终拍板
- 日常迭代（Bug修复、文档更新、小功能）→ 参考自主决策，定期汇报

**团队协作规则**：
1. 所有技术变更记录在 MEMORY.md + 对应 Skill 的日志区
2. 每周产品指挥官自检一次架构图与代码一致性
3. 重大版本（v5/v6/v7）发布前，易涛和参考共同评审架构图

| Skill名称 | 位置 | 用途 |
|-----------|------|------|
| karpathy-guidelines | ~/.workbuddy/skills/karpathy-guidelines/ | 写Rust/后端代码的风格指南 |
| awesome-design-md | ~/.workbuddy/skills/awesome-design-md/ | 69个网站设计规范参考 |
| visual-bug-hunter | ~/.workbuddy/skills/visual-bug-hunter/ | 视觉Bug定位与修复 |
| playwright | ~/.workbuddy/skills/playwright/ | 浏览器自动化测试 |
| **shaoziclaw-ops-manual** | **~/.workbuddy/skills/shaoziclaw-ops-manual/** | **🖥️ 更新服务器运维（发版/签名/SSL/Nginx）** |
| 勺子Claw司令部 | ~/.workbuddy/skills/shaozi-claw-v4/_command-center/ | 餐饮Skill生产调度（非产品开发）|
| fireworks-tech-graph | ~/.workbuddy/skills/fireworks-tech-graph/ | 技术架构图自动生成（SVG+PNG）|

---

| v4.3 | 2026-04-22 | fireworks-tech-graph集成 + 产品架构总览图(PNG) + **产品文档体系6问（§十二）** |
| **v4.3·1** | **2026-04-22** | **【10项功能升级】：技能市场(15模块/167skill全中文)、实时思考过程、问题答案分离、永久对话记忆、文件拖拽上传、专家对话多开、用户档案首次引导、模块→专家角色映射、OnboardingFlow、FileUploader** |

---

## 十三、v4.3 功能升级详解（10项需求实现）

> **版本**：v4.3·1 (2026-04-22)
> **触发场景**：用户说"继续Shaoziclaw大活"、"10个需求做完"、"v4.3开发"
> **数据来源**：基于 `ShaoziClaw SKILL模块设计与技能分类2026042101.docx`

### 13.1 功能清单（10项）

| # | 优先级 | 功能名称 | 实现文件 | 状态 |
|---|--------|---------|---------|------|
| 【1】 | P0 | **专家模块新窗口**：调用新专家模块时，打开新的对话窗口 | App.tsx | ✅ |
| 【2】 | P0 | **技能库→技能市场**：15个ShaoziClaw模块，中文名+中文说明 | SkillsPage.tsx | ✅ |
| 【3】 | P0 | **首次使用用户档案**：7问收集用户基本资料 | OnboardingFlow.tsx | ✅ |
| 【4】 | — | 已删除（原"订阅分级"，改为v5计划） | — | ❌ |
| 【5】 | P1 | **实时思考过程**：AI思考步骤实时展示（带fadeIn动画） | ChatArea.tsx | ✅ |
| 【6】 | P1 | 联网模式（留到v5实时热点采集） | — | ⏸️ |
| 【7】 | P0 | **永久对话记忆**：每条问答永久存储到localStorage | ChatArea.tsx | ✅ |
| 【8】 | P1 | **问题答案分离**：追问卡片+跳过按钮 | ChatArea.tsx | ✅ |
| 【9】 | P0 | **模块→专家角色映射**：每个ShaoziClaw模块对应一个专家角色 | App.tsx | ✅ |
| 【10】 | P1 | **文件拖拽上传**：文件拖入+图片拖入+上传按钮 | FileUploader.tsx | ✅ |

### 13.2 关键组件详情

#### SkillsPage.tsx → 技能市场

**核心重构**：
- 标题从"技能库"→"技能市场" + v4.3徽章
- 全部Skills使用中文名称+中文描述（基于宋宣分类表）
- 15个ShaoziClaw模块（M1品牌定位 ~ M15法务合规）
- 额外保留 EXTRA_SKILLS（外卖运营/客户服务/财务管控/数据分析/危机公关/战略融资/SaaS集成）

**模块颜色系统**：M1紫/M2绿/M3橙/M4红/M5蓝...

**技术实现**：
- 使用 `scan_skills.py` / `scan_all_skills.py` 从167个SKILL.md提取中文名+描述
- 接口结构：`SkillItem { id, name(中文), desc(中文) }`
- 搜索覆盖：`name` + `desc` + `id` 三个字段

#### ExpertCenter.tsx → 专家中心

**专家→模块映射表**：
```
brand(🎯品牌策略师)    → M1品牌定位模块
ops(⚙️营运总监)        → M2营运服务模块
marketing(📣营销操盘手) → M3品牌宣传模块
waimai(🛵外卖运营官)   → 外卖运营extra
finance(💰财务顾问)    → 财务管控extra
legal(⚖️法务顾问)      → M15法务合规模块
hr(👥人力资源专家)     → M7人力资源模块
supply(🔗供应链专家)   → M14采购供应模块
data(📊数据分析师)     → 数据分析extra
general(🦞餐饮专家)   → 全局兜底
```

#### OnboardingFlow.tsx → 首次引导

**7问收集**：身份/门店类型/经营规模/主要痛点/营业额(可选)/AI帮您做什么/昵称(可选)

**技术实现**：App.tsx检查 `userProfile.completed`，未完成→渲染OnboardingFlow

#### FileUploader.tsx → 文件上传组件

支持：txt/pdf/docx/xlsx/jpg/png，拖拽+按钮上传，预览+删除

#### ChatArea.tsx → 聊天区三大升级

**【5】实时思考过程**：`thinkingRef`自动滚动+`fadeInStep`动画+最新step高亮

**【7】永久对话记忆**：key=`shaoziclaw_conversation_memory`，容量500条

**【8】问题答案分离**：绿色主题追问卡片+跳过按钮

---

### 13.3 架构变更（store.ts扩展）

```typescript
// 多专家会话
interface ConversationSession {
  id: string; type: ExpertType; title: string;
  emoji: string; createdAt: number; messages: Message[]; isActive: boolean
}

// 用户档案
interface UserProfile {
  role: string; businessType: string; scale: string;
  painPoints: string[]; dailyRevenue: string; goals: string;
  nickname: string; completed: boolean; createdAt: string; updatedAt: string
}

// 专家类型
type ExpertType = 'brand'|'ops'|'marketing'|'waimai'|'finance'|'legal'|'hr'|'supply'|'data'|'general'
```

---

### 13.4 v4.3 技术债务/待处理

| # | 问题 | 优先级 |
|---|------|--------|
| L005 | 联网模式（留到v5实时热点采集） | P0 |
| L006 | 后端skill_manager.rs未同步v4.3 SkillsPage 167个skill | P1 |
| L007 | OnboardingFlow数据未持久化到后端 | P1 |
| L008 | 永久对话记忆未同步到后端learning.db | P2 |

---

## 十四、🔴 强制执行规则（2026-05-13 涛哥铁律升级）

### 14.1 Git 版本控制铁律

> **🔴🔴🔴 涛哥指令：每个版本都必须存代码！没有Git=裸奔！**

**强制规则**：
1. **每次修改代码前必须先 commit 当前状态**（保存干净的工作节点）
2. **每次发版/修复后必须打 tag**（格式：`v5.5.x`）
3. **新版本如果引入更多 Bug → 立即回退到上一个版本**
   ```bash
   git tag v5.5.8          # 保存稳定版本
   git log --oneline -5    # 确认当前在哪个节点
   # 新版出bug时：
   git reset --hard v5.5.8  # 回退到稳定版本
   ```
4. **回退版本必须记录在 Bug 历史表**（§七），注明"回退原因+回退到哪个版本"
5. **禁止在无 Git 的情况下修改任何生产代码**

**安装**：https://git-scm.com

### 14.2 Bug 反馈模板（用户报 Bug 必填格式）

> **🔴 当用户报告 Bug 时，必须引导用户填写以下格式，否则无法开始排查。**

```
【模块】，点击【】，输入【】，本应该是【】，但返回结果是【】，附上截图
```

**完整示例**：
```
【聊天页ChatArea】，点击【发送按钮(绿色)】，输入【任何文字如"你好"】，
本应该是【消息发送成功，AI开始回复】，
但返回结果是【完全无反应，按钮点击后什么都没发生】，
附上截图（2张：输入状态+点击后状态）
```

**模板字段说明**：

| 字段 | 说明 | 帮助用户举例 |
|------|------|-------------|
| 模块 | 哪个页面/功能 | 聊天页、专家中心、设置、登录、定时任务、侧边栏... |
| 点击 | 具体操作了什么 | 点击发送按钮、点击专家卡片、切换页面... |
| 输入 | 输入了什么内容 | 文字内容、上传了什么文件、或"无输入" |
| 本应该是 | 期望的正确行为 | 消息发送成功、页面跳转、弹窗出现... |
| 返回结果 | 实际发生了什么 | 无反应、报错、闪退、白屏、卡死... |
| 截图 | 问题的视觉证据 | 至少1张，最好包含：①操作前状态 ②操作后状态 ③日志（如有） |

**AI 收到 Bug 反馈后的执行流程**：
1. 确认模板完整度 → 缺字段则追问补全
2. **一定要看日志**！让用户打开开发者工具（Ctrl+Shift+I 或 Cmd+Option+I）截图 Console
3. 读产品指挥官 §七 Bug历史 → 检查是否回归
4. 按模块定位源文件（§四 组件文件映射 + §二.2 目录结构）
5. 启用诊断代码注入（§14.3）定位根因
6. 修复 → 验证 → commit → 更新产品指挥官

### 14.3 诊断代码注入机制（哨兵系统 🏗️）

> **🔴 关键节点放哨——输入、输出、UI控件。修改代码时注入诊断代码，修复后清理。**

**设计原则**：
- 诊断代码是**临时的**，修复确认后必须删除
- 诊断日志用统一前缀 `[DIAG-任务编号]`，方便搜索和清理
- 覆盖三个层面：**数据输入 → 处理逻辑 → UI输出**

#### 诊断注入三哨位：

```
用户操作 → [哨位1: 输入捕获] → 业务逻辑 → [哨位2: 中间状态] → UI渲染 → [哨位3: 输出验证]
```

| 哨位 | 位置 | 注入内容 | 示例 |
|------|------|---------|------|
| **哨位1：输入** | 事件处理函数入口 | 记录函数被调用、参数值、调用栈 | `console.log('[DIAG-B093] handleSend调用! input=', input.substring(0,50))` |
| **哨位2：中间** | 核心业务逻辑关键节点 | 记录条件分支走向、变量值、异步操作开始/结束 | `console.log('[DIAG-B093] API调用前: model=', model, 'messages=', messages.length)` |
| **哨位3：输出** | UI 渲染/状态更新 | 记录 DOM 变更、state 变化、渲染完成 | `console.log('[DIAG-B093] UI更新: messages.length=', messages.length, 'scrollTop=', container.scrollTop)` |

#### 诊断代码规范：

```typescript
// ✅ 正确格式
console.log('[DIAG-B093] 📍 哨位1-输入: handleSend调用')
console.log('[DIAG-B093] 📍 哨位1-输入: input=', input.substring(0,30), 'files=', uploadedFiles.length)
console.log('[DIAG-B093] 📍 哨位2-中间: API请求开始, model=', currentModel)
console.log('[DIAG-B093] 📍 哨位2-中间: API响应收到, status=', response.status)
console.log('[DIAG-B093] 📍 哨位3-输出: messages更新后, count=', messages.length)

// ❌ 错误格式（不要用）
console.log('debug')           // 无前缀，无法搜索
console.log(diagData)          // 无上下文说明
alert('test')                  // 绝对不能在诊断代码中用 alert！
```

#### 诊断代码清理检查清单：

修复完成后，必须执行：
```bash
# 搜索所有残留诊断代码
grep -rn "DIAG-B093\|DIAG-\[编号\]" frontend/src/
grep -rn "DIAG-\[" frontend/src-tauri/src/
```
确认全部清理后才能 commit。

#### ⚠️ 诊断代码安全铁律（B058/B092 血泪教训）：

| 铁律 | 说明 | 违反后果 |
|------|------|---------|
| **const/let 必须在使用前声明** | useEffect 回调中引用的变量必须定义在 useEffect 之前 | TDZ ReferenceError，整个组件崩溃 |
| **诊断代码不能改变执行顺序** | 只能"旁路观察"（console.log），不能改变控制流 | 引入新 Bug |
| **诊断代码不能阻塞主线程** | 不能在诊断中加同步等待、死循环 | UI 卡死 |
| **诊断代码不能用 alert()** | Tauri WebView 中 alert 行为不可预测 | 弹窗死锁 |

### 14.4 分模块开发规则

> **🔴 以后分模块来做，不要一次性改多个模块！**

**模块清单**（按 §四 组件文件映射）：

| 模块 | 核心文件 | 依赖 |
|------|---------|------|
| **聊天核心** | ChatArea.tsx, store.ts | 无（底层模块） |
| **侧边栏** | Sidebar.tsx | store.ts |
| **专家中心** | ExpertCenter.tsx, ChatArea.tsx | store.ts |
| **技能系统** | SkillsPage.tsx, SkillPickerTab | store.ts |
| **设置页** | Settings.tsx | store.ts |
| **Rust 后端** | ai_engine.rs, main.rs | 无（底层模块） |
| **RAG/记忆** | rag_engine.rs, working_notes.rs | ai_engine.rs |
| **认证/订阅** | auth.rs, subscription.rs | main.rs |
| **文件系统** | local_fs.rs, FileUploader.tsx | main.rs |
| **自动更新** | UpdateNotifier.tsx, main.rs(check_update) | main.rs |

**规则**：
1. 每次任务只改 **1 个模块**（除非是跨模块 Bug 需要联动修复）
2. 改模块前先 **git commit**（保存当前稳定状态）
3. 修完后验证 **不影响其他模块**
4. 如果影响其他模块 → 记录影响范围 → 一起测试

---

*本Skill由产品指挥官模式生成，最后一次更新：2026-05-13 18:00*
*每次完成勺子Claw开发任务后，务必更新本文件的对应章节*
*架构图路径：generated-images/shaoziclaw-product-arch.png（PNG）/ shaoziclaw-architecture.svg（源文件）*
