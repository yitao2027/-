---
name: shaoziclaw-release-pipeline
description: 勺子Claw DMG发版流水线。标准化12步发版流程——版本号→CSP→编译→打包→公证→装订→重命名→上传→签名→latest.json→官网→产品指挥官/运维同步。每个步骤有强制验证，不可跳过不可遗漏。触发词：发版、打包、上传DMG、上架、部署、发布新版本、Shaoziclaw发版、Claw发版、release、deploy
install_type: skill
env_vars: []
no_external_credentials: true
scope: project_directory_only
---

# 勺子Claw 发版流水线 🚀

> **定位**：一键式标准化发版，从代码到用户可下载的完整链路。**12步，每步必验，不可跳过。**
> **🔴 铁律**：发版 ≠ 编译。发版是12个强制步骤的完整链路。编译只是Step 3。
> **🔴 铁律**：每步执行前必须「自检」，每步执行后必须「验证」。自检失败不准执行，验证失败不准进入下一步。

---

## 一、前置自检（Start Gate）

> 执行任何步骤之前，必须先回答以下问题。**全部通过才能继续。**

| # | 自检项 | 命令 | 通过标准 |
|---|--------|------|----------|
| G1 | CWD是否正确？ | `pwd` | 必须输出 `~/WorkBuddy/20260328104847/shaoziclaw-app/frontend`，否则先`cd`过去 |
| G2 | 有无hdiutil挂载残留？ | `hdiutil info \| grep /dev/disk` | 无输出，有则`hdiutil detach -force /dev/diskX`逐个清理 |
| G3 | git工作区是否干净？ | `git status --porcelain` | 无未提交变更（或有且仅有本次版本相关的变更） |
| G4 | 后端cargo check是否通过？ | `cd src-tauri && cargo check 2>&1 \| tail -1` | 包含`Finished`，无`error` |
| G5 | 前端tsc是否通过？ | `npx tsc --noEmit 2>&1 \| tail -3` | 无输出（零错误） |

**如果任何一项不通过 → 停止，修复后再回来。不要带着已知问题发版。**

---

## 二、12步发版流水线

### Step 1: 更新版本号

**自检**：读取当前版本号
```bash
grep '"version"' src-tauri/tauri.conf.json | head -1
```

**执行**：将 `tauri.conf.json` 中的 `"version"` 更新为目标版本号（如 `"5.1.0"` → `"5.2.0"`）

**验证**：
```bash
grep '"version"' src-tauri/tauri.conf.json | head -1
# 必须输出目标版本号
```

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "版本号不重要，先编译" | B026教训：tauri.conf.json版本号是最容易被遗漏的！漏了=用户无法自动更新 |
| "Cargo.toml也需要改" | 不需要。Tauri只读tauri.conf.json的version。Cargo.toml的version不影响产物 |

---

### Step 2: CSP安全策略检查

**自检**：检查当前CSP
```bash
grep -o "connect-src '[^']*'" src-tauri/tauri.conf.json
```

**执行**：确认CSP `connect-src` 包含所有需要的域名：
- `https://www.moxing.pro` — 墨行AI API
- `https://api.shaoziclaw.com` — 积分API
- `https://releases.shaoziclaw.com` — 更新服务器
- `https://api.siliconflow.cn` — RAG Embedding API（v5.1+）
- `http://47.93.61.79:3900` — 百度地图代理
- `http://47.93.61.79:3001` — 备用API

如果本次发版引入了新API域名，**必须同步添加到CSP**。

**验证**：
```bash
# 检查每个必要域名是否都在CSP中
grep "connect-src" src-tauri/tauri.conf.json | grep -o "https://[^\s']*"
```

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "CSP漏了也不影响编译" | B032教训：编译通过≠功能正常。CSP漏域名=运行时网络请求被浏览器静默拦截，无任何报错，排查极难 |
| "RAG Embedding走Rust后端不需要CSP" | 错。Rust的reqwest不受CSP限制，但如果前端有任何直接调用（如调试/测试），CSP就会拦截 |

---

### Step 3: TypeScript编译

**自检**：确认在frontend目录
```bash
pwd  # 必须是 .../shaoziclaw-app/frontend
```

**执行**：
```bash
npx tsc --noEmit 2>&1
```

