# ShaoziClaw Design System

> **Version**: 4.3 | **Last Updated**: 2026-04-22
> **Product**: ShaoziClaw 勺子Claw — 餐饮AI专家系统 (Tauri 2.0 Desktop App)
> **Design Philosophy**: **「专业感 × 温暖感 × 高效」** — 借鉴 WorkBuddy/Cursor/Linear 的极简效率美学，用品牌黄(#FFD600)作为唯一强调色，白色为主基调，让餐饮老板用起来既专业又亲切。

---

## v4.3 新增设计规范（2026-04-22）

### 新增页面/组件
- `OnboardingFlow.tsx` — 7步引导档案收集，品牌黄主题，进度条
- `FileUploader.tsx` — 拖拽上传+按钮上传，支持图片/PDF/Word/PPT/Excel
- `ExpertCenter.tsx` — 按ShaoziClaw 15模块分类，19位中文专家，中文说明
- `SkillsPage.tsx` → `技能市场` — 15大模块+专项技能库，167个Skill全部中文名+中文描述

### 新增交互模式
- **实时思考滚动展示**：thinkingSteps实时更新，每次新步骤带fadeIn动画，最新步骤高亮+脉冲动画
- **问答分离模式**：AI回答后追问问题先行展示（绿色主题），含"跳过直接看完整回答"按钮
- **多专家会话标签**：侧边栏横向滚动专家会话Pill，点击新建独立会话
- **用户档案折叠面板**：侧边栏品牌卡片，可展开查看品类/地区/状态/对标
- **首次使用引导**：未完成档案时自动弹出OnboardingFlow

### 设计一致性要点
- 思考过程面板：暖黄渐变背景（#FFFBEB→#FFF8E1），实心黄色边框
- 追问区：绿色主题（#F0FDF4/#DCFCE7），跳过按钮虚线边框
- 文件上传面板：弹出式，绝对定位在上传按钮上方

---

## 1. Visual Theme & Atmosphere

| Attribute | Value |
|-----------|-------|
| **Mood** | 专业、高效、温暖、可信赖 |
| **Density** | 中等偏疏 — 信息密度适中，留白充足 |
| **Design Philosophy** | 极简功能主义 + 品牌色点缀 |
| **Primary Metapher** | 「你的私人餐饮智囊团」— 专家顾问感 |
| **Light/Dark Mode** | 聊天页=**纯亮色**，Skills/设置等页面=**深色** |
| **Reference Aesthetics** | WorkBuddy(侧边栏) + Cursor(输入区) + Linear(排版精度) |

---

## 2. Color Palette & Roles

### 2.1 品牌色（Brand Colors）

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-primary` | **`#FFD600`** | 主按钮、Logo、活跃状态、品牌强调、发送按钮 |
| `--brand-gradient` | `linear-gradient(135deg, #FFD600 0%, #F5A000 100%)` | Logo背景、重要CTA渐变 |
| `--brand-light` | `#FFFBE8` | 提示卡片背景、hover浅底 |
| `--brand-lighter` | `#FEF3C7` / `#FFF8E1` | 思考面板背景、标签底色 |
| `--brand-border` | `#FDE68A` / `#FFE082` | 黄色边框、用户气泡边框 |
| `--brand-text` | `#D97706` | 琥珀色文字（Skill标签、思考面板标题） |
| `--brand-text-dark` | `#92400E` | 深琥珀色（思考步骤标题） |
| `--brand-text-gold` | `#CC9A00` / `#b8860b` | 金色文字（用户消息时间戳） |

### 2.2 中性色（Neutral Colors）— 亮色主题（聊天页主用）

| Token | Hex | Role |
|-------|-----|------|
| `--bg-page` | **`#FFFFFF`** | 页面主背景 |
| `--bg-surface` | **`#FAFAFA`** | 侧边栏、标题栏、输入区容器 |
| `--bg-elevated` | **`#FFFFFF`** | 卡片、弹窗、气泡 |
| `--bg-subtle` | **`#F8F8FA`** | AI气泡背景 |
| `--bg-user-bubble` | **`#FFF9E6`** | 用户消息气泡（淡黄白） |
| `--bg-hover` | **`#F5F5F5` / gray-50`** | 悬停状态 |
| `--bg-active` | **`gray-100 / #F3F4F6`** | 选中/激活状态 |

### 2.3 中性色（Neutral Colors）— 深色主题（Skills/设置页用）

| Token | Hex | Role |
|-------|-----|------|
| `--bg-dark-page` | **`#0C0C0E`** | 深色页面主背景 |
| `--bg-dark-surface` | **`#0A0A0A`** | 深色侧边栏、深色面板 |
| `--bg-dark-elevated` | **`#161620 / #151515`** | 深色卡片 |
| `--bg-dark-input` | **`#1A1A18 / #252200`** | 深色输入框 |

### 2.4 文字色（Text Colors）

| Token | Hex | Size | Weight | Usage |
|-------|-----|------|--------|-------|
| `--text-primary` | **`#1A1A1A`** | 14-20px | 600-800 | 标题、正文主文字 |
| `--text-secondary` | **`#333333`** | 13-14px | 400-500 | 输入框文字、按钮文字 |
| `--text-body` | **`#444444`** / **`#555555`** | 13-14px | 400 | 正文次要信息 |
| `--text-muted` | **`#888888`** | 11-12px | 400 | 占位符、辅助说明 |
| `--text-faint` | **`#AAAAAA`** / **`#BBBBBB`** | 10-11px | 400 | 时间戳、元数据 |
| `--text-disabled` | **`#CCCCCC`** | 10-12px | 400 | 免责声明、禁用文字 |
| `--text-on-brand` | **`#000000`** | 12-14px | 600-700 | 品牌黄底上的文字（按钮） |

### 2.5 边框色（Border Colors）

| Token | Hex | Usage |
|-------|-----|-------|
| `--border-default` | **`#EAEAEA`** / **`#E0E0E0`** | 默认边框（输入框、按钮、分割线） |
| `--border-subtle` | **`#F0F0F0`** / **`#EEEEEE`** | 轻微分割线（标题栏底部、区域分隔） |
| `--border-strong` | **`#DDDDDD`** | 强调边框 |
| `--border-focus` | **`#FFD60080`** (50%透明) | 输入框聚焦态 |
| `--border-focus-solid` | **`#FFD600`** | 聚焦实边（思考中面板） |

### 2.6 反馈色（Feedback / Semantic Colors）

| Token | Hex | BG Token | Usage |
|-------|-----|----------|-------|
| `--success` | **`#22C55E`** | `#F0FDF4` bg, `#BBF7D0` border | 有帮助反馈、成功状态 |
| `--error` | **`#EF4444`** | `#FEF2F2` bg, `#FECACA` border | 错误反馈、删除操作 |
| `--warning` | **`#F59E0B`** | `#FFFBEB` bg | 警告提示 |
| `--info` | **`#3B82F6`** | `#EFF6FF` bg | 信息提示 |

---

## 3. Typography Rules

### 3.1 字体族

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
```

**代码字体**：`"SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace`

### 3.2 字号层级（Type Scale）

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| **H1** | **20px** | **800** | 1.3 | -0.02em | 页面主标题 |
| **H2** | **17px** | **700** | 1.35 | -0.01em | 区块标题 |
| **H3** | **15px** | **700** | 1.4 | normal | 子区块标题 |
| **Body** | **14px** | **400** | 1.65-1.75 | normal | 正文内容、消息文字 |
| **Body Large** | **14px** | **400-500** | 1.5 | normal | 输入框文字 |
| **Small** | **13px** | **400-500** | 1.5 | normal | 按钮、导航项、列表项 |
| **Caption** | **12px** | **500-600** | 1.4 | normal | 用户名、标签、面板标题 |
| **Meta** | **11px** | **400-600** | 1.4 | 0.04em uppercase | 分组标题、时间戳、徽章 |
| **Tiny** | **10-11px** | **400-500** | 1.4 | normal | 辅助说明、免责声明 |
| **Micro** | **9px** | **500-600** | 1.3 | normal | 徽章数字、版本标签 |

### 3.3 关键排版规则

- **中文优先 PingFang SC**，英文/数字用 SF Pro
- **行高**：正文必须 ≥ 1.65（阅读舒适）
- **标题字重不低于 600**（层次分明）
- **字号不小于 10px**（可读性底线）
- **代码块**：等宽字体，深色背景 `#1E1E1E`，圆角 10px

---

## 4. Component Styling

### 4.1 侧边栏（Sidebar）

```
Width: 278px (fixed)
Background: #FAFAFA
Border-right: 1px solid #EAEAEA (gray-200)
Padding: 16px vertical, 0 horizontal
```

**子组件规范：**

| Element | Style |
|---------|-------|
| Logo容器 | 36×36px, rounded-lg, brand-gradient背景 |
| 品牌名 | 14px, bold, #1A1A1A |
| 副标题 | 11px, #AAA（如"餐饮AI专家系统"） |
| 状态点 | 8×8px 圆形, bg-green-500, animate-pulse |
| 搜索框 | bg-#F5F5F5, border 1px #EAEAEA, rounded-lg, focus:ring-yellow-400/30 |
| 新建按钮 | bg-white, border 1px #EAEAEA, hover:bg-gray-100 |
| 导航项(active) | bg-gray-100, text-gray-900, 图标=#FFD600 |
| 导航项(inactive) | text-gray-600, hover:bg-gray-50, 图标=#888 |
| 任务列表项(hover) | hover:bg-gray-50 |
| 任务列表项(selected) | bg-yellow-50 |
| 底部分隔线 | border-top 1px solid #EAEAEA |
| 用户头像 | 28×28px 圆形, 渐变紫蓝背景 |

### 4.2 聊天气泡（Message Bubbles）

**用户气泡（右侧）：**
```
background: #FFF9E6
color: #333
border-radius: 18px
border-top-right-radius: 4px  ← 尖角指向自己
border: 1px solid #FFE082
padding: 12px 16px
max-width: 82%
font-size: 14px
line-height: 1.65
```

**AI气泡（左侧）：**
```
background: #F8F8FA
color: #222
border-radius: 18px
border-top-left-radius: 4px   ← 尖角指向AI
border: 1px solid #EEE
padding: 12px 16px
max-width: 82%
font-size: 14px
line-height: 1.75
```

**头像：**

| Type | Size | Style |
|------|------|-------|
| AI头像 | 32×32px 圆形 | brand-gradient (#FFD600→#F59E0B), 内嵌 logo.svg 24×24px |
| 用户头像 | 32×32px 圆形 | bg-#E8E8EE, 首字母 12px bold, color-#AAA |

### 4.3 输入区（Chat Input Area）

```
Container:
  background: #FFFFFF
  border-top: 1px solid #F0F0F0
  padding: 12px 16px

Input Box:
  background: #FFFFFF
  border: 1px solid #E0E0E0
  border-radius: 12px (xl)
  padding: 12px 48px 12px 16px  (right padding for send button)
  font-size: 14px
  line-height: 1.5
  color: #333
  placeholder: #999
  min-height: 80px
  max-height: 160px
  resize: none
  
  Focus state:
    border-color: #FFD60080 (50% opacity)
    (NOT #252525!)

Send Button (bottom-right inside input):
  position: absolute
  right: 8px, bottom: 8px
  size: 36×36px (p-2 rounded-xl)
  background: #FFD600 (enabled) / #DDD (disabled)
  color: white
```

**工具栏 Tabs（输入区上方）：**

```
Tab button:
  padding: 6px 12px
  border-radius: 8px (lg)
  font-size: 13px
  font-weight: 500
  border: 1px solid #EAEAEA
  background: #FAFAFA
  color: #333
  
Active/hover: subtle highlight
```

### 4.4 按钮（Buttons）

#### Primary Button（主要操作）
```
background: #FFD600
color: #000000
font-size: 13px
font-weight: 600
padding: 8px 20px
border-radius: 8px (lg) / 12px (xl)
border: none
cursor: pointer
transition: all 0.15s ease

Hover: slight brightness increase or subtle shadow
Disabled: background: #DDD, cursor: not-allowed
```

#### Secondary Button（次要操作）
```
background: #FAFAFA / #FFFFFF
color: #555 / #333
font-size: 13px
font-weight: 500
padding: 8px 16px
border-radius: 8px
border: 1px solid #EAEAEA
cursor: pointer

Hover: background: #F5F5F5, border-color darken slightly
```

#### Ghost Button（透明按钮）
```
background: transparent
color: inherit
border: none
padding: 4px 8px
border-radius: 6px

Hover: background tint matching context
```

#### 快捷问题按钮（Quick Questions）
```
display: grid, 2-3 columns
background: #FAFAFA
border: 1px solid #F0F0F0
border-radius: 12px (xl)
padding: 10px 12px
font-size: 13px
color: #555
text-align: left

MouseEnter → border-color: #FFD600, background: #FFFBE8, color: #333
MouseLeave → restore original
```

### 4.5 思考过程面板（Thinking Panel）

**折叠态：**
```
margin-bottom: 10px
border-radius: 12px
border: 1px solid #FEF3C7
background: #FFFBEB
overflow: hidden
```

**展开态标题栏：**
```
padding: 8px 12px
background: #FEF3C7 (expanded) / transparent (collapsed)
font-size: 12px
font-weight: 600
color: #FFD600
```

**思考步骤卡片（展开后）：**
```
display: flex, gap: 10px
padding: 8px 10px
margin-bottom: 6px
background: #FFFFFF
border-radius: 8px
border: 1px solid #FDE68A
font-size: 12px
line-height: 1.5
```

**步骤图标容器：**
```
28×28px, rounded-8px
background: #FEF3C7
color: #92400E (icon)
```

### 4.6 实时思考中面板（Real-time Thinking）

```
padding: 14px 16px
border-radius: 12px
background: linear-gradient(135deg, #FFFBF0, #FFF8E1)
border: 1px solid #FFD600
box-shadow: 0 2px 12px rgba(255,214,0,0.15)

Header:
  font-size: 13px, font-weight: 700, color: #FFD600
  border-bottom: 1px solid rgba(255,214,0,0.2)
  Status badge: #22C55E "实时处理中"

Step items:
  font-size: 13px, title color: #FFD600 (bold)

Typing dots (bottom):
  6×6px circles, background: #FFD600
  animation: blink 1s infinite (opacity 0.3↔1.0)
```

### 4.7 Skill 标签（Skill Tag）

```
display: inline-flex
gap: 4px
padding: 2px 8px
border-radius: 6px
font-size: 10px
font-weight: 600
color: #D97706
background: #FEF3C7
border: 1px solid #FDE68A
margin-bottom: 6px

Prefix: ✨ emoji
```

### 4.8 延伸问题按钮（Follow-up Questions）

```
display: flex
align-items: center
gap: 8px
padding: 9px 14px
border-radius: 12px
border: 1px solid #E8E8E8
background: #FFFFFF
font-size: 13px
color: #444
text-align: left
line-height: 1.4

Q-icon (left):
  20×20px, rounded-6px
  background: #FFF8E1
  border: 1px solid #FFE082
  font-size: 11px
  font-weight: 700
  color: #F59E0B

MouseEnter:
  border-color: #FFD600
  transform: translateX(4px)

⚠️ MouseLeave 必须恢复白色！不能用深色！
```

### 4.9 操作栏（Action Bar — 气泡底部）

```
display: flex
align-items: center
gap: 8px
margin-top: 8px
padding-top: 4px
font-size: 10px

Time color: user=#CC9A00 / ai=#BBB

Feedback buttons:
  👍 有帮助:
    padding: 3px 7px, rounded-12px (pill)
    border: 1px solid #BBF7D0
    color: #22C55E
    hover: bg-#F0FDF4
    
  👎 需改进:
    same structure, red colors
    
  复制按钮:
    opacity: 0.35
    no background/border
```

### 4.10 弹窗/模态框（Modal）

```
Overlay: fixed inset-0, bg-black/40, z-100

Panel:
  width: 480px (default) / 320px (small dropdown)
  background: #FFFFFF
  border-radius: 16px (2xl)
  border: 1px solid #EAEAEA
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25) (shadow-2xl)
  overflow: hidden

Header:
  padding: 16px 24px
  border-bottom: 1px solid #F0F0F0
  font-size: 16px (base)
  font-weight: 700 (bold)
  color: #1A1A1A

Body:
  padding: 20px 24px

Footer:
  padding: 16px 24px
  border-top: 1px solid #F0F0F0
  display: flex, justify-end, gap: 10px
```

### 4.11 下拉选择器（Dropdown/Picker）

```
Trigger: same as Secondary Button style

Panel (absolute positioned):
  width: 320px
  background: #FFFFFF
  border-radius: 12px (xl)
  border: 1px solid #EAEAEA
  box-shadow: shadow-2xl
  z-index: 50
  overflow: hidden

Item:
  padding: 8px 12px
  font-size: 13px
  color: #555 (normal) / #1A1A1A (selected+bold)
  hover: bg-yellow-50
  selected: bg-yellow-50
```

### 4.12 卡片（Card）

```
Standard card:
  background: #FFFFFF
  border-radius: 8px (lg) / 12px (xl)
  border: 1px solid #EAEAEA (subtle) or none
  padding: 16px
  box-shadow: none or shadow-sm

Subscription card (special):
  background: linear-gradient(135deg, #FFFBE8, #FEF3C7)
  border: 1px solid #FDE68A
  border-radius: 8px
  padding: 12px
```

### 4.13 Markdown 渲染样式（Rich Content）

渲染器函数: `renderMarkdownEnhanced(text)` in ChatArea.tsx

| Element | Style |
|---------|-------|
| **H1** | 20px, 800 weight, color #1A1A1A, margin 22px 0 14px |
| **H2** | 17px, 700 weight, color #1A1A1A, margin 20px 0 12px, border-bottom 3px solid #FFD600 |
| **H3** | 15px, 700 weight, color #1A1A1A, margin 18px 0 10px, border-bottom 2px solid #FFD600 |
| **Bold (**text**)** | 700 weight, color #1A1A1A |
| **Italic (*text*)** | italic, color #555 |
| **Quote (> text)** | border-left 3px solid #FFD600, bg-#FFFBE8, color #92400E, rounded-r 8px |
| **Ordered List** | flex layout, number badge bg-#FFD600 color-#000, rounded-6px |
| **Unordered List** | bullet = ● in #FFD600, bold |
| **Inline code (`code`)** | bg-#F0F0F0, padding 2px 6px, rounded-4px, color-#E83E8C, monospace |
| **Code block (```)** | bg-#1E1E1E, color-#D4D4D4, padding 14px 16px, rounded-10px, monospace |
| **Separator (---)** | border-top 1px dashed #DDD |
| **Paragraph** | color #333, line-height 1.75, margin 14px 0 |

---

## 5. Layout Principles

### 5.1 整体布局

```
┌──────────────────────────────────────────────┐
│  App Shell (flex, 100vw × 100vh)             │
│  ┌────────────┬─────────────────────────────┐│
│  │            │                             ││
│  │  Sidebar   │     Main Content Area       ││
│  │  278px     │     (flex: 1, 无marginLeft) ││
│  │  固定宽度   │     自动填充剩余空间          ││
│  │            │                             ││
│  └────────────┴─────────────────────────────┘│
└──────────────────────────────────────────────┘
```

**关键规则**：
- **Sidebar 在 flex 流中自然占位（278px），Main 不设 marginLeft！** （之前踩过的坑：双重偏移导致深色缝隙）
- 外层容器背景根据 `currentPage` 动态切换：chat页=白，其他=深色
- 使用 `minWidth: 0` 防止 flex 子元素溢出

### 5.2 间距系统（Spacing Scale）

基于 Tailwind 默认间距，常用值：

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | 紧凑内间距、图标与文字间隙 |
| `sm` | 8px | 小组件内部间距 |
| `md` | 12px | 标准内间距、段落间距 |
| `lg` | 16px | 区块级间距、容器padding |
| `xl` | 20px | 大区块间距、弹窗body |
| `2xl` | 24px | 弹窗header/footer padding |
| `3xl` | 32px | 页面级大间距 |

### 5.3 圆角系统（Border Radius）

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4px | 小标签、徽章、代码片段 |
| `md` | 6px | 标签、小按钮 |
| `lg` | **8px** | 标准**按钮、卡片、输入框**（最常用！）|
| `xl` | 12px | 大按钮、下拉面板、思考步骤 |
| `2xl` | 16px | 弹窗/模态框 |
| `full` | 9999px | 头像(pill)、药丸按钮 |

### 5.4 响应式断点

| Breakpoint | Value | Behavior |
|------------|-------|----------|
| `lg` | 1024px | Sidebar 从 fixed→static，移动端适配 |
| Mobile (<1024px) | — | Sidebar 变为抽屉式（translate-x），带遮罩层 |

---

## 6. Depth & Elevation (Shadow System)

| Level | Shadow Value | Usage |
|-------|-------------|-------|
| **none** | none | 平面元素（默认） |
| **sm** | `0 1px 2px rgba(0,0,0,0.05)` | 标准卡片、悬浮按钮 |
| **md** | `0 4px 6px rgba(0,0,0,0.07)` | 下拉面板、浮动元素 |
| **lg** | `0 10px 15px rgba(0,0,0,0.1)` | 重要浮层 |
| **xl** | `0 20px 25px rgba(0,0,0,0.1)` | 大型弹窗 |
| **2xl** | `0 25px 50px -12px rgba(0,0,0,0.25)` | **模态框专用** |
| **custom-thinking** | `0 2px 12px rgba(255,214,0,0.15)` | 思考中面板（品牌色光晕）|

---

## 7. Do's and Don'ts

### ✅ DO

- **聊天页保持纯白背景** — 不要混入任何深色元素
- **品牌黄 #FFD600 只用于强调** — 主按钮、聚焦态、活跃图标、Logo。不要大面积使用
- **圆角统一用 8px 作为默认值** — 按钮、卡片、输入框都用 `rounded-lg`(8px)
- **用户气泡用淡黄白 #FFF9E6** — 不是褐色！不是深金色！
- **AI气泡用浅灰 #F8F8FA** — 干净清爽
- **所有交互必须有 hover 态** — 即使只是背景微变
- **文字颜色对比度足够** — 正文不低于 `#333` on white
- **Flex 布局自然流动** — Main 区域不设 marginLeft（Sidebar 已在流中占位）

### ❌ DON'T

- **不要在聊天页使用深色背景** — #0a0a0a, #151515, #1a1a1a, #252500 这些是 Skills/设置页用的
- **不要用 #2a2500 作为用户气泡色** — 这是暗金/褐色，在白底上看起来很脏
- **不要在 onMouseLeave 里写死深色值** — 如 `background:'#151515'`，这会导致白底页出现黑色闪烁
- **不要给 Main 设 marginLeft** — Sidebar 已经在 flex 流中了，双重偏移会产生缝隙
- **不要混用亮色和深色文字色** — 白底上不用 #ccc/#ddd（太浅），深底上不用 #333（太深）
- **不要超过 3 种强调色** — 品牌黄是唯一主角，绿/红仅用于反馈
- **不要省略 `}}` 闭合括号** — JSX style 属性必须完整闭合（语法错误高发区）

---

## 8. Agent Prompt Guide

### 快速参考卡（给 AI 的提示词模板）

当需要生成或修改 ShaoziClaw UI 时，使用以下 prompt：

```
你正在为 ShaoziClaw（ShaoziClaw 勺子Claw — 餐饮AI专家桌面应用）编写/修改前端组件。

【强制设计规范】
请严格遵循以下设计令牌：

🎨 配色：
- 品牌色: #FFD600（唯一强调色，用于按钮/Logo/活跃态/聚焦）
- 页面背景(聊天): #FFFFFF, 页面背景(其他): #0C0C0E
- 侧边栏: #FAFAFA, 边框: #EAEAEA
- 用户气泡: #FFF9E6(淡黄白), 边框: #FFE082
- AI气泡: #F8F8FA(浅灰), 边框: #EEE
- 文字主色: #1A1A1A / #333, 次要: #555 / #888, 弱: #AAA / #CCC
- 边框默认: #EAEAEA, 聚焦: #FFD60080
- 成功绿: #22C55E, 错误红: #EF4444
- 思考面板: 底#FFFBEB, 边#FEF3C7, 文字#92400E

📐 排版：
- 字体: -apple-system, "SF Pro", "PingFang SC", sans-serif
- 正文字号: 14px, 行高: 1.65+
- 标题字重: 600+, 最小字号: 10px
- 圆角默认: 8px(lg), 气泡: 18px(一角4px)

🏗️ 布局：
- Sidebar: 278px固定宽, flex流中自然占位
- Main区域: flex:1, 不设marginLeft!
- 外层容器背景根据currentPage动态切换

❌ 绝对禁止：
- 聊天页使用任何深色背景（#0a0a0a/#151515/#252500等）
- 用户气泡使用#2a2500（褐色脏块）
- onMouseLeave写死深色值
- 给Main设marginLeft（双重偏移bug）
- JSX style属性缺少}}闭合
```

### 颜色速查表

```
#FFD600        → 品牌/主按钮/活跃态/Logo
#FFF9E6        → 用户气泡
#F8F8FA        → AI气泡
#FFFBEB        → 思考面板底
#FEF3C7 / #FDE68A → 思考面板边/标签底
#FFFFFF        → 页面背景(聊天)/卡片/弹窗
#FAFAFA        → 侧边栏/标题栏/输入区
#F0F0F0 / #EAEAEA → 边框/分割线
#1A1A1A / #333 → 主文字
#555 / #888     → 次要文字
#AAA / BBB / CCC → 弱文字
#22C55E        → 成功
#EF4444        → 错误
```

---

## 9. Component File Map

| Component | File Path | Theme | Key Design Tokens |
|-----------|----------|-------|-------------------|
| App壳 | `App.tsx` | 动态(按page) | 外层bg, header, main布局 |
| 侧边栏 | `Sidebar.tsx` | 亮色(#FAFAFA) | nav-items, task-list, user-panel |
| 聊天区 | `ChatArea.tsx` | **亮色(#FFF)** | bubbles, input, thinking-panel, markdown |
| 专家中心 | `ExpertCenter.tsx` | 深色 | expert-cards, category-filter |
| 技能中心 | `SkillCenter.tsx` | 深色 | skill-grid, skill-cards, search |
| 技能页 | `SkillsPage.tsx` | 深色 | skill-detail, module-tree |
| 设置 | `Settings.tsx` | 深色/亮色 | setting-groups, toggles |
| 登录 | `LoginScreen.tsx` | 自定义 | login-form, branding |
| 学习仪表盘 | `LearningDashboard.tsx` | 亮色 | charts, stats-cards |
| 订阅 | `Subscription.tsx` | 亮色 | pricing-cards, payment |
| 工具箱 | `ToolBox.tsx` | 亮色 | tool-cards, grid |
| 首页 | `HomeScreen.tsx` | 动态 | welcome, quick-actions |

---

*此文件为 ShaoziClaw 前端的「设计宪法」，所有新增/修改的UI组件必须遵循本规范。修改前请先更新本文件。*
