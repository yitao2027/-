// ============================================================================
// 勺子Claw v5.5.34 — 用户日志诊断模块 (user_diagnostic)
// ============================================================================
// Task #23: 用户日志诊断系统
//
// 核心功能：
//   ① 用户诊断码：基于 user_id 生成短码（一人一码，6位字母数字）
//   ② 按用户过滤日志：从 claw.log 中提取特定用户的所有日志
//   ③ 日志埋点增强：在 claw_log 中增加 user_id 字段
//   ④ 自动化诊断报告：分析错误模式、频率、时间分布
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::Manager;

// ============================================================================
// 数据结构
// ============================================================================

/// 用户诊断码映射
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserDiagnosticCode {
    pub user_id: String,
    pub diagnostic_code: String,  // 6位短码
    pub created_at: String,
}

/// 日志条目（解析后）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub seq: u64,
    pub module: String,
    pub message: String,
    pub user_id: Option<String>,  // 从消息中提取的 user_id
}

/// 诊断报告
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticReport {
    pub user_id: String,
    pub diagnostic_code: String,
    pub total_logs: usize,
    pub error_count: usize,
    pub warn_count: usize,
    pub info_count: usize,
    pub debug_count: usize,
    pub time_range: (String, String),  // (first_log, last_log)
    pub top_errors: Vec<(String, usize)>,  // (error_msg, count)
    pub top_modules: Vec<(String, usize)>, // (module, count)
    pub error_timeline: Vec<(String, usize)>, // (hour, count)
    pub recent_errors: Vec<LogEntry>,  // 最近10条错误
}

// ============================================================================
// 诊断码生成（基于 user_id 的确定性哈希）
// ============================================================================

/// 生成用户诊断码（6位字母数字，基于 user_id 的 SHA256 哈希）
pub fn generate_diagnostic_code(user_id: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(user_id.as_bytes());
    let result = hasher.finalize();
    
    // 取前3字节，转为 base36（字母+数字）
    let bytes = &result[..3];
    let num = u32::from_be_bytes([0, bytes[0], bytes[1], bytes[2]]);
    
    // base36 编码（0-9, a-z）
    let mut code = String::new();
    let mut n = num;
    let charset = "0123456789abcdefghijklmnopqrstuvwxyz";
    while code.len() < 6 {
        let idx = (n % 36) as usize;
        code.push(charset.chars().nth(idx).unwrap());
        n /= 36;
    }
    
    code.to_uppercase()
}