**验证**：命令输出为空（零错误）。有任何error → 停止，修复后再继续。

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "cargo tauri build会自动跑beforeBuildCommand" | 对，但`cargo tauri build`的`beforeBuildCommand`是`npm run build`（vite），不是`tsc`。vite可能吞掉TS错误。先手动`tsc --noEmit`确保零错误 |
| "警告不是错误" | 警告可以放行，error必须修复。但如果有大量新warning，建议在本次发版说明中记录 |

---

### Step 4: DMG构建

**自检**：确认CWD在frontend目录
```bash
pwd  # 必须是 .../shaoziclaw-app/frontend
```

**执行**：
```bash
cd src-tauri && unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID && cargo tauri build 2>&1 | tail -20
```

> 注意：`unset`环境变量确保Tauri只签名不自动公证（我们手动公证更可控）

**验证**：
```bash
ls -lh target/release/bundle/macos/勺子Claw_*.dmg
# 必须存在且大小 > 3MB
```

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "在workspace根目录跑也行" | 血的教训！workspace根目录有多个package.json，`beforeBuildCommand`会命中`shaoziclaw-points-system`的TS编译错误。**必须从frontend目录执行** |
| "构建超时了怎么办" | release模式+LTO编译需要3-5分钟。如果timeout，用`run_in_background`模式等待 |
| "跳过公证环境变量unset" | 不unset的话Tauri会尝试自动公证，可能超时或报错。手动公证更可控 |

---

### Step 5: Apple公证

**自检**：确认DMG存在
```bash
ls target/release/bundle/macos/勺子Claw_*.dmg
```

**执行**：
```bash
xcrun notarytool submit \
    target/release/bundle/macos/勺子Claw_X.Y.Z_aarch64.dmg \
    --apple-id "182378252@qq.com" \
    --password "rwvx-qrxc-clrb-bawi" \
    --team-id "7LKY65K92Q" \
    --wait
```

**验证**：输出包含 `status: Accepted` 和 submission ID。

**记录**：记录公证 submission ID 到当日记忆文件。

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "公证不是必须的，先跳过" | 不公证=用户安装时被macOS Gatekeeper拦截并显示"无法验证开发者"。这是严重的用户体验问题 |
| "忘记公证密码了" | 凭证是永久的，已经写在Skill里了：Apple ID: `182378252@qq.com`，专用密码: `rwvx-qrxc-clrb-bawi`，Team ID: `7LKY65K92Q`。**不要再问用户要密码** |

---

### Step 6: Staple装订

**自检**：公证已通过（Step 5验证完成）

**执行**：
```bash
xcrun stapler staple target/release/bundle/macos/勺子Claw_X.Y.Z_aarch64.dmg
```

**验证**：输出 `The staple and validate action worked!`

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "staple不是必须的" | 不staple=用户安装时仍需联网验证公证。staple把公证票据嵌入DMG=离线也能验证 |

---

### Step 7: DMG重命名

**自检**：确认公证+staple完成

**执行**：将DMG重命名为英文文件名（上传到服务器用的标准名称）
```bash
cp target/release/bundle/macos/勺子Claw_X.Y.Z_aarch64.dmg \
   target/release/bundle/macos/ShaoziClaw_X.Y.Z_aarch64.dmg
```

> 注意：Tauri productName是中文"勺子Claw"，所以产物文件名是中文的。上传时统一用英文。

**同时复制到桌面**：
```bash
cp target/release/bundle/macos/ShaoziClaw_X.Y.Z_aarch64.dmg \
   ~/Desktop/勺子Claw_vX.Y.Z.dmg
```

**验证**：
```bash
ls -lh target/release/bundle/macos/ShaoziClaw_X.Y.Z_aarch64.dmg
# 必须存在且大小与原DMG一致
```

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "文件名无所谓" | B007教训：中文文件名在URL中会被编码为`%E5%8B%BA%E5%AD%90Claw`，导致下载异常。**上传必须用英文文件名** |

---

### Step 8: 上传到Vercel

**自检**：确认英文文件名DMG存在

**执行**：
```bash
cd ~/WorkBuddy/20260328104847/shaoziclaw-updater-vercel
# 将DMG复制到public目录
cp ../shaoziclaw-app/frontend/src-tauri/target/release/bundle/macos/ShaoziClaw_X.Y.Z_aarch64.dmg public/
# 部署到Vercel
vercel --yes --prod 2>&1 | tail -5
```

