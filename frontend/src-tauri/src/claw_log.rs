// 勺子Claw 日志系统 v5.2.1
// 统一日志格式：[时间] [级别] [模块] 消息
// 写入路径：{app_data}/logs/claw.log，自动轮转（>1MB备份）

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::Local;

static LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
static LOG_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// 初始化日志系统，设置日志目录
pub fn init_log(data_dir: &PathBuf) {
    let log_dir = data_dir.join("logs");
    let _ = fs::create_dir_all(&log_dir);
    if let Ok(mut path) = LOG_PATH.lock() {
        *path = Some(log_dir.join("claw.log"));
    }
    log_info("LOG", "日志系统初始化完成");
}

pub fn log_info(module: &str, msg: &str) { write_log("INFO", module, msg); }
pub fn log_warn(module: &str, msg: &str) { write_log("WARN", module, msg); }
pub fn log_error(module: &str, msg: &str) { write_log("ERROR", module, msg); }
pub fn log_debug(module: &str, msg: &str) { write_log("DEBUG", module, msg); }

fn write_log(level: &str, module: &str, msg: &str) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let seq = LOG_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let line = format!("[{}] [{}] [#{}] [{}] {}\n", timestamp, level, seq, module, msg);

    // 也输出到stdout方便 cargo tauri dev 查看
    print!("{}", line);

    if let Ok(guard) = LOG_PATH.lock() {
        if let Some(ref log_path) = *guard {
            // 检查文件大小，超过1MB则备份
            if let Ok(meta) = fs::metadata(log_path) {
                if meta.len() > 1_000_000 {
                    let backup = log_path.with_extension("log.bak");
                    let _ = fs::rename(log_path, &backup);
                }
            }
            if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path) {
                let _ = f.write_all(line.as_bytes());
                let _ = f.flush();
            }
        }
    }
}

/// 前端可通过此命令写入日志
#[tauri::command]
pub fn log_frontend(level: String, module: String, msg: String) -> Result<(), String> {
    match level.to_uppercase().as_str() {
        "ERROR" => log_error(&module, &msg),
        "WARN" => log_warn(&module, &msg),
        "DEBUG" => log_debug(&module, &msg),
        _ => log_info(&module, &msg),
    }
    Ok(())
}

/// 获取最近N条日志（用于调试面板）
#[tauri::command]
pub fn get_recent_logs(n: usize) -> Result<Vec<String>, String> {
    let guard = LOG_PATH.lock().map_err(|e| e.to_string())?;
    if let Some(ref log_path) = *guard {
        if let Ok(content) = fs::read_to_string(log_path) {
            let lines: Vec<String> = content.lines().rev().take(n).map(|s| s.to_string()).collect();
            return Ok(lines.into_iter().rev().collect());
        }
    }
    Ok(vec![])
}

/// 获取日志文件路径
#[tauri::command]
pub fn get_log_path() -> Result<String, String> {
    let guard = LOG_PATH.lock().map_err(|e| e.to_string())?;
    if let Some(ref log_path) = *guard {
        Ok(log_path.to_string_lossy().to_string())
    } else {
        Err("日志系统未初始化".to_string())
    }
}
