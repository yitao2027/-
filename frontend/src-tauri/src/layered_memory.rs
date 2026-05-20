// ============================================================================
// 勺子Claw v5.5.34 — 分层记忆模块 (layered_memory)
// ============================================================================
// TencentDB-Agent-Memory 理念落地：分层记忆 + 上下文卸载 + Mermaid压缩
//
// 四层架构：
//   L0: 原始对话 → 复用现有聊天记录（不在此模块存储）
//   L1: 原子事实 → SQLite表（用户基本信息、偏好、关键配置）
//   L2: 场景块   → Markdown文件（每次对话的摘要+决策+结果）
//   L3: 用户画像 → persona.md（综合L1+L2生成的用户全貌）
//
// 上下文卸载：长输出 → 文件 + 摘要（省30-61% Token）
// Mermaid压缩：复杂任务状态 → 符号图（几十token）
// ============================================================================

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

// ============================================================================
// 数据结构
// ============================================================================

/// L1 原子事实
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AtomicFact {
    pub id: Option<i64>,
    pub category: String,   // "identity" | "preference" | "config" | "habit"
    pub key: String,        // 事实键，如 "restaurant_type"
    pub value: String,      // 事实值，如 "火锅"
    pub confidence: f64,    // 0.0-1.0
    pub source: String,     // "user_stated" | "inferred"
    pub updated_at: String,
}

/// L2 场景块
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioBlock {
    pub session_id: String,
    pub date: String,
    pub topic: String,
    pub problem: String,       // 用户遇到的问题
    pub solution: String,      // 解决方案
    pub outcome: String,       // 结果/结论
    pub key_facts: Vec<String>, // 关键事实
    pub tags: Vec<String>,
}

/// L3 用户画像
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserPersona {
    pub user_id: String,
    pub identity: String,      // "XX餐饮老板，3家店，主营火锅"
    pub top_concerns: Vec<String>, // 最关心的问题
    pub preferences: Vec<String>,  // 偏好
    pub active_projects: Vec<String>, // 正在推进的事
    pub last_updated: String,
}

/// 上下文卸载结果
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OffloadResult {
    pub summary: String,       // 注入 prompt 的摘要（≤200字）
    pub ref_path: String,      // 完整内容存储路径
    pub original_len: usize,   // 原始字符数
    pub summary_len: usize,    // 摘要字符数
    pub saved_ratio: f64,      // 节省比例
}

/// 分层记忆注入结果（用于 system prompt）
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayeredContext {
    pub persona_summary: String,   // L3 画像摘要
    pub recent_scenarios: String,  // L2 最近场景
    pub key_facts: String,         // L1 关键事实
    pub total_tokens_est: usize,   // 估算 token 数
}

// ============================================================================
// 数据库初始化
// ============================================================================

const LAYERED_DB_NAME: &str = "layered_memory.db";

fn open_db(data_dir: &Path) -> Result<rusqlite::Connection, String> {
    let db_path = data_dir.join(LAYERED_DB_NAME);
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("打开分层记忆DB失败: {}", e))?;
    ensure_tables(&conn)?;
    Ok(conn)
}

fn ensure_tables(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS atomic_facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL DEFAULT 'identity',
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 0.8,
            source TEXT NOT NULL DEFAULT 'user_stated',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(key)
        );
        CREATE TABLE IF NOT EXISTS scenario_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            date TEXT NOT NULL,
            topic TEXT NOT NULL,
            problem TEXT NOT NULL DEFAULT '',
            solution TEXT NOT NULL DEFAULT '',
            outcome TEXT NOT NULL DEFAULT '',
            key_facts TEXT NOT NULL DEFAULT '[]',
            tags TEXT NOT NULL DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_scenario_date ON scenario_blocks(date DESC);
        CREATE INDEX IF NOT EXISTS idx_fact_category ON atomic_facts(category);"
    ).map_err(|e| format!("分层记忆建表失败: {}", e))?;
    Ok(())
}

// ============================================================================
// L1 原子事实操作
// ============================================================================

