// ============================================================================
// 勺子Claw v5.2 — 行为模式追踪模块 (behavior_tracker)
// ============================================================================
// 追踪用户使用行为 → 构建动态用户画像 → 注入回复策略
//
// 追踪维度：
//   ① 时段偏好 — 什么时间用、每次用多久
//   ② 话题偏好 — 常问什么话题
//   ③ 功能习惯 — 常用哪些功能（导出/追问/图片/地图）
//   ④ 回复偏好 — 喜欢长回答还是短回答
// ============================================================================

use rusqlite::params;
use serde::{Deserialize, Serialize};

/// 单次交互记录
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InteractionRecord {
    pub timestamp: i64,        // Unix timestamp
    pub hour: i32,             // 0-23
    pub weekday: i32,          // 0=周日 6=周六
    pub topic_tags: String,    // JSON数组 如["菜单定价","外卖运营"]
    pub reply_length: i32,     // AI回复字数
    pub features_used: String, // JSON数组 如["export","image","map"]
    pub session_duration_secs: i32,
}

/// 行为模式摘要
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorProfile {
    pub peak_hours: String,          // "上午9-11点"
    pub active_weekdays: String,     // "周一至周五"
    pub top_topics: Vec<(String, i32)>,  // 话题+频次
    pub avg_reply_length: i32,
    pub preferred_length: String,    // "简洁" | "标准" | "详细"
    pub top_features: Vec<String>,
    pub total_sessions: i32,
    pub avg_duration_secs: i32,
}

// ============================================================================
// 话题标签提取（复用 learning.rs 的逻辑）
// ============================================================================

fn extract_topic_tags(query: &str) -> Vec<String> {
    let topic_map: &[(&str, &[&str])] = &[
        ("菜单定价", &["菜单", "定价", "价格", "菜品", "套餐"]),
        ("成本控制", &["成本", "毛利", "食材", "损耗", "降本"]),
        ("外卖运营", &["外卖", "美团", "饿了么", "满减", "配送"]),
        ("选址评估", &["选址", "开店", "位置", "铺子", "租金"]),
        ("营销推广", &["营销", "推广", "抖音", "小红书", "促销"]),
        ("人员管理", &["员工", "招聘", "排班", "薪酬", "绩效"]),
        ("品牌战略", &["品牌", "定位", "品类", "加盟"]),
        ("财务税务", &["财务", "税务", "报表", "现金流", "利润"]),
        ("食品安全", &["食安", "卫生", "安全", "合规"]),
        ("供应链", &["供应", "采购", "库存", "仓储"]),
        ("数据分析", &["数据", "分析", "看板", "指标"]),
        ("顾客服务", &["服务", "投诉", "差评", "好评"]),
        ("数字化转型", &["数字", "SaaS", "POS", "AI", "智能"]),
        ("融资扩张", &["融资", "扩张", "股权", "估值"]),
    ];

    let mut tags = Vec::new();
    for (tag, keywords) in topic_map {
        if keywords.iter().any(|k| query.contains(k)) {
            tags.push(tag.to_string());
        }
    }
    if tags.is_empty() {
        tags.push("综合咨询".to_string());
    }
    tags
}

// ============================================================================
// 数据库操作
// ============================================================================

const BEHAVIOR_DB_NAME: &str = "behavior_tracker.db";

fn ensure_table(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            hour INTEGER NOT NULL,
            weekday INTEGER NOT NULL,
            topic_tags TEXT NOT NULL DEFAULT '[]',
            reply_length INTEGER NOT NULL DEFAULT 0,
            features_used TEXT NOT NULL DEFAULT '[]',
            session_duration_secs INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_interactions_hour ON interactions(hour);
        CREATE INDEX IF NOT EXISTS idx_interactions_weekday ON interactions(weekday);
        CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);"
    ).map_err(|e| format!("行为追踪建表失败: {}", e))?;
    Ok(())
}

/// 记录一次对话交互
pub fn record_interaction(
    app_data_dir: &std::path::Path,
    user_query: &str,
    reply_length: i32,
    features: &[&str],
    session_duration_secs: i32,
) -> Result<(), String> {
    let db_dir = app_data_dir.join("learning");
    std::fs::create_dir_all(&db_dir).map_err(|e| format!("{}", e))?;

    let conn = rusqlite::Connection::open(db_dir.join(BEHAVIOR_DB_NAME))
        .map_err(|e| format!("打开行为库失败: {}", e))?;

    ensure_table(&conn)?;

    let now = chrono::Local::now();
    let tags = extract_topic_tags(user_query);

    conn.execute(
        "INSERT INTO interactions (timestamp, hour, weekday, topic_tags, reply_length, features_used, session_duration_secs)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            now.timestamp(),
            now.format("%H").to_string().parse::<i32>().unwrap_or(0),
            now.format("%u").to_string().parse::<i32>().unwrap_or(0) % 7,
            serde_json::to_string(&tags).unwrap_or_default(),
            reply_length,
            serde_json::to_string(&features).unwrap_or_default(),
            session_duration_secs,
        ],
    ).map_err(|e| format!("记录行为失败: {}", e))?;

    Ok(())
}