/// 保存用户诊断码映射
pub fn save_diagnostic_code(data_dir: &Path, user_id: &str) -> Result<String, String> {
    let code = generate_diagnostic_code(user_id);
    let mapping_file = data_dir.join("diagnostic_codes.json");
    
    // 读取现有映射
    let mut mappings: HashMap<String, UserDiagnosticCode> = if mapping_file.exists() {
        let content = fs::read_to_string(&mapping_file)
            .map_err(|e| format!("读取诊断码映射失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        HashMap::new()
    };
    
    // 如果已存在，直接返回
    if let Some(existing) = mappings.get(user_id) {
        return Ok(existing.diagnostic_code.clone());
    }
    
    // 新增映射
    let mapping = UserDiagnosticCode {
        user_id: user_id.to_string(),
        diagnostic_code: code.clone(),
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };
    mappings.insert(user_id.to_string(), mapping);
    
    // 写回文件
    let json = serde_json::to_string_pretty(&mappings)
        .map_err(|e| format!("序列化诊断码映射失败: {}", e))?;
    fs::write(&mapping_file, json)
        .map_err(|e| format!("写入诊断码映射失败: {}", e))?;
    
    Ok(code)
}

/// 根据诊断码查找 user_id
pub fn get_user_id_by_code(data_dir: &Path, code: &str) -> Option<String> {
    let mapping_file = data_dir.join("diagnostic_codes.json");
    if !mapping_file.exists() {
        return None;
    }
    
    let content = fs::read_to_string(&mapping_file).ok()?;
    let mappings: HashMap<String, UserDiagnosticCode> = serde_json::from_str(&content).ok()?;
    
    for (user_id, mapping) in mappings {
        if mapping.diagnostic_code.to_uppercase() == code.to_uppercase() {
            return Some(user_id);
        }
    }
    None
}

// ============================================================================
// 日志解析与过滤
// ============================================================================

/// 解析日志行
/// 格式：[2026-05-17 14:30:25.123] [INFO] [#123] [MODULE] message
fn parse_log_line(line: &str) -> Option<LogEntry> {
    // 正则匹配：[timestamp] [level] [#seq] [module] message
    let parts: Vec<&str> = line.splitn(5, ']').collect();
    if parts.len() < 5 {
        return None;
    }
    
    let timestamp = parts[0].trim_start_matches('[').trim().to_string();
    let level = parts[1].trim_start_matches('[').trim().to_string();
    let seq_str = parts[2].trim_start_matches('[').trim_start_matches('#').trim();
    let seq = seq_str.parse::<u64>().ok()?;
    let module = parts[3].trim_start_matches('[').trim().to_string();
    let message = parts[4].trim().to_string();
    
    // 尝试从 message 中提取 user_id（如果有 "user_id=XXX" 或 "uid=XXX"）
    let user_id = extract_user_id_from_message(&message);
    
    Some(LogEntry {
        timestamp,
        level,
        seq,
        module,
        message,
        user_id,
    })
}

/// 从消息中提取 user_id
fn extract_user_id_from_message(msg: &str) -> Option<String> {
    // 匹配 user_id=XXX 或 uid=XXX
    if let Some(start) = msg.find("user_id=") {
        let rest = &msg[start + 8..];
        let end = rest.find(|c: char| c.is_whitespace() || c == ',' || c == ']' || c == ')').unwrap_or(rest.len());
        return Some(rest[..end].to_string());
    }
    if let Some(start) = msg.find("uid=") {
        let rest = &msg[start + 4..];
        let end = rest.find(|c: char| c.is_whitespace() || c == ',' || c == ']' || c == ')').unwrap_or(rest.len());
        return Some(rest[..end].to_string());
    }
    None
}

/// 读取并过滤日志（按 user_id）
pub fn get_user_logs(log_path: &Path, user_id: &str) -> Result<Vec<LogEntry>, String> {
    if !log_path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(log_path)
        .map_err(|e| format!("读取日志文件失败: {}", e))?;
    
    let mut logs = Vec::new();
    for line in content.lines() {
        if let Some(entry) = parse_log_line(line) {
            // 过滤：user_id 匹配 或 消息中包含 user_id
            if entry.user_id.as_ref() == Some(&user_id.to_string()) 
                || entry.message.contains(user_id) {
                logs.push(entry);
            }
        }
    }
    
    Ok(logs)
}

// ============================================================================
// 自动化诊断分析
// ============================================================================

/// 生成诊断报告
pub fn generate_diagnostic_report(
    data_dir: &Path,
    log_path: &Path,
    user_id: &str,
) -> Result<DiagnosticReport, String> {
    let diagnostic_code = save_diagnostic_code(data_dir, user_id)?;
    let logs = get_user_logs(log_path, user_id)?;
    
    if logs.is_empty() {
        return Ok(DiagnosticReport {
            user_id: user_id.to_string(),
            diagnostic_code,
            total_logs: 0,
            error_count: 0,
            warn_count: 0,
            info_count: 0,
            debug_count: 0,
            time_range: (String::new(), String::new()),
            top_errors: Vec::new(),
            top_modules: Vec::new(),
            error_timeline: Vec::new(),
            recent_errors: Vec::new(),
        });
    }
    
    // 统计各级别日志数量
    let mut error_count = 0;
    let mut warn_count = 0;
    let mut info_count = 0;
    let mut debug_count = 0;
    
    for log in &logs {
        match log.level.as_str() {
            "ERROR" => error_count += 1,
            "WARN" => warn_count += 1,
            "INFO" => info_count += 1,
            "DEBUG" => debug_count += 1,
            _ => {}
        }
    }
    
    // 时间范围
    let time_range = (
        logs.first().map(|l| l.timestamp.clone()).unwrap_or_default(),
        logs.last().map(|l| l.timestamp.clone()).unwrap_or_default(),
    );
    
    // Top 错误（按消息分组统计）
    let mut error_map: HashMap<String, usize> = HashMap::new();
    for log in &logs {
        if log.level == "ERROR" {
            // 截取前100字作为错误标识
            let key: String = log.message.chars().take(100).collect();
            *error_map.entry(key).or_insert(0) += 1;
        }
    }
    let mut top_errors: Vec<(String, usize)> = error_map.into_iter().collect();
    top_errors.sort_by(|a, b| b.1.cmp(&a.1));
    top_errors.truncate(10);
    
    // Top 模块（按模块统计）
    let mut module_map: HashMap<String, usize> = HashMap::new();
    for log in &logs {
        *module_map.entry(log.module.clone()).or_insert(0) += 1;
    }
    let mut top_modules: Vec<(String, usize)> = module_map.into_iter().collect();
    top_modules.sort_by(|a, b| b.1.cmp(&a.1));
    top_modules.truncate(10);
    
    // 错误时间线（按小时统计）
    let mut hour_map: HashMap<String, usize> = HashMap::new();
    for log in &logs {
        if log.level == "ERROR" {
            // 提取小时（格式：2026-05-17 14:30:25.123 → 14）
            if let Some(hour_str) = log.timestamp.split_whitespace().nth(1) {
                if let Some(hour) = hour_str.split(':').next() {
                    *hour_map.entry(hour.to_string()).or_insert(0) += 1;
                }
            }
        }
    }
    let mut error_timeline: Vec<(String, usize)> = hour_map.into_iter().collect();
    error_timeline.sort_by(|a, b| a.0.cmp(&b.0));
    
    // 最近10条错误
    let recent_errors: Vec<LogEntry> = logs.iter()
        .filter(|l| l.level == "ERROR")
        .rev()
        .take(10)
        .cloned()
        .collect();
    
    Ok(DiagnosticReport {
        user_id: user_id.to_string(),
        diagnostic_code,
        total_logs: logs.len(),
        error_count,
        warn_count,
        info_count,
        debug_count,
        time_range,
        top_errors,
        top_modules,
        error_timeline,
        recent_errors,
    })
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// 获取用户诊断码
#[tauri::command]
pub fn get_diagnostic_code(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<String, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    save_diagnostic_code(&data_dir, &user_id)
}

/// 根据诊断码查找用户ID
#[tauri::command]
pub fn find_user_by_code(
    app: tauri::AppHandle,
    code: String,
) -> Option<String> {
    let data_dir = app.path().app_data_dir().ok()?;
    get_user_id_by_code(&data_dir, &code)
}

/// 获取用户日志
#[tauri::command]
pub fn get_user_diagnostic_logs(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<Vec<LogEntry>, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let log_path = data_dir.join("logs").join("claw.log");
    get_user_logs(&log_path, &user_id)
}

/// 生成用户诊断报告
#[tauri::command]
pub fn generate_user_diagnostic_report(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<DiagnosticReport, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let log_path = data_dir.join("logs").join("claw.log");
    generate_diagnostic_report(&data_dir, &log_path, &user_id)
}

/// 根据诊断码生成报告
#[tauri::command]
pub fn generate_report_by_code(
    app: tauri::AppHandle,
    code: String,
) -> Result<DiagnosticReport, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    
    let user_id = get_user_id_by_code(&data_dir, &code)
        .ok_or_else(|| format!("诊断码 {} 未找到对应用户", code))?;
    
    let log_path = data_dir.join("logs").join("claw.log");
    generate_diagnostic_report(&data_dir, &log_path, &user_id)
}
