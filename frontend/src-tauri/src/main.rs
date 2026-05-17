// ShaoziClaw 勺子Claw - 餐饮AI专家助手
// Tauri 2.0 后端核心

mod ai_engine;
mod auth;
mod invite_store; // 🔒 v5.5.34 B100修复：邀请码后端存储（一码一用，前端不暴露）
mod skill_manager;
mod subscription;
mod tools;
mod user_store;
mod learning; // 🧠 学习闭环模块
mod web_tools; // 🌐 网络工具模块（热榜/搜索/抓取/浏览器）
mod firecrawl_opinion; // 🔥 Firecrawl舆情采集模块（内置APIKey，已充值3000积分）
mod scheduler; // ⏰ 定时任务调度器（v4.7.0新增）

// 🛑 v5.3.2: 全局停止标志 — 模块级static，所有函数共享同一个AtomicBool
static ABORT_FLAG: std::sync::OnceLock<std::sync::Arc<std::sync::atomic::AtomicBool>> = std::sync::OnceLock::new();
fn get_abort_flag() -> std::sync::Arc<std::sync::atomic::AtomicBool> {
    ABORT_FLAG.get_or_init(|| std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false))).clone()
}
mod baidu_map; // 🗺️ 百度地图代理工具（v4.9.3新增）
mod rag_engine; // 📚 RAG知识库引擎（v5.1新增）
mod cross_session_memory; // 🧠 跨会话记忆模块（v5.1.1新增）
mod working_notes; // 📝 工作笔记MD模块（v5.1.3新增）
mod memory_compressor; // 🧠 记忆压缩模块（v5.2新增）
mod behavior_tracker; // 📊 行为模式追踪模块（v5.2新增）
mod knowledge_evolution; // 🌱 知识演进模块（v5.2新增）
mod claw_log; // 📋 统一日志系统（v5.2.1新增）
mod local_fs; // 🦞 v5.3.9: 龙虾级本地文件系统权限
mod resource_unpacker; // 📦 v5.5.19: 安装包资源解包器（知识库随包打包）
mod oss_uploader; // ☁️ v5.5.24: 阿里云OSS图片上传（B095图生图）; v5.5.31: validate改非阻塞

pub use firecrawl_opinion::{firecrawl_status, firecrawl_search, firecrawl_scrape, firecrawl_deep};
// ⏰ 定时任务 Commands
pub use scheduler::{
    create_scheduled_task, list_scheduled_tasks, update_scheduled_task,
    delete_scheduled_task, toggle_scheduled_task, run_scheduled_task_now,
    get_active_task_count,
};

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::{ipc::Channel, Manager, Emitter};

#[derive(Debug, Serialize, Clone, Default)]
pub struct AppState {
    pub is_authenticated: bool,
    pub current_user: Option<UserInfo>,
    pub subscription: Option<SubscriptionInfo>,
    // 🧠 学习闭环状态（运行时初始化）
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscriptionInfo {
    pub plan: String,        // "free" | "pro" | "enterprise"
    pub status: String,      // "active" | "expired" | "cancelled"
    pub token_balance: i64,  // 剩余Token
    pub monthly_limit: i64,  // 月度上限
    pub used_this_month: i64,// 本月已用
    pub expires_at: String,
    pub price_per_month: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String, // "user" | "assistant" | "system"
    #[serde(default)]
    pub content: serde_json::Value, // String 或 vision多模态数组 [{type:"text",...},{type:"image_url",...}]
    pub timestamp: Option<String>,
    pub skill_name: Option<String>,
    pub tokens_used: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,       // "glm5.1" | "qwen3.5-max-preview" | "deepseek-latest"
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub use_skill: Option<String>,   // 指定使用的skill名称
    pub stream: Option<bool>,        // 是否流式输出
    #[serde(default)]
    pub session_id: Option<String>,  // 🧠 v5.1.1: 当前会话ID（跨会话记忆排除用）
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub tokens_used: i64,
    pub skill_applied: Option<String>,
    pub remaining_tokens: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillItem {
    pub id: String,
    pub name: String,
    pub category: String,     // L0/L1/L2/L3
    pub subcategory: String,  // 子分类
    pub description: String,
    pub tags: Vec<String>,
    pub version: String,
    pub has_references: bool,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub name: String,
    pub invite_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub user: Option<UserInfo>,
    pub subscription: Option<SubscriptionInfo>,
    pub token: Option<String>,
    pub message: String,
}

#[tauri::command]
async fn chat(
    state: tauri::State<'_, Mutex<AppState>>,
    learning: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
    request: ChatRequest,
) -> Result<ChatResponse, String> {
    let model = request.model.clone().unwrap_or_else(|| "deepseek-v4".to_string());

    // 检查认证和订阅状态（立即释放锁）
    {
        let app_state = state.lock().map_err(|e| e.to_string())?;
        if !app_state.is_authenticated {
            return Err("请先登录".to_string());
        }
    } // 锁在这里释放

    // 🧠 提取动态红线注入系统提示词
    let dynamic_redline = {
        let ls = learning.lock().map_err(|e| e.to_string())?;
        ls.as_ref().and_then(|state| state.build_dynamic_system_prompt_addition())
    };

    // 调用 AI 引擎（带动态红线）
    ai_engine::call_ai_with_redline(&request, &model, dynamic_redline.as_deref()).await
}

/// 🆕 透明思考模式 - 实时事件推送（边处理边推送）
#[tauri::command]
async fn chat_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<AppState>>,
    learning: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
    request: ChatRequest,
) -> Result<String, String> {
    let model = request.model.clone().unwrap_or_else(|| "deepseek-v4".to_string());
    claw_log::log_info("CHAT", &format!("chat_stream 开始: model={}, messages={}", model, request.messages.len()));

    {
        let app_state = state.lock().map_err(|e| e.to_string())?;
        if !app_state.is_authenticated {
            return Err("请先登录".to_string());
        }
    }

    // 🧠 提取动态红线（Phase 2: 学习闭环实际注入）
    let dynamic_redline = {
        let ls = learning.lock().map_err(|e| e.to_string())?;
        ls.as_ref().and_then(|state| state.build_dynamic_system_prompt_addition())
    };

    // 🧠 v5.2: 读取长期记忆（MEMORY.md）+ 行为画像
    let long_term_memory = {
        let data_dir = app.path().app_data_dir().unwrap_or_default();
        let mut ctx = memory_compressor::get_memory_context(&data_dir, 3000).unwrap_or_default();
        if let Some(behavior) = behavior_tracker::build_behavior_context(&data_dir) {
            ctx.push_str(&behavior);
        }
        if let Some(prefs) = memory_compressor::build_preference_injection(&data_dir) {
            ctx.push_str(&prefs);
        }
        if ctx.is_empty() { None } else { Some(ctx) }
    };

    // 🛑 v5.3.2: 停止生成 — 全局共享 AtomicBool
    use std::sync::atomic::Ordering;
    let abort_flag = get_abort_flag();
    abort_flag.store(false, Ordering::SeqCst);

    let abort_checker = {
        let flag = abort_flag.clone();
        async move {
            loop {
                if flag.load(Ordering::SeqCst) { break; }
                tokio::time::sleep(std::time::Duration::from_millis(150)).await;
            }
        }
    };

    // 调用透明思考引擎
    claw_log::log_info("DIAG", "chat_stream [A] 🚀即将进入call_ai_streaming_events");
    let result = tokio::select! {
        r = tokio::time::timeout(
            std::time::Duration::from_secs(180),
            ai_engine::call_ai_streaming_events(&app, &request, &model, dynamic_redline.as_deref(), long_term_memory.as_deref())
        ) => {
            match r {
                Ok(result) => result,
                Err(_) => {
                    let _ = app.emit("shaoziclaw-stream-event", serde_json::json!({
                        "event_type": "error",
                        "content": "⚠️ AI响应超时（3分钟），请重试或简化问题"
                    }));
                    Err("AI响应超时(180s)，请重试".to_string())
                }
            }
        }
        _ = abort_checker => {
            // 用户点击了停止按钮
            let _ = app.emit("shaoziclaw-stream-event", serde_json::json!({
                "event_type": "aborted",
                "title": "⏹ 已停止生成",
                "content": "AI 生成已被用户中断",
                "icon": "⏹"
            }));
            Err("已停止生成".to_string())
        }
    };
    match &result {
        Ok(content) => claw_log::log_info("DIAG", &format!("chat_stream [B] ✅返回: content_len={}", content.len())),
        Err(e) => claw_log::log_error("DIAG", &format!("chat_stream [B] ❌错误: {}", e)),
    }
    result
}

/// 🛑 v5.3.2: 停止当前 AI 回复（全局共享 AtomicBool）
#[tauri::command]
fn abort_generation() -> Result<(), String> {
    get_abort_flag().store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

/// 📖 v5.3.1: 读取文件内容（带行号，cat -n格式）
#[tauri::command]
fn read_file(path: String, offset: Option<usize>, limit: Option<usize>) -> Result<String, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取失败: {}", e))?;
    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();
    let start = offset.unwrap_or(0).min(total);
    let end = limit.map(|l| (start + l).min(total)).unwrap_or(total);
    let snippet: Vec<String> = lines[start..end].iter().enumerate()
        .map(|(i, l)| format!("{:>6}\t{}", start + i + 1, l))
        .collect();
    let header = format!("📖 {} (L{}-L{}, 共{}行)\n", path, start+1, end, total);
    Ok(header + &snippet.join("\n"))
}

/// ✏️ v5.3.1: 编辑文件（精确字符串替换）
#[tauri::command]
fn edit_file(path: String, old_string: String, new_string: String) -> Result<String, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取失败: {}", e))?;
    if !content.contains(&old_string) {
        return Err(format!("未找到要替换的内容"));
    }
    let count = content.matches(&old_string).count();
    if count > 1 {
        return Err(format!("old_string匹配到{}处，请提供更精确的上下文", count));
    }
    let new_content = content.replacen(&old_string, &new_string, 1);
    std::fs::write(&path, &new_content)
        .map_err(|e| format!("写入失败: {}", e))?;
    Ok(format!("✅ 已编辑 {} — 1处替换完成", path))
}

