// ============================================================================
// 勺子Claw v5.2 — 知识演进模块 (knowledge_evolution)
// ============================================================================
// 从对话中提取新知识 → LLM结构化 → 本地SQLite+FTS5存储 → RAG检索时追加
//
// 实现"越用越懂行"：
//   ① 对话后自动提取新知识点
//   ② 本地存储 + 全文搜索
//   ③ 下次RAG检索时自动包含演化知识
// ============================================================================

use rusqlite::params;
use serde::{Deserialize, Serialize};

/// 提取出的知识点
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeItem {
    pub topic: String,
    pub content: String,
    pub source: String,       // "conversation" | "user_input" | "ai_response"
    pub confidence: f64,      // 0.0-1.0
    pub tags: Vec<String>,
}

const EVO_DB_NAME: &str = "knowledge_evolution.db";

// ============================================================================
// 数据库操作
// ============================================================================

fn ensure_table(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS evolved_knowledge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            content TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'conversation',
            confidence REAL NOT NULL DEFAULT 0.5,
            tags TEXT NOT NULL DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS evolved_fts USING fts5(
            topic, content, content=evolved_knowledge, content_rowid=rowid
        );
        CREATE TRIGGER IF NOT EXISTS evo_ai AFTER INSERT ON evolved_knowledge BEGIN
            INSERT INTO evolved_fts(rowid, topic, content) VALUES (new.id, new.topic, new.content);
        END;"
    ).map_err(|e| format!("知识演进建表失败: {}", e))?;
    Ok(())
}

// ============================================================================
// ① 从对话中提取新知识（调LLM）
// ============================================================================

pub async fn extract_knowledge(
    user_query: &str,
    ai_response: &str,
    api_key: &str,
    api_base: &str,
    model: &str,
) -> Result<Vec<KnowledgeItem>, String> {
    let prompt = format!(
        r#"你是知识提取助手。从以下对话中提取有价值的餐饮行业新知识。

规则：
1. 只提取新增的事实/数据/经验（已在通用知识中的忽略）
2. topic: 知识主题，≤20字
3. content: 知识内容，≤200字
4. confidence: 可信度0.0-1.0（用户明确说的=0.9，AI推断的=0.5）
5. tags: 相关标签数组

返回纯JSON数组：
[{{"topic":"...","content":"...","source":"user_input","confidence":0.9,"tags":[]}}]

用户问题：{user}
AI回复：{ai}"#,
        user = &user_query[..user_query.len().min(500)],
        ai = &ai_response[..ai_response.len().min(1000)],
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("client err: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 1024,
        "stream": false
    });

    let resp = client
        .post(&format!("{}/chat/completions", api_base))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("知识提取API错误: {}", e))?;

    let v: serde_json::Value = resp.json().await.map_err(|e| format!("{}", e))?;
    let raw = v["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("[]");

    let json_str = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let items: Vec<KnowledgeItem> =
        serde_json::from_str(json_str).unwrap_or_default();

    Ok(items)
}

// ============================================================================
// ② 存储知识点
// ============================================================================

pub fn store_knowledge(
    app_data_dir: &std::path::Path,
    items: &[KnowledgeItem],
) -> Result<usize, String> {
    if items.is_empty() { return Ok(0); }

    let db_dir = app_data_dir.join("learning");
    std::fs::create_dir_all(&db_dir).map_err(|e| format!("{}", e))?;

    let conn = rusqlite::Connection::open(db_dir.join(EVO_DB_NAME))
        .map_err(|e| format!("打开知识演进库失败: {}", e))?;

    ensure_table(&conn)?;

    let mut count = 0;
    for item in items {
        // 去重：检查近30天是否有相同topic+content开头
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM evolved_knowledge
             WHERE topic = ?1 AND content LIKE ?2
             AND created_at > datetime('now', '-30 days')",
            params![item.topic, format!("{}%", &item.content[..item.content.len().min(50)])],
            |r| r.get(0),
        ).unwrap_or(false);

        if exists { continue; }

        conn.execute(
            "INSERT INTO evolved_knowledge (topic, content, source, confidence, tags)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                item.topic,
                item.content,
                item.source,
                item.confidence,
                serde_json::to_string(&item.tags).unwrap_or_default(),
            ],
        ).map_err(|e| format!("插入知识失败: {}", e))?;
        count += 1;
    }

    if count > 0 {
        println!("🌱 知识演进: +{} 条新知识", count);
    }
    Ok(count)
}