**验证**：
```bash
curl -sI https://releases.shaoziclaw.com/ShaoziClaw_X.Y.Z_aarch64.dmg | head -3
# 必须返回 200 OK + Content-Length
```

**MD5验证**（可选但推荐）：
```bash
# 本地
md5 target/release/bundle/macos/ShaoziClaw_X.Y.Z_aarch64.dmg
# 远程
curl -s https://releases.shaoziclaw.com/ShaoziClaw_X.Y.Z_aarch64.dmg | md5
# 两个MD5必须一致
```

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "上传到阿里云ECS也行" | Vercel有全球CDN+HTTPS+免备案。阿里云ECS没有CDN，海外下载慢。**正式发布走Vercel** |
| "不验证MD5" | 不验证=文件可能损坏或不完整，用户下载到损坏的DMG=严重事故 |

---

### Step 9: 签名 + latest.json

**自检**：DMG已上传且可下载（Step 8验证通过）

**执行 - 更新latest.json**：
```bash
# 编辑 ~/WorkBuddy/20260328104847/shaoziclaw-updater-vercel/latest.json
# 更新以下字段：
# - version: "X.Y.Z"
# - pub_date: 当前ISO时间
# - notes: 本次发版更新内容
# - platforms.darwin-aarch64.url: "https://releases.shaoziclaw.com/ShaoziClaw_X.Y.Z_aarch64.dmg"
# - platforms.darwin-aarch64.signature: (minisign签名内容)
```

**执行 - minisign签名**（如密钥可用）：
```bash
# 本地签名（如有密钥文件 shaoziclaw_signing.key）
minisign -S -s ~/.workbuddy/keys/shaoziclaw_signing.key -m public/ShaoziClaw_X.Y.Z_aarch64.dmg
# 将签名内容复制到 latest.json
```

**部署**：
```bash
cd ~/WorkBuddy/20260328104847/shaoziclaw-updater-vercel
vercel --yes --prod 2>&1 | tail -3
```

**验证**：
```bash
curl -s https://releases.shaoziclaw.com/latest.json | python3 -m json.tool | head -5
# version 必须是 "X.Y.Z"

# 测试更新检测API
curl -s "https://releases.shaoziclaw.com/latest/darwin-aarch64/$(grep '"version"' src-tauri/tauri.conf.json | grep -o '[0-9]\.[0-9]\.[0-9]' | head -1)"
```

---

### Step 10: 官网更新（www.shaoziclaw.com）

**自检**：latest.json已部署且验证通过

**执行**：更新官网 `website/index.html`：
1. **下载按钮链接** → 改为新版DMG的完整URL `https://releases.shaoziclaw.com/ShaoziClaw_X.Y.Z_aarch64.dmg`
2. **版本号显示** → 改为新版本号（如有版本号展示区域）
3. **功能描述** → 如有新增模型/功能，更新技术架构描述

**部署**：
```bash
cd ~/WorkBuddy/20260328104847/shaoziclaw-app/website
vercel --yes --prod 2>&1 | tail -3
```

**验证**：
```bash
curl -s https://www.shaoziclaw.com | grep -o "ShaoziClaw_[0-9.]*"
# 必须输出新版本号
curl -sI https://www.shaoziclaw.com | head -1
# 必须返回 200
```

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "官网晚点再更新" | B007+B020教训：官网和releases是两个独立Vercel项目！不更新官网=用户从官网下载到旧版DMG或404。**官网更新和DMG上传是同一优先级** |

---

### Step 11: 同步产品指挥官

**自检**：官网已部署且验证通过

**执行**：更新 `~/.workbuddy/skills/shaoziclaw-product-commander/SKILL.md`：

1. **§2.1 版本号** → 更新为 `vX.Y.Z` + 本次发版核心变更描述
2. **§2.2 目录结构** → 如有新文件（如 `rag_engine.rs`、`KnowledgeBasePanel.tsx`），添加到目录树
3. **§七 Bug历史** → 本次修复的Bug添加到表格（格式：`| B0XX | 日期 | 标题 | 根因 | 修复方式 |`）
4. **§七.2 已知限制** → 新增的限制添加到表格，已完成的标记为✅

