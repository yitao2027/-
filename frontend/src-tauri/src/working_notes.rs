// ============================================================================
// 勺子Claw v5.1.3 — 工作笔记MD模块
// ============================================================================
// 自动将AI回复中的有价值内容保存为本地MD文件
// 下次对话时自动检索最近笔记并注入到系统提示中
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 笔记元数据（前端列表展示用）
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteInfo {
    pub filename: String,
    pub title: String,
    pub created_at: String,   // ISO时间戳
    pub size_bytes: u64,
    pub preview: String,      // 前200字预览
}

/// 笔记目录名
const NOTES_DIR: &str = "notes";

// ============================================================================
// 保存工作笔记
// ============================================================================

pub fn save_note(
    app_data_dir: &std::path::Path,
    title: &str,
    content: &str,
) -> Result<String, String> {
    let notes_dir = app_data_dir.join(NOTES_DIR);
    fs::create_dir_all(&notes_dir)
        .map_err(|e| format!("创建笔记目录失败: {}", e))?;

    // 生成文件名：时间戳-标题摘要.md
    let now = chrono::Local::now();
    let timestamp = now.format("%Y%m%d-%H%M").to_string();
    let slug = title
        .chars()
        .take(30)
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    let slug = if slug.is_empty() { "笔记".to_string() } else { slug };
    let filename = format!("{}-{}.md", timestamp, slug);

    // 构造完整Markdown内容
    let full_content = format!(
        "# {}\n\n> 生成时间：{}\n> 由 勺子Claw 自动生成\n\n---\n\n{}",
        title,
        now.format("%Y-%m-%d %H:%M:%S"),
        content
    );

    let file_path = notes_dir.join(&filename);
    fs::write(&file_path, full_content)
        .map_err(|e| format!("写入笔记失败: {}", e))?;

    let full_path = file_path.to_string_lossy().to_string();
    println!("📝 工作笔记已保存: {}", full_path);
    Ok(full_path)
}

// ============================================================================
// 获取最近笔记列表
// ============================================================================

pub fn get_recent_notes(
    app_data_dir: &std::path::Path,
    limit: usize,
) -> Vec<NoteInfo> {
    let notes_dir = app_data_dir.join(NOTES_DIR);
    if !notes_dir.exists() {
        return Vec::new();
    }

    let mut entries: Vec<(PathBuf, fs::Metadata)> = match fs::read_dir(&notes_dir) {
        Ok(dir) => dir
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .ends_with(".md")
            })
            .filter_map(|e| {
                let meta = e.metadata().ok()?;
                Some((e.path(), meta))
            })
            .collect(),
        Err(_) => return Vec::new(),
    };

    // 按修改时间降序排列
    entries.sort_by(|a, b| {
        b.1.modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .cmp(
                &a.1.modified()
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
            )
    });

    entries
        .into_iter()
        .take(limit)
        .filter_map(|(path, meta)| {
            let content = fs::read_to_string(&path).ok()?;

            // 提取标题（第一个 # 行）
            let title = content
                .lines()
                .find(|l| l.starts_with("# "))
                .map(|l| l.trim_start_matches("# ").to_string())
                .unwrap_or_else(|| {
                    path.file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                });

            // 提取预览（跳过元数据行后的正文前200字）
            let preview_lines: Vec<&str> = content
                .lines()
                .skip_while(|l| l.starts_with('#') || l.starts_with('>') || l.starts_with("---") || l.trim().is_empty())
                .collect();
            let preview = preview_lines.join(" ");
            // 🔧 v5.5.7→v5.5.8: 使用char边界安全截断，修复"byte index not char boundary"的panic
            // 旧代码 `preview[..200]` 在UTF-8多字节字符（如中文"下"占3字节）的中间切割会panic
            let preview_chars: String = preview.chars().take(200).collect();
            let preview = if preview.chars().count() > 200 {
                format!("{}...", preview_chars)
            } else {
                preview
            };

            let created_at = meta
                .modified()
                .ok()
                .and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|d| {
                            let secs = d.as_secs();
                            // 简单ISO格式
                            let dt = chrono::DateTime::from_timestamp(secs as i64, 0)
                                .unwrap_or_default();
                            dt.format("%Y-%m-%dT%H:%M:%S").to_string()
                        })
                })
                .unwrap_or_default();

            Some(NoteInfo {
                filename: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                title,
                created_at,
                size_bytes: meta.len(),
                preview,
            })
        })
        .collect()
}

// ============================================================================
// 获取最近笔记内容（注入系统提示用）
// ============================================================================

pub fn get_notes_context(
    app_data_dir: &std::path::Path,
    max_notes: usize,
) -> Option<String> {
    let notes = get_recent_notes(app_data_dir, max_notes);
    if notes.is_empty() {
        return None;
    }

    let mut ctx = String::from("\n\n## 📝 最近的工作笔记（由勺子Claw自动保存）\n\n");
    ctx.push_str("以下是之前对话中自动保存的笔记摘要，可能对当前问题有参考价值：\n\n");

    for (i, note) in notes.iter().enumerate() {
        ctx.push_str(&format!(
            "### 笔记{}：{}\n**时间**：{}\n**预览**：{}\n\n",
            i + 1,
            note.title,
            note.created_at,
            note.preview,
        ));
    }

    ctx.push_str("---\n**提示**：如果这些笔记与当前问题相关，请自然地引用其中的内容。\n");

    Some(ctx)
}