/// 🔧 v5.3.6: Rust原生写文件 — 接收base64字符串（避免IPC传巨大JSON数组）
/// 🔧 v5.3.10: 改用OpenOptions+write_all+sync_all，增强错误诊断
#[tauri::command]
fn save_file_to_disk(path: String, data_base64: String) -> Result<String, String> {
    use base64::Engine;
    claw_log::log_info("SAVE_FILE", &format!("开始解码base64, 长度={}", data_base64.len()));
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| {
            claw_log::log_error("SAVE_FILE", &format!("base64解码失败: {}", e));
            format!("base64解码失败: {}", e)
        })?;
    claw_log::log_info("SAVE_FILE", &format!("解码成功 {} bytes, 目标路径: {}", bytes.len(), path));

    // 使用OpenOptions获得更细粒度的控制和错误信息
    let write_result = (|| -> Result<(), String> {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&path)
            .map_err(|e: std::io::Error| format!("打开文件失败({:?}): {}", e.kind(), e))?;
        file.write_all(&bytes)
            .map_err(|e: std::io::Error| format!("写入数据失败({:?}): {}", e.kind(), e))?;
        file.sync_all()
            .map_err(|e: std::io::Error| format!("同步文件失败({:?}): {}", e.kind(), e))?;
        Ok(())
    })();

    match write_result {
        Ok(_) => {
            match std::fs::metadata(&path) {
                Ok(m) => claw_log::log_info("SAVE_FILE", &format!("✅ 写入成功 {} bytes -> {}", m.len(), path)),
                Err(e) => claw_log::log_warn("SAVE_FILE", &format!("写入后验证失败: {}", e)),
            }
            Ok(path)
        }
        Err(e) => {
            claw_log::log_error("SAVE_FILE", &format!("写入失败: {} -> {}", path, e));
            // 🔧 v5.3.9: fallback — 如果写Download失败, 尝试Desktop
            let home = dirs::home_dir().unwrap_or_default();
            let downloads_dir = home.join("Downloads");
            if path.starts_with(downloads_dir.to_str().unwrap_or("")) {
                let fname = std::path::Path::new(&path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy();
                let desktop_path = home.join("Desktop").join(fname.as_ref());
                let desktop_str = desktop_path.to_string_lossy().to_string();
                claw_log::log_info("SAVE_FILE", &format!("→ 尝试fallback: {}", desktop_str));
                match std::fs::OpenOptions::new().write(true).create(true).truncate(true).open(&desktop_path) {
                    Ok(mut file) => {
                        if let Err(e) = file.write_all(&bytes) {
                            return Err(format!("写入Downloads失败, Desktop写入也失败: {}", e));
                        }
                        if let Err(e) = file.sync_all() {
                            return Err(format!("写入Downloads失败, Desktop同步也失败: {}", e));
                        }
                        claw_log::log_info("SAVE_FILE", &format!("✅ fallback成功 -> {}", desktop_str));
                        return Ok(desktop_str);
                    }
                    Err(e) => {
                        return Err(format!("写入Downloads失败({}), Desktop打开也失败: {}", e, e));
                    }
                }
            }
            Err(format!("写入文件失败: {}", e))
        }
    }
}

#[tauri::command]
async fn login(
    state: tauri::State<'_, Mutex<AppState>>,
    request: LoginRequest,
) -> Result<AuthResponse, String> {
    auth::login(&request.email, &request.password).await.map(|resp| {
        if resp.success {
            if let Ok(mut s) = state.lock() {
                s.is_authenticated = true;
                s.current_user = resp.user.clone();
                s.subscription = resp.subscription.clone();
            }
        }
        resp
    })
}

#[tauri::command]
async fn register(request: RegisterRequest) -> Result<AuthResponse, String> {
    auth::register(&request).await
}

// 🔒 v5.5.34 B100修复：邀请码验证（前端调用，后端验证）
#[tauri::command]
fn verify_invite_code_cmd(code: String) -> invite_store::VerifyResult {
    auth::verify_invite_code(&code)
}

// 🔒 v5.5.34 B100修复：邀请码兑换（注册时标记已使用）
#[tauri::command]
fn redeem_invite_code_cmd(code: String, email: String) -> invite_store::RedeemResult {
    auth::redeem_invite_code(&code, &email)
}

