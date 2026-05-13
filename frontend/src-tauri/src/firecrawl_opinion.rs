// firecrawl_opinion.rs — 舆情采集模块
// 内置 Firecrawl API，已充值 3000 积分，仅供舆情监测场景使用
//
// API Key: fc-b0202f9dce3b4ef98c3d3593507b75f5（已内置，不对外开放）
// 计费规则：search=5积分，scrape=1积分/page，extract=3积分，deep=50积分

use chrono::Local;
use reqwest::blocking::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;

const FIRECRAWL_API_KEY: &str = "fc-b0202f9dce3b4ef98c3d3593507b75f5";
const FIRECRAWL_BASE_URL: &str = "https://api.firecrawl.dev/v0";
const INITIAL_CREDITS: i64 = 3000;

// ============================================================
// 数据结构
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct FirecrawlSearchResult {
    pub url: String,
    pub title: String,
    pub description: String,
    pub raw_content: Option<String>,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FirecrawlSearchResponse {
    pub success: bool,
    pub query: String,
    pub results: Vec<FirecrawlSearchResult>,
    pub credits_remaining: i64,
    pub credits_used: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FirecrawlScrapeResult {
    pub url: String,
    pub title: String,
    pub content: String,
    pub credits_remaining: i64,
    pub credits_used: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FirecrawlStatus {
    pub credits_total: i64,
    pub credits_remaining: i64,
    pub credits_used: i64,
    pub total_requests: i64,
    pub top_users: Vec<LeaderboardEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LeaderboardEntry {
    pub user_id: String,
    pub user_name: String,
    pub total_credits: i64,
    pub request_count: i64,
    pub rank: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FirecrawlDeepResponse {
    pub success: bool,
    pub summary: String,
    pub data: Vec<serde_json::Value>,
    pub credits_remaining: i64,
    pub credits_used: i64,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FirecrawlExtractResponse {
    pub success: bool,
    pub data: serde_json::Value,
    pub credits_remaining: i64,
    pub credits_used: i64,
    pub error: Option<String>,
}

// ============================================================
// 数据库管理
// ============================================================

fn get_db_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let dir = std::path::Path::new(&home).join(".shaoziclaw");
    std::fs::create_dir_all(&dir).ok();
    dir.join("firecrawl_credits.db").to_string_lossy().to_string()
}

fn get_conn() -> Result<Connection, String> {
    let conn = Connection::open(&get_db_path())
        .map_err(|e| format!("数据库打开失败: {}", e))?;

    // 初始化表
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS credit_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            operation TEXT NOT NULL,
            url TEXT,
            credits INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS credit_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_records_user ON credit_records(user_id);
        CREATE INDEX IF NOT EXISTS idx_records_time ON credit_records(created_at);
        ",
    )
    .map_err(|e| format!("初始化表失败: {}", e))?;

    // 确保初始积分记录存在
    conn.execute(
        "INSERT OR IGNORE INTO credit_meta (key, value) VALUES ('total_credits', ?)",
        params![INITIAL_CREDITS.to_string()],
    )
    .ok();

    Ok(conn)
}

// 获取剩余积分
fn get_remaining_credits(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT value FROM credit_meta WHERE key = 'credits_remaining'",
        [],
        |row| {
            let s: String = row.get(0)?;
            Ok(s.parse::<i64>().unwrap_or(INITIAL_CREDITS))
        },
    )
    .unwrap_or(INITIAL_CREDITS)
}

// 设置剩余积分
fn set_remaining_credits(conn: &Connection, credits: i64) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO credit_meta (key, value) VALUES ('credits_remaining', ?)",
        params![credits.to_string()],
    )
    .map_err(|e| format!("更新积分失败: {}", e))?;
    Ok(())
}

// 获取总消耗积分
fn get_total_used(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COALESCE(SUM(credits), 0) FROM credit_records WHERE operation != 'refund'",
        [],
        |row| row.get::<_, i64>(0),
    )
    .unwrap_or(0)
}

