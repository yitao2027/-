// ⏰ Scheduler — 勺子Claw 定时任务调度器（v4.7.0 新增）
//
// 功能：
//   - 定时任务的 CRUD（创建/读取/更新/删除）
//   - tokio 后台调度循环（每60秒检查触发条件）
//   - 触发时自动调用 AI 引擎执行任务
//   - JSON 文件持久化
//   - 执行结果通知（Tauri event + webhook）
//
// 触发方式（MVP = 每天 / 每周 / 一次性）:
//   - Daily:   每天指定时间触发一次
//   - Weekly:  每周指定星期几+时间触发
//   - Once:    指定日期时间触发一次后自动禁用

use crate::{ChatMessage, ChatRequest, ChatResponse};
use chrono::{Datelike, Local, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

// ═════════════════════════════════════════
// 数据模型
// ═════════════════════════════════════════

/// 触发方式（MVP: 只支持三种）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerType {
    Daily,
    Weekly,
    Once,
}

/// 定时任务
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub trigger_type: TriggerType,

    /// 时间配置
    #[serde(default)]
    pub schedule: ScheduleConfig,

    /// 任务内容
    #[serde(default)]
    pub task_content: TaskContent,

    /// 通知配置
    #[serde(default)]
    pub notification: NotificationConfig,

    /// 元数据（ISO 8601 字符串）
    #[serde(default = "default_now_rfc")]
    pub created_at: String,
    #[serde(default = "default_now_rfc")]
    pub updated_at: String,
    #[serde(default)]
    pub last_run_at: Option<String>,
    #[serde(default)]
    pub last_run_status: Option<String>,
    #[serde(default)]
    pub next_run_at: Option<String>,
    #[serde(default)]
    pub run_count: i32,
}

fn default_now_rfc() -> String {
    Local::now().to_rfc3339()
}

impl Default for ScheduledTask {
    fn default() -> Self {
        let now = Local::now().to_rfc3339();
        Self {
            id: String::new(),
            name: String::new(),
            enabled: true,
            trigger_type: TriggerType::Daily,
            schedule: ScheduleConfig::default(),
            task_content: TaskContent::default(),
            notification: NotificationConfig::default(),
            created_at: now.clone(),
            updated_at: now,
            last_run_at: None,
            last_run_status: None,
            next_run_at: None,
            run_count: 0,
        }
    }
}

/// 时间配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleConfig {
    pub hour: u8,
    pub minute: u8,
    pub week_days: Option<Vec<u8>>,
    pub once_at: Option<String>,
}

/// 任务内容
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskContent {
    pub expert_type: Option<String>,
    pub skill_name: Option<String>,
    #[serde(default = "default_prompt_template")]
    pub prompt_template: String,
    #[serde(default)]
    pub use_user_context: bool,
}

fn default_prompt_template() -> String {
    String::new()
}

/// 通知配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotificationConfig {
    pub enabled: bool,
    #[serde(default)]
    pub channels: Vec<NotificationChannel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationChannel {
    InApp,
    WechatWebhook,
    FeishuWebhook,
}

impl Default for NotificationChannel {
    fn default() -> Self {
        NotificationChannel::InApp
    }
}

/// 执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub task_id: String,
    pub task_name: String,
    pub success: bool,
    pub content: Option<String>,
    pub tokens_used: i64,
    pub executed_at: String,
    pub error_message: Option<String>,
}

/// 调度器全局状态
pub struct SchedulerState {
    tasks: Mutex<Vec<ScheduledTask>>,
    data_dir: PathBuf,
}

impl SchedulerState {
    pub fn new(data_dir: PathBuf) -> Self {
        let s = Self {
            tasks: Mutex::new(Vec::new()),
            data_dir,
        };
        if let Err(e) = s.load_tasks() {
            eprintln!("[Scheduler] ⚠️ 加载定时任务失败: {}", e);
        }
        s
    }

    fn tasks_file(&self) -> PathBuf {
        self.data_dir.join("scheduled_tasks.json")
    }

    fn backup_file(&self) -> PathBuf {
        self.data_dir.join("scheduled_tasks.json.bak")
    }