#[tauri::command]
fn logout(state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    if let Ok(mut s) = state.lock() {
        s.is_authenticated = false;
        s.current_user = None;
        s.subscription = None;
    }
    user_store::clear_session().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_state(state: tauri::State<'_, Mutex<AppState>>) -> Result<AppState, String> {
    state.lock().map_err(|e| e.to_string()).map(|s| s.clone())
}

#[tauri::command]
fn get_skills_list(category: Option<String>) -> Result<Vec<SkillItem>, String> {
    skill_manager::list_skills(category.as_deref())
}

#[tauri::command]
fn get_skill_detail(skill_id: String) -> Result<SkillItem, String> {
    skill_manager::get_skill(&skill_id)
}

#[tauri::command]
fn execute_tool(tool_id: String, params: serde_json::Value) -> Result<serde_json::Value, String> {
    tools::execute(&tool_id, &params)
}

#[tauri::command]
fn list_tools() -> Result<Vec<tools::ToolInfo>, String> {
    tools::list_available()
}

#[tauri::command]
fn check_subscription(state: tauri::State<'_, Mutex<AppState>>) -> Result<Option<SubscriptionInfo>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.subscription.clone())
}

#[tauri::command]
async fn get_subscription_info(user_id: String) -> Result<SubscriptionInfo, String> {
    subscription::get_info(&user_id).await
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn get_macos_version() -> String {
    let output = std::process::Command::new("sw_vers")
        .output()
        .unwrap_or_else(|_| std::process::Output { status: std::process::ExitStatus::default(), stdout: vec![], stderr: vec![] });
    String::from_utf8_lossy(&output.stdout).to_string()
}

// ============================================================================
// 🧠 学习闭环 — Tauri Commands
// ============================================================================

/// 记录用户反馈（👍/👎）
#[tauri::command]
async fn submit_feedback(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
    req: learning::FeedbackRequest,
) -> Result<i64, String> {
    let ls = state.lock().map_err(|e| e.to_string())?;
    let learning_state = ls.as_ref().ok_or("学习系统未初始化")?;
    learning_state.record_feedback(req)
}

/// 记录隐式行为（复制/重问）
#[tauri::command]
fn record_implicit_feedback(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
    message_id: String,
    action_type: String,
) -> Result<(), String> {
    let ls = state.lock().map_err(|e| e.to_string())?;
    let learning_state = ls.as_ref().ok_or("学习系统未初始化")?;
    learning_state.record_implicit_feedback(&message_id, &action_type)
}

/// 获取学习统计
#[tauri::command]
fn get_learning_stats(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
) -> Result<learning::LearningStats, String> {
    let ls = state.lock().map_err(|e| e.to_string())?;
    let learning_state = ls.as_ref().ok_or("学习系统未初始化")?;
    learning_state.get_learning_stats()
}

/// 获取活跃负面案例列表
#[tauri::command]
fn get_negative_cases(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
) -> Result<Vec<learning::NegativeCase>, String> {
    let ls = state.lock().map_err(|e| e.to_string())?;
    let learning_state = ls.as_ref().ok_or("学习系统未初始化")?;
    learning_state.get_active_negative_cases()
}

/// 解决一个负面案例
#[tauri::command]
fn resolve_case(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
    case_id: i64,
) -> Result<(), String> {
    let ls = state.lock().map_err(|e| e.to_string())?;
    let learning_state = ls.as_ref().ok_or("学习系统未初始化")?;
    learning_state.resolve_negative_case(case_id)
}

// 🧠 v5.2: 获取用户偏好话题列表（正向泛化：点赞→同类话题加分）
#[tauri::command]
fn get_preferred_topics(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
) -> Result<Vec<(String, f64)>, String> {
    let ls = state.lock().map_err(|e| e.to_string())?;
    let learning_state = ls.as_ref().ok_or("学习系统未初始化")?;
    learning_state.get_preferred_topics()
}

// 🧠 v5.2: 获取话题偏好加成系数（RAG检索用）
#[tauri::command]
fn get_preference_boost(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
    query: String,
) -> f64 {
    let ls = match state.lock() { Ok(l) => l, Err(_) => return 1.0 };
    match ls.as_ref() {
        Some(ls) => ls.get_preference_boost(&query),
        None => 1.0,
    }
}

/// 🔍 搜索记忆（FTS5全文检索）
#[tauri::command]
fn search_memories(
    state: tauri::State<'_, Mutex<Option<learning::LearningState>>>,
    query: String,
) -> Result<Vec<learning::MemoryEntry>, String> {
    let ls = state.lock().map_err(|e| e.to_string())?;
    let learning_state = ls.as_ref().ok_or("学习系统未初始化")?;
    learning_state.search_memories(&query, 5)
}

// ============================================================
// 🌐 网络工具 Tauri Commands
// ============================================================

#[tauri::command]
async fn fetch_hot_trends(platform: Option<String>) -> Result<Vec<web_tools::HotBoardResult>, String> {
    web_tools::fetch_hot_trends(platform).await
}

#[tauri::command]
async fn web_search(query: String, max_results: Option<i32>) -> Result<web_tools::SearchResponse, String> {
    web_tools::web_search(&query, max_results.unwrap_or(5)).await
}

#[tauri::command]
async fn web_fetch(url: String) -> Result<String, String> {
    web_tools::web_fetch(&url).await
}

#[tauri::command]
async fn browser_scrape(url: String) -> Result<web_tools::BrowserScrapeResult, String> {
    web_tools::browser_scrape(&url).await
}

/// 🔐 启动时恢复认证状态
/// 1. 先尝试从session.json恢复
/// 2. 如果没有session或用户不存在，自动注册/登录默认用户
/// 3. 确保AppState.is_authenticated = true（让chat/chat_stream能正常工作）
fn restore_auth_state(state: &Mutex<AppState>) -> Result<(), String> {
    // 策略1：尝试从session文件恢复
    if let Ok(Some(session)) = user_store::get_session() {
        // 有session → 找对应用户信息
        let users = user_store::get_users().unwrap_or_default();
        if let Some(u) = users.iter().find(|u| u.id == session.user_id) {
            let mut s = state.lock().map_err(|e| e.to_string())?;
            s.is_authenticated = true;
            s.current_user = Some(UserInfo {
                id: u.id.clone(),
                email: u.email.clone(),
                name: u.name.clone(),
                avatar: None,
                created_at: u.created_at.clone(),
            });
            s.subscription = Some(SubscriptionInfo {
                plan: "pro".to_string(),
                status: "active".to_string(),
                token_balance: 500_000,
                monthly_limit: 1_000_000,
                used_this_month: 0,
                expires_at: "2027-12-31".to_string(),
                price_per_month: 0.0,
            });
            return Ok(());
        }
    }

    // 策略2：没有有效session → 自动注册/登录默认用户
    let default_email = "user@shaoziclaw.cn";
    let users = user_store::get_users().unwrap_or_default();
    
    if !users.iter().any(|u| u.email == default_email) {
        // 默认用户不存在 → 自动注册
        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            .to_string();
        
        user_store::save_user(&user_store::StoredUser {
            id: format!("default-user-{}", now),
            email: default_email.to_string(),
            name: "user".to_string(),
            password: "".to_string(),
            created_at: now,
        })?;
        
        println!("  📝 已自动注册默认用户: {}", default_email);
    }

    // 设置为已登录状态（模拟login成功）
    let users = user_store::get_users()?;
    if let Some(u) = users.iter().find(|u| u.email == default_email) {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.is_authenticated = true;
        s.current_user = Some(UserInfo {
            id: u.id.clone(),
            email: u.email.clone(),
            name: u.name.clone(),
            avatar: None,
            created_at: u.created_at.clone(),
        });
        s.subscription = Some(SubscriptionInfo {
            plan: "pro".to_string(),
            status: "active".to_string(),
            token_balance: 500_000,
            monthly_limit: 1_000_000,
            used_this_month: 0,
            expires_at: "2027-12-31".to_string(),
            price_per_month: 0.0,
        });
        
        // 同时保存session以便下次启动恢复
        let _ = user_store::save_session(&user_store::SessionData {
            user_id: u.id.clone(),
            token: "auto-login-token".to_string(),
        });
    }

    Ok(())
}

// ═════════════════════════════════════════
// 🔄 自动更新模块（v4.6.2 — DMG完整流程）
//
// 架构说明：
//   check_update     → 用Tauri插件查询latest.json（只读，轻量）
//   download_install  → 自实现：HTTP下载DMG → hdiutil挂载 → 复制.app → 卸载 → 重启
// ═════════════════════════════════════════

#[derive(Debug, Serialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub body: Option<String>,
    pub date: Option<String>,
    /// DMG下载地址（前端"重启升级"按钮需要）
    pub download_url: Option<String>,
}

/// 用系统默认浏览器打开URL（替代前端window.open，避免Tauri webview安全限制）
#[tauri::command]
async fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell()
        .open(&url, None)
        .map_err(|e| format!("打开链接失败: {}", e))
}

// ═══════════════════════════════════════════════════════════════
// 图片设计专家 — AI图片生成
// B053: 硅基流动 SiliconFlow Kolors（主力）+ apiyi gpt-image-2（备用）
// ═══════════════════════════════════════════════════════════════

#[derive(serde::Serialize)]
struct ImageGenerateResult {
    success: bool,
    b64_data: Option<String>,   // base64编码的PNG图片数据
    error: Option<String>,
}

/// 调用AI生图模型
/// v5.5.23 Bug#4 修复: 实测墨行 succeeded payload 的 URL 在 result.primary_url / result.urls[0]
///   - Banana2 (Gemini-3.1-Flash-Image-Preview, 1k + 16:9) 实测 ~16s
///   - Seedream4.5 (doubao-seedream-4-5-251128, 1728x2304)  实测 ~75s
/// 改用 select! 取最快成功，不再等所有完成；轮询扩到 180s
/// 返回base64编码的PNG数据
#[tauri::command]
async fn image_generate(prompt: String, size: Option<String>) -> Result<ImageGenerateResult, String> {
    let _ = size; // 墨行两模型各自有固定size，不再使用前端传入值
    image_generate_inner(prompt, None).await
}

/// 图生图变体（暴露 reference_image_url 给前端）
/// v5.5.22 hotfix: 兼容两种入参格式
///   1. https URL（如 https://xxx.com/a.jpg）
///   2. base64 data URL（如 data:image/png;base64,xxxxx）— 先上传OSS拿公网URL再传墨行
/// v5.5.31: 加强日志，方便排查base64直传问题
#[tauri::command]
async fn image_generate_with_ref(prompt: String, reference_image_url: String) -> Result<ImageGenerateResult, String> {
    let kind = if reference_image_url.starts_with("data:") { "base64_dataurl" }
               else if reference_image_url.starts_with("http") { "https_url" }
               else { "raw_base64_or_unknown" };
    log::info!("[IMAGE_GEN] image_generate_with_ref 入参: kind={}, ref_len={}, prompt_len={}", 
        kind, reference_image_url.len(), prompt.len());
    if kind == "base64_dataurl" {
        log::info!("[IMAGE_GEN] ⚠️ base64参考图(len={}kb),将先上传OSS转公网URL再传墨行", reference_image_url.len()/1024);
    }
    image_generate_inner(prompt, Some(reference_image_url)).await
}

