// 🔒🔒🔒 v5.5.34 B100修复：本文件已废弃，勿恢复！
// 
// 安全漏洞：邀请码硬编码在前端 → 任何人都能通过开发者工具获取
// 修复方案：邀请码迁移至后端 invite_store.rs（编译期嵌入二进制 + JSON持久化）
// 
// 前端不再持有邀请码列表，改为调用后端 Tauri command 验证：
//   - verify_invite_code_cmd(code) → 检查有效性 + 使用状态
//   - redeem_invite_code_cmd(code, email) → 注册时标记已使用
// 
// ⚠️ 如果你看到这个文件被 import，说明代码回退了！立即检查：
//   - LoginScreen.tsx 是否恢复了 import { VALID_INVITE_CODES } from './INVITE_CODES'
//   - 如果是，立即删除该 import，改为调用后端 command
// 
// 🔴 此文件保留仅为防止编译报错，内容已清空。

// 导出空数组和正则（防止旧代码引用时报错）
export const VALID_INVITE_CODES: string[] = [];
export const INVITE_CODE_COUNT = 0;
export const INVITE_CODE_PATTERN = /^[23456789A-HJ-NP-Z]{11}$/;
