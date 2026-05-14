// ShaoziClaw 勺子Claw - 餐饮AI专家助手
// Tauri 2.0 后端核心

mod ai_engine;
mod auth;
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
/// B053: 硅基流动 Kolors（主力，实测可用）→ 备用 api.apiyi.com gpt-image-2
/// 返回base64编码的PNG数据
#[tauri::command]
async fn image_generate(prompt: String, size: Option<String>) -> Result<ImageGenerateResult, String> {
    let size = size.unwrap_or_else(|| "1024x1024".into());

    // 🔧 并行尝试两个生图模型，取最快成功的结果
    println!("[image_generate] 并行启动2个生图模型: prompt长度={}", prompt.len());
    let start = std::time::Instant::now();

    let (r1, r2) = tokio::join!(
        try_siliconflow_image(&prompt, &size),
        try_api_gpt_image_2(&prompt, &size)
    );

    // 按优先级返回第一个成功的结果
    if let Ok(r) = r1 {
        println!("[image_generate] 硅基流动Kolors成功，耗时{:?}", start.elapsed());
        return Ok(r);
    }
    if let Ok(r) = r2 {
        println!("[image_generate] gpt-image-2成功，耗时{:?}", start.elapsed());
        return Ok(r);
    }

    let errors = vec![
        format!("硅基流动Kolors: {}", r1.err().unwrap_or_default()),
        format!("gpt-image-2: {}", r2.err().unwrap_or_default()),
    ];
    Err(format!("所有图片模型失败: {}", errors.join(" | ")))
}

/// B053: 调用硅基流动 SiliconFlow 图片生成（Kolors模型，实测可用）
async fn try_siliconflow_image(prompt: &str, size: &str) -> Result<ImageGenerateResult, String> {
    let api_key = "sk-acutyiuetcukysdmtvevlufuhyetpedsxekukdywdgjymoru";
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP客户端失败: {}", e))?;

    let image_api_url = "https://api.siliconflow.cn/v1/images/generations";
    let body = serde_json::json!({
        "model": "Kwai-Kolors/Kolors",
        "prompt": prompt,
        "image_size": size,
        "batch_size": 1,
        "num_inference_steps": 25,
        "guidance_scale": 7.5,
    });

    println!("[image_generate] 硅基流动Kolors 请求中... size={}", size);
    let resp = client.post(image_api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            println!("[image_generate] 硅基流动请求失败: {}", e);
            format!("请求失败: {}", e)
        })?;

    let status = resp.status();
    let json: serde_json::Value = resp.json().await.map_err(|e| {
        println!("[image_generate] 硅基流动解析失败: {}", e);
        format!("解析失败: {}", e)
    })?;

    if !status.is_success() {
        let err_msg = json.get("error").and_then(|e| {
            if e.is_string() { e.as_str() }
            else { e.get("message").and_then(|m| m.as_str()) }
        }).unwrap_or("未知错误");
        println!("[image_generate] 硅基流动HTTP错误 {}: {}", status, err_msg);
        return Err(format!("HTTP {}: {}", status, err_msg));
    }

    // 硅基流动返回格式: {"images": [{"url": "..."}], "timings": {...}}
    if let Some(images) = json.get("images").and_then(|i| i.as_array()) {
        if let Some(first) = images.first() {
            if let Some(url) = first.get("url").and_then(|u| u.as_str()) {
                println!("[image_generate] 硅基流动返回图片URL，下载中...");
                // 下载图片并转为base64
                match download_image_to_b64(url).await {
                    Ok(b64) => {
                        println!("[image_generate] ✅ 硅基流动生图成功, b64长度: {}", b64.len());
                        return Ok(ImageGenerateResult { success: true, b64_data: Some(b64), error: None });
                    }
                    Err(e) => {
                        // URL下载失败，返回URL让前端处理
                        println!("[image_generate] 硅基流动下载失败: {}", e);
                        return Ok(ImageGenerateResult { success: true, b64_data: None, error: Some(format!("url:{}", url)) });
                    }
                }
            }
        }
    }

    let err_msg = json.get("message").and_then(|m| m.as_str()).unwrap_or("响应无图片数据");
    Err(err_msg.to_string())
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

/// 调用 apiyi gpt-image-2 (images/generations 端点)
async fn try_api_gpt_image_2(prompt: &str, size: &str) -> Result<ImageGenerateResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("HTTP客户端失败: {}", e))?;

    let body = serde_json::json!({
        "model": "gpt-image-2",
        "prompt": prompt,
        "n": 1,
        "size": size,
    });

    let resp = client.post("https://api.apiyi.com/v1/images/generations")
        .header("Authorization", "Bearer sk-ws6foW8LNsQYZYaDA60d274240A245489bC6D594Fb6eB7F4")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let err_status = resp.status();
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("解析失败: {}", e))?;

    if !err_status.is_success() {
        let msg = json.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).unwrap_or("未知错误");
        return Err(msg.to_string());
    }

    // images/generations 返回 data[0].b64_json 或 url
    if let Some(data) = json.get("data").and_then(|d| d.as_array()).and_then(|a| a.first()) {
        if let Some(b64) = data.get("b64_json").and_then(|b| b.as_str()) {
            return Ok(ImageGenerateResult { success: true, b64_data: Some(b64.to_string()), error: None });
        }
        if let Some(url) = data.get("url").and_then(|u| u.as_str()) {
            return Ok(ImageGenerateResult { success: true, b64_data: None, error: Some(format!("url:{}", url)) });
        }
    }
    Err("响应无图片数据".to_string())
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