async fn image_generate_inner(prompt: String, image_url: Option<String>) -> Result<ImageGenerateResult, String> {
    let is_img2img = image_url.is_some();
    log::info!("[IMAGE_GEN] 生图请求: prompt长度={}, 图生图={}", prompt.len(), is_img2img);
    
    // v5.5.32: 移除 prompt 截断（墨行技术确认prompt≤3000字没问题，之前Data too long根因是base64直传不是prompt）
    let start = std::time::Instant::now();

    // 🔧 B098修复(v5.5.24): 墨行 /media/generations 的 image / reference_images 字段
    // 严格要求公网 https URL,不支持 base64 data URL。
    // 如果前端传来 base64,先上传到阿里云 OSS 拿公网 URL,再传给墨行。
    // v5.5.32: 增加 OSS 上传失败的降级日志，如果仍然失败转文生图（不发图片）
    // B099修复(v5.5.34): AI修图返回的 enhancedImage 是裸base64(无 data:前缀),
    //   批量生图时传入被当作URL直传墨行→Data too long。增加裸base64检测分支。
    let processed_url: Option<String> = if let Some(ref u) = image_url {
        if u.starts_with("data:") {
            log::info!("[IMAGE_GEN] 🔄 检测到 data:base64 参考图(len={}chars≈{}KB),上传 OSS 中...", 
                u.len(), u.len() / 1365); // base64膨胀率≈1.365x, len/1365≈原始KB
            // 剥离 "data:image/xxx;base64," 前缀,拿到纯 base64
            let b64_pure = if let Some(idx) = u.find(";base64,") {
                &u[idx + 8..] // "data:image/jpeg;base64," → 跳过 "data:xxx;base64,"
            } else if let Some(idx) = u.find(',') {
                &u[idx+1..] // 兜底: 跳过第一个逗号
            } else {
                u.as_str() // 没有逗号,本身就是裸base64
            };
            log::info!("[IMAGE_GEN] 纯base64长度: {}chars", b64_pure.len());
            match oss_uploader::upload_and_get_signed_url(b64_pure).await {
                Ok(oss_url) => {
                    log::info!("[IMAGE_GEN] ✅ OSS上传成功! 预签名URL(len={}): {}...", 
                        oss_url.len(), &oss_url[..80.min(oss_url.len())]);
                    log::info!("[IMAGE_GEN] 📊 预估Moxing请求体: prompt({}) + oss_url({}) + json≈80 = {}chars",
                        prompt.len(), oss_url.len(), prompt.len() + oss_url.len() + 80);
                    Some(oss_url)
                }
                Err(e) => {
                    // v5.5.32: OSS上传失败时降级为文生图（不传图片），而非直接报错
                    // 这样用户至少能生成图片，只是没有参考图编辑效果
                    log::error!("[IMAGE_GEN] ❌ OSS上传失败: {}", e);
                    log::warn!("[IMAGE_GEN] ⚠️ 降级策略: 跳过参考图，执行纯文生图（prompt中已包含菜品描述）");
                    None
                }
            }
        } else if u.starts_with("http://") || u.starts_with("https://") {
            // 已经是 https URL,直接透传
            log::info!("[IMAGE_GEN] ✅ 参考图已是公网URL(len={}),直接透传", u.len());
            Some(u.clone())
        } else {
            // B099: 裸base64（AI修图enhancedImage无data:前缀,iVBORw0...开头）
            // 检测依据: 长度>500 && 不含空白字符 && 前1000字符只含base64字符集
            let is_base64_like = u.len() > 500 
                && !u.contains(' ') && !u.contains('\n') && !u.contains('\t')
                && u.chars().take(1000).all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=');
            if is_base64_like {
                log::info!("[IMAGE_GEN] 🔄 检测到裸base64参考图(len={}chars≈{}KB),上传 OSS 中...", 
                    u.len(), u.len() / 1365);
                match oss_uploader::upload_and_get_signed_url(u).await {
                    Ok(oss_url) => {
                        log::info!("[IMAGE_GEN] ✅ OSS上传成功! 预签名URL(len={}): {}...", 
                            oss_url.len(), &oss_url[..80.min(oss_url.len())]);
                        log::info!("[IMAGE_GEN] 📊 预估Moxing请求体: prompt({}) + oss_url({}) + json≈80 = {}chars",
                            prompt.len(), oss_url.len(), prompt.len() + oss_url.len() + 80);
                        Some(oss_url)
                    }
                    Err(e) => {
                        log::error!("[IMAGE_GEN] ❌ OSS上传失败: {}", e);
                        log::warn!("[IMAGE_GEN] ⚠️ 降级策略: 跳过参考图，执行纯文生图（prompt中已包含菜品描述）");
                        None
                    }
                }
            } else {
                // 不是base64也不是URL,可能是短路径或其他格式,尝试作为URL透传
                log::warn!("[IMAGE_GEN] ⚠️ 参考图格式未知(len={}),尝试作为URL透传", u.len());
                Some(u.clone())
            }
        }
    } else {
        None
    };
    let url_ref = processed_url.as_deref();

    // 🔧 v5.5.30: 图生图改用 GeminiFlash（真正图生图）
    // GeminiFlash 的 /media/generations image 字段是对原图进行编辑
    // 不再是 Banana2 那种"只做风格参考"（那是文生图套壳）
    if is_img2img {
        if let Some(ref_url) = url_ref {
            log::info!("[IMAGE_GEN] 图生图模式(/media/generations + image), ref_url={}...", 
                &ref_url[..60.min(ref_url.len())]);
        
            // GeminiFlash 首选,60秒超时
            let gpt_future = try_moxing_gemini_flash(&prompt, url_ref);
            match tokio::time::timeout(std::time::Duration::from_secs(60), gpt_future).await {
                Ok(Ok(result)) => {
                    log::info!("[IMAGE_GEN] ✅ GeminiFlash图生图成功,耗时{:?}", start.elapsed());
                    if result.success {
                        if let Some(b64) = &result.b64_data {
                            let b64_clone = b64.clone();
                            tokio::spawn(async move {
                                match oss_uploader::upload_image_to_oss(&b64_clone).await {
                                    Ok(url) => log::info!("[IMAGE_GEN][OSS] 图生图结果已上传: {}", url),
                                    Err(e) => log::warn!("[IMAGE_GEN][OSS] 上传失败(不影响前端): {}", e),
                                }
                            });
                        }
                    }
                    return Ok(result);
                }
                Ok(Err(e)) => {
                    log::warn!("[IMAGE_GEN] GeminiFlash失败({}),降级Seedream4.5", e);
                    return try_moxing_seedream(&prompt, url_ref).await;
                }
                Err(_) => {
                    log::info!("[IMAGE_GEN] GeminiFlash超时(>60s),降级Seedream4.5");
                    return try_moxing_seedream(&prompt, url_ref).await;
                }
            }
        }
        // url_ref 为 None（OSS上传失败降级），或不传 ref_url 时：走文生图
        log::info!("[IMAGE_GEN] ⚠️ 图生图请求但无有效参考图URL，转为文生图模式");
    }

    // 文生图: 串行降级策略
    log::info!("[IMAGE_GEN] 文生图模式: GeminiFlash(60s超时)→降级Seedream4.5");
    
    let gpt_future = try_moxing_gemini_flash(&prompt, url_ref);
    match tokio::time::timeout(std::time::Duration::from_secs(60), gpt_future).await {
        Ok(Ok(result)) => {
            log::info!("[IMAGE_GEN] ✅ GeminiFlash成功,耗时{:?}", start.elapsed());
            return Ok(result);
        }
        Ok(Err(e)) => {
            log::warn!("[IMAGE_GEN] GeminiFlash失败({}),立即降级Seedream4.5", e);
            return try_moxing_seedream(&prompt, url_ref).await;
        }
        Err(_) => {
            log::info!("[IMAGE_GEN] GeminiFlash超时(>60s),降级Seedream4.5");
            return try_moxing_seedream(&prompt, url_ref).await;
        }
    }
}

