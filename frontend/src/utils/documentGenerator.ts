/**
 * documentGenerator.ts — 文档生成工具
 *
 * 支持将 AI 回复（markdown）一键导出为 Word / PPT / PDF / HTML / Excel
 *
 * 架构：前端 JS 库生成 → Tauri dialog 选保存路径 → Tauri fs 写入
 * 依赖：docx, pptxgenjs, jspdf, xlsx + @tauri-apps/plugin-dialog + @tauri-apps/plugin-fs
 */

import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
  HeadingLevel as DocxHeadingLevel,
  AlignmentType as DocxAlignment,
  Packer as DocxPacker,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType as DocxWidthType,
  BorderStyle as DocxBorderStyle,
} from 'docx';
import PptxGenJS from 'pptxgenjs';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// ============================================================
// Markdown 解析器 — 将 markdown 拆解为结构化块
// ============================================================

interface MdBlock {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'list' | 'ordered-list' | 'code' | 'quote' | 'hr' | 'table';
  content: string;
  lang?: string;       // code block language
  rows?: string[][];   // table rows
  items?: string[];    // list items
}

function parseMarkdown(md: string): MdBlock[] {
  if (!md) return [];
  const blocks: MdBlock[] = [];
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行跳过
    if (line.trim() === '') { i++; continue; }

    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', content: codeLines.join('\n'), lang });
      i++; // skip closing ```
      continue;
    }

    // 标题
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4).trim() });
      i++; continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.slice(3).trim() });
      i++; continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', content: line.slice(2).trim() });
      i++; continue;
    }

    // 分隔线
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr', content: '' });
      i++; continue;
    }

    // 引用块
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push({ type: 'quote', content: quoteLines.join('\n') });
      continue;
    }

    // 无序列表
    if (/^[\s]*[·•\-●○◦*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[·•\-●○◦*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[·•\-●○◦*]\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'list', content: '', items });
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ordered-list', content: '', items });
      continue;
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())) {
      const rows: string[][] = [];
      // header row
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean);
      rows.push(headerCells);
      i++; // skip separator
      i++;
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length > 0) rows.push(cells);
        i++;
      }
      if (rows.length >= 2) {
        blocks.push({ type: 'table', content: '', rows });
      }
      continue;
    }

    // 普通段落
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' &&
      !lines[i].startsWith('#') && !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') && !lines[i].startsWith('---') &&
      !/^[\s]*[·•\-●○◦*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return blocks;
}

