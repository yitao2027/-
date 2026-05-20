# B100 修复任务清单

- [ ] **Task 1**: 创建 `invite_store.rs` — 邀请码后端存储模块（含500个码的编译期嵌入 + JSON文件持久化 + 使用状态追踪）
- [ ] **Task 2**: 修改 `auth.rs` — 对接 `invite_store`，重构 `verify_invite_code` 和 `register` 函数
- [ ] **Task 3**: 修改 `main.rs` — 注册 `invite_store` 模块和新的 Tauri commands
- [ ] **Task 4**: 修改 `LoginScreen.tsx` — 移除前端明文邀请码import，改为调用后端command验证
- [ ] **Task 5**: 验证编译 — `cargo check` + `tsc --noEmit` 零错误