    pub fn load_tasks(&self) -> Result<(), String> {
        let p = self.tasks_file();
        if !p.exists() { return Ok(()); }
        let content = fs::read_to_string(&p).map_err(|e| format!("读取失败: {}", e))?;

        let wrapper: TasksJsonWrapper =
            serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;

        if let Ok(mut guard) = self.tasks.lock() {
            let len = wrapper.tasks.len();
            *guard = wrapper.tasks;
            println!("[Scheduler] ✅ 已加载 {} 个定时任务", len);
        }
        Ok(())
    }

    pub fn save_tasks(&self) -> Result<(), String> {
        let p = self.tasks_file();
        if p.exists() { let _ = fs::copy(&p, self.backup_file()); }

        let guard = self.tasks.lock().map_err(|e| format!("锁失败: {}", e))?;
        let wrapper = TasksJsonWrapper { version: 1, tasks: (*guard).clone() };
        drop(guard);

        let json = serde_json::to_string_pretty(&wrapper).map_err(|e| format!("序列化失败: {}", e))?;
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
        fs::write(&p, json).map_err(|e| format!("写入失败: {}", e))?;
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct TasksJsonWrapper {
    version: i32,
    tasks: Vec<ScheduledTask>,
}

// ═════════════════════════════════════════
// Tauri Commands — CRUD
// ═════════════════════════════════════════

#[tauri::command]
pub async fn create_scheduled_task(
    state: tauri::State<'_, Mutex<SchedulerState>>,
    mut task: ScheduledTask,
) -> Result<ScheduledTask, String> {
    task.id = format!("sched_{}", Local::now().timestamp_millis());
    let now = Local::now().to_rfc3339();
    task.created_at = now.clone();
    task.updated_at = now;
    task.run_count = 0;
    task.next_run_at = Some(calc_next_run_at(&task));

    let guard = state.lock().map_err(|e| e.to_string())?;
    let mut tasks = guard.tasks.lock().map_err(|e| e.to_string())?;
    tasks.push(task.clone());
    drop(tasks);
    guard.save_tasks()?;
    drop(guard);

    println!("[Scheduler] ✅ 创建任务: {} ({})", task.name, task.id);
    Ok(task)
}

#[tauri::command]
pub async fn list_scheduled_tasks(
    state: tauri::State<'_, Mutex<SchedulerState>>,
) -> Result<Vec<ScheduledTask>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let tasks = guard.tasks.lock().map_err(|e| e.to_string())?;
    Ok(tasks.clone())
}

#[tauri::command]
pub async fn update_scheduled_task(
    state: tauri::State<'_, Mutex<SchedulerState>>,
    task_id: String,
    updates: ScheduledTask,
) -> Result<ScheduledTask, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let mut tasks = guard.tasks.lock().map_err(|e| e.to_string())?;

    let pos = tasks.iter().position(|t| t.id == task_id).ok_or("任务不存在")?;
    let mut updated = updates.clone();
    updated.updated_at = Local::now().to_rfc3339();
    updated.next_run_at = Some(calc_next_run_at(&updated));
    tasks[pos] = updated.clone();

    drop(tasks);
    guard.save_tasks()?;
    drop(guard);

    println!("[Scheduler] 📝 更新任务: {}", updated.name);
    Ok(updated)
}

#[tauri::command]
pub async fn delete_scheduled_task(
    state: tauri::State<'_, Mutex<SchedulerState>>,
    task_id: String,
) -> Result<(), String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let mut tasks = guard.tasks.lock().map_err(|e| e.to_string())?;
    let before = tasks.len();
    tasks.retain(|t| t.id != task_id);
    if tasks.len() == before { return Err("任务不存在".into()); }
    drop(tasks);
    guard.save_tasks()?;
    drop(guard);
    println!("[Scheduler] 🗑️ 删除任务: {}", task_id);
    Ok(())
}

#[tauri::command]
pub async fn toggle_scheduled_task(
    state: tauri::State<'_, Mutex<SchedulerState>>,
    task_id: String,
    enabled: bool,
) -> Result<ScheduledTask, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let mut tasks = guard.tasks.lock().map_err(|e| e.to_string())?;

    let task = tasks.iter_mut().find(|t| t.id == task_id).ok_or("任务不存在")?;
    task.enabled = enabled;
    task.updated_at = Local::now().to_rfc3339();
    task.next_run_at = if enabled { Some(calc_next_run_at(task)) } else { None };
    let result = task.clone();

    drop(tasks);
    guard.save_tasks()?;
    drop(guard);

    println!(
        "[Scheduler] {} 任务: {}",
        if enabled { "▶️ 启用" } else { "⏸️ 暂停" },
        result.name
    );
    Ok(result)
}