/// 墨行 API key（与 compress_memory 共用）
const MOXING_API_KEY: &str = "sk-mxai-3d96e98c6a64adcde222b8020e9ab42979fd17a30a46f31e60b4a3e6ca03c3e2";
const MOXING_API_BASE: &str = "https://www.moxing.pro/v1";

/// 提交墨行异步任务并轮询结果
/// v5.5.23 Bug#4: 轮询扩到 90×2s=180s（实测 Seedream4.5 需要 ~75s 才 succeeded）
/// 1) POST /media/generations 拿 task_id
/// 2) 轮询 GET /media/tasks/<task_id> 直到完成（最多 90 次 × 2s = 180s）
/// 3) 提取图片 URL，下载并转为 base64
async fn submit_and_poll_moxing(body: serde_json::Value, model_label: &str) -> Result<ImageGenerateResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90)) // v5.5.23: 30→90，下载大图也走这条
        .build()
        .map_err(|e| format!("HTTP客户端失败: {}", e))?;

    // ① 提交任务
    let submit_url = format!("{}/media/generations", MOXING_API_BASE);
    log::info!("[IMAGE_GEN][{}] 提交任务: {}", model_label, submit_url);
    
    // v5.5.32 安全守卫: 检查是否有 base64 data URL 混入 image 字段
    // 墨行要求 image 字段必须是公网 https URL，不能是 base64
    // 如果检测到 >500字符 的非URL，拒绝发送并记录完整诊断
    {
        let body_str = body.to_string();
        let body_len = body_str.len();
        log::info!("[IMAGE_GEN][{}] 请求体总长度: {}chars", model_label, body_len);
        
        for key in ["image", "reference_images"] {
            if let Some(v) = body.get(key) {
                let field_val = match v {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Array(arr) => arr.iter()
                        .filter_map(|x| x.as_str()).collect::<Vec<_>>().join(","),
                    _ => String::new(),
                };
                if field_val.len() > 500 && field_val.contains("base64") || field_val.starts_with("data:") {
                    log::error!("[IMAGE_GEN][{}] 🛑 BASE64守卫触发! {}字段(长度{})疑似base64不是URL,阻止发送",
                        model_label, key, field_val.len());
                    log::error!("[IMAGE_GEN][{}] field[:200]={}", model_label, &field_val[..200.min(field_val.len())]);
                    return Err(format!("图片参考图{}字段包含base64数据(长度{}),应为公网URL。OSS上传环节可能未生效。",
                        key, field_val.len()));
                }
            }
        }
        // 安全: 打印脱敏后的请求体用于诊断
        let sanitized = sanitize_body_for_log(&body);
        log::info!("[IMAGE_GEN][{}] 请求体(脱敏): {}", model_label, sanitized);
    }
    
    let resp = client.post(&submit_url)
        .header("Authorization", format!("Bearer {}", MOXING_API_KEY))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("提交请求失败: {}", e))?;

    let status = resp.status();
    let json: serde_json::Value = resp.json().await
        .map_err(|e| format!("提交响应解析失败: {}", e))?;

    if !status.is_success() {
        let err_msg = json.get("error")
            .and_then(|e| if e.is_string() { e.as_str() } else { e.get("message").and_then(|m| m.as_str()) })
            .or_else(|| json.get("message").and_then(|m| m.as_str()))
            .unwrap_or("未知错误");
        log::info!("[IMAGE_GEN][{}] 提交HTTP错误 {}: {}", model_label, status, err_msg);
        return Err(format!("提交HTTP {}: {}", status, err_msg));
    }

    // ② 提取 task_id(兼容多种返回字段)
    // 优先级:根 data 立即返回 url -> task_id -> id
    if let Some(direct_url) = extract_image_url_from_moxing(&json) {
        log::info!("[IMAGE_GEN][{}] 同步直返URL,下载中...", model_label);
        return download_url_to_result(&direct_url, model_label).await;
    }

    let task_id = json.get("task_id").and_then(|v| v.as_str())
        .or_else(|| json.get("id").and_then(|v| v.as_str()))
        .or_else(|| json.get("data").and_then(|d| d.get("task_id")).and_then(|v| v.as_str()))
        .or_else(|| json.get("data").and_then(|d| d.get("id")).and_then(|v| v.as_str()))
        .ok_or_else(|| format!("响应未携带task_id: {}", json))?
        .to_string();

    log::info!("[IMAGE_GEN][{}] 取得task_id={}, 开始轮询", model_label, task_id);

    // ③ 轮询任务状态（最多 90 次，每次 2s = 180s）
    // v5.5.23: 实测 Seedream4.5 ~75s 才 succeeded，60s 不够
    let poll_url = format!("{}/media/tasks/{}", MOXING_API_BASE, task_id);
    for attempt in 1..=90 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        let r = client.get(&poll_url)
            .header("Authorization", format!("Bearer {}", MOXING_API_KEY))
            .send()
            .await;

        let r = match r {
            Ok(r) => r,
            Err(e) => {
                log::info!("[IMAGE_GEN][{}] 轮询#{} 网络错误: {}", model_label, attempt, e);
                continue;
            }
        };

        let st = r.status();
        let pj: serde_json::Value = match r.json().await {
            Ok(v) => v,
            Err(e) => {
                log::info!("[IMAGE_GEN][{}] 轮询#{} 解析错误: {}", model_label, attempt, e);
                continue;
            }
        };

        if !st.is_success() {
            log::info!("[IMAGE_GEN][{}] 轮询#{} HTTP {}: {}", model_label, attempt, st, pj);
            continue;
        }

        // 状态字段：status/state，可能值: pending/queued/running/processing/succeeded/completed/success/failed/error
        let state = pj.get("status").and_then(|v| v.as_str())
            .or_else(|| pj.get("state").and_then(|v| v.as_str()))
            .or_else(|| pj.get("data").and_then(|d| d.get("status")).and_then(|v| v.as_str()))
            .unwrap_or("");

        let s_lower = state.to_lowercase();
        if s_lower == "failed" || s_lower == "error" || s_lower == "cancelled" {
            let err = pj.get("error").and_then(|e| if e.is_string() { e.as_str() } else { e.get("message").and_then(|m| m.as_str()) })
                .or_else(|| pj.get("message").and_then(|m| m.as_str()))
                .unwrap_or("任务失败");
            return Err(format!("任务{}: {}", state, err));
        }

        // 尝试提取 URL — 部分模型完成时不显式返回 status
        if let Some(url) = extract_image_url_from_moxing(&pj) {
            log::info!("[IMAGE_GEN][{}] 轮询#{} 完成,下载图片", model_label, attempt);
            return download_url_to_result(&url, model_label).await;
        }

        if attempt % 5 == 0 {
            log::info!("[IMAGE_GEN][{}] 轮询#{} 状态={} 仍在处理", model_label, attempt, state);
        }
    }

    Err("轮询超时(180s)".to_string())
}