/// 写入/更新原子事实（upsert by key）
pub fn upsert_fact(data_dir: &Path, fact: &AtomicFact) -> Result<(), String> {
    let conn = open_db(data_dir)?;
    conn.execute(
        "INSERT INTO atomic_facts (category, key, value, confidence, source, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             confidence = excluded.confidence,
             source = excluded.source,
             updated_at = excluded.updated_at",
        params![fact.category, fact.key, fact.value, fact.confidence, fact.source],
    ).map_err(|e| format!("写入原子事实失败: {}", e))?;
    Ok(())
}

/// 批量写入原子事实
pub fn upsert_facts(data_dir: &Path, facts: &[AtomicFact]) -> Result<usize, String> {
    let conn = open_db(data_dir)?;
    let mut count = 0;
    for fact in facts {
        conn.execute(
            "INSERT INTO atomic_facts (category, key, value, confidence, source, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
                 value = excluded.value,
                 confidence = excluded.confidence,
                 source = excluded.source,
                 updated_at = excluded.updated_at",
            params![fact.category, fact.key, fact.value, fact.confidence, fact.source],
        ).map_err(|e| format!("写入原子事实失败: {}", e))?;
        count += 1;
    }
    Ok(count)
}

/// 读取所有原子事实
pub fn get_all_facts(data_dir: &Path) -> Result<Vec<AtomicFact>, String> {
    let conn = open_db(data_dir)?;
    let mut stmt = conn.prepare(
        "SELECT id, category, key, value, confidence, source, updated_at
         FROM atomic_facts ORDER BY category, key"
    ).map_err(|e| format!("查询原子事实失败: {}", e))?;

    let facts = stmt.query_map([], |row| {
        Ok(AtomicFact {
            id: Some(row.get(0)?),
            category: row.get(1)?,
            key: row.get(2)?,
            value: row.get(3)?,
            confidence: row.get(4)?,
            source: row.get(5)?,
            updated_at: row.get(6)?,
        })
    }).map_err(|e| format!("遍历原子事实失败: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(facts)
}

/// 按分类读取原子事实
pub fn get_facts_by_category(data_dir: &Path, category: &str) -> Result<Vec<AtomicFact>, String> {
    let conn = open_db(data_dir)?;
    let mut stmt = conn.prepare(
        "SELECT id, category, key, value, confidence, source, updated_at
         FROM atomic_facts WHERE category = ?1 ORDER BY key"
    ).map_err(|e| format!("查询原子事实失败: {}", e))?;

    let facts = stmt.query_map(params![category], |row| {
        Ok(AtomicFact {
            id: Some(row.get(0)?),
            category: row.get(1)?,
            key: row.get(2)?,
            value: row.get(3)?,
            confidence: row.get(4)?,
            source: row.get(5)?,
            updated_at: row.get(6)?,
        })
    }).map_err(|e| format!("遍历原子事实失败: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(facts)
}

// ============================================================================
// L2 场景块操作
// ============================================================================

/// 写入场景块
pub fn save_scenario(data_dir: &Path, scenario: &ScenarioBlock) -> Result<(), String> {
    let conn = open_db(data_dir)?;
    let key_facts_json = serde_json::to_string(&scenario.key_facts)
        .unwrap_or_else(|_| "[]".to_string());
    let tags_json = serde_json::to_string(&scenario.tags)
        .unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO scenario_blocks (session_id, date, topic, problem, solution, outcome, key_facts, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            scenario.session_id, scenario.date, scenario.topic,
            scenario.problem, scenario.solution, scenario.outcome,
            key_facts_json, tags_json
        ],
    ).map_err(|e| format!("写入场景块失败: {}", e))?;

    // 同时写入 Markdown 文件（便于人工查阅）
    let scenario_dir = data_dir.join("scenarios");
    let _ = fs::create_dir_all(&scenario_dir);
    let filename = format!("{}-{}.md", scenario.date, &scenario.session_id[..8.min(scenario.session_id.len())]);
    let md_content = format!(
        "# {}\n\n**日期**: {}\n**会话**: {}\n\n## 问题\n{}\n\n## 解决方案\n{}\n\n## 结果\n{}\n\n## 关键事实\n{}\n\n## 标签\n{}\n",
        scenario.topic, scenario.date, scenario.session_id,
        scenario.problem, scenario.solution, scenario.outcome,
        scenario.key_facts.iter().map(|f| format!("- {}", f)).collect::<Vec<_>>().join("\n"),
        scenario.tags.join(", ")
    );
    let _ = fs::write(scenario_dir.join(&filename), md_content);

    Ok(())
}

/// 读取最近N个场景块
pub fn get_recent_scenarios(data_dir: &Path, limit: usize) -> Result<Vec<ScenarioBlock>, String> {
    let conn = open_db(data_dir)?;
    let mut stmt = conn.prepare(
        "SELECT session_id, date, topic, problem, solution, outcome, key_facts, tags
         FROM scenario_blocks ORDER BY created_at DESC LIMIT ?1"
    ).map_err(|e| format!("查询场景块失败: {}", e))?;

    let scenarios = stmt.query_map(params![limit as i64], |row| {
        let key_facts_str: String = row.get(6)?;
        let tags_str: String = row.get(7)?;
        Ok(ScenarioBlock {
            session_id: row.get(0)?,
            date: row.get(1)?,
            topic: row.get(2)?,
            problem: row.get(3)?,
            solution: row.get(4)?,
            outcome: row.get(5)?,
            key_facts: serde_json::from_str(&key_facts_str).unwrap_or_default(),
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
        })
    }).map_err(|e| format!("遍历场景块失败: {}", e))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(scenarios)
}

// ============================================================================
// L3 用户画像操作
// ============================================================================

fn persona_path(data_dir: &Path, user_id: &str) -> PathBuf {
    data_dir.join(format!("persona-{}.md", &user_id[..8.min(user_id.len())]))
}

/// 读取用户画像
pub fn get_persona(data_dir: &Path, user_id: &str) -> Option<UserPersona> {
    let path = persona_path(data_dir, user_id);
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(&path).ok()?;
    // 从 Markdown 中提取 JSON frontmatter（---之间的内容）
    if content.starts_with("---") {
        let end = content[3..].find("---")?;
        let yaml_str = &content[3..end + 3];
        // 简单解析：找 JSON 块
        if let Some(json_start) = yaml_str.find('{') {
            if let Some(json_end) = yaml_str.rfind('}') {
                let json_str = &yaml_str[json_start..=json_end];
                return serde_json::from_str(json_str).ok();
            }
        }
    }
    None
}

/// 保存用户画像
pub fn save_persona(data_dir: &Path, persona: &UserPersona) -> Result<(), String> {
    let path = persona_path(data_dir, &persona.user_id);
    let json = serde_json::to_string_pretty(persona)
        .map_err(|e| format!("序列化画像失败: {}", e))?;

    let md_content = format!(
        "---\n{}\n---\n\n# 用户画像\n\n**身份**: {}\n\n**核心关注**:\n{}\n\n**偏好**:\n{}\n\n**进行中的项目**:\n{}\n\n**最后更新**: {}\n",
        json,
        persona.identity,
        persona.top_concerns.iter().map(|c| format!("- {}", c)).collect::<Vec<_>>().join("\n"),
        persona.preferences.iter().map(|p| format!("- {}", p)).collect::<Vec<_>>().join("\n"),
        persona.active_projects.iter().map(|p| format!("- {}", p)).collect::<Vec<_>>().join("\n"),
        persona.last_updated
    );

    fs::write(&path, md_content).map_err(|e| format!("写入画像失败: {}", e))?;
    Ok(())
}

/// 从 L1+L2 自动更新 L3 用户画像（本地规则，不调 LLM）
pub fn refresh_persona_from_facts(data_dir: &Path, user_id: &str) -> Result<UserPersona, String> {
    let facts = get_all_facts(data_dir)?;
    let scenarios = get_recent_scenarios(data_dir, 10)?;

    // 从 identity 类事实构建身份描述
    let identity_facts: Vec<String> = facts.iter()
        .filter(|f| f.category == "identity")
        .map(|f| format!("{}:{}", f.key, f.value))
        .collect();
    let identity = if identity_facts.is_empty() {
        "餐饮从业者".to_string()
    } else {
        identity_facts.join("，")
    };

    // 从 preference 类事实提取偏好
    let preferences: Vec<String> = facts.iter()
        .filter(|f| f.category == "preference")
        .map(|f| format!("{}: {}", f.key, f.value))
        .collect();

    // 从最近场景提取关注点
    let top_concerns: Vec<String> = scenarios.iter()
        .take(5)
        .map(|s| s.topic.clone())
        .collect();

    // 从 project 类事实提取进行中项目
    let active_projects: Vec<String> = facts.iter()
        .filter(|f| f.category == "project")
        .map(|f| f.value.clone())
        .collect();

    let persona = UserPersona {
        user_id: user_id.to_string(),
        identity,
        top_concerns,
        preferences,
        active_projects,
        last_updated: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    save_persona(data_dir, &persona)?;
    Ok(persona)
}

// ============================================================================
// 上下文卸载（Context Offload）
// ============================================================================

/// 将长输出卸载到文件，返回摘要+引用路径
/// 当内容超过 threshold_chars 时触发卸载
pub fn offload_if_long(
    data_dir: &Path,
    content: &str,
    label: &str,
    threshold_chars: usize,
) -> OffloadResult {
    let original_len = content.chars().count();

    if original_len <= threshold_chars {
        // 不需要卸载
        return OffloadResult {
            summary: content.to_string(),
            ref_path: String::new(),
            original_len,
            summary_len: original_len,
            saved_ratio: 0.0,
        };
    }

    // 生成文件名
    let offload_dir = data_dir.join("offloads");
    let _ = fs::create_dir_all(&offload_dir);
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("{}_{}.txt", label.replace(' ', "_"), timestamp);
    let file_path = offload_dir.join(&filename);

    // 写入完整内容
    let _ = fs::write(&file_path, content);

    // 生成摘要（取前200字 + 省略提示）
    let summary_chars: String = content.chars().take(200).collect();
    let summary = format!(
        "{}...\n[完整内容已卸载至: {}，共{}字]",
        summary_chars,
        file_path.to_string_lossy(),
        original_len
    );
    let summary_len = summary.chars().count();
    let saved_ratio = 1.0 - (summary_len as f64 / original_len as f64);

    OffloadResult {
        summary,
        ref_path: file_path.to_string_lossy().to_string(),
        original_len,
        summary_len,
        saved_ratio,
    }
}

// ============================================================================
// Mermaid 状态图压缩
// ============================================================================

/// 将任务状态列表压缩为 Mermaid 图（几十token代替几百字描述）
pub fn compress_to_mermaid(title: &str, states: &[(String, String, String)]) -> String {
    // states: Vec<(from_state, to_state, label)>
    let mut lines = vec![
        format!("```mermaid"),
        format!("stateDiagram-v2"),
        format!("    title: {}", title),
    ];
    for (from, to, label) in states {
        if label.is_empty() {
            lines.push(format!("    {} --> {}", from, to));
        } else {
            lines.push(format!("    {} --> {} : {}", from, to, label));
        }
    }
    lines.push("```".to_string());
    lines.join("\n")
}

/// 将任务进度压缩为简洁的 Mermaid 甘特图
pub fn compress_tasks_to_mermaid(tasks: &[(String, String, String)]) -> String {
    // tasks: Vec<(task_name, status, section)>
    let mut lines = vec![
        "```mermaid".to_string(),
        "gantt".to_string(),
        "    dateFormat X".to_string(),
        "    axisFormat %s".to_string(),
    ];

    let mut current_section = String::new();
    for (name, status, section) in tasks {
        if section != &current_section {
            lines.push(format!("    section {}", section));
            current_section = section.clone();
        }
        let status_marker = match status.as_str() {
            "done" => "done,",
            "active" => "active,",
            "crit" => "crit,",
            _ => "",
        };
        lines.push(format!("    {} : {}t1, 0, 1", name, status_marker));
    }
    lines.push("```".to_string());
    lines.join("\n")
}

// ============================================================================
// 统一注入接口（供 main.rs 调用）
// ============================================================================

/// 构建分层记忆注入上下文（用于 system prompt）
pub fn build_layered_context(data_dir: &Path, user_id: &str) -> LayeredContext {
    // L3 画像
    let persona_summary = if let Some(persona) = get_persona(data_dir, user_id) {
        format!(
            "【用户画像】{}\n关注: {}\n偏好: {}",
            persona.identity,
            persona.top_concerns.join("、"),
            persona.preferences.first().cloned().unwrap_or_default()
        )
    } else {
        String::new()
    };

    // L2 最近场景（最近3个）
    let recent_scenarios = match get_recent_scenarios(data_dir, 3) {
        Ok(scenarios) if !scenarios.is_empty() => {
            let items: Vec<String> = scenarios.iter()
                .map(|s| format!("• [{}] {} → {}", s.date, s.topic, s.outcome))
                .collect();
            format!("【近期场景】\n{}", items.join("\n"))
        }
        _ => String::new(),
    };

    // L1 关键事实（identity + preference 类）
    let key_facts = match get_all_facts(data_dir) {
        Ok(facts) if !facts.is_empty() => {
            let items: Vec<String> = facts.iter()
                .filter(|f| f.category == "identity" || f.category == "preference")
                .take(8)
                .map(|f| format!("{}={}", f.key, f.value))
                .collect();
            if items.is_empty() {
                String::new()
            } else {
                format!("【关键事实】{}", items.join("；"))
            }
        }
        _ => String::new(),
    };

    let total_tokens_est = (persona_summary.len() + recent_scenarios.len() + key_facts.len()) / 4;

    LayeredContext {
        persona_summary,
        recent_scenarios,
        key_facts,
        total_tokens_est,
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// 写入原子事实
#[tauri::command]
pub fn store_atomic_fact(
    app: tauri::AppHandle,
    category: String,
    key: String,
    value: String,
    confidence: f64,
    source: String,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let fact = AtomicFact {
        id: None,
        category,
        key,
        value,
        confidence,
        source,
        updated_at: String::new(),
    };
    upsert_fact(&data_dir, &fact)
}

/// 批量写入原子事实
#[tauri::command]
pub fn store_atomic_facts(
    app: tauri::AppHandle,
    facts: Vec<AtomicFact>,
) -> Result<usize, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    upsert_facts(&data_dir, &facts)
}

/// 写入场景块
#[tauri::command]
pub fn store_scenario_block(
    app: tauri::AppHandle,
    scenario: ScenarioBlock,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    save_scenario(&data_dir, &scenario)
}

/// 获取分层记忆注入上下文
#[tauri::command]
pub fn get_layered_context(
    app: tauri::AppHandle,
    user_id: String,
) -> LayeredContext {
    let data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("/tmp/shaoziclaw"));
    build_layered_context(&data_dir, &user_id)
}

/// 刷新用户画像（从 L1+L2 重新生成）
#[tauri::command]
pub fn refresh_user_persona(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<UserPersona, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    refresh_persona_from_facts(&data_dir, &user_id)
}

/// 上下文卸载（长输出 → 文件+摘要）
#[tauri::command]
pub fn offload_long_content(
    app: tauri::AppHandle,
    content: String,
    label: String,
    threshold_chars: usize,
) -> OffloadResult {
    let data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("/tmp/shaoziclaw"));
    offload_if_long(&data_dir, &content, &label, threshold_chars)
}

/// 生成 Mermaid 状态图
#[tauri::command]
pub fn generate_mermaid_states(
    title: String,
    states: Vec<(String, String, String)>,
) -> String {
    compress_to_mermaid(&title, &states)
}

/// 获取所有原子事实
#[tauri::command]
pub fn get_atomic_facts(
    app: tauri::AppHandle,
    category: Option<String>,
) -> Vec<AtomicFact> {
    let data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("/tmp/shaoziclaw"));
    match category {
        Some(cat) => get_facts_by_category(&data_dir, &cat).unwrap_or_default(),
        None => get_all_facts(&data_dir).unwrap_or_default(),
    }
}