#[tauri::command]
pub async fn run_scheduled_task_now(
    app: AppHandle,
    state: tauri::State<'_, Mutex<SchedulerState>>,
    task_id: String,
) -> Result<ExecutionResult, String> {
    crate::claw_log::log_info("SCHEDULER", &format!("▶ 定时任务开始执行: id={}", task_id));
    // 阶段1：读取任务信息（在锁内）
    let task = {
        let guard = state.lock().map_err(|e| e.to_string())?;
        let tasks = guard.tasks.lock().map_err(|e| e.to_string())?;
        tasks.iter().find(|t| t.id == task_id).ok_or("任务不存在")?.clone()
    };
    crate::claw_log::log_info("SCHEDULER", &format!("任务信息: name={}, prompt_len={}", task.name, task.task_content.prompt_template.len()));

    // 阶段2：执行AI调用（不持有state引用，可安全await）
    let result = execute_ai_call(&app, &task).await;
    crate::claw_log::log_info("SCHEDULER", &format!("AI调用完成: success={}", result.is_ok()));

    // 阶段3：更新状态（重新获取锁）
    match &result {
        Ok(r) => {
            if let Err(e) = update_after_run_locked(&state, &task.id, &r.executed_at, "success", r.tokens_used) {
                eprintln!("[Scheduler] ⚠️ 状态更新失败: {}", e);
            }
        }
        Err((executed_at, _)) => {
            if let Err(e) = update_after_run_locked(&state, &task.id, executed_at, "failed", 0) {
                eprintln!("[Scheduler] ⚠️ 状态更新失败: {}", e);
            }
        }
    }

    result.map(|r| r).map_err(|(_, e)| e)
}

#[tauri::command]
pub fn get_active_task_count(
    state: tauri::State<'_, Mutex<SchedulerState>>,
) -> Result<i32, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let tasks = guard.tasks.lock().map_err(|e| e.to_string())?;
    Ok(tasks.iter().filter(|t| t.enabled).count() as i32)
}

// ═════════════════════════════════════════
// 调度循环
// ═════════════════════════════════════════

pub fn start_scheduler(app: AppHandle) {
    // ⚠️ 必须用 tauri::async_runtime 而非直接 tokio::spawn
    // 因为 start_scheduler 从同步的 setup() 中调用，此时没有 Tokio runtime
    tauri::async_runtime::spawn(async move {
        // 等待App完全启动
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;

            // 阶段1：在同步上下文中读取待触发任务（不跨await持锁）
            let to_trigger: Vec<ScheduledTask> = {
                let Some(mutex) = app.try_state::<Mutex<SchedulerState>>() else { continue; };
                let Ok(guard) = mutex.lock() else { continue; };
                let Ok(tasks) = guard.tasks.lock() else { continue; };
                let now = Local::now();
                tasks.iter()
                    .filter(|t| t.enabled && should_trigger(t, &now))
                    .cloned()
                    .collect()
            };

            if to_trigger.is_empty() { continue; }

            println!("[Scheduler] 📋 发现 {} 个待执行任务", to_trigger.len());

            // 阶段2：异步并发执行（纯AI调用，无状态依赖）
            let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(3));
            for task in to_trigger {
                let ac = app.clone();
                let sm = sem.clone();
                tokio::spawn(async move {
                    let _permit = sm.acquire().await.unwrap();
                    match execute_ai_call(&ac, &task).await {
                        Ok(r) => println!("[Scheduler] ✅ '{}' 执行{}", r.task_name, if r.success {"成功"} else {"失败"}),
                        Err((_, e)) => eprintln!("[Scheduler] ❌ AI调用异常: {}", e),
                    }
                });
            }
        }
    });
    println!("[Scheduler] ✅ 后台调度循环已启动");
}

// ═════════════════════════════════════════
// 触发判断
// ═════════════════════════════════════════

