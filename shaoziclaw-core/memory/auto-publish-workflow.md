# 勺子Claw 自动发布工作流

> App更新、官网部署、Skill推送的自动化发布SOP。

---

## 一、Mac App 发布流程

```bash
# 1. 确认代码最新
cd ~/WorkBuddy/20260328104847/shaoziclaw-app/frontend
git pull

# 2. 前端依赖检查
npm install

# 3. Tauri 构建
npm run tauri build

# 4. 移除隔离属性（关键步骤！）
xattr -cr src-tauri/target/release/bundle/dmg/*.app
xattr -cr src-tauri/target/release/bundle/dmg/*.dmg

# 5. 验证DMG
ls -la src-tauri/target/release/bundle/dmg/

# 6. 本地测试安装
open src-tauri/target/release/bundle/dmg/CAN\ Claw_*.dmg
```

### 检查清单
- [ ] 版本号已在 `src-tauri/tauri.conf.json` 更新
- [ ] `npm run build` 零错误
- [ ] `npm run tauri build` 零错误
- [ ] DMG 文件 < 10MB
- [ ] 安装后双击可启动
- [ ] 首页正常渲染
- [ ] 对话功能正常

---

## 二、Windows App 发布流程（待实现）

```bash
# 目标环境: GitHub Actions CI/CD 或 Windows 本地构建
# 预期产出: .msi 安装包

# 前置条件:
# - Windows 10/11 构建环境
# - Visual Studio Build Tools 2022
# - Rust toolchain (stable-x86_64-pc-windows-msvc)
# - NSIS (用于生成 MSI)
```

### 检查清单（规划中）
- [ ] Windows 构建环境就绪
- [ ] 跨平台代码兼容性验证
- [ ] MSI 安装包生成
- [ ] 杀软白名单测试
- [ ] Win11 兼容性测试

---

## 三、官网部署流程

```bash
# 官网位置: shaoziclaw-app/website/
# 当前形式: 静态 HTML 单文件 (index.html)

# 部署方式选项:
# A. Vercel/Netlify（免费静态托管）
# B. 云服务器 Nginx
# C. GitHub Pages

# 部署前检查:
# - [ ] Logo 正确显示
# - [ ] 所有链接有效
# - [ ] Skill 市场信息准确
# - [ ] 定价信息正确
# - [ ] 移动端适配正常
```

---

## 四、Skill 推送流程

### 新 Skill 上架
1. 开发/审核 SKILL.md
2. 放入对应 L0/L1/L2/L3 目录
3. 更新 SKILL_INDEX.md
4. 官网 market 板块添加卡片
5. 随版本发布或热更新

### 专家 Skill 上架（付费市场）
1. 专家提供内容 → 内部质检
2. 标价（¥39/¥49/¥59）
3. 官网上架展示
4. 用户购买 → 下载 SKILL.md → 导入 勺子Claw

---

## 五、版本管理规范

| 类型 | 示例 | 说明 |
|------|------|------|
| Major | v2.0.0 | 架构重构/UI重写 |
| Minor | v1.3.0 | 新功能/Skill批量新增 |
| Patch | v1.2.1 | Bug修复/文案调整 |

### 当前版本: v1.2.0

### Changelog 格式
```markdown
## v1.2.0 (2026-04-15)
### 新增
- 首页改为对话页（仿WorkBuddy）
- 专家Skill市场板块
- 通用办公Skill 41个
- 三层记忆系统完整版
### 修复
- Tauri 2.0 配置兼容问题
- macOS Quarantine 启动问题
```

---

*最后更新: 2026-04-15*