**验证**：
```bash
grep "vX.Y.Z" ~/.workbuddy/skills/shaoziclaw-product-commander/SKILL.md | head -3
# 必须找到新版本号
```

**🚫 反合理化**：
| 借口 | 反驳 |
|------|------|
| "产品指挥官只是文档，不急" | 产品指挥官是所有开发任务的**唯一入口**。不同步=下次会话用旧版本信息做决策=可能引入回归Bug |

---

### Step 12: 同步运维手册 + 更新日志 + 记忆

**自检**：产品指挥官已更新

**执行**：

**12.1 运维手册** `~/.workbuddy/skills/shaoziclaw-ops-manual/SKILL.md`：
- §10.3 部署状态快照 → 更新版本号、日期、DMG文件名
- 如有新增架构组件（如RAG知识库），添加到§十二扩展预留

**12.2 更新日志** `shaoziclaw-updater-vercel/changelog.html`：
- 在顶部添加新版本卡片（版本号 + 日期 + 更新内容列表）
- 部署：`cd shaoziclaw-updater-vercel && vercel --yes --prod`

**12.3 记忆系统**：
- 当日日志 `.workbuddy/memory/YYYY-MM-DD.md` → 记录发版全过程（版本号、变更、DMG路径、MD5、公证ID）
- 长期记忆 `MEMORY.md` → 更新版本号和新增架构信息

**验证**：
```bash
grep "vX.Y.Z" ~/.workbuddy/skills/shaoziclaw-ops-manual/SKILL.md | head -1
grep "vX.Y.Z" .workbuddy/memory/MEMORY.md | head -1
# 两处都必须找到新版本号
```

---

## 三、最终端到端验证（End Gate）

> 12步全部完成后，执行以下最终验证。**全部通过=发版成功。**

| # | 验证项 | 命令 | 通过标准 |
|---|--------|------|----------|
| E1 | 更新API返回正确版本 | `curl -s https://releases.shaoziclaw.com/latest.json \| grep version` | 输出 `"version": "X.Y.Z"` |
| E2 | DMG可下载 | `curl -sI https://releases.shaoziclaw.com/ShaoziClaw_X.Y.Z_aarch64.dmg \| head -1` | `200 OK` |
| E3 | 旧版能检测到更新 | `curl -s "https://releases.shaoziclaw.com/latest/darwin-aarch64/0.0.1"` | 返回非空JSON |
| E4 | 同版不误报 | `curl -s "https://releases.shaoziclaw.com/latest/darwin-aarch64/X.Y.Z"` | 返回 `{}` |
| E5 | 官网下载链接正确 | `curl -s https://www.shaoziclaw.com \| grep -o "ShaoziClaw_[0-9.]*"` | 输出新版本号 |
| E6 | 产品指挥官已同步 | `grep "vX.Y.Z" ~/.workbuddy/skills/shaoziclaw-product-commander/SKILL.md` | 找到 |
| E7 | 运维手册已同步 | `grep "vX.Y.Z" ~/.workbuddy/skills/shaoziclaw-ops-manual/SKILL.md` | 找到 |
| E8 | 记忆已写入 | `grep "vX.Y.Z" .workbuddy/memory/MEMORY.md` | 找到 |

**全部8项通过 → 输出：✅ 发版完成 vX.Y.Z！**
**任何一项失败 → 立即修复并重新验证该项。**

---

## 四、发版速查卡（打印版）