// 扣减积分并记录
fn deduct_and_record(
    conn: &Connection,
    user_id: &str,
    user_name: &str,
    operation: &str,
    url: Option<&str>,
    credits: i64,
) -> Result<i64, String> {
    let remaining = get_remaining_credits(conn);
    if remaining < credits {
        return Err(format!(
            "积分不足！剩余 {} 积分，本次需要 {} 积分",
            remaining, credits
        ));
    }

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO credit_records (user_id, user_name, operation, url, credits, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![user_id, user_name, operation, url.unwrap_or(""), credits, now],
    )
    .map_err(|e| format!("记录积分失败: {}", e))?;

    let new_remaining = remaining - credits;
    set_remaining_credits(conn, new_remaining)?;

    Ok(new_remaining)
}

// 获取排行榜 Top N
fn get_leaderboard(conn: &Connection, limit: i32) -> Vec<LeaderboardEntry> {
    let mut stmt = match conn.prepare(
        "SELECT user_id, user_name, SUM(credits) as total, COUNT(*) as cnt
         FROM credit_records
         WHERE operation != 'refund'
         GROUP BY user_id
         ORDER BY total DESC
         LIMIT ?",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let entries: Vec<LeaderboardEntry> = stmt
        .query_map([limit], |row| {
            Ok(LeaderboardEntry {
                user_id: row.get(0)?,
                user_name: row.get(1)?,
                total_credits: row.get::<_, i64>(2).unwrap_or(0),
                request_count: row.get::<_, i64>(3).unwrap_or(0),
                rank: 0,
            })
        })
        .ok()
        .map(|rows| {
            rows.filter_map(|r| r.ok())
                .enumerate()
                .map(|(i, mut e)| {
                    e.rank = (i + 1) as i32;
                    e
                })
                .collect()
        })
        .unwrap_or_default();

    entries
}

// ============================================================
// Firecrawl API 调用
// ============================================================

fn call_firecrawl(endpoint: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let url = format!("{}{}", FIRECRAWL_BASE_URL, endpoint);

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", FIRECRAWL_API_KEY))
        .json(&body)
        .send()
        .map_err(|e| format!("请求 Firecrawl 失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().unwrap_or_default();
        return Err(format!("Firecrawl API 错误 ({}): {}", status, body_text));
    }

    resp.json::<serde_json::Value>()
        .map_err(|e| format!("解析 Firecrawl 响应失败: {}", e))
}

fn call_firecrawl_search(query: &str) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "query": query,
        "limit": 20,
        "scrapeOptions": {
            "formats": ["markdown"],
            "onlyMainContent": true
        }
    });
    call_firecrawl("/search", body)
}

fn call_firecrawl_scrape(url: &str) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "url": url,
        "formats": ["markdown", "html"],
        "onlyMainContent": true
    });
    call_firecrawl("/scrape", body)
}

fn call_firecrawl_deep(query: &str) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "query": query,
        "limit": 10
    });
    call_firecrawl("/search", body)
}

// ============================================================
// Tauri Commands
// ============================================================

#[tauri::command]
pub async fn firecrawl_status() -> Result<FirecrawlStatus, String> {
    let conn = Connection::open(&get_db_path()).map_err(|e| e.to_string())?;

    let credits_remaining = get_remaining_credits(&conn);
    let credits_used = get_total_used(&conn);
    let top_users = get_leaderboard(&conn, 20);

    Ok(FirecrawlStatus {
        credits_total: INITIAL_CREDITS,
        credits_remaining,
        credits_used,
        total_requests: top_users.iter().map(|e| e.request_count).sum(),
        top_users,
    })
}