// ============================================================================
// ③ 搜索演化知识（FTS5全文检索）
// ============================================================================

pub fn search_evolved_knowledge(
    app_data_dir: &std::path::Path,
    query: &str,
    limit: usize,
) -> Result<Vec<KnowledgeItem>, String> {
    let db_path = app_data_dir.join("learning").join(EVO_DB_NAME);
    if !db_path.exists() { return Ok(Vec::new()); }

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("打开知识演进库失败: {}", e))?;

    // FTS5全文搜索
    let mut stmt = conn.prepare(
        "SELECT k.topic, k.content, k.source, k.confidence, k.tags
         FROM evolved_knowledge k
         JOIN evolved_fts f ON k.id = f.rowid
         WHERE evolved_fts MATCH ?1
         ORDER BY rank
         LIMIT ?2"
    ).map_err(|e| e.to_string())?;

    let rows: Vec<KnowledgeItem> = stmt.query_map(
        params![query, limit as i64],
        |r| Ok(KnowledgeItem {
            topic: r.get(0)?,
            content: r.get(1)?,
            source: r.get(2)?,
            confidence: r.get(3)?,
            tags: serde_json::from_str(&r.get::<_, String>(4)?).unwrap_or_default(),
        }),
    ).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(rows)
}

// ============================================================================
// ④ 获取知识统计
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeStats {
    pub total_items: i64,
    pub high_confidence: i64,   // confidence >= 0.7
    pub this_month: i64,
    pub top_topics: Vec<(String, i64)>,
}

pub fn get_knowledge_stats(
    app_data_dir: &std::path::Path,
) -> Result<KnowledgeStats, String> {
    let db_path = app_data_dir.join("learning").join(EVO_DB_NAME);
    if !db_path.exists() {
        return Ok(KnowledgeStats {
            total_items: 0, high_confidence: 0, this_month: 0, top_topics: Vec::new(),
        });
    }

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("{}", e))?;

    let total: i64 = conn.query_row("SELECT COUNT(*) FROM evolved_knowledge", [], |r| r.get(0)).unwrap_or(0);
    let high: i64 = conn.query_row("SELECT COUNT(*) FROM evolved_knowledge WHERE confidence >= 0.7", [], |r| r.get(0)).unwrap_or(0);
    let month: i64 = conn.query_row(
        "SELECT COUNT(*) FROM evolved_knowledge WHERE created_at > datetime('now', '-30 days')",
        [], |r| r.get(0),
    ).unwrap_or(0);

    let mut tstmt = conn.prepare(
        "SELECT topic, COUNT(*) as cnt FROM evolved_knowledge
         GROUP BY topic ORDER BY cnt DESC LIMIT 5"
    ).map_err(|e| e.to_string())?;

    let top_topics: Vec<(String, i64)> = tstmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(KnowledgeStats { total_items: total, high_confidence: high, this_month: month, top_topics })
}

// ============================================================================
// ⑤ 构建演化知识上下文（注入RAG检索结果）
// ============================================================================

pub fn build_evolution_context(
    app_data_dir: &std::path::Path,
    query: &str,
    max_items: usize,
) -> Option<String> {
    let items = search_evolved_knowledge(app_data_dir, query, max_items).ok()?;
    if items.is_empty() { return None; }

    let mut ctx = String::from("\n\n## 🌱 从对话中学习到的知识\n\n");
    ctx.push_str("> 以下知识点来自历史对话，可能对当前问题有帮助：\n\n");

    for (i, item) in items.iter().enumerate() {
        let confidence_icon = if item.confidence >= 0.8 { "✅" } else { "📝" };
        ctx.push_str(&format!(
            "{}. **{}** {}: {}\n",
            i + 1, item.topic, confidence_icon, item.content
        ));
    }

    Some(ctx)
}