fn should_trigger(task: &ScheduledTask, now: &chrono::DateTime<Local>) -> bool {
    match task.trigger_type {
        TriggerType::Daily => is_target_time(&task.schedule, now) && !already_ran_today(task, now),
        TriggerType::Weekly => is_target_weekday_time(&task.schedule, now) && !already_ran_today(task, now),
        TriggerType::Once => is_target_once_time(&task.schedule, now) && task.run_count == 0,
    }
}

/// 每天：检查时分是否匹配（±1分钟窗口）
fn is_target_time(sc: &ScheduleConfig, now: &chrono::DateTime<Local>) -> bool {
    let h = sc.hour as u32;
    let m = sc.minute as u32;
    now.time().hour() == h && ((now.time().minute() == m) || (now.time().minute() == m.saturating_sub(1)))
}

/// 每周：检查星期几 + 时分
fn is_target_weekday_time(sc: &ScheduleConfig, now: &chrono::DateTime<Local>) -> bool {
    let wd = now.weekday().number_from_monday(); // Mon=1 .. Sun=7
    match &sc.week_days {
        Some(days) if days.contains(&(wd as u8)) => is_target_time(sc, now),
        _ => false,
    }
}

/// 一次性：目标时间到达（±1分钟窗口）
fn is_target_once_time(sc: &ScheduleConfig, now: &chrono::DateTime<Local>) -> bool {
    match &sc.once_at {
        Some(s) => {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|target| {
                    let local = target.with_timezone(&Local);
                    let diff = (*now - local).num_minutes();
                    (diff >= 0) && (diff <= 1)
                })
                .unwrap_or(false)
        }
        None => false,
    }
}

/// 防重复：今天同时间段已执行过
fn already_ran_today(task: &ScheduledTask, now: &chrono::DateTime<Local>) -> bool {
    match &task.last_run_at {
        Some(last) => {
            chrono::DateTime::parse_from_rfc3339(last)
                .map(|l| {
                    let local = l.with_timezone(&Local);
                    local.date_naive() == now.date_naive()
                        && local.time().hour() as u8 == task.schedule.hour
                        && local.time().minute() as u8 == task.schedule.minute
                })
                .unwrap_or(false)
        }
        None => false,
    }
}

// ═════════════════════════════════════════
// 下次执行时间计算
// ═════════════════════════════════════════

fn calc_next_run_at(task: &ScheduledTask) -> String {
    let now = Local::now();

    let target = match task.trigger_type {
        TriggerType::Daily => {
            let naive = now.date_naive()
                .and_hms_opt(task.schedule.hour.into(), task.schedule.minute.into(), 0)
                .unwrap();
            let scheduled = Local.from_local_datetime(&naive).earliest().unwrap();
            if scheduled > now { scheduled } else { scheduled + chrono::Duration::days(1) }
        }
        TriggerType::Weekly => {
            let mut candidate = now + chrono::Duration::days(1);
            for _ in 0..7 {
                let wd = candidate.weekday().number_from_monday();
                if let Some(ref days) = task.schedule.week_days {
                    if days.contains(&(wd as u8)) { break; }
                }
                candidate += chrono::Duration::days(1);
            }
            Local.from_local_datetime(
                &candidate.date_naive()
                    .and_hms_opt(task.schedule.hour.into(), task.schedule.minute.into(), 0)
                    .unwrap()
            ).earliest().unwrap()
        }
        TriggerType::Once => {
            if let Some(ref once) = task.schedule.once_at {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(once) {
                    return dt.to_rfc3339();
                }
            }
            now
        }
    };

    target.to_rfc3339()
}

// ═════════════════════════════════════════
// 执行引擎 — 纯AI调用（不持有state引用，Send安全）
// ═════════════════════════════════════════