// 去除 markdown 格式标记，返回纯文本
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/\*\*(.+?)\*\*/g, '$1') // 加粗
    .replace(/\*(.+?)\*/g, '$1') // 斜体
    .replace(/`([^`]+)`/g, '$1') // 行内代码
    .replace(/^#{1,3}\s+/gm, '') // 标题
    .replace(/^>\s+/gm, '') // 引用
    .replace(/^[-*]\s+/gm, '') // 无序列表
    .replace(/^\d+\.\s+/gm, '') // 有序列表
    .replace(/\n{2,}/g, '\n') // 多余空行
    .trim();
}

// ============================================================
// 导出为 Word (.docx)
// ============================================================

export async function exportToDocx(title: string, markdown: string): Promise<string | null> {
  try {
    const blocks = parseMarkdown(markdown);

    const children: DocxParagraph[] = [];

    // 文档标题
    children.push(
      new DocxParagraph({
        heading: DocxHeadingLevel.TITLE,
        alignment: DocxAlignment.CENTER,
        spacing: { after: 400 },
        children: [
          new DocxTextRun({
            text: title || '勺子Claw 文档',
            bold: true,
            size: 44,
            font: 'Microsoft YaHei',
            color: '1A7D4E',
          }),
        ],
      })
    );

    // 生成时间
    children.push(
      new DocxParagraph({
        alignment: DocxAlignment.CENTER,
        spacing: { after: 600 },
        children: [
          new DocxTextRun({
            text: `生成时间：${new Date().toLocaleString('zh-CN')}`,
            size: 20,
            color: '999999',
            font: 'Microsoft YaHei',
          }),
        ],
      })
    );

    for (const block of blocks) {
      switch (block.type) {
        case 'h1':
          children.push(
            new DocxParagraph({
              heading: DocxHeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
              children: [
                new DocxTextRun({ text: block.content, bold: true, size: 32, font: 'Microsoft YaHei', color: '1a1a1a' }),
              ],
            })
          );
          break;

        case 'h2':
          children.push(
            new DocxParagraph({
              heading: DocxHeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
              children: [
                new DocxTextRun({ text: block.content, bold: true, size: 28, font: 'Microsoft YaHei', color: '1a1a1a' }),
              ],
            })
          );
          break;

        case 'h3':
          children.push(
            new DocxParagraph({
              heading: DocxHeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
              children: [
                new DocxTextRun({ text: block.content, bold: true, size: 24, font: 'Microsoft YaHei', color: '1a1a1a' }),
              ],
            })
          );
          break;

        case 'paragraph': {
          // 处理加粗和斜体
          const parts = block.content.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
          const runs = parts.map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return new DocxTextRun({ text: part.slice(2, -2), bold: true, size: 22, font: 'Microsoft YaHei' });
            }
            if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
              return new DocxTextRun({ text: part.slice(1, -1), italics: true, size: 22, font: 'Microsoft YaHei' });
            }
            return new DocxTextRun({ text: part, size: 22, font: 'Microsoft YaHei' });
          });
          children.push(
            new DocxParagraph({ spacing: { after: 120 }, children: runs })
          );
          break;
        }

        case 'list':
          for (const item of block.items || []) {
            children.push(
              new DocxParagraph({
                bullet: { level: 0 },
                spacing: { after: 60 },
                children: [
                  new DocxTextRun({ text: item, size: 22, font: 'Microsoft YaHei' }),
                ],
              })
            );
          }
          break;

        case 'ordered-list':
          for (let idx = 0; idx < (block.items || []).length; idx++) {
            children.push(
              new DocxParagraph({
                numbering: { reference: 'default-numbering', level: 0 },
                spacing: { after: 60 },
                children: [
                  new DocxTextRun({ text: block.items![idx], size: 22, font: 'Microsoft YaHei' }),
                ],
              })
            );
          }
          break;

        case 'code':
          children.push(
            new DocxParagraph({
              spacing: { before: 100, after: 100 },
              shading: { fill: 'F5F5F5' },
              indent: { left: 400 },
              children: [
                new DocxTextRun({ text: block.content, font: 'Consolas', size: 18, color: '333333' }),
              ],
            })
          );
          break;

        case 'quote':
          children.push(
            new DocxParagraph({
              spacing: { before: 100, after: 100 },
              indent: { left: 600 },
              border: { left: { style: DocxBorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 10 } },
              children: [
                new DocxTextRun({ text: block.content, italics: true, size: 20, color: '666666', font: 'Microsoft YaHei' }),
              ],
            })
          );
          break;

        case 'hr':
          children.push(
            new DocxParagraph({
              spacing: { before: 200, after: 200 },
              border: { bottom: { style: DocxBorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 } },
              children: [],
            })
          );
          break;

        case 'table':
          if (block.rows && block.rows.length > 0) {
            const tableRows = block.rows.map((cells, rowIdx) => {
              return new DocxTableRow({
                children: cells.map(cell => {
                  return new DocxTableCell({
                    width: { size: Math.floor(9000 / cells.length), type: DocxWidthType.DXA },
                    children: [
                      new DocxParagraph({
                        children: [
                          new DocxTextRun({
                            text: cell,
                            bold: rowIdx === 0,
                            size: rowIdx === 0 ? 22 : 20,
                            font: 'Microsoft YaHei',
                            color: '333333',
                          }),
                        ],
                      }),
                    ],
                    shading: rowIdx === 0 ? { fill: '57CC86' } : rowIdx % 2 === 0 ? { fill: 'F8F9FA' } : undefined,
                  });
                }),
              });
            });
            children.push(
              new DocxParagraph({
                children: [],
                spacing: { before: 100 },
              })
            );
            // docx Table 需要直接添加，不能用 Paragraph 包装
            // 简化处理：跳过复杂表格，用文本替代
            const tableText = block.rows.map(r => r.join(' | ')).join('\n');
            children.push(
              new DocxParagraph({
                spacing: { after: 120 },
                children: [
                  new DocxTextRun({ text: tableText, size: 18, font: 'Consolas', color: '555555' }),
                ],
              })
            );
          }
          break;
      }
    }

    // 页脚
    children.push(
      new DocxParagraph({
        spacing: { before: 600 },
        alignment: DocxAlignment.CENTER,
        children: [
          new DocxTextRun({ text: '由 勺子Claw 生成', size: 16, color: 'AAAAAA', font: 'Microsoft YaHei' }),
        ],
      })
    );

    const doc = new DocxDocument({
      numbering: {
        config: [{
          reference: 'default-numbering',
          levels: [{ level: 0, format: 'decimal' as any, text: '%1.', alignment: DocxAlignment.START }],
        }],
      },
      sections: [{ children }],
    });

    // 🔧 v5.3.3: 增加详细日志诊断导出失败原因
    console.log(`[DocxExport] 开始导出, title=${title}, blocks=${blocks.length}`);
    const base64 = await DocxPacker.toBase64String(doc);
    console.log(`[DocxExport] Packer返回base64: ${base64 ? base64.length + '字符' : 'NULL'}`);
    if (!base64 || base64.length < 10) {
      throw new Error('DocxPacker.toBase64String返回空内容，可能doc数据构建失败');
    }
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    console.log(`[DocxExport] 生成 ${bytes.length} 字节，调用 saveFile...`);
    return await saveFile(bytes, title, '.docx');
  } catch (err) {
    console.error('[DocumentGenerator] DOCX export error:', err);
    throw err; // 抛出给handleExport显示toast
  }
}

// ============================================================
// 导出为 PPT (.pptx)
// ============================================================

export async function exportToPptx(title: string, markdown: string): Promise<string | null> {
  try {
    const blocks = parseMarkdown(markdown);
    const pptx = new PptxGenJS();

    pptx.author = '勺子Claw';
    pptx.title = title || '勺子Claw 演示';
    pptx.layout = 'LAYOUT_16x9';

    // 封面页
    const coverSlide = pptx.addSlide();
    coverSlide.background = { fill: '1A7D4E' };
    coverSlide.addText(title || '勺子Claw 文档', {
      x: 1, y: 1.5, w: 8, h: 2,
      fontSize: 36, fontFace: 'Microsoft YaHei',
      color: 'FFFFFF', bold: true, align: 'center',
    });
    coverSlide.addText(new Date().toLocaleString('zh-CN'), {
      x: 1, y: 3.8, w: 8, h: 0.8,
      fontSize: 14, fontFace: 'Microsoft YaHei',
      color: 'AADDCC', align: 'center',
    });
    coverSlide.addText('由 勺子Claw 生成', {
      x: 1, y: 4.6, w: 8, h: 0.6,
      fontSize: 12, fontFace: 'Microsoft YaHei',
      color: '88BBAA', align: 'center',
    });

    // 内容页
    let currentItems: { text: string; isBold: boolean; level: number }[] = [];
    let currentTitle = '';

    function flushSlide() {
      if (currentItems.length === 0 && !currentTitle) return;
      const slide = pptx.addSlide();
      slide.background = { fill: 'FFFFFF' };

      // 标题栏
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.8,
        fill: { color: '1A7D4E' },
      });
      slide.addText(currentTitle || title, {
        x: 0.5, y: 0.1, w: 8.5, h: 0.6,
        fontSize: 22, fontFace: 'Microsoft YaHei',
        color: 'FFFFFF', bold: true,
      });

      // 内容
      const contentRows = currentItems.map(item => ({
        text: item.text,
        options: {
          fontSize: item.isBold ? 18 : 16,
          fontFace: 'Microsoft YaHei',
          color: '333333',
          bold: item.isBold,
          bullet: item.isBold ? false : { code: '2022' as any },
          indentLevel: item.level,
          breakLine: true,
        },
      }));

      slide.addText(contentRows, {
        x: 0.6, y: 1.0, w: 8.4, h: 4.5,
        valign: 'top',
        lineSpacingMultiple: 1.3,
      });

      // 页脚
      slide.addText('勺子Claw', {
        x: 7.5, y: 5.0, w: 2, h: 0.3,
        fontSize: 8, color: 'CCCCCC', fontFace: 'Microsoft YaHei',
        align: 'right',
      });
    }

    for (const block of blocks) {
      switch (block.type) {
        case 'h1':
          // h1 作为新幻灯片标题
          if (currentItems.length > 0) flushSlide();
          currentTitle = block.content;
          currentItems = [];
          break;

        case 'h2':
          // h2 也作为新幻灯片标题
          if (currentItems.length > 0) flushSlide();
          currentTitle = block.content;
          currentItems = [];
          break;

        case 'h3':
          // h3 作为小标题
          currentItems.push({ text: block.content, isBold: true, level: 0 });
          break;

        case 'paragraph':
          currentItems.push({ text: block.content, isBold: false, level: 0 });
          break;

        case 'list':
          for (const item of block.items || []) {
            currentItems.push({ text: item, isBold: false, level: 0 });
          }
          break;

        case 'ordered-list':
          for (const item of block.items || []) {
            currentItems.push({ text: item, isBold: false, level: 0 });
          }
          break;

        case 'table':
          if (block.rows && block.rows.length > 0) {
            // 表格作为新幻灯片
            if (currentItems.length > 0) flushSlide();
            currentTitle = currentTitle || '表格';
            const slide = pptx.addSlide();
            slide.background = { fill: 'FFFFFF' };
            slide.addShape(pptx.ShapeType.rect, {
              x: 0, y: 0, w: '100%', h: 0.8,
              fill: { color: '1A7D4E' },
            });
            slide.addText(currentTitle, {
              x: 0.5, y: 0.1, w: 8.5, h: 0.6,
              fontSize: 22, fontFace: 'Microsoft YaHei',
              color: 'FFFFFF', bold: true,
            });

            const headerRow = block.rows[0];
            const dataRows = block.rows.slice(1);
            slide.addTable(
              [
                headerRow.map(h => ({
                  text: h,
                  options: { bold: true, color: 'FFFFFF', fill: { color: '1A7D4E' }, fontSize: 12, fontFace: 'Microsoft YaHei', align: 'center' },
                })),
                ...dataRows.map(row => row.map(cell => ({
                  text: cell,
                  options: { fontSize: 11, fontFace: 'Microsoft YaHei', color: '333333', fill: { color: 'F8F9FA' } },
                }))),
              ],
              {
                x: 0.6, y: 1.2, w: 8.4,
                border: { type: 'solid', pt: 0.5, color: 'DDDDDD' },
                colW: Array(headerRow.length).fill(8.4 / headerRow.length),
                rowH: 0.5,
              }
            );
            currentItems = [];
          }
          break;

        case 'quote':
          currentItems.push({ text: `💡 ${block.content}`, isBold: false, level: 0 });
          break;

        case 'hr':
          // 忽略分隔线
          break;

        case 'code':
          currentItems.push({ text: `[代码块: ${block.lang || 'text'}]`, isBold: false, level: 0 });
          break;
      }

      // 每页不超过8个条目，自动翻页
      if (currentItems.length >= 8) {
        flushSlide();
        currentItems = [];
      }
    }

    // 最后一张
    flushSlide();

    // 🔧 v5.2.2: 优先 arraybuffer，降级 base64
    let pptxBytes: Uint8Array;
    try {
      const ab = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
      pptxBytes = new Uint8Array(ab);
    } catch {
      const b64 = await pptx.write({ outputType: 'base64' }) as string;
      const bin = atob(b64);
      pptxBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) pptxBytes[i] = bin.charCodeAt(i);
    }
    return await saveFile(pptxBytes, title, '.pptx');
  } catch (err) {
    console.error('[DocumentGenerator] PPTX export error:', err);
    throw err;
  }
}

// ============================================================
// 导出为 PDF (.pdf) — 通过HTML打印方案支持完整中文
// ============================================================

export async function exportToPdf(title: string, markdown: string): Promise<string | null> {
  try {
    const blocks = parseMarkdown(markdown);
    const now = new Date().toLocaleString('zh-CN');

    function blocksToHtml(blks: MdBlock[]): string {
      return blks.map(block => {
        switch (block.type) {
          case 'h1': return `<h1>${block.content}</h1>`;
          case 'h2': return `<h2>${block.content}</h2>`;
          case 'h3': return `<h3>${block.content}</h3>`;
          case 'paragraph': return `<p>${block.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')}</p>`;
          case 'list': return `<ul>${(block.items || []).map(i => `<li>${i}</li>`).join('')}</ul>`;
          case 'ordered-list': return `<ol>${(block.items || []).map(i => `<li>${i}</li>`).join('')}</ol>`;
          case 'code': return `<pre><code>${block.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`;
          case 'quote': return `<blockquote>${block.content}</blockquote>`;
          case 'table': {
            if (!block.rows || block.rows.length === 0) return '';
            const hdr = block.rows[0].map(c => `<th>${c}</th>`).join('');
            const body = block.rows.slice(1).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
            return `<table><thead><tr>${hdr}</tr></thead><tbody>${body}</tbody></table>`;
          }
          default: return '';
        }
      }).join('\n');
    }

    const contentHtml = blocksToHtml(blocks);
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif; color: #333; line-height: 1.8; font-size: 14px; }
  .cover { text-align: center; padding-bottom: 24px; border-bottom: 2px solid #57CC86; margin-bottom: 24px; }
  .cover h1 { font-size: 26px; color: #1A7D4E; margin-bottom: 8px; }
  .cover .meta { font-size: 12px; color: #999; }
  .cover .brand { font-size: 11px; color: #bbb; margin-top: 6px; }
  h1 { font-size: 20px; color: #1a1a1a; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
  h2 { font-size: 17px; color: #1a1a1a; margin: 20px 0 10px; }
  h3 { font-size: 15px; color: #1a1a1a; margin: 16px 0 8px; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0 8px 20px; }
  li { margin: 3px 0; }
  strong { color: #1a1a1a; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; margin: 12px 0; }
  blockquote { border-left: 4px solid #57CC86; background: #f8faf8; padding: 10px 14px; margin: 12px 0; color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #1A7D4E; color: #fff; padding: 8px 12px; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  tbody tr:nth-child(even) { background: #f8f9fa; }
  .footer { text-align: center; padding-top: 20px; margin-top: 24px; border-top: 1px solid #eee; font-size: 11px; color: #bbb; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
<div class="cover"><h1>${title || '勺子Claw 文档'}</h1><div class="meta">${now}</div><div class="brand">由 勺子Claw 生成</div></div>
<div class="content">${contentHtml}</div>
<div class="footer">由 勺子Claw 生成</div>
</body></html>`;

    // 打开新窗口打印为PDF（系统打印对话框会提供"保存为PDF"选项）
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      // 等待渲染完成后自动调起打印
      printWin.onload = () => {
        setTimeout(() => { printWin.print(); }, 300);
      };
      return '[已通过系统打印对话框保存为PDF]';
    } else {
      // 如果弹窗被阻止，fallback到jsPDF纯文本方案
      console.warn('[DocumentGenerator] Print window blocked, falling back to jsPDF');
      const plainText = stripMarkdown(markdown);
      const pdfDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdfDoc.internal.pageSize.getWidth();
      const ph = pdfDoc.internal.pageSize.getHeight();
      let y = 20;
      pdfDoc.setFontSize(20);
      pdfDoc.text(title || 'ShaoziClaw', pw / 2, y, { align: 'center' });
      y += 15;
      const lines = pdfDoc.splitTextToSize(plainText, pw - 40);
      pdfDoc.setFontSize(11);
      for (const line of lines) {
        if (y > ph - 20) { pdfDoc.addPage(); y = 20; }
        pdfDoc.text(line, 20, y);
        y += 5;
      }
      const buffer = pdfDoc.output('arraybuffer');
      return await saveFile(new Uint8Array(buffer), title, '.pdf');
    }
  } catch (err) {
    console.error('[DocumentGenerator] PDF export error:', err);
    throw err;
  }
}

// ============================================================
// 导出为 Excel (.xlsx) — v5.1.2 新增
// ============================================================

export async function exportToXlsx(title: string, markdown: string): Promise<string | null> {
  try {
    const blocks = parseMarkdown(markdown);

    // 创建工作簿
    const wb = XLSX.utils.book_new();

    // 默认工作表：收集所有标题和内容
    const defaultData: string[][] = [];
    defaultData.push([title || '勺子Claw 文档']);
    defaultData.push([`生成时间：${new Date().toLocaleString('zh-CN')}`]);
    defaultData.push([]);

    for (const block of blocks) {
      switch (block.type) {
        case 'h1':
          defaultData.push([`【${block.content}】`]);
          break;
        case 'h2':
          defaultData.push([`▸ ${block.content}`]);
          break;
        case 'h3':
          defaultData.push([`  ▪ ${block.content}`]);
          break;
        case 'paragraph':
          defaultData.push([block.content]);
          break;
        case 'list':
        case 'ordered-list':
          (block.items || []).forEach((item, i) => {
            const prefix = block.type === 'ordered-list' ? `${i + 1}.` : '•';
            defaultData.push([`${prefix} ${item}`]);
          });
          break;
        case 'code':
          defaultData.push([`[代码] ${block.lang || ''}`]);
          defaultData.push([block.content]);
          break;
        case 'table':
          if (block.rows && block.rows.length > 0) {
            // 表格内容作为独立工作表
            const sheetName = `${block.rows[0]?.join(' ')}`.substring(0, 28) || '表格';
            const ws = XLSX.utils.aoa_to_sheet(block.rows);
            wb.SheetNames.push(sheetName);
            wb.Sheets[sheetName] = ws;
          }
          break;
        case 'quote':
          defaultData.push([`[引用] ${block.content}`]);
          break;
        default:
          if (block.content) defaultData.push([block.content]);
      }
    }

    // 默认工作表
    const ws = XLSX.utils.aoa_to_sheet(defaultData);
    // 设置列宽
    ws['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, '内容概要');

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return await saveFile(new Uint8Array(buffer), title, '.xlsx');
  } catch (err) {
    console.error('[DocumentGenerator] XLSX export error:', err);
    throw err;
  }
}

// ============================================================
// 通用保存函数 — 弹出保存对话框并写入文件
// 返回保存路径字符串，null表示用户取消，异常抛出错误
// ============================================================

async function saveFile(data: Uint8Array, title: string, ext: string): Promise<string | null> {
  console.log(`[DocumentGenerator] saveFile called: ext=${ext}, dataLen=${data.length}`);

  const fileName = `${title || '勺子Claw文档'}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}${ext}`;

  let filePath: string | null = null;
  try {
    filePath = await save({
      title: `保存${ext.toUpperCase().slice(1)}文件`,
      defaultPath: fileName,
      filters: [{ name: `${ext.toUpperCase().slice(1)} Files`, extensions: [ext.slice(1)] }],
    });
  } catch (dialogErr: any) {
    console.error('[DocumentGenerator] save dialog error:', dialogErr);
    throw new Error(`保存对话框异常: ${dialogErr?.message || dialogErr}`);
  }

  if (!filePath) {
    console.log('[DocumentGenerator] User cancelled save dialog');
    return null; // 用户取消
  }

  console.log(`[DocumentGenerator] Save path: ${filePath}, writing ${data.length} bytes via Rust...`);
  let writtenPath: string | null = null;
  try {
    // 🔧 v5.3.6: 用base64传数据(避免IPC传巨大JSON数组)
    const { invoke } = await import('@tauri-apps/api/core');
    // Uint8Array → base64
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const dataBase64 = btoa(binary);
    console.log(`[DocumentGenerator] base64长度=${dataBase64.length}, 调用save_file_to_disk...`);
    invoke('log_frontend', { level: 'INFO', module: 'DocExport', msg: `保存路径: ${filePath}, base64: ${dataBase64.length}` }).catch(() => {});
    writtenPath = await invoke<string>('save_file_to_disk', {
      path: filePath,
      dataBase64: dataBase64,
    });
    console.log(`[DocumentGenerator] ✅ Rust写入成功: ${writtenPath}`);
  } catch (writeErr: any) {
    console.error('[DocumentGenerator] Rust writeFile error:', writeErr);
    // 🔧 v5.3.10: 提供更详细的错误信息，包含可能的权限/沙盒提示
    const errStr = String(writeErr?.message || writeErr || '未知错误');
    if (errStr.includes('Permission') || errStr.includes('denied') || errStr.includes('权限')) {
      throw new Error(`写入文件失败(权限不足): ${errStr}\n建议：尝试保存到 Desktop 或其他目录。`);
    }
    throw new Error(`写入文件失败: ${errStr}`);
  }

  // 返回Rust实际写入的路径（可能是fallback后的路径）
  return writtenPath || filePath;
}

// ============================================================
// 导出为 HTML (.html)
// ============================================================

export async function exportToHtml(title: string, markdown: string): Promise<string | null> {
  try {
    const blocks = parseMarkdown(markdown);
    const now = new Date().toLocaleString('zh-CN');

    // 将 MdBlock 转为 HTML
    function blocksToHtml(blks: MdBlock[]): string {
      return blks.map(block => {
        switch (block.type) {
          case 'h1':
            return `<h1>${inlineMarkdown(block.content)}</h1>`;
          case 'h2':
            return `<h2>${inlineMarkdown(block.content)}</h2>`;
          case 'h3':
            return `<h3>${inlineMarkdown(block.content)}</h3>`;
          case 'paragraph':
            return `<p>${inlineMarkdown(block.content)}</p>`;
          case 'list':
            return `<ul>${(block.items || []).map(i => `<li>${inlineMarkdown(i)}</li>`).join('')}</ul>`;
          case 'ordered-list':
            return `<ol>${(block.items || []).map(i => `<li>${inlineMarkdown(i)}</li>`).join('')}</ol>`;
          case 'code': {
            const escaped = block.content
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            const langLabel = block.lang ? `<span class="code-lang">${block.lang}</span>` : '';
            return `<div class="code-block">${langLabel}<pre><code>${escaped}</code></pre></div>`;
          }
          case 'quote':
            return `<blockquote>${inlineMarkdown(block.content)}</blockquote>`;
          case 'hr':
            return `<hr>`;
          case 'table': {
            if (!block.rows || block.rows.length === 0) return '';
            const headerCells = block.rows[0].map(c => `<th>${inlineMarkdown(c)}</th>`).join('');
            const bodyRows = block.rows.slice(1).map(row =>
              `<tr>${row.map(c => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`
            ).join('');
            return `<div class="table-wrap"><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
          }
          default:
            return '';
        }
      }).join('\n');
    }

    // 行内 markdown 转换（加粗、斜体、行内代码）
    function inlineMarkdown(text: string): string {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/```([^`]+)```/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    const contentHtml = blocksToHtml(blocks);

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${inlineMarkdown(title || '勺子Claw 文档')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
      color: #333; line-height: 1.75; background: #FAFBFC;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 48px 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }

    /* 封面 */
    .cover { text-align: center; padding-bottom: 32px; border-bottom: 2px solid #57CC86; margin-bottom: 32px; }
    .cover h1 { font-size: 28px; color: #1A7D4E; margin-bottom: 12px; }
    .cover .meta { font-size: 13px; color: #999; }
    .cover .brand { font-size: 12px; color: #bbb; margin-top: 8px; }

    /* 内容 */
    h1 { font-size: 22px; color: #1a1a1a; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
    h2 { font-size: 19px; color: #1a1a1a; margin: 28px 0 14px; }
    h3 { font-size: 16px; color: #1a1a1a; margin: 22px 0 10px; }
    p { margin: 10px 0; font-size: 15px; }
    ul, ol { margin: 10px 0 10px 24px; }
    li { margin: 4px 0; font-size: 15px; }
    strong { color: #1a1a1a; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #e83e8c; font-family: 'SFMono-Regular', Consolas, monospace; }

    /* 代码块 */
    .code-block {
      background: #1e1e1e; border-radius: 8px; margin: 16px 0; overflow: hidden;
    }
    .code-lang {
      display: inline-block; background: #2d2d2d; color: #888; font-size: 12px;
      padding: 4px 12px 2px; border-radius: 8px 8px 0 0;
    }
    .code-block pre { padding: 16px 20px; margin: 0; overflow-x: auto; }
    .code-block code { background: none; color: #d4d4d4; padding: 0; font-size: 13px; }

    /* 引用 */
    blockquote {
      border-left: 4px solid #57CC86; background: #f8faf8; padding: 12px 16px;
      margin: 16px 0; border-radius: 0 8px 8px 0; color: #555; font-style: italic;
    }

    /* 表格 */
    .table-wrap { overflow-x: auto; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #1A7D4E; color: #fff; padding: 10px 14px; text-align: left; font-weight: 600; }
    td { padding: 10px 14px; border-bottom: 1px solid #eee; }
    tbody tr:nth-child(even) { background: #f8f9fa; }
    tbody tr:hover { background: #f0f7f2; }

    /* 分隔线 */
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }

    /* 页脚 */
    .footer { text-align: center; padding-top: 24px; margin-top: 32px; border-top: 1px solid #eee; font-size: 12px; color: #bbb; }

    /* 打印优化 */
    @media print {
      body { background: #fff; padding: 0; }
      .container { box-shadow: none; padding: 0; max-width: 100%; border-radius: 0; }
      .cover h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="cover">
      <h1>${inlineMarkdown(title || '勺子Claw 文档')}</h1>
      <div class="meta">${now}</div>
      <div class="brand">由 勺子Claw 生成</div>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">由 勺子Claw 生成</div>
  </div>
</body>
</html>`;

    const encoder = new TextEncoder();
    return await saveFile(encoder.encode(html), title, '.html');
  } catch (err) {
    console.error('[DocumentGenerator] HTML export error:', err);
    throw err;
  }
}
