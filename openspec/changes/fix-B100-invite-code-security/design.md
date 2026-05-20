# B100 修复技术方案

## 核心思路

将邀请码从「前端明文列表」迁移为「后端/用户端本地验证+使用状态追踪」。

### 架构调整

```
修复前：
  前端(INVITE_CODES.ts 含500个明文码) → 本地Set匹配 → 放行
  后端(auth.rs 仅1个码+通配符)     → 任何码都不过

修复后：
  前端(LoginScreen.tsx) → 调用后端 verify_invite_code → 后端(invite_store.rs)
  后端(invite_store.rs) → 读取本地 ~/.shaoziclaw/invite_codes.json
                        → 校验存在性 + 未使用状态
                        → 注册时标记已使用(rust redeem）
```

### 具体变更

#### 1. 新建 `invite_store.rs`（后端邀请码存储模块）
- 500个邀请码预烧录在 `~/.shaoziclaw/invite_codes.json`
- 首次启动时自动创建（从编译期嵌入的码表生成）
- 每个码记录: `{code, used: bool, used_by: Option<String>, used_at: Option<String>}`
- 提供两个 Tauri command:
  - `verify_invite_code(code)` → 返回 {valid, message}
  - `redeem_invite_code(code, email)` → 注册时标记已使用

#### 2. 修改 `auth.rs`
- 删除硬编码的 `VALID_INVITE_CODES` 数组
- `verify_invite_code()` 改为调用 `invite_store`
- `register()` 增加邀请码参数 + 调用 `redeem_invite_code()`
- RegisterRequest 增加 `invite_code` 字段

#### 3. 修改 `LoginScreen.tsx`
- 删除 `import { VALID_INVITE_CODES, INVITE_CODE_PATTERN } from '../data/INVITE_CODES'`
- 前端不再本地校验邀请码合法性——改为调用后端 `verify_invite_code` command
- 前端只做格式预检（长度、字符集），真正校验交给后端
- 注册时传递 `invite_code` 参数

#### 4. 标记 `INVITE_CODES.ts` 为废弃
- 不删除（避免编译报错），但内容置空 + 加废弃注释
- 防止其他模块 import 时报错

### 不修改的部分
- 登录UI不变（用户无感知）
- 邀请码输入框格式校验保留（前端体验优化：即时反馈字符集格式）

### 安全边界
- 邀请码不在前端任何位置暴露
- Rust 编译产物的二进制中包含码表（无法通过 F12 获取）
- 一码一用，使用记录持久化在 `~/.shaoziclaw/invite_codes.json`