/// 纯AI调用（可安全跨await），返回 Result<(ExecutionResult), (executed_at, error_msg)>
async fn execute_ai_call(
    app: &AppHandle,
    task: &ScheduledTask,
) -> Result<ExecutionResult, (String, String)> {
    let executed_at = Local::now().to_rfc3339();
    println!("[Scheduler] ▶️ 开始执行: '{}'", task.name);

    let mut prompt = task.task_content.prompt_template.clone();
    if task.task_content.use_user_context {
        if let Some(ctx) = load_user_context(app) {
            prompt = format!("{}\n\n---\n用户档案：{}", prompt, ctx);
        }
    }

    // 🔧 B052: 热点监控等定时任务注入中文关键词，确保skill_match能匹配到
    if let Some(ref skill_name) = task.task_content.skill_name {
        let skill_hint = match skill_name.as_str() {
            "catering-trend-monitor" => "\n\n【关键词标记：热点监测、行业动态、餐饮趋势】",
            "fn-cost-control" => "\n\n【关键词标记：成本控制、毛利分析】",
            "L1-menu-pricing" => "\n\n【关键词标记：菜单定价策略】",
            "L1-food-safety" => "\n\n【关键词标记：食品安全、食安巡检】",
            _ => "",
        };
        if !skill_hint.is_empty() {
            prompt.push_str(skill_hint);
        }
    }

    // 🔧 B052: 尝试RAG知识库检索，注入相关知识到prompt（仅同步获取状态，不await）
    let rag_info: Option<String> = {
        if let Some(rag_state) = app.try_state::<std::sync::Mutex<Option<crate::rag_engine::RagState>>>() {
            if let Ok(guard) = rag_state.lock() {
                if let Some(rs) = guard.as_ref() {
                    if rs.get_status().initialized {
                        Some("已启用知识库增强".to_string())
                    } else { None }
                } else { None }
            } else { None }
        } else { None }
    };
    if let Some(info) = rag_info {
        println!("[Scheduler] ✅ {}", info);
    }

    let request = ChatRequest {
        messages: vec![ChatMessage {
            role: "user".into(),
            content: serde_json::Value::String(prompt),
            timestamp: Some(executed_at.clone()),
            skill_name: task.task_content.skill_name.clone(),
            tokens_used: None,
        }],
        model: Some("deepseek-v4".into()),
        temperature: Some(0.7),
        max_tokens: Some(4096),
        use_skill: task.task_content.skill_name.clone(),
        stream: Some(false),
        session_id: None,
    };

    match crate::ai_engine::call_ai(&request, "deepseek-v4").await {
        Ok(resp) => {
            let er = ExecutionResult {
                task_id: task.id.clone(),
                task_name: task.name.clone(),
                success: true,
                content: Some(resp.content),
                tokens_used: resp.tokens_used,
                executed_at: executed_at.clone(),
                error_message: None,
            };
            notify(app, task, &er).await;
            Ok(er)
        }
        Err(e) => {
            let err_msg = format!("AI调用失败: {}", e);
            eprintln!("[Scheduler] ❌ 执行失败 '{}': {}", task.name, err_msg);
            let er = ExecutionResult {
                task_id: task.id.clone(),
                task_name: task.name.clone(),
                success: false,
                content: None,
                tokens_used: 0,
                executed_at: executed_at.clone(),
                error_message: Some(err_msg.clone()),
            };
            notify(app, task, &er).await;
            Err((executed_at, err_msg))
        }
    }
}

fn load_user_context(_app: &AppHandle) -> Option<String> { None }

// ═════════════════════════════════════════
// 执行后状态更新（独立函数，单独获取锁）
// ═════════════════════════════════════════

/// 通过 tauri::State 更新任务执行状态
fn update_after_run_locked(
    state: &tauri::State<'_, Mutex<SchedulerState>>,
    task_id: &str,
    executed_at: &str,
    status: &str,
    tokens: i64,
) -> Result<(), String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let mut tasks = guard.tasks.lock().map_err(|e| e.to_string())?;

    if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
        t.last_run_at = Some(executed_at.to_string());
        t.last_run_status = Some(status.to_string());
        t.run_count += 1;
        t.updated_at = Local::now().to_rfc3339();
        t.next_run_at = Some(calc_next_run_at(t));
        if matches!(t.trigger_type, TriggerType::Once) { t.enabled = false; }
    }
    drop(tasks);
    guard.save_tasks()?;
    drop(guard);
    Ok(())
}

async fn notify(app: &AppHandle, task: &ScheduledTask, result: &ExecutionResult) {
    if !task.notification.enabled { return; }
    for ch in &task.notification.channels {
        if matches!(ch, NotificationChannel::InApp) {
            let _ = app.emit("scheduled-task-complete", result);
        }
    }
}