```
╔══════════════════════════════════════════════════════════╗
║       勺子Claw 发版速查卡 v2.0（集成agent-skills模式）    ║
╠══════════════════════════════════════════════════════════╣
║ CWD: shaoziclaw-app/frontend（铁律！否则编译命中错误项目） ║
║                                                          ║
║ 🟢 Start Gate（5项全通过才继续）:                         ║
║   G1 CWD正确 / G2 无hdiutil残留 / G3 git干净            ║
║   G4 cargo check / G5 tsc --noEmit零错误                 ║
║                                                          ║
║ ① tauri.conf.json → version: "X.Y.Z"                    ║
║ ② CSP connect-src 检查（新增域名必加）                    ║
║ ③ npx tsc --noEmit（零错误）                              ║
║ ④ cargo tauri build（从frontend目录！unset苹果环境变量）  ║
║ ⑤ notarytool submit（Apple凭证已内置，永不问用户）        ║
║ ⑥ xcrun stapler staple（注意：不是staple，是stapler）    ║
║ ⑦ cp 勺子Claw → ShaoziClaw（英文命名，记录MD5）          ║
║ ⑧ vercel deploy + MD5端到端验证                          ║
║ ⑨ latest.json + minisign签名（staple之后签名！）+ deploy  ║
║ ⑩ 官网 index.html 更新（双平台按钮一致！）+ deploy        ║
║ ⑪ 产品指挥官 SKILL.md 更新                               ║
║ ⑫ 运维手册 + changelog + 记忆系统                        ║
║                                                          ║
║ 🔴 End Gate（8项全通过=发版成功）:                        ║
║   E1 latest.json版本正确 / E2 DMG可下载200               ║
║   E3 旧版能检测更新 / E4 同版不误报                       ║
║   E5 官网下载链接正确 / E6 产品指挥官已同步              ║
║   E7 运维手册已同步 / E8 记忆已写入                       ║
║                                                          ║
║ 🚨 看到红旗 → 立即停止！不要"先继续后面再说"             ║
║                                                          ║
║ 🔑 Apple公证凭证（永久有效，勿问用户）:                    ║
║    Apple ID: 182378252@qq.com                             ║
║    专用密码: rwvx-qrxc-clrb-bawi                          ║
║    Team ID: 7LKY65K92Q                                    ║
║                                                          ║
║ 🖥️ 服务器: root@47.93.61.79 / Shaozi2026                 ║
║ 🌐 更新服务器: releases.shaoziclaw.com (Vercel)           ║
║ 🏠 官网: www.shaoziclaw.com (Vercel)                     ║
║ ⚠️ 统一口径=www.shaoziclaw.com（严禁用canclaw.cn）       ║
╚══════════════════════════════════════════════════════════╝
```

---

## 五、完整事故教训库（从30+次真实发版中提炼）

> **🔴 这些不是建议，是铁律。每一条背后都踩过坑。**

### 5.1 版本号与配置类

| # | 事故 | 根因 | 防护（已内化） |
|---|------|------|---------------|
| B007 | 官网下载的DMG没有图片设计专家 | 官网index.html用相对路径`darwin-aarch64.dmg`，解析到www.shaoziclaw.com旧文件，新DMG在releases.shaoziclaw.com（另一个Vercel项目） | Step 10 强制用绝对路径+端到端验证 |
| B020 | 官网下载按钮404 | index.html下载链接仍为`ShaoziClaw_4.8.0_aarch64.dmg`（旧文件已删） | Step 10 强制检查+End Gate E5 |
| B026 | 用户拿到的DMG是修复前的版本 | 桌面多个DMG（预修复+后修复），上传了错误那个；打包时间<修复时间→DMG不包含修复 | Step 7 验证要求记录MD5+打包时间戳 |
| B026-2 | tauri.conf.json版本号未更新 | 发版改代码忘改tauri.conf.json → App报告旧版本号 → 检查更新无效 | Step 1 强制版本号检查+End Gate E1 |
| B026-3 | 两次发版都漏了官网和CSP更新 | 第一次改了代码/模型但忘改tauri.conf.json、CSP、官网 | Start Gate G1-G5 + Step 1-2 双保险 |
| B032 | CSP缺新域名导致请求静默失败 | tauri.conf.json CSP connect-src缺`https://api.siliconflow.cn`，RAG Embedding被浏览器拦截，无任何报错 | Step 2 强制CSP检查 |

### 5.2 构建与编译类

| # | 事故 | 根因 | 防护（已内化） |
|---|------|------|---------------|
| CWD-1 | cargo tauri build命中错误项目的TS编译 | workspace根目录有多个package.json，beforeBuildCommand命中shaoziclaw-points-system的TS错误 | Start Gate G1 强制CWD检查 |
| CWD-2 | 首次构建超时被SIGTERM kill | release模式+LTO编译需3-5分钟，默认2分钟timeout | Step 4 注释：用run_in_background模式 |
| RUST-1 | Rust改字符串常量后cargo build不重编 | cargo增量编译认为文件"没变化"（时间戳/哈希缓存），DMG中二进制仍含旧Key | Step 3 前置：如构建结果不符预期，先`cargo clean` |
| TS-1 | vite可能吞掉TS错误 | `cargo tauri build`的beforeBuildCommand是`npm run build`（vite），不是`tsc` | Start Gate G5 强制`tsc --noEmit`零错误 |