#[tauri::command]
pub async fn firecrawl_search(
    query: String,
    user_id: String,
    user_name: String,
) -> Result<FirecrawlSearchResponse, String> {
    // search 消耗 5 积分
    const SEARCH_COST: i64 = 5;

    let conn = Connection::open(&get_db_path()).map_err(|e| e.to_string())?;
    let remaining_before = get_remaining_credits(&conn);

    if remaining_before < SEARCH_COST {
        return Err(format!(
            "积分不足！剩余 {} 积分，搜索需要 {} 积分",
            remaining_before, SEARCH_COST
        ));
    }

    // 调用 Firecrawl
    let data = call_firecrawl_search(&query)?;

    // 解析响应
    let success = data.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
    if !success {
        let error = data.get("error").map(|v| v.to_string()).unwrap_or_default();
        return Err(format!("Firecrawl 搜索失败: {}", error));
    }

    // 扣积分
    let new_remaining = deduct_and_record(
        &conn,
        &user_id,
        &user_name,
        "search",
        None,
        SEARCH_COST,
    )?;

    // 解析结果
    let mut results = Vec::new();
    if let Some(arr) = data.get("data").and_then(|v| v.as_array()) {
        for item in arr.iter() {
            results.push(FirecrawlSearchResult {
                url: item.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                title: item.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                description: item
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                raw_content: item
                    .get("rawContent")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                score: item
                    .get("score")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0),
            });
        }
    }

    Ok(FirecrawlSearchResponse {
        success: true,
        query,
        results,
        credits_remaining: new_remaining,
        credits_used: SEARCH_COST,
    })
}

#[tauri::command]
pub async fn firecrawl_scrape(
    url: String,
    user_id: String,
    user_name: String,
) -> Result<FirecrawlScrapeResult, String> {
    // scrape 每个页面 1 积分
    const SCRAPE_COST: i64 = 1;

    let conn = Connection::open(&get_db_path()).map_err(|e| e.to_string())?;
    let remaining_before = get_remaining_credits(&conn);

    if remaining_before < SCRAPE_COST {
        return Err(format!(
            "积分不足！剩余 {} 积分，抓取需要 {} 积分/页",
            remaining_before, SCRAPE_COST
        ));
    }

    // 调用 Firecrawl
    let data = call_firecrawl_scrape(&url)?;

    let success = data.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
    if !success {
        let error = data.get("error").map(|v| v.to_string()).unwrap_or_default();
        return Err(format!("Firecrawl 抓取失败: {}", error));
    }

    // 扣积分
    let new_remaining = deduct_and_record(
        &conn,
        &user_id,
        &user_name,
        "scrape",
        Some(&url),
        SCRAPE_COST,
    )?;

    let title = data
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let content = data
        .get("markdown")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(FirecrawlScrapeResult {
        url,
        title,
        content,
        credits_remaining: new_remaining,
        credits_used: SCRAPE_COST,
    })
}

#[tauri::command]
pub async fn firecrawl_deep(
    query: String,
    user_id: String,
    user_name: String,
) -> Result<FirecrawlDeepResponse, String> {
    // deep 消耗 50 积分（限额使用）
    const DEEP_COST: i64 = 50;

    let conn = Connection::open(&get_db_path()).map_err(|e| e.to_string())?;
    let remaining_before = get_remaining_credits(&conn);

    if remaining_before < DEEP_COST {
        return Err(format!(
            "积分不足！剩余 {} 积分，深度研究需要 {} 积分",
            remaining_before, DEEP_COST
        ));
    }

    // 调用 Firecrawl
    let data = call_firecrawl_deep(&query)?;

    let success = data.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
    let error_msg = data.get("error").and_then(|v| v.as_str()).map(|s| s.to_string());

    // 扣积分（即使部分失败也扣）
    let new_remaining = deduct_and_record(
        &conn,
        &user_id,
        &user_name,
        "deep",
        None,
        DEEP_COST,
    )
    .unwrap_or(remaining_before);

    let summary = data
        .get("data")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .take(5)
                .filter_map(|item| {
                    item.get("title")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                })
                .collect::<Vec<_>>()
                .join(" | ")
        })
        .unwrap_or_default();

    Ok(FirecrawlDeepResponse {
        success,
        summary,
        data: data.get("data").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
        credits_remaining: new_remaining,
        credits_used: DEEP_COST,
        error: error_msg,
    })
}

// ============================================================
// 内部状态（用于刷新通知）
// ============================================================

lazy_static::lazy_static! {
    pub static ref LAST_STATUS: Mutex<Option<FirecrawlStatus>> = Mutex::new(None);
}

pub fn cache_status(status: FirecrawlStatus) {
    if let Ok(mut cache) = LAST_STATUS.lock() {
        *cache = Some(status);
    }
}