/// 从墨行响应中尽力提取图片 URL（兼容多种结构）
/// v5.5.23 Bug#4 修复: 实测墨行 succeeded payload 在 result.primary_url / result.urls[0]，
/// 当前漏掉这两个字段是导致两模型都"轮询超时"的真根因
fn extract_image_url_from_moxing(v: &serde_json::Value) -> Option<String> {
    // 0. ★ 实测墨行 succeeded 真实路径: result.primary_url 或 result.urls[0]
    if let Some(result) = v.get("result") {
        if let Some(u) = result.get("primary_url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
        if let Some(arr) = result.get("urls").and_then(|d| d.as_array()) {
            if let Some(first) = arr.first().and_then(|x| x.as_str()) { return Some(first.to_string()); }
        }
    }

    // 1. data: [{url}]
    if let Some(arr) = v.get("data").and_then(|d| d.as_array()) {
        if let Some(first) = arr.first() {
            if let Some(u) = first.get("url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
            if let Some(u) = first.get("image_url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
            if let Some(u) = first.get("primary_url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
        }
    }
    // 2. images: [{url}] 或 [string]
    if let Some(arr) = v.get("images").and_then(|d| d.as_array()) {
        if let Some(first) = arr.first() {
            if let Some(u) = first.as_str() { return Some(u.to_string()); }
            if let Some(u) = first.get("url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
        }
    }
    // 3. result/output/data 内嵌 url 单数 / image_url / images 数组
    for key in ["result", "output", "data"] {
        if let Some(obj) = v.get(key) {
            if let Some(u) = obj.get("url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
            if let Some(u) = obj.get("image_url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
            if let Some(u) = obj.get("primary_url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
            // urls 数组（首项可能是字符串或对象）
            if let Some(arr) = obj.get("urls").and_then(|d| d.as_array()) {
                if let Some(first) = arr.first() {
                    if let Some(u) = first.as_str() { return Some(u.to_string()); }
                    if let Some(u) = first.get("url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
                }
            }
            // 嵌套 images 数组
            if let Some(arr) = obj.get("images").and_then(|d| d.as_array()) {
                if let Some(first) = arr.first() {
                    if let Some(u) = first.as_str() { return Some(u.to_string()); }
                    if let Some(u) = first.get("url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
                }
            }
        }
    }
    // 4. 顶层 url
    if let Some(u) = v.get("url").and_then(|x| x.as_str()) { return Some(u.to_string()); }
    None
}

/// 下载墨行 URL 转换为前端可用的结果
async fn download_url_to_result(url: &str, model_label: &str) -> Result<ImageGenerateResult, String> {
    match download_image_to_b64(url).await {
        Ok(b64) => {
            log::info!("[IMAGE_GEN][{}] ✅ 下载成功, b64长度={}", model_label, b64.len());
            Ok(ImageGenerateResult { success: true, b64_data: Some(b64), error: None })
        }
        Err(e) => {
            // 下载失败,回退把 URL 给前端
            log::info!("[IMAGE_GEN][{}] 下载失败: {}, 返回URL让前端兜底", model_label, e);
            Ok(ImageGenerateResult { success: true, b64_data: None, error: Some(format!("url:{}", url)) })
        }
    }
}

/// v5.5.24 修复 B096: 墨行 Banana2（Gemini-3.1-Flash-Image-Preview）
/// 🔧 v5.5.30: GeminiFlash 真正图生图（替代 Banana2）
/// 图生图: /media/generations 接口 + "image": "url" 字段
///   GeminiFlash 的 /media/generations image 字段是真正的「对原图进行编辑」
///   不是 Banana2 那种"风格参考"（那是文生图套壳）
/// seedream 降级用 reference_images 数组（兼容多图）
/// ⚠️ image 字段只支持 https URL,不支持 base64 data URL
async fn try_moxing_gemini_flash(prompt: &str, image_url: Option<&str>) -> Result<ImageGenerateResult, String> {
    let mut body = serde_json::json!({
        "model": "Gemini-3.1-Flash-Image-Preview",
        "capability": "image_generation",
        "prompt": prompt,
        "size": "1k",
        "aspect_ratio": "16:9",
        "response_format": "url",
    });
    if let Some(u) = image_url {
        body["image"] = serde_json::Value::String(u.to_string());
        log::info!("[IMAGE_GEN][GeminiFlash] 图生图模式(/media/generations + image)",);
    } else {
        log::info!("[IMAGE_GEN][GeminiFlash] 文生图模式(/media/generations)");
    }
    let body_log = sanitize_body_for_log(&body);
    log::info!("[IMAGE_GEN][GeminiFlash] 请求body(脱敏): {}", body_log);
    submit_and_poll_moxing(body, "GeminiFlash").await
}


/// 🔧 B095辅助: 脱敏body日志,base64字段只保留前50字符
fn sanitize_body_for_log(body: &serde_json::Value) -> String {
    let mut clone = body.clone();
    if let Some(obj) = clone.as_object_mut() {
        for key in ["image", "image_url", "reference_images", "reference_image", "input_image"] {
            if let Some(v) = obj.get_mut(key) {
                if let Some(s) = v.as_str() {
                    if s.len() > 50 {
                        let preview: String = s.chars().take(50).collect();
                        *v = serde_json::Value::String(format!("{}...[len={}]", preview, s.len()));
                    }
                }
            }
        }
    }
    clone.to_string()
}

/// 下载图片URL并转为base64
async fn download_image_to_b64(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP客户端失败: {}", e))?;
    
    let resp = client.get(url)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    
    let bytes = resp.bytes().await.map_err(|e| format!("读取失败: {}", e))?;
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// v5.5.24 修复 B096: 墨行 Seedream4.5（doubao-seedream-4-5-251128）
/// 文生图 size=1728x2304；图生图额外携带 reference_images 数组字段
/// ⚠️ 注意: reference_images 必须是数组格式 ["url"],不是字符串
async fn try_moxing_seedream(prompt: &str, image_url: Option<&str>) -> Result<ImageGenerateResult, String> {
    let mut body = serde_json::json!({
        "model": "doubao-seedream-4-5-251128",
        "capability": "image_generation",
        "prompt": prompt,
        "size": "1728x2304",
        "response_format": "url",
    });
    if let Some(u) = image_url {
        // 🔧 B096修复: reference_images 必须是数组格式(墨行官方文档)
        body["reference_images"] = serde_json::json!([u]);
        log::info!("[IMAGE_GEN][Seedream4.5] 图生图模式: reference_images=[前50字符={}]", 
            &u.chars().take(50).collect::<String>());
    }
    submit_and_poll_moxing(body, "Seedream4.5").await
}

/// 🔧 B052: 图片设计专家数据持久化 — 保存品牌档案和Logo到本地文件系统
/// 替代localStorage，彻底解决QuotaExceededError问题
#[tauri::command]
async fn save_image_design_data(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| format!("{}", e))?;
    let design_dir = data_dir.join("image_design");
    std::fs::create_dir_all(&design_dir).map_err(|e| format!("创建目录失败: {}", e))?;
    let file_path = design_dir.join(format!("{}.json", key));
    std::fs::write(&file_path, &value).map_err(|e| format!("写入失败: {}", e))?;
    Ok(())
}

/// 🔧 B052: 图片设计专家数据持久化 — 读取品牌档案和Logo
#[tauri::command]
async fn load_image_design_data(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| format!("{}", e))?;
    let file_path = data_dir.join("image_design").join(format!("{}.json", key));
    match std::fs::read_to_string(&file_path) {
        Ok(content) => Ok(Some(content)),
        Err(_) => Ok(None), // 文件不存在返回None，不报错
    }
}

/// 检查是否有新版本（从releases.shaoziclaw.com/latest.json读取）
#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|e| format!("获取updater失败: {}", e))?;

    match updater.check().await {
        Ok(Some(update)) => {
            // 从update对象中提取download URL（Tauri updater会解析platforms中的url）
            let download_url = update.download_url.to_string();
            Ok(UpdateInfo {
                available: true,
                version: Some(update.version.clone()),
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
                download_url: Some(download_url),
            })
        }
        Ok(None) => {
            Ok(UpdateInfo {
                available: false,
                version: None,
                body: None,
                date: None,
                download_url: None,
            })
        }
        Err(e) => Err(format!("检查更新失败: {}", e)),
    }
}

/// 🔄 macOS DMG 完整更新流程：
///   1. HTTP下载DMG到 /tmp/
///   2. hdiutil attach 挂载磁盘映像
///   3. cp -R 复制 .app 到 /Applications（覆盖旧版）
///   4. hdiutil detach 卸载磁盘映像
///   5. open 启动新版本 + std::process::exit(0)
///
/// 注意：此命令仅在 macOS 上编译，Windows走NSIS原生流程
#[tauri::command]
async fn download_and_install_update(
    app: tauri::AppHandle,
    dmg_url: String,
    on_progress: Channel<i32>, // 进度回调: 0-100
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        let tmp_path = "/tmp/shaoziclaw-update.dmg";

        // ─── Step 1: 下载DMG ───
        on_progress.send(10).map_err(|e| format!("进度发送失败: {}", e))?;

        // 用 reqwest 或直接用 Tauri 的 http 插件下载
        let response = reqwest::Client::new()
            .get(&dmg_url)
            .send()
            .await
            .map_err(|e| format!("连接服务器失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("服务器返回错误: HTTP {}", response.status()));
        }

        let total_bytes = response.content_length().unwrap_or(0);
        let bytes = response.bytes().await.map_err(|e| format!("下载失败: {}", e))?;

        // 写入临时文件
        std::fs::write(tmp_path, &bytes).map_err(|e| format!("写入临时文件失败: {}", e))?;
        on_progress.send(50).map_err(|e| format!("进度发送失败: {}", e))?;

        // ─── Step 2: 挂载DMG ───
        on_progress.send(60).map_err(|e| format!("进度发送失败: {}", e))?;

        let attach_output = Command::new("hdiutil")
            .args(["attach", "-nobrowse", "-quiet", tmp_path])
            .output()
            .map_err(|e| format!("挂载DMG失败(hdiutil): {}", e))?;

        if !attach_output.status.success() {
            let stderr = String::from_utf8_lossy(&attach_output.stderr);
            return Err(format!("挂载DMG失败: {}", stderr));
        }

        // 获取挂载路径（hdiutil输出最后一行是挂载点）
        let stdout = String::from_utf8_lossy(&attach_output.stdout);
        let mount_path = stdout.lines()
            .last()
            .and_then(|line| line.trim().strip_prefix("/Volumes/"))
            .map(|v| format!("/Volumes/{}", v))
            .ok_or_else(|| "无法获取DMG挂载路径".to_string())?;

        // ─── Step 3: 复制.app到Applications ───
        on_progress.send(75).map_err(|e| format!("进度发送失败: {}", e))?;

        // 查找DMG内的.app
        let app_source = std::path::Path::new(&mount_path).join("勺子Claw.app");
        if !app_source.exists() {
            // 尝试查找任意.app
            let mut found = false;
            if let Ok(entries) = std::fs::read_dir(&mount_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map(|e| e == "app").unwrap_or(false) {
                        found = true;
                        break;
                    }
                }
            }
            if !found {
                // 清理挂载
                let _ = Command::new("hdiutil")
                    .args(["detach", "-quiet", &mount_path])
                    .output();
                return Err("DMG中未找到勺子Claw应用程序".to_string());
            }
        }

        let copy_result = Command::new("cp")
            .args(["-R", &app_source.to_string_lossy(), "/Applications/"])
            .output()
            .map_err(|e| format!("复制应用失败(cp): {}", e))?;

        if !copy_result.status.success() {
            let stderr = String::from_utf8_lossy(&copy_result.stderr);
            // 尝试清理挂载
            let _ = Command::new("hdiutil")
                .args(["detach", "-quiet", &mount_path])
                .output();
            return Err(format!("复制应用到/Applications失败: {}", stderr));
        }

        // ─── Step 4: 卸载DMG ───
        on_progress.send(90).map_err(|e| format!("进度发送失败: {}", e))?;

        let _ = Command::new("hdiutil")
            .args(["detach", "-quiet", &mount_path])
            .output();

        // 清理临时DMG
        let _ = std::fs::remove_file(tmp_path);

        // ─── Step 5: 启动新版本并退出当前进程 ───
        on_progress.send(100).map_err(|e| format!("进度发送失败: {}", e))?;

        // 延迟一下让前端收到100%再退出
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // 用open启动新版本（异步，不阻塞）
        let _ = Command::new("open")
            .args(["-a", "勺子Claw"])
            .spawn();

        // 退出当前进程（让新版本接管）
        std::process::exit(0);
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("自动更新仅支持macOS".to_string())
    }
}

// ============================================================================
// 📚 RAG知识库 Commands (v5.1)
// ============================================================================

#[tauri::command]
fn get_kb_status(
    rag: tauri::State<'_, Mutex<Option<rag_engine::RagState>>>,
) -> Result<rag_engine::KbStatus, String> {
    let guard = rag.lock().map_err(|e| format!("获取RAG状态失败: {}", e))?;
    match guard.as_ref() {
        Some(rs) => Ok(rs.get_status()),
        None => Ok(rag_engine::KbStatus {
            initialized: false,
            index_version: None,
            total_chunks: 0,
            last_used: None,
        }),
    }
}

#[tauri::command]
async fn download_kb_index(
    app: tauri::AppHandle,
    rag: tauri::State<'_, Mutex<Option<rag_engine::RagState>>>,
    on_progress: tauri::ipc::Channel<rag_engine::DownloadProgress>,
) -> Result<rag_engine::KbStatus, String> {
    let kb_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?
        .join("knowledge-base");

    rag_engine::download_kb_index(kb_dir, on_progress).await?;

    // 重新初始化RAG系统
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let new_state = rag_engine::RagState::init(data_dir).await?;
    let status = new_state.get_status();

    let mut guard = rag.lock().map_err(|e| format!("更新RAG状态失败: {}", e))?;
    *guard = Some(new_state);

    Ok(status)
}

#[tauri::command]
async fn init_knowledge_base(
    app: tauri::AppHandle,
    rag: tauri::State<'_, Mutex<Option<rag_engine::RagState>>>,
) -> Result<rag_engine::KbStatus, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let new_state = rag_engine::RagState::init(data_dir).await?;
    let status = new_state.get_status();

    let mut guard = rag.lock().map_err(|e| format!("更新RAG状态失败: {}", e))?;
    *guard = Some(new_state);

    Ok(status)
}

// 🧠 跨会话记忆：存储对话记忆（v5.1.1）
#[tauri::command]
async fn store_cross_session_memory(
    app: tauri::AppHandle,
    session_id: String,
    session_title: String,
    user_query: String,
    ai_response: String,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let req = cross_session_memory::StoreMemoryRequest {
        session_id,
        session_title,
        user_query,
        ai_response,
    };
    cross_session_memory::store_memory(&req, &data_dir).await
}

// 📝 工作笔记MD：保存笔记（v5.1.3）
#[tauri::command]
fn save_working_note(
    app: tauri::AppHandle,
    title: String,
    content: String,
) -> Result<String, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    working_notes::save_note(&data_dir, &title, &content)
}

// 📝 工作笔记MD：获取最近笔记列表（v5.1.3）
#[tauri::command]
fn get_recent_notes(
    app: tauri::AppHandle,
    limit: usize,
) -> Vec<working_notes::NoteInfo> {
    let data_dir = app.path().app_data_dir().unwrap_or_default();
    working_notes::get_recent_notes(&data_dir, limit)
}

// 🧠 记忆压缩：对话结束后自动压缩并写入 MEMORY.md（v5.2）
#[tauri::command]
async fn compress_memory(
    app: tauri::AppHandle,
    messages_json: String,
) -> Result<memory_compressor::CompressResult, String> {
    crate::claw_log::log_info("MEMORY", &format!("compress_memory 开始, json_len={}", messages_json.len()));
    let data_dir = app.path().app_data_dir()
        .map_err(|e| {
            crate::claw_log::log_error("MEMORY", &format!("获取data_dir失败: {}", e));
            format!("获取数据目录失败: {}", e)
        })?;
    crate::claw_log::log_info("MEMORY", &format!("data_dir={}", data_dir.display()));

    let api_key = "sk-mxai-3d96e98c6a64adcde222b8020e9ab42979fd17a30a46f31e60b4a3e6ca03c3e2";
    let api_base = "https://www.moxing.pro/v1";
    let model = "DeepSeek-V4-pro";

    let entries = memory_compressor::compress_conversation(
        &messages_json, api_key, api_base, model,
    ).await
    .map_err(|e| {
        crate::claw_log::log_error("MEMORY", &format!("compress_conversation失败: {}", e));
        e
    })?;
    crate::claw_log::log_info("MEMORY", &format!("LLM压缩完成, entries={}", entries.len()));

    let path = memory_compressor::write_memory_md(&data_dir, &entries)
    .map_err(|e| {
        crate::claw_log::log_error("MEMORY", &format!("write_memory_md失败: {}", e));
        e
    })?;
    crate::claw_log::log_info("MEMORY", &format!("MEMORY.md写入完成, path={}", path));

    let preview = entries.iter()
        .map(|e| format!("- {}: {}", e.date, e.topic))
        .collect::<Vec<_>>()
        .join("\n");

    Ok(memory_compressor::CompressResult {
        entries_count: entries.len(),
        memory_path: path,
        preview,
    })
}

// 🧠 获取长期记忆上下文（注入 system prompt 用，v5.2）
#[tauri::command]
fn get_memory_context(
    app: tauri::AppHandle,
) -> Option<String> {
    let data_dir = app.path().app_data_dir().unwrap_or_default();
    memory_compressor::get_memory_context(&data_dir, 3000)
}

// 📊 v5.2: 记录单次对话行为
#[tauri::command]
fn record_interaction(
    app: tauri::AppHandle,
    user_query: String,
    reply_length: i32,
    features: Vec<String>,
    session_duration_secs: i32,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let feature_refs: Vec<&str> = features.iter().map(|s| s.as_str()).collect();
    behavior_tracker::record_interaction(&data_dir, &user_query, reply_length, &feature_refs, session_duration_secs)
}

// 📊 v5.2: 获取行为画像上下文（注入system prompt）
#[tauri::command]
fn get_behavior_context(
    app: tauri::AppHandle,
) -> Option<String> {
    let data_dir = app.path().app_data_dir().unwrap_or_default();
    behavior_tracker::build_behavior_context(&data_dir)
}

// 🌱 v5.2: 从对话提取新知识并存储
#[tauri::command]
async fn evolve_knowledge(
    app: tauri::AppHandle,
    user_query: String,
    ai_response: String,
) -> Result<i32, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;

    let api_key = "sk-mxai-3d96e98c6a64adcde222b8020e9ab42979fd17a30a46f31e60b4a3e6ca03c3e2";
    let api_base = "https://www.moxing.pro/v1";
    let model = "DeepSeek-V4-pro";

    let items = knowledge_evolution::extract_knowledge(
        &user_query, &ai_response, api_key, api_base, model,
    ).await?;

    let count = knowledge_evolution::store_knowledge(&data_dir, &items)?;
    Ok(count as i32)
}

// 🌱 v5.2: 获取知识演进统计
#[tauri::command]
fn get_knowledge_stats(
    app: tauri::AppHandle,
) -> knowledge_evolution::KnowledgeStats {
    let data_dir = app.path().app_data_dir().unwrap_or_default();
    knowledge_evolution::get_knowledge_stats(&data_dir)
        .unwrap_or(knowledge_evolution::KnowledgeStats {
            total_items: 0, high_confidence: 0, this_month: 0, top_topics: Vec::new(),
        })
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: Some("app".into()) }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(10_000_000) // 10MB 轮转
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build()
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(AppState::default()))
        .manage(Mutex::new(None::<learning::LearningState>)) // 🧠 学习闭环
        .manage(Mutex::new(None::<rag_engine::RagState>)) // 📚 RAG知识库
        // 🛑 v5.3.1: 停止生成使用全局 OnceLock<AtomicBool>，无需 managed state
        .invoke_handler(tauri::generate_handler![
            chat,
            chat_stream,
            abort_generation,
            read_file,
            edit_file,
            save_file_to_disk, // 🔧 v5.3.4: Rust原生写文件(绕过plugin-fs路径问题)
            login,
            register,
            logout,
            // 🔒 v5.5.34 B100修复：邀请码验证 commands
            verify_invite_code_cmd,
            redeem_invite_code_cmd,
            get_app_state,
            get_skills_list,
            get_skill_detail,
            execute_tool,
            list_tools,
            check_subscription,
            get_subscription_info,
            #[cfg(target_os = "macos")]
            get_macos_version,
            // 🧠 学习闭环 Commands
            submit_feedback,
            record_implicit_feedback,
            get_learning_stats,
            get_negative_cases,
            resolve_case,
            search_memories,
            // 🧠 v5.2: 话题偏好学习
            get_preferred_topics,
            get_preference_boost,
            // 🌐 网络工具 Commands
            fetch_hot_trends,
            web_search,
            web_fetch,
            browser_scrape,
            // 🔥 Firecrawl 舆情采集 Commands
            firecrawl_status,
            firecrawl_search,
            firecrawl_scrape,
            firecrawl_deep,
            // 🔄 自动更新 Commands
            open_url,
            // 🎨 图片设计专家 Commands
            image_generate,
            image_generate_with_ref,
            check_update,
            download_and_install_update,
            // ⏰ 定时任务 Commands (v4.7.0)
            create_scheduled_task,
            list_scheduled_tasks,
            update_scheduled_task,
            delete_scheduled_task,
            toggle_scheduled_task,
            run_scheduled_task_now,
            get_active_task_count,
            // 🗺️ 百度地图代理 Commands (v4.9.3)
            baidu_map::map_search,
            baidu_map::map_geocoding,
            baidu_map::map_reverse_geocoding,
            baidu_map::map_route,
            // 📚 RAG知识库 Commands (v5.1)
            get_kb_status,
            download_kb_index,
            init_knowledge_base,
            // 🧠 跨会话记忆 Commands (v5.1.1)
            store_cross_session_memory,
            // 📝 工作笔记MD Commands (v5.1.3)
            save_working_note,
            get_recent_notes,
            // 🧠 记忆压缩 Commands (v5.2)
            compress_memory,
            get_memory_context,
            // 📊 行为追踪 Commands (v5.2)
            record_interaction,
            get_behavior_context,
            // 🌱 知识演进 Commands (v5.2)
            evolve_knowledge,
            get_knowledge_stats,
            // 📋 统一日志 Commands (v5.2.1)
            claw_log::log_frontend,
            claw_log::get_recent_logs,
            claw_log::get_log_path,
            // 🦞 v5.3.9: 龙虾级本地文件系统 Commands
            local_fs::local_read_text_file,
            local_fs::local_read_binary_file,
            local_fs::local_write_text_file,
            local_fs::local_write_binary_file,
            local_fs::local_list_directory,
            local_fs::local_create_directory,
            local_fs::local_remove,
            local_fs::local_path_info,
            local_fs::local_get_home_dir,
            local_fs::local_get_common_dirs,
            // 🔧 B052: 图片设计专家数据持久化
            save_image_design_data,
            load_image_design_data,
        ])
.setup(|app| {
            // ShaoziClaw 勺子Claw starting...
            println!("ShaoziClaw 勺子Claw v1.0.1 (with Learning Loop) starting...");

            // 🔐 启动时恢复认证状态（解决"请先登录"bug）
            if let Some(state) = app.try_state::<Mutex<AppState>>() {
                match restore_auth_state(&state) {
                    Ok(_) => println!("✅ 认证状态已恢复"),
                    Err(e) => println!("⚠️ 认证状态恢复失败（将自动注册默认用户）: {}", e),
                }
            }

            // 🧠 初始化学习闭环系统
            match learning::init_learning_system(app.handle()) {
                Ok(ls) => {
                    if let Some(state) = app.try_state::<Mutex<Option<learning::LearningState>>>() {
                        if let Ok(mut g) = state.lock() { *g = Some(ls); }
                        println!("✅ 学习闭环系统初始化成功");
                    }
                }
                Err(e) => {
                    eprintln!("⚠️ 学习闭环系统初始化失败: {}", e);
                }
            }

            // 📚 初始化RAG知识库系统（v5.1）
            {
                // 🦞 v5.5.19: 先把打包资源解压到 app_data_dir，再初始化 RAG
                if let Err(e) = resource_unpacker::unpack_all(app.handle()) {
                    eprintln!("⚠️ 资源解包失败（不影响启动）: {}", e);
                }

                let data_dir = app.handle()
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                let handle = app.handle().clone();
                // setup不是async的，用tauri::async_runtime::spawn异步初始化（不能用tokio::spawn，会报"no reactor running"）
                tauri::async_runtime::spawn(async move {
                    match rag_engine::RagState::init(data_dir).await {
                        Ok(rs) => {
                            if let Some(state) = handle.try_state::<Mutex<Option<rag_engine::RagState>>>() {
                                if let Ok(mut g) = state.lock() { *g = Some(rs); }
                                println!("✅ RAG知识库系统初始化成功");
                            }
                        }
                        Err(e) => {
                            eprintln!("⚠️ RAG知识库系统初始化失败: {}", e);
                            if let Some(state) = handle.try_state::<Mutex<Option<rag_engine::RagState>>>() {
                                if let Ok(mut g) = state.lock() {
                                    *g = Some(rag_engine::RagState::uninitialized(
                                        handle.path().app_data_dir()
                                            .unwrap_or_else(|_| std::path::PathBuf::from("."))
                                            .join("knowledge-base")
                                    ));
                                }
                            }
                        }
                    }
                });
            }

            // 📋 初始化统一日志系统（v5.2.1）
            {
                let data_dir = app.handle()
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                claw_log::init_log(&data_dir);
                println!("✅ 日志系统初始化成功: {}/logs/claw.log", data_dir.display());
            }

            // ⏰ 初始化定时任务调度器（v4.7.0）
            {
                let data_dir = app.handle()
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                let scheduler_state = scheduler::SchedulerState::new(data_dir);
                app.manage(std::sync::Mutex::new(scheduler_state));
                scheduler::start_scheduler(app.handle().clone());
                println!("✅ 定时任务调度器初始化成功");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ShaoziClaw 勺子Claw");
}