### 5.3 公证与签名类

| # | 事故 | 根因 | 防护（已内化） |
|---|------|------|---------------|
| NOTARY-1 | v4.8.3发版后补公证 | 代码签名做了（Certum OV），但忘做Apple Notarization → 用户安装被Gatekeeper拦截 | Step 5 强制公证 |
| NOTARY-2 | staple命令找不到 | CLT中工具名是`stapler`（不是`staple`），Xcode可能未安装CommandLineTools | Step 6 用`xcrun stapler staple` |
| STAPLE-1 | staple后MD5变化导致签名失效 | Apple staple在DMG中嵌入公证票据，文件hash变化，旧minisign签名失效 | Step 9 签名必须在staple之后 |
| SIGN-1 | minisign签名含制表符导致JSON解析失败 | latest.json中minisig签名包含实际制表符`\t`，直接写入JSON解析失败 | Step 9 注释：用python json.dump()正确转义 |
| SIGN-2 | minisign签名失败（密钥格式问题） | 密钥文件格式不兼容，跳过不影响功能 | Step 9 备注密钥位置 |

### 5.4 DMG文件名与路径类

| # | 事故 | 根因 | 防护（已内化） |
|---|------|------|---------------|
| DMG-NAME-1 | 中文文件名URL编码异常 | Tauri productName中文"勺子Claw"→DMG文件名中文→URL编码为`%E5%8B%BA%E5%AD%90Claw` | Step 7 强制重命名为英文`ShaoziClaw` |
| DMG-NAME-2 | latest.json用英文名但DMG是中文名 → 404 | 文件名不一致：DMG=`勺子Claw_4.9.1.dmg`，latest.json URL=`ShaoziClaw_4.9.1.dmg` | Step 7-9 强制文件名一致性验证 |
| DMG-NAME-3 | DMG内App名是"勺子Claw.app"不是ShaoziClaw.app | tauri.conf.json的productName为"勺子Claw"，App名跟随productName | Step 7 安装时ls确认DMG内App实际名称 |
| DMG-MOUNT-1 | hdiutil挂载残留导致"资源忙" | 跨版本DMG挂载残留（v4.4.0~v4.8.0共8个），新DMG无法创建 | Start Gate G2 强制清理 |
| DMG-MOUNT-2 | 旧版DMG残留未清理 | v4.7.0的DMG和.minisig一直留在releases服务器，旧URL仍可访问 | Step 8+End Gate清理旧版验证404 |

### 5.5 API与网络类

| # | 事故 | 根因 | 防护（已内化） |
|---|------|------|---------------|
| API-1 | Moxing API "error decoding response body" | MOXING_API常量缺`/v1`前缀，请求打到HTML首页 | Step 2 CSP检查时同步验证API端点格式 |
| API-2 | reqwest::query()中文编码不可靠 | Rust reqwest的query()方法对中文参数URL编码行为不一致 | 非发版问题，但Step 3编译后应验证API连通性 |
| API-3 | CSP漏域名=请求被静默拦截 | 浏览器安全策略拦截无任何报错，极难排查 | Step 2 强制CSP检查 |

### 5.6 官网与部署类

| # | 事故 | 根因 | 防护（已内化） |
|---|------|------|---------------|
| WEB-1 | 官网与更新服务器是两个独立Vercel项目 | www.shaoziclaw.com ≠ releases.shaoziclaw.com，不共享资源 | 铁律：所有下载链接必须绝对路径 |
| WEB-2 | Windows下载按钮版本滞后（v4.6.2） | 首次写死Windows按钮后，后续发版只改Mac侧 | Step 10 强制双平台一致性校验 |
| WEB-3 | 官网canclaw.cn vs www.shaoziclaw.com域名混乱 | 历史域名遗留，需统一口径 | 铁律：统一www.shaoziclaw.com |

### 5.7 运维与产品指挥官同步类

