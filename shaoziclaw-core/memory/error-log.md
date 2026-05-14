# 勺子Claw 错误日志

> 每次出错必须记录。不记 = 下次还犯。

---

## 格式

```
### [日期时间] 错误类型
- **上下文**: 在做什么时出错
- **现象**: 具体报错信息
- **根因**: 为什么出错（不是现象）
- **修复**: 怎么修好的
- **教训**: 以后怎么避免
```

---

## 已知错误记录

### 2026-04-12 Tauri 2.0 配置崩溃
- **上下文**: App v1.1 升级后无法启动，exit code 101
- **现象**: 反序列化 tauri.conf.json 时 panic
- **根因**: 使用了 Tauri 1.x 的 `plugins.shell.scope` 和 `plugins.fs.scope` 字段，Tauri 2.0 不支持
- **修复**: 移除 scope 配置，shell 改用 `open: true`，移除整个 fs plugins 段
- **教训**: ⚠️ Tauri 2.0 的 plugin 配置格式完全不同于 1.x，改配置前必须查官方文档

### 2026-04-12 macOS Quarantine 问题
- **上下文**: 自编译的 .app 双击打不开
- **现象**: 无任何反应，进程未启动
- **根因**: macOS Gatekeeper 对非签名 App 设置了 quarantine 属性
- **修复**: `xattr -cr "/Applications/勺子Claw.app"`
- **教训**: ⚠️ 每次 `npx tauri build` 后都要执行 xattr -cr 清理隔离属性

### 2026-04-10 TS 编译类型错误
- **上下文**: 重写 App.tsx / ExpertCenter.tsx / ChatArea.tsx 后 npm run build 报错
- **现象**: 多个 TypeScript 类型不匹配（Props 类型、事件处理函数签名等）
- **根因**: 快速重构时未严格匹配组件 Props 接口定义
- **修复**: 逐个组件检查 Props interface，统一类型签名
- **教训**: ⚠️ React 组件间传参时，必须先确认接收方的 Props 定义再传
