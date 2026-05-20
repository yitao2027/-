import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore, type UploadedFile } from '../store';
import { Upload, X, Image, FileText, Presentation, File } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// 配置 PDF.js worker（使用 CDN）
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface Props {
  onFileAdded?: (file: UploadedFile) => void;
}

// 判断文件类型
function getFileType(name: string): UploadedFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx', 'txt', 'xls', 'xlsx'].includes(ext)) return 'document';
  return 'other';
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// 每个文件类型的图标
const FileTypeIcon = ({ type, size = 16 }: { type: UploadedFile['type']; size?: number }) => {
  const iconProps = { size, strokeWidth: 1.8 };
  switch (type) {
    case 'image': return <Image {...iconProps} style={{ color: '#059669' }} />;
    case 'pdf': return <FileText {...iconProps} style={{ color: '#DC2626' }} />;
    case 'ppt': return <Presentation {...iconProps} style={{ color: '#EA580C' }} />;
    case 'document': return <FileText {...iconProps} style={{ color: '#2563EB' }} />;
    default: return <File {...iconProps} style={{ color: '#6B7280' }} />;
  }
};

export default function FileUploader({ onFileAdded }: Props) {
  const { uploadedFiles, addUploadedFile, removeUploadedFile } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭面板
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  // 打开面板时计算按钮位置（智能定位：避免被遮挡）
  const openPanel = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelHeight = 360; // 预估面板高度
      const panelWidth = 320;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;

      // 计算水平位置：面板左边缘对齐按钮左边缘，但确保不超出右边界
      let left = rect.left;
      if (left + panelWidth > viewportWidth - 16) {
        left = viewportWidth - panelWidth - 16;
      }
      if (left < 16) left = 16;

      if (spaceAbove > spaceBelow && spaceAbove > panelHeight) {
        // 向上弹出：面板底部在按钮上方8px
        setPanelPos({
          bottom: viewportHeight - rect.top + 8,
          left,
        });
      } else {
        // 向下弹出：面板顶部在按钮下方8px
        setPanelPos({
          top: rect.bottom + 8,
          left,
        });
      }
    }
    setShowPanel(true);
  };

  const processFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) {
      console.warn('[FileUploader] 文件列表为空');
      return;
    }

    // 🔧 v5.5.39: 100MB 文件大小限制
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const oversizedFiles = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      const names = oversizedFiles.map(f => `"${f.name}"(${(f.size/1024/1024).toFixed(1)}MB)`).join('、');
      alert(`以下文件超过100MB大小限制，无法上传：\n${names}\n请压缩或拆分文件后重试。`);
      // 过滤掉超大文件，继续处理其余文件
      const validFiles = Array.from(files).filter(f => f.size <= MAX_FILE_SIZE);
      if (validFiles.length === 0) return;
      // 用 DataTransfer 构造新的 FileList（兼容处理）
      const dt = new DataTransfer();
      validFiles.forEach(f => dt.items.add(f));
      files = dt.files;
    }

    const newFiles: UploadedFile[] = [];
    let processedCount = 0;
    const totalCount = files.length;

    console.log(`[FileUploader] 开始处理 ${totalCount} 个文件`);

    Array.from(files).forEach(async (file, index) => {
      try {
        const fileType = getFileType(file.name);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        // 🔧 v5.3.2: 静态import JSZip替代动态import（Tauri WebView中动态import可能失败）
        if (ext === 'docx') {
          let content = '';
          let parseError = '';
          try {
            console.log(`[FileUploader] 解析DOCX[${index + 1}/${totalCount}]: ${file.name}`);
            const arrayBuffer = await file.arrayBuffer();
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(arrayBuffer);
            // 尝试多种路径读取文本
            let docXml = zip.file('word/document.xml');
            if (!docXml) docXml = zip.file('word/document2.xml'); // 某些模板用这个
            if (docXml) {
              const xmlText = await docXml.async('text');
              const matches = xmlText.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
              if (matches) {
                content = matches
                  .map(m => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
                  .join('');
              }
            }
            if (!content) {
              content = `[Word文档: ${file.name}]`;
            }
            console.log(`[FileUploader] DOCX解析成功[${file.name}]: ${content.length} 字符`);
          } catch (e: any) {
            parseError = e?.message || String(e);
            console.warn(`[FileUploader] DOCX解析失败[${file.name}]: ${parseError}`);
            content = `[Word文档: ${file.name}]\n⚠️ 解析失败: ${parseError}`;
          }
          const fileData: UploadedFile = {
            id: fileId, name: file.name, type: 'docx', size: file.size,
            content: content || `[Word文档: ${file.name}]\n（解析失败: ${parseError || '未知错误'}）`,
            uploadedAt: new Date(),
          };
          addUploadedFile(fileData);
          newFiles.push(fileData);
          onFileAdded?.(fileData);
          processedCount++;
          return;
        }

        // 🔧 图片文件：多级压缩策略（避免4MB+原图导致504超时）
        // ⚠️ Tauri webview中 new Image() 可能静默hang（无论blob URL还是dataURL）
        //    策略：createImageBitmap(现代API,不依赖URL) → Image+dataURL → 原图兜底
        if (fileType === 'image') {
          console.log(`[FileUploader] 处理图片[${index + 1}/${totalCount}]: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);

          // ═══ Level 1: createImageBitmap API（现代方案，不依赖URL加载）═══
          let compressedDataUrl: string | null = null;
          const MAX_DIM = 1536;

          if (typeof createImageBitmap !== 'undefined') {
            try {
              console.log(`[FileUploader] 尝试Level1: createImageBitmap...`);
              const bitmap = await Promise.race([
                createImageBitmap(file),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('BMP_TIMEOUT')), 8000))
              ]);
              const w = bitmap.width, h = bitmap.height;
              let dw = w, dh = h;
              if (w > MAX_DIM || h > MAX_DIM) {
                if (w > h) { dh = Math.round(h * MAX_DIM / w); dw = MAX_DIM; }
                else { dw = Math.round(w * MAX_DIM / h); dh = MAX_DIM; }
              }
              const canvas = document.createElement('canvas');
              canvas.width = dw; canvas.height = dh;
              canvas.getContext('2d')!.drawImage(bitmap, 0, 0, dw, dh);
              bitmap.close();
              compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
              console.log(`[FileUploader] ✅ Level1成功: createImageBitmap`);
            } catch (bmpErr) {
              console.warn(`[FileUploader] Level1失败:`, bmpErr instanceof Error ? bmpErr.message : bmpErr);
            }
          }

          // ═══ Level 2: FileReader dataURL → new Image()（传统方案）═══
          if (!compressedDataUrl) {
            try {
              console.log(`[FileUploader] 尝试Level2: Image+dataURL...`);
              const rawDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                const timer = setTimeout(() => reject(new Error('FR_TIMEOUT')), 8000);
                reader.onload = (e) => { clearTimeout(timer); resolve(e.target?.result as string); };
                reader.onerror = () => { clearTimeout(timer); reject(new Error('FR_ERROR')); };
                reader.readAsDataURL(file);
              });

              compressedDataUrl = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                let settled = false;
                const TIMEOUT_MS = 8000; // Level2给更长时间
                const timer = setTimeout(() => {
                  if (!settled) { settled = true; reject(new Error('IMG_TIMEOUT')); }
                }, TIMEOUT_MS);

                img.onload = () => {
                  if (settled) return;
                  settled = true; clearTimeout(timer);
                  try {
                    let w = img.width, h = img.height;
                    if (w > MAX_DIM || h > MAX_DIM) {
                      if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
                      else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
                    }
                    const c = document.createElement('canvas');
                    c.width = w; c.height = h;
                    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
                    resolve(c.toDataURL('image/jpeg', 0.82));
                  } catch (canvasErr) {
                    reject(new Error('CANVAS_ERR'));
                  }
                };
                img.onerror = () => {
                  if (settled) return;
                  settled = true; clearTimeout(timer);
                  reject(new Error('IMG_ERR'));
                };
                img.src = rawDataUrl;
              });
              console.log(`[FileUploader] ✅ Level2成功: Image+dataURL`);
            } catch (level2Err) {
              console.warn(`[FileUploader] Level2失败:`, level2Err instanceof Error ? level2Err.message : level2Err);
              compressedDataUrl = null;
            }
          }

          // ═══ 最终：使用最佳结果或原图兜底 ═══
          if (compressedDataUrl) {
            // 压缩成功路径 ✅
            const compressedSize = Math.round((compressedDataUrl.length - 22) * 3 / 4);
            console.log(`[图片压缩✅] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (${Math.round(100 * compressedSize / file.size)}%)`);
            const fileData: UploadedFile = {
              id: fileId, name: file.name, type: fileType,
              size: compressedSize, dataUrl: compressedDataUrl, uploadedAt: new Date(),
            };
            addUploadedFile(fileData);
            newFiles.push(fileData);
            onFileAdded?.(fileData);
          } else {
            // 🔄 全部压缩策略失败 → 使用原始dataURL（最后手段）
            console.warn(`[图片压缩❌] ${file.name}: 所有压缩方式均失败，使用原图(${(file.size / 1024).toFixed(0)}KB)，可能导致超时`);
            await new Promise<void>((res) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const fallbackData: UploadedFile = {
                  id: fileId, name: file.name, type: fileType,
                  size: file.size, dataUrl: e.target?.result as string, uploadedAt: new Date(),
                };
                addUploadedFile(fallbackData);
                newFiles.push(fallbackData);
                onFileAdded?.(fallbackData);
                res();
              };
              reader.onerror = () => { console.error(`[FileUploader] 兜底也失败: ${file.name}`); res(); };
              reader.readAsDataURL(file);
            });
          }
          processedCount++;
          return;
        }

        // 🔧 PDF 文件：用 pdfjs-dist 提取文本
        if (ext === 'pdf') {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const textParts: string[] = [];
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              textParts.push(pageText);
            }
            const fullText = textParts.join('\n');
            const fileData: UploadedFile = {
              id: fileId,
              name: file.name,
              type: 'pdf',
              size: file.size,
              content: fullText || `[PDF文件: ${file.name}]\n（文件可能为扫描件，无法提取文字）`,
              uploadedAt: new Date(),
            };
            addUploadedFile(fileData);
            newFiles.push(fileData);
          } catch {
            const fileData: UploadedFile = {
              id: fileId,
              name: file.name,
              type: 'pdf',
              size: file.size,
              content: `[PDF文件: ${file.name}]\n（解析失败，仅提供文件名）`,
              uploadedAt: new Date(),
            };
            addUploadedFile(fileData);
            newFiles.push(fileData);
          }
          processedCount++;
          return;
        }

        // 🔧 Excel 文件：用 SheetJS 解析为表格文本
        if (ext === 'xlsx' || ext === 'xls') {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const sheetsText: string[] = [];
            workbook.SheetNames.forEach(sheetName => {
              const sheet = workbook.Sheets[sheetName];
              const csvText = XLSX.utils.sheet_to_csv(sheet);
              sheetsText.push(`[工作表: ${sheetName}]\n${csvText}`);
            });
            const fullText = sheetsText.join('\n\n');
            const fileData: UploadedFile = {
              id: fileId,
              name: file.name,
              type: 'document',
              size: file.size,
              content: fullText || `[Excel文件: ${file.name}]`,
              uploadedAt: new Date(),
            };
            addUploadedFile(fileData);
            newFiles.push(fileData);
          } catch {
            const fileData: UploadedFile = {
              id: fileId,
              name: file.name,
              type: 'document',
              size: file.size,
              content: `[Excel文件: ${file.name}]\n（解析失败，仅提供文件名）`,
              uploadedAt: new Date(),
            };
            addUploadedFile(fileData);
            newFiles.push(fileData);
          }
          processedCount++;
          return;
        }

        // 🔧 DOC/PPT/其他二进制文件：仅记录文件名，不尝试解码二进制内容
        if (['doc', 'ppt', 'pptx'].includes(ext)) {
          const extLabel = { doc: 'Word', ppt: 'PPT', pptx: 'PPT' }[ext] || '文档';
          const fileData: UploadedFile = {
            id: fileId,
            name: file.name,
            type: fileType,
            size: file.size,
            content: `[${extLabel}文件: ${file.name}]\n（暂不支持内容提取，请转换为docx/pdf格式上传）`,
            uploadedAt: new Date(),
          };
          addUploadedFile(fileData);
          newFiles.push(fileData);
          processedCount++;
          return;
        }

        // 其他非docx/非图片文件用 FileReader 读取（TXT等纯文本）
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileData: UploadedFile = {
            id: fileId,
            name: file.name,
            type: fileType,
            size: file.size,
            dataUrl: e.target?.result as string,
            uploadedAt: new Date(),
          };
          addUploadedFile(fileData);
          newFiles.push(fileData);
          onFileAdded?.(fileData);
          processedCount++;
        };
        reader.onerror = () => {
          console.error(`[FileUploader] FileReader读取失败: ${file.name}`);
          processedCount++;
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error(`[FileUploader] 文件处理异常: ${file.name}`, err);
        processedCount++;
      }
    });

    // 上传完成后：关闭面板
    setTimeout(() => {
      setShowPanel(false);
      console.log(`[FileUploader] 面板已关闭，共处理 ${processedCount}/${totalCount} 个文件`);
    }, 500);
  }, [addUploadedFile, onFileAdded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        ref={buttonRef}
        className="p-2 rounded-lg transition-all"
        style={{ color: '#6B7280', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={openPanel}
        title="上传文件"
      >
        <Upload size={18} strokeWidth={1.8} />
      </button>

      {/* 文件面板 — Portal渲染到body，避免被Sidebar遮挡 */}
      {showPanel && createPortal(
        <div
          ref={panelRef}
          className="rounded-xl shadow-2xl"
          style={{
            position: 'fixed',
            ...panelPos,
            width: 320,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            zIndex: 9999,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {/* 拖拽区域 */}
          <div
            className="m-3 p-4 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer"
            style={{
              borderColor: isDragging ? '#57CC86' : '#E5E7EB',
              background: isDragging ? '#FFF9E6' : '#F9FAFB',
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload
              size={24}
              strokeWidth={1.5}
              style={{ color: isDragging ? '#57CC86' : '#9CA3AF', margin: '0 auto' }}
            />
            <p className="text-sm font-medium mt-2" style={{ color: isDragging ? '#1A7D4E' : '#374151' }}>
              {isDragging ? '松开以上传' : '拖拽文件到这里'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
              支持：图片 · PDF · Word · PPT · Excel（最大100MB）
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            className="hidden"
            onChange={e => processFiles(e.target.files)}
          />

          {/* 文件列表 */}
          {uploadedFiles.length > 0 && (
            <div className="border-t px-3 py-2" style={{ borderColor: '#E5E7EB', maxHeight: '200px', overflowY: 'auto' }}>
              <p className="text-xs font-medium mb-2" style={{ color: '#6B7280' }}>
                本次对话已上传 {uploadedFiles.length} 个文件
              </p>
              {uploadedFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                  style={{ background: '#F9FAFB' }}
                >
                  <FileTypeIcon type={file.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: '#374151' }}>{file.name}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{formatSize(file.size)}</p>
                  </div>
                  {file.type === 'image' && file.dataUrl && (
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <button
                    className="p-1 rounded"
                    style={{ color: '#9CA3AF' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                    onClick={() => removeUploadedFile(file.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                className="w-full text-center text-xs py-1.5 mt-1 rounded-lg"
                style={{ color: '#9CA3AF', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => uploadedFiles.forEach(f => removeUploadedFile(f.id))}
              >
                清空全部
              </button>
            </div>
          )}
        </div>
      , document.body)}

      {/* 点击外部关闭已改用useEffect监听document mousedown */}
    </div>
  );
}
