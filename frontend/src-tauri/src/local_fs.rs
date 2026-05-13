// 🦞 local_fs.rs — 龙虾级本地文件系统权限
// v5.3.9: 对标OpenClaw Gateway的Unix用户权限，解锁勺子Claw的本地能力
//
// 核心设计：
// - 绕过Tauri fs插件的scope限制，直接用std::fs操作
// - 所有路径都是绝对路径，不限制访问范围
// - 返回详细的错误信息，便于前端诊断

use serde::{Deserialize, Serialize};
use std::path::Path;

/// 📁 文件/目录信息
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<String>,
}

/// 格式化时间戳为字符串
fn format_time(meta: &std::fs::Metadata) -> Option<String> {
    meta.modified().ok().map(|t| {
        let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
        let secs = dur.as_secs();
        let dt = chrono::DateTime::from_timestamp(secs as i64, 0).unwrap_or_default();
        dt.format("%Y-%m-%d %H:%M").to_string()
    })
}

/// 📖 读取任意文件内容（文本）
#[tauri::command]
pub fn local_read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("读取失败 [{}]: {}", e.kind(), e))
}

/// 📖 读取任意文件内容（二进制转base64）
#[tauri::command]
pub fn local_read_binary_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("读取失败 [{}]: {}", e.kind(), e))?;
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// ✏️ 写入文本到任意文件
#[tauri::command]
pub fn local_write_text_file(path: String, content: String) -> Result<String, String> {
    // 确保父目录存在
    if let Some(parent) = Path::new(&path).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(format!("创建父目录失败: {}", e));
        }
    }

    std::fs::write(&path, &content)
        .map_err(|e| format!("写入失败 [{}]: {}", e.kind(), e))?;

    Ok(path)
}

/// ✏️ 写入二进制到任意文件（接收base64）
#[tauri::command]
pub fn local_write_binary_file(path: String, data_base64: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("base64解码失败: {}", e))?;

    // 确保父目录存在
    if let Some(parent) = Path::new(&path).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(format!("创建父目录失败: {}", e));
        }
    }

    std::fs::write(&path, &bytes)
        .map_err(|e| format!("写入失败 [{}]: {}", e.kind(), e))?;

    Ok(path)
}

/// 📁 列出目录内容
#[tauri::command]
pub fn local_list_directory(path: String) -> Result<Vec<FileInfo>, String> {
    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("读取目录失败 [{}]: {}", e.kind(), e))?;

    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let metadata = entry.metadata().ok();
        let path_buf = entry.path();

        result.push(FileInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path_buf.to_string_lossy().to_string(),
            is_dir: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            modified: metadata.as_ref().and_then(format_time),
        });
    }

    // 排序：目录在前，文件在后，按名称排序
    result.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(result)
}

/// 📁 创建目录
#[tauri::command]
pub fn local_create_directory(path: String) -> Result<String, String> {
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("创建目录失败 [{}]: {}", e.kind(), e))?;
    Ok(path)
}

/// 🗑️ 删除文件或目录
#[tauri::command]
pub fn local_remove(path: String, recursive: Option<bool>) -> Result<String, String> {
    let meta = std::fs::metadata(&path)
        .map_err(|e| format!("获取元数据失败: {}", e))?;

    if meta.is_dir() && recursive.unwrap_or(false) {
        std::fs::remove_dir_all(&path)
            .map_err(|e| format!("删除目录失败 [{}]: {}", e.kind(), e))?;
    } else if meta.is_dir() {
        std::fs::remove_dir(&path)
            .map_err(|e| format!("删除空目录失败 [{}]: {}", e.kind(), e))?;
    } else {
        std::fs::remove_file(&path)
            .map_err(|e| format!("删除文件失败 [{}]: {}", e.kind(), e))?;
    }

    Ok(path)
}

/// 🔍 检查路径是否存在及类型
#[tauri::command]
pub fn local_path_info(path: String) -> Result<FileInfo, String> {
    let meta = std::fs::metadata(&path)
        .map_err(|e| format!("获取元数据失败: {}", e))?;

    Ok(FileInfo {
        name: Path::new(&path).file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone()),
        path,
        is_dir: meta.is_dir(),
        size: meta.len(),
        modified: format_time(&meta),
    })
}

/// 🏠 获取用户主目录
#[tauri::command]
pub fn local_get_home_dir() -> Result<String, String> {
    let home = dirs::home_dir()
        .ok_or("无法获取用户主目录")?;
    Ok(home.to_string_lossy().to_string())
}

/// 📋 获取常用目录路径
#[tauri::command]
pub fn local_get_common_dirs() -> Result<std::collections::HashMap<String, String>, String> {
    let mut dirs = std::collections::HashMap::new();

    if let Some(home) = dirs::home_dir() {
        dirs.insert("home".to_string(), home.to_string_lossy().to_string());
        dirs.insert("desktop".to_string(), home.join("Desktop").to_string_lossy().to_string());
        dirs.insert("documents".to_string(), home.join("Documents").to_string_lossy().to_string());
        dirs.insert("downloads".to_string(), home.join("Downloads").to_string_lossy().to_string());
        dirs.insert("pictures".to_string(), home.join("Pictures").to_string_lossy().to_string());
    }

    Ok(dirs)
}
