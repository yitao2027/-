# 勺子Claw 账号系统配置

> 产品相关的所有账号、密钥、服务配置集中管理。

---

## API 配置

### AI 模型服务

```yaml
# 主模型（待配置真实 Key）
primary_provider: "待定"
primary_model: "待定"
api_key: "待用户配置"
base_url: "待定"

# 备用模型
fallback_providers: []
```

### 配置方式

用户首次启动 勺子Claw 时需在设置页面填入 API Key：
- 支持 OpenAI 兼容接口
- 支持国内大模型（通义/智谱/DeepSeek 等）
- Key 加密存储在本地

---

## 第三方服务

| 服务 | 用途 | 状态 |
|------|------|------|
| 图片生成 Seedream | 配图生成 | ⚠️ 需腾讯云Key |
| 视频生成 Seedance | 视频素材 | ⚠️ 需腾讯云Key |
| 新榜 newrank.cn | 热点数据 | 🔑 需账号登录 |

---

## 本地工具路径

| 工具 | 路径 | 用途 |
|------|------|------|
| Node.js | ~/.workbuddy/binaries/node/versions/22.12.0/bin/node | 前端构建 |
| Python3 | /usr/bin/python3 | 脚本执行 |
| FFmpeg | ~/bin/ffmpeg | 音视频处理 |
| yt-dlp | node_modules/.bin/yt-dlp | B站视频下载 |
| Whisper | ~/.workbuddy/bili2text/ | 语音转文字 |

---

## 文件存储路径

```
勺子Claw 数据目录:
~/shaoziclaw-data/                    # 用户运行时数据（独立于安装目录）
├── conversations/                  # 对话历史
├── user-skills/                    # 用户下载的Skill（含市场购买的）
├── user-memory/                    # 用户个人记忆
├── config.json                     # 用户配置（API Key等）
└── logs/                           # 运行日志

勺子Claw 安装目录:
/Applications/勺子Claw.app/         # macOS
C:\\Program Files\\勺子Claw\\       # Windows
```

---

*最后更新: 2026-04-15*