/// 计算行为模式摘要
pub fn compute_behavior_profile(
    app_data_dir: &std::path::Path,
) -> Result<BehaviorProfile, String> {
    let db_path = app_data_dir.join("learning").join(BEHAVIOR_DB_NAME);
    if !db_path.exists() {
        return Ok(BehaviorProfile {
            peak_hours: "暂无数据".to_string(),
            active_weekdays: "暂无数据".to_string(),
            top_topics: Vec::new(),
            avg_reply_length: 0,
            preferred_length: "标准".to_string(),
            top_features: Vec::new(),
            total_sessions: 0,
            avg_duration_secs: 0,
        });
    }

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("打开行为库失败: {}", e))?;

    // ① 高峰期（最近30天）
    let peak_hour: i32 = conn.query_row(
        "SELECT hour FROM interactions
         WHERE timestamp > unixepoch('now', '-30 days')
         GROUP BY hour ORDER BY COUNT(*) DESC LIMIT 1",
        [], |r| r.get(0),
    ).unwrap_or(9);

    let peak_hours = match peak_hour {
        0..=5 => "深夜".to_string(),
        6..=8 => "早晨6-8点".to_string(),
        9..=11 => "上午9-11点".to_string(),
        12..=13 => "午间12-13点".to_string(),
        14..=17 => "下午14-17点".to_string(),
        18..=21 => "晚间18-21点".to_string(),
        _ => "深夜".to_string(),
    };

    // ② 活跃日
    let total: i32 = conn.query_row("SELECT COUNT(*) FROM interactions", [], |r| r.get(0)).unwrap_or(0);
    let weekday_ratio: f64 = if total > 0 {
        let wd: i32 = conn.query_row(
            "SELECT COUNT(*) FROM interactions WHERE weekday >= 1 AND weekday <= 5",
            [], |r| r.get(0),
        ).unwrap_or(0);
        wd as f64 / total as f64
    } else { 0.0 };

    let active_weekdays = if weekday_ratio > 0.7 {
        "工作日为主".to_string()
    } else if weekday_ratio < 0.3 {
        "周末为主".to_string()
    } else {
        "工作日和周末均衡".to_string()
    };

    // ③ 热门话题
    let mut stmt = conn.prepare("SELECT topic_tags FROM interactions ORDER BY timestamp DESC LIMIT 100")
        .map_err(|e| e.to_string())?;

    let mut topic_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let rows: Vec<String> = stmt.query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for tags_json in &rows {
        if let Ok(tags) = serde_json::from_str::<Vec<String>>(tags_json) {
            for tag in tags {
                *topic_counts.entry(tag).or_insert(0) += 1;
            }
        }
    }

    let mut top_topics: Vec<(String, i32)> = topic_counts.into_iter().collect();
    top_topics.sort_by(|a, b| b.1.cmp(&a.1));
    top_topics.truncate(5);

    // ④ 回复长度偏好
    let avg_len: f64 = conn.query_row(
        "SELECT AVG(reply_length) FROM interactions WHERE reply_length > 0",
        [], |r| r.get(0),
    ).unwrap_or(500.0);

    let preferred_length = if avg_len < 400.0 {
        "简洁".to_string()
    } else if avg_len < 1000.0 {
        "标准".to_string()
    } else {
        "详细".to_string()
    };

    // ⑤ 常用功能
    let mut fstmt = conn.prepare("SELECT features_used FROM interactions ORDER BY timestamp DESC LIMIT 100")
        .map_err(|e| e.to_string())?;

    let mut feature_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let frows: Vec<String> = fstmt.query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for feats_json in &frows {
        if let Ok(feats) = serde_json::from_str::<Vec<String>>(feats_json) {
            for feat in feats {
                *feature_counts.entry(feat).or_insert(0) += 1;
            }
        }
    }

    let mut top_features: Vec<(String, i32)> = feature_counts.into_iter().collect();
    top_features.sort_by(|a, b| b.1.cmp(&a.1));
    let top_features: Vec<String> = top_features.into_iter().take(5).map(|(f, _)| f).collect();

    // ⑥ 平均时长
    let avg_dur: f64 = conn.query_row(
        "SELECT AVG(session_duration_secs) FROM interactions WHERE session_duration_secs > 0",
        [], |r| r.get(0),
    ).unwrap_or(0.0);

    Ok(BehaviorProfile {
        peak_hours,
        active_weekdays,
        top_topics,
        avg_reply_length: avg_len as i32,
        preferred_length,
        top_features,
        total_sessions: total,
        avg_duration_secs: avg_dur as i32,
    })
}

/// 构建行为画像提示词片段（注入system prompt）
pub fn build_behavior_context(
    app_data_dir: &std::path::Path,
) -> Option<String> {
    let profile = compute_behavior_profile(app_data_dir).ok()?;
    if profile.total_sessions < 3 {
        return None; // 数据太少，不注入
    }

    let topic_str = if profile.top_topics.is_empty() {
        "暂无".to_string()
    } else {
        profile.top_topics.iter()
            .map(|(t, c)| format!("{} ({}次)", t, c))
            .collect::<Vec<_>>()
            .join("、")
    };

    let features_str = if profile.top_features.is_empty() {
        "暂无".to_string()
    } else {
        profile.top_features.join("、")
    };

    Some(format!(
        "\n\n## 📊 用户行为画像（自动学习）\n\n\
        根据 {} 次对话记录，分析如下：\n\n\
        - **活跃时段**：{}\n\
        - **使用习惯**：{}\n\
        - **热门话题**：{}\n\
        - **回复偏好**：{}回答（平均{}字）\n\
        - **常用功能**：{}\n\
        - **平均时长**：{}秒/会话\n\n\
        **用法**：结合用户的使用习惯和偏好，提供更贴合的回复。",
        profile.total_sessions,
        profile.peak_hours,
        profile.active_weekdays,
        topic_str,
        profile.preferred_length, profile.avg_reply_length,
        features_str,
        profile.avg_duration_secs,
    ))
}
