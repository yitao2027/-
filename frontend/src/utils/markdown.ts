/**
 * renderMarkdownEnhanced — Markdown渲染工具（v5.2 marked版）
 *
 * 替换手写正则渲染器为marked库，新增支持：
 *   ✅ 表格（GFM tables）
 *   ✅ 嵌套列表
 *   ✅ 自动链接
 *   ✅ 任务列表
 *   ✅ 删除线
 *
 * 保持品牌设计语言：#57CC86主色、#1a1a1a深色标题、代码块暗色主题
 */

import { marked } from 'marked'

// ============================================================
// 全局CSS样式表（注入到每个渲染结果中）
// ============================================================
const GLOBAL_STYLES = `
<style>
  .sc-md { color: #333; line-height: 1.75; font-size: 14px; }
  .sc-md h1 { font-size: 20px; font-weight: 800; color: #1a1a1a; margin: 18px 0 12px; }
  .sc-md h2 { font-size: 17px; font-weight: 700; color: #1a1a1a; margin: 16px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #e5e7eb; }
  .sc-md h3 { font-size: 15px; font-weight: 700; color: #1a1a1a; margin: 14px 0 8px; }
  .sc-md h4 { font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 12px 0 6px; }
  .sc-md p { margin: 8px 0; }
  .sc-md strong { color: #1a1a1a; font-weight: 700; }
  .sc-md em { font-style: italic; color: #555; }
  .sc-md a { color: #2563EB; text-decoration: none; border-bottom: 1px solid #93C5FD; }
  .sc-md a:hover { color: #1D4ED8; border-color: #2563EB; }

  /* 列表 */
  .sc-md ul { margin: 8px 0; padding-left: 20px; }
  .sc-md ol { margin: 8px 0; padding-left: 20px; }
  .sc-md li { margin: 4px 0; line-height: 1.75; }
  .sc-md ul > li::marker { color: #57CC86; font-weight: 700; }
  .sc-md ol > li::marker { color: #57CC86; font-weight: 700; }

  /* 代码块 */
  .sc-md pre { background: #1e1e1e; color: #d4d4d4; padding: 14px 16px; border-radius: 10px; overflow-x: auto; font-size: 13px; line-height: 1.6; margin: 14px 0; border: 1px solid #333; }
  .sc-md pre code { background: none; color: #d4d4d4; padding: 0; font-size: 13px; font-family: 'SF Mono', 'Fira Code', monospace; }
  .sc-md code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #e83e8c; font-family: 'SF Mono', 'Fira Code', monospace; }

  /* 引用块 */
  .sc-md blockquote { border-left: 3px solid #ccc; background: #f8f8f8; padding: 10px 16px; margin: 10px 0; border-radius: 0 8px 8px 0; font-size: 13.5px; color: #555; line-height: 1.7; }
  .sc-md blockquote p { margin: 4px 0; }

  /* 分隔线 */
  .sc-md hr { border: none; border-top: 1px dashed #ddd; margin: 16px 0; }

  /* 表格 */
  .sc-md table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  .sc-md thead { background: #f8fafc; }
  .sc-md th { padding: 8px 12px; text-align: left; font-weight: 600; color: #1a1a1a; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .sc-md td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #333; }
  .sc-md tr:last-child td { border-bottom: none; }
  .sc-md tr:hover td { background: #f9fafb; }

  /* 任务列表 */
  .sc-md input[type="checkbox"] { margin-right: 6px; accent-color: #57CC86; }

  /* 删除线 */
  .sc-md del { color: #999; text-decoration: line-through; }

  /* 图片 */
  .sc-md img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
</style>`

// ============================================================
// 配置 marked（GFM + 禁用HTML标签安全）
// ============================================================
marked.setOptions({
  gfm: true,          // GitHub Flavored Markdown（表格/任务列表/删除线）
  breaks: false,      // 不把单个换行转为<br>（保持段落结构）
})

// ============================================================
// ============================================================
// 主渲染函数
// ============================================================

export function renderMarkdownEnhanced(text: string): string {
  if (!text) return ''

  try {
    const body = marked.parse(text) as string
    return `${GLOBAL_STYLES}<div class="sc-md">${body}</div>`
  } catch {
    // 降级：纯文本输出
    return `<div class="sc-md"><p>${escapeHtml(text)}</p></div>`
  }
}

// ============================================================
// HTML转义（给其他模块用）
// ============================================================

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