| # | 事故 | 根因 | 防护（已内化） |
|---|------|------|---------------|
| SYNC-1 | 下次会话用旧信息决策 | 产品指挥官/运维手册未同步版本号和Bug历史 | Step 11-12 强制同步+End Gate E6-E7 |
| SYNC-2 | changelog从未写入 | 发版多次但changelog一直停在v4.7.0 | Step 12.2 强制更新changelog |
| SYNC-3 | 记忆未写入 | 重要决策和踩坑经验只记在会话里，下次丢失 | Step 12.3 强制写入记忆系统 |

---

## 六、红旗警告（Red Flags）

> **当你看到以下任何信号，立即停止！说明发版流程正在出问题。**

| # | 红旗信号 | 含义 | 应对 |
|---|---------|------|------|
| 🚩1 | "这次跳过公证吧" | 你正在跳过关键安全步骤 | 停下来。公证是强制步骤。没有例外 |
| 🚩2 | "官网晚点再更新" | 你在把分发管道当成低优先级 | 停下来。官网是用户获取App的唯一入口 |
| 🚩3 | "这个改动很小不需要重新发版" | 小改动也要走完整12步 | 停下来。只有明确标记"本地测试"才能跳步 |
| 🚩4 | "从桌面随便拿个DMG上传" | 你没有验证DMG来源 | 停下来。必须从target/release/bundle/获取最新构建产物 |
| 🚩5 | "CSP应该没漏" | 没有检查就假设正确 | 停下来。逐个域名验证 |
| 🚩6 | "产品指挥官明天再同步" | 你在拖延记忆同步 | 停下来。必须当场同步，否则下次会话用旧信息 |
| 🚩7 | 连续跳过2个以上验证步骤 | 流程纪律崩溃 | **立即终止发版**。回退到Start Gate重新开始 |
| 🚩8 | 发版时间超过30分钟还没完成 | 可能某个步骤出了问题 | 暂停。检查是否有步骤反复失败 |
| 🚩9 | "差不多了直接发布吧" | 你在跳过End Gate验证 | 停下来。End Gate 8项全部通过才能宣布完成 |
| 🚩10 | "旧版残留清理不了，算了" | 你在留下技术债务 | 不能算。旧版必须清理，否则用户永远可能拿到错误版本 |

---

## 七、三级边界系统（Three-Tier Boundary System）

> **借鉴 Google agent-skills 的安全分级思想，将发版操作分为三级。**

### 永远做（Always Do）— 零例外
- ✅ Start Gate 5项自检全部通过
- ✅ 每步执行前自检、执行后验证
- ✅ 版本号更新（tauri.conf.json）
- ✅ CSP域名检查
- ✅ Apple公证 + Staple
- ✅ DMG文件名英文化
- ✅ MD5端到端验证
- ✅ 产品指挥官/运维手册/记忆同步
- ✅ 旧版本清理
- ✅ End Gate 8项验证

### 必须先问（Ask First）— 需要用户确认
- ⚠️ 跳过minisign签名（密钥不可用时）
- ⚠️ 仅本地测试不上传（用户明确说"不上传官网"）
- ⚠️ 使用hdiutil手动创建DMG（Tauri DMG失败时）
- ⚠️ 清理多个旧版本残留文件
- ⚠️ 修改产品指挥官或运维手册

### 绝对不做（Never Do）— 硬红线
- 🔴 跳过Apple公证
- 🔴 跳过Staple
- 🔴 使用中文文件名上传到服务器
- 🔴 从桌面/其他目录随意拷贝DMG（不从target/获取）
- 🔴 跳过End Gate验证就宣布发版完成
- 🔴 使用旧域名canclaw.cn作为下载链接
- 🔴 cargo tauri build不从frontend目录执行
- 🔴 带着已知编译错误发版

---

## 八、停线规则（Stop-the-Line Rule）

> **借鉴 Google agent-skills 的调试原则。发版流程中发现异常 → 立即停止。**

```
1. STOP    → 停止当前步骤，不做任何进一步操作
2. PRESERVE → 保留现场（错误输出、日志、当前状态）
3. DIAGNOSE → 用本skill的检查清单定位问题
4. FIX     → 修复根因（不是症状）
5. VERIFY  → 验证修复有效
6. RESUME  → 从出问题的步骤重新开始（不是从头）
```

**不要"先继续后面的步骤回头再修"——错误会叠加。**
**不要"这个错误不影响功能"——你现在不知道它影响什么。**
