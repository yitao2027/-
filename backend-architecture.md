# 勺子Claw 后端架构方案

**版本：** v1.0 | **日期：** 2026-04-26 | **状态：** 建议稿，待确认

---

## 一、核心需求

| 需求 | 说明 |
|------|------|
| 登录入口 | 用户注册/登录，支持微信/邮箱 |
| 权限系统 | 管理员 vs 普通用户，内测码管理 |
| Skill热更新 | 后端上传 SKILL.md，App 实时拉取，无需发版 |
| 版本管理 | DMG/EXE 版本检测 + 差量更新 |
| 下载服务 | OSS 存储安装包，CDN 加速分发 |

---

## 二、推荐架构（最小成本方案）

### 基础设施（阿里云方案B，稳健型）

| 组件 | 规格 | 用途 |
|------|------|------|
| **ECS** | 2核4G + 5M带宽 | 后端服务 + 管理后台 |
| **RDS MySQL** | 基础版，2GB存储 | 用户数据、Skill版本、兑换码 |
| **OSS** | 标准存储 | 安装包/Skill文件/图片存储 |
| **CDN** | 全球节点 | 安装包下载加速 |

**预估月成本：约 300-500元**（比 Vercel Pro 便宜，且数据自主）

---

### 后端技术栈

```
Node.js 20 + Express + TypeScript
├── RESTful API（供 App 调用）
├── JWT 认证（无状态）
├── MySQL（Sequelize ORM）
└── OSS SDK（文件上传/下载）
```

**为什么不用其他方案：**
- 不用 Java/Python：团队已有 Node.js 经验，开发最快
- 不用 PHP：维护性差，不支持 TypeScript
- 不用 BaaS（LeanCloud/Parse）：长期成本高，数据不自主

---

### 前端管理后台

```
React 19 + Vite + Ant Design
├── 用户管理（列表/封禁/权限）
├── Skill 管理（上传/编辑/版本/分类）
├── 兑换码管理（生成/作废/批量）
├── 版本管理（上传 DMG/EXE，版本记录）
└── 数据看板（DAU/MAU/下载量）
```

**部署在 ECS 上**，用一个二级域名 `admin.shaoziclaw.com`

---

## 三、数据库设计（核心表）

```
users
├── id, uuid
├── email
├── phone (微信unionid)
├── password_hash
├── role (admin/user)
├── invite_code
├── created_at
└── last_login

skills
├── id
├── name (技能名称)
├── category (L1/L2/L3)
├── version (语义版本)
├── file_path (OSS路径)
├── changelog
├── created_by (admin uuid)
├── created_at
└── published (boolean)

exchange_codes
├── id
├── code (唯一兑换码)
├── used (boolean)
├── used_by (user uuid)
├── created_at
└── expires_at

app_versions
├── id
├── platform (mac/windows)
├── version (1.2.3)
├── min_version (强制更新下限)
├── file_path (OSS路径)
├── file_size
├── changelog
└── published_at
```

---

## 四、App 端 API（热更新核心）

### 1. 检查更新
```
GET /api/v1/app/check-update?platform=mac&current_version=4.4.0
Response: {
  "has_update": true,
  "latest_version": "4.4.1",
  "download_url": "https://cdn.shaoziclaw.com/ShaoziClaw-v4.4.1-macOS.dmg",
  "force_update": false
}
```

### 2. 获取 Skills 列表
```
GET /api/v1/skills?category=L2&page=1&limit=20
Response: {
  "skills": [{ id, name, category, version, description }],
  "total": 261,
  "has_more": true
}
```

### 3. 下载单个 Skill（增量更新）
```
GET /api/v1/skills/:id/download
Response: 返回 SKILL.md 文件内容 + references 压缩包
```

### 4. 全量同步（首次安装/重置）
```
GET /api/v1/skills/sync?since_version=0
Response: 返回全部 SKILL.md 列表 + 增量包下载地址
```

---

## 五、热更新机制（最关键）

### 工作流
```
后端上传 SKILL.md
    ↓
管理员发布（设置版本号）
    ↓
App 启动时调用 /api/skills/check-updates
    ↓
返回有更新的 Skills 列表
    ↓
App 按需下载差量内容
    ↓
写入本地 skills/ 目录
    ↓
Skill 立即可用
```

### 版本控制策略
- 每个 Skill 有 `version` 字段（语义化版本 v1.0.0）
- App 记录本地 Skills 的 `version`
- 每次只拉取 `local_version < server_version` 的 Skills
- **无需发版**：新 Skill 或 Skill 迭代，用户重启 App 即生效

### Skill 包结构
```
skills/
  L1-menu-pricing/
    SKILL.md
    references/
      菜单定价手册.pdf
      竞品菜单分析.xlsx
  L2-waimai-operation/
    SKILL.md
    ...
```

---

## 六、安全设计

| 风险 | 防护 |
|------|------|
| 管理员后台被爆破 | JWT + 强密码 + 登录IP限制 |
| App 被破解绕过兑换码 | 兑换码验证在服务端，App 无强验证逻辑 |
| Skill 文件被篡改 | OSS 文件 HTTPS + 文件 hash 校验 |
| 内测码泄露 | 码一次性使用，绑定用户ID |
| 恶意注册 | 邮箱验证 + 兑换码白名单机制 |

---

## 七、实施计划

### Phase 1：基础设施（1天）
- [ ] 购买阿里云 ECS + RDS + OSS
- [ ] 域名解析（api.shaoziclaw.com / admin.shaoziclaw.com）
- [ ] SSL 证书（Let's Encrypt 免费）

### Phase 2：后端核心（3天）
- [ ] 项目脚手架（Node.js + TypeScript + Express）
- [ ] 数据库建表 + Sequelize 模型
- [ ] 用户认证（注册/登录/JWT）
- [ ] 兑换码管理 API
- [ ] Skill CRUD API
- [ ] 版本管理 API

### Phase 3：管理后台（3天）
- [ ] React + Vite + Ant Design 搭建
- [ ] 用户管理页面
- [ ] Skill 上传/编辑/发布页面
- [ ] 兑换码生成页面
- [ ] 版本发布页面

### Phase 4：App 对接（2天）
- [ ] App 端接入更新检测 API
- [ ] Skill 增量下载逻辑
- [ ] 内测码激活流程对接

### Phase 5：部署上线（1天）
- [ ] PM2 部署后端
- [ ] Nginx 配置
- [ ] CDN 绑定
- [ ] 数据迁移测试

**总工期：约 10 个工作日**

---

## 八、需要你确认的问题

1. **内测策略**：先开放注册还是保持兑换码机制？
2. **用户数据**：微信登录（需要公众号）还是先用邮箱？
3. **Skill 来源**：Skill 由谁来上传？你自己还是宋宣那边？
4. **预算确认**：阿里云这套方案，300-500/月可以接受吗？
5. **Windows EXE**：v4.4.0 Windows 版本需要我先构建吗？
