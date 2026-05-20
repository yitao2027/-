// ShaoziClaw 勺子Claw Learning Loop — 学习闭环核心模块
//
// 模块架构（参考 Hermes Agent）：
//   ① FeedbackCollector — 反馈收集器
//   ② MemorySystem      — 记忆系统（SQLite + FTS5）
//   ③ ExperienceExtractor— 经验提取器
//   ④ SelfOptimizer     — 自适应优化器

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// 全局学习系统状态
pub struct LearningState {
    pub db: Mutex<rusqlite::Connection>,
    pub app_handle: AppHandle,
}

// ============================================================================
// 数据模型
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackRequest {
    pub message_id: String,
    pub user_query: String,
    pub ai_response: String,
    pub skill_used: Option<String>,
    pub feedback_type: String, // "positive" | "negative"
    pub reason: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NegativeCase {
    pub id: i64,
    pub user_query: String,
    pub ai_response: String,
    pub violation_type: String,
    pub severity: String,
    pub correct_guidance: String,
    pub source_skill: Option<String>,
    pub count: i64,
    pub created_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub id: i64,
    pub category: String,
    pub content: String,
    pub keywords: Vec<String>,
    pub source: Option<String>,
    pub created_at: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LearningStats {
    pub total_feedbacks: i64,
    pub positive_count: i64,
    pub negative_count: i64,
    pub active_negative_cases: i64,
    pub total_memories: i64,
    pub dynamic_redlines: i64,
    pub top_violations: Vec<ViolationStat>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ViolationStat {
    pub violation_type: String,
    pub count: i64,
}

// ============================================================================
// 初始化
// ============================================================================

pub fn init_learning_system(app: &AppHandle) -> Result<LearningState, String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("创建数据目录失败: {}", e))?;
    let db_path = app_dir.join("learning.db");
    println!("🧠 学习闭环数据库: {:?}", db_path);
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    create_tables(&conn)?;
    Ok(LearningState {
        db: Mutex::new(conn),
        app_handle: app.clone(),
    })
}

fn create_tables(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT NOT NULL,
            user_query TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            skill_used TEXT,
            feedback_type TEXT NOT NULL CHECK(feedback_type IN ('positive', 'negative')),
            reason TEXT, comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS negative_cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_query TEXT NOT NULL, ai_response TEXT NOT NULL,
            violation_type TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'medium', 'low')),
            correct_guidance TEXT, source_skill TEXT,
            count INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'reviewing'))
        );
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL CHECK(category IN ('work', 'short_term', 'long_term')),
            content TEXT NOT NULL, source TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME, access_count INTEGER DEFAULT 0
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
            content, content=memories, content_rowid=rowid
        );
        CREATE TABLE IF NOT EXISTS dynamic_redlines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_text TEXT NOT NULL,
            trigger_keywords TEXT,
            severity TEXT NOT NULL DEFAULT 'medium',
            source_case_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS implicit_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT NOT NULL,
            action_type TEXT NOT NULL CHECK(action_type IN ('copy', 'retry', 'edit_followup', 'long_read')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        -- 🧠 v5.2: 话题偏好表（正向泛化：点赞→同类话题加分）
        CREATE TABLE IF NOT EXISTS topic_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic_tag TEXT NOT NULL,           -- 话题标签如菜单定价/成本控制等
            source_query TEXT,                 -- 原始用户问题
            affinity_score REAL DEFAULT 1.0,   -- 偏好分 0-10
            positive_count INTEGER DEFAULT 1,  -- 正向反馈次数
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_pref_tag ON topic_preferences(topic_tag);
    ").map_err(|e| format!("建表失败: {}", e))?;

    conn.execute_batch("
        CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
            INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content); END;
        CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
            INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
            INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content); END;
    ").map_err(|e| format!("创建FTS触发器失败: {}", e))?;

    println!("✅ 学习闭环数据库表创建完成");
    Ok(())
}

// ============================================================================
// ① FeedbackCollector — 反馈收集器
// ============================================================================

impl LearningState {
    /// 记录用户显式反馈
    pub fn record_feedback(&self, req: FeedbackRequest) -> Result<i64, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO feedback (message_id, user_query, ai_response, skill_used, feedback_type, reason, comment)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![req.message_id, req.user_query, req.ai_response, req.skill_used,
                    req.feedback_type, req.reason, req.comment],
        ).map_err(|e| format!("插入反馈失败: {}", e))?;
        let row_id = conn.last_insert_rowid();
        drop(conn);

        if req.feedback_type == "negative" {
            self.extract_negative_case(&req)?;
        }
        // 🧠 v5.2: 正向反馈 → 学习话题偏好（点赞→同类话题加分）
        if req.feedback_type == "positive" {
            self.learn_topic_preference(&req.user_query)?;
        }
        Ok(row_id)
    }

    /// 记录隐式反馈（复制/重问等行为）
    pub fn record_implicit_feedback(&self, message_id: &str, action: &str) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO implicit_feedback (message_id, action_type) VALUES (?1, ?2)",
            params![message_id, action]).map_err(|e| format!("插入隐式反馈失败: {}", e))?;
        Ok(())
    }

    /// 获取学习统计概览
    pub fn get_learning_stats(&self) -> Result<LearningStats, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM feedback", [], |r| r.get(0)).unwrap_or(0);
        let positive: i64 = conn.query_row("SELECT COUNT(*) FROM feedback WHERE feedback_type='positive'", [], |r| r.get(0)).unwrap_or(0);
        let negative: i64 = conn.query_row("SELECT COUNT(*) FROM feedback WHERE feedback_type='negative'", [], |r| r.get(0)).unwrap_or(0);
        let active_cases: i64 = conn.query_row("SELECT COUNT(*) FROM negative_cases WHERE status='active'", [], |r| r.get(0)).unwrap_or(0);
        let memories: i64 = conn.query_row("SELECT COUNT(*) FROM memories", [], |r| r.get(0)).unwrap_or(0);
        let redlines: i64 = conn.query_row("SELECT COUNT(*) FROM dynamic_redlines WHERE is_active=1", [], |r| r.get(0)).unwrap_or(0);

        let mut stmt = conn.prepare(
            "SELECT violation_type, count FROM negative_cases WHERE status='active'
             GROUP BY violation_type ORDER BY count DESC LIMIT 5"
        ).map_err(|e| e.to_string())?;
        let mut top_violations: Vec<ViolationStat> = Vec::new();
        let rows = stmt.query_map([], |row| {
            Ok(ViolationStat { violation_type: row.get(0)?, count: row.get(1)? })
        }).map_err(|e| e.to_string())?;
        for row in rows.flatten() { top_violations.push(row); }

        Ok(LearningStats { total_feedbacks: total, positive_count: positive, negative_count: negative,
            active_negative_cases: active_cases, total_memories: memories, dynamic_redlines: redlines,
            top_violations })
    }

    /// 获取所有活跃的负面案例
    pub fn get_active_negative_cases(&self) -> Result<Vec<NegativeCase>, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, user_query, ai_response, violation_type, severity,
                    correct_guidance, source_skill, count, created_at, status
             FROM negative_cases WHERE status='active' ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(NegativeCase { id: row.get(0)?, user_query: row.get(1)?, ai_response: row.get(2)?,
                violation_type: row.get(3)?, severity: row.get(4)?,
                correct_guidance: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                source_skill: row.get(6)?, count: row.get(7)?, created_at: row.get(8)?, status: row.get(9)? })
        }).map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>().into_iter().map(Ok).collect::<Result<Vec<_>, _>>()
    }

    /// 解决一个负面案例
    pub fn resolve_negative_case(&self, case_id: i64) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute("UPDATE negative_cases SET status='resolved', updated_at=CURRENT_TIMESTAMP WHERE id=?1",
            params![case_id]).map_err(|e| format!("更新案例状态失败: {}", e))?;
        Ok(())
    }
}

// ============================================================================
// ② ExperienceExtractor — 经验提取器
// ============================================================================

fn classify_violation(reason: &str, _user_query: &str, ai_response: &str) -> (String, String) {
    let reason_lower = reason.to_lowercase();
    let response_lower = ai_response.to_lowercase();

    if reason_lower.contains("harmful") || response_lower.contains("刷单")
        || response_lower.contains("补单") || response_lower.contains("虚假好评") {
        return ("fraud_or_cheating".to_string(), "critical".to_string());
    }
    if reason_lower.contains("wrong") && (response_lower.contains("欺骗") || response_lower.contains("隐瞒")
        || response_lower.contains("欺瞒") || response_lower.contains("钻规则")) {
        return ("deceptive_practices".to_string(), "critical".to_string());
    }
    if response_lower.contains("过期") || response_lower.contains("变质")
        || (_user_query.contains("食安") || _user_query.contains("食品安全")) {
        return ("food_safety_violation".to_string(), "critical".to_string());
    }
    if reason_lower.contains("irrelevant") {
        return ("off_topic_response".to_string(), "low".to_string());
    }
    ("general_quality_issue".to_string(), "medium".to_string())
}

fn get_correct_guidance(violation_type: &str) -> &'static str {
    match violation_type {
        "fraud_or_cheating" => "应引导用户通过正规运营手段提升：优化菜品质量、提升服务评分、参与平台合规营销活动、做好复购运营",
        "deceptive_practices" => "应引导用户诚信经营、透明沟通，不建议任何形式的欺骗或隐瞒行为",
        "food_safety_violation" => "必须严肃对待食品安全问题，建议立即整改、正面回应顾客关切、建立完善的食品安全管理制度",
        "off_topic_response" => "应聚焦用户实际问题，给出针对性方案，避免泛泛而谈",
        _ => "应提供更专业、更有针对性的餐饮行业解决方案",
    }
}

impl LearningState {
    pub fn extract_negative_case(&self, req: &FeedbackRequest) -> Result<i64, String> {
        let (violation_type, severity) = classify_violation(
            &req.reason.as_deref().unwrap_or("other"),
            &req.user_query, &req.ai_response,
        );
        let correct_guidance = get_correct_guidance(&violation_type);
        let conn = self.db.lock().map_err(|e| e.to_string())?;

        let existing: Option<i64> = conn.query_row(
            "SELECT id FROM negative_cases WHERE violation_type=?1 AND status='active'
             AND created_at > datetime('now', '-7 days') ORDER BY created_at DESC LIMIT 1",
            params![violation_type], |r| r.get(0)).ok();

        let case_id = match existing {
            Some(id) => { conn.execute("UPDATE negative_cases SET count=count+1, updated_at=CURRENT_TIMESTAMP WHERE id=?1", params![id]).ok(); id }
            None => {
                conn.execute("INSERT INTO negative_cases (user_query, ai_response, violation_type, severity,
                     correct_guidance, source_skill, count) VALUES (?1,?2,?3,?4,?5,?6, 1)",
                    params![req.user_query, req.ai_response, violation_type, severity, correct_guidance, req.skill_used])
                    .map_err(|e| format!("插入案例失败: {}", e))?;
                conn.last_insert_rowid()
            }
        };
        drop(conn);

        if severity == "critical" {
            self.generate_dynamic_redline(case_id, &violation_type, correct_guidance)?;
        } else if severity == "medium" {
            let cnt = { let c = self.db.lock().ok(); c.and_then(|c| c.query_row("SELECT count FROM negative_cases WHERE id=?1",
                params![case_id], |r| r.get(0)).ok()).unwrap_or(0) };
            if cnt >= 3 { self.generate_dynamic_redline(case_id, &violation_type, correct_guidance)?; }
        }
        Ok(case_id)
    }
}

// ============================================================================
// ③ MemorySystem — 记忆系统
// ============================================================================

impl LearningState {
    pub fn store_work_memory(&self, content: &str, source: Option<&str>) -> Result<i64, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO memories (category, content, source) VALUES ('work',?1,?2)",
            params![content, source]).map_err(|e| format!("写入工作记忆失败: {}", e))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn store_short_term_memory(&self, content: &str, source: Option<&str>) -> Result<i64, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO memories (category, content, source, expires_at) VALUES ('short_term',?1,?2, datetime('now','+7 days'))",
            params![content, source]).map_err(|e| format!("写入短期记忆失败: {}", e))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn store_long_term_memory(&self, content: &str, source: Option<&str>) -> Result<i64, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO memories (category, content, source) VALUES ('long_term',?1,?2)",
            params![content, source]).map_err(|e| format!("写入长期记忆失败: {}", e))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn search_memories(&self, query: &str, limit: usize) -> Result<Vec<MemoryEntry>, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        let _ = conn.execute("DELETE FROM memories WHERE category='short_term' AND expires_at < datetime('now')", []);
        let fts_query = query.trim().split_whitespace().collect::<Vec<_>>().join(" AND ");
        if fts_query.is_empty() { return Ok(Vec::new()); }
        let sql = format!(
            "SELECT m.id, m.category, m.content, m.source, m.created_at, m.expires_at
             FROM memories_fts mf JOIN memories m ON m.id = mf.rowid
             WHERE memories_fts MATCH ?1 ORDER BY m.access_count DESC, m.created_at DESC LIMIT {}", limit);
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("搜索记忆失败: {}", e))?;
        let results: Vec<MemoryEntry> = stmt.query_map(params![fts_query], |row| {
            Ok(MemoryEntry { id: row.get(0)?, category: row.get(1)?, content: row.get(2)?,
                keywords: vec![], source: row.get::<_, Option<String>>(3)?,
                created_at: row.get(4)?, expires_at: row.get(5)? })
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        for entry in &results {
            let _ = conn.execute("UPDATE memories SET access_count=access_count+1 WHERE id=?1", params![entry.id]);
        }
        Ok(results)
    }

    pub fn get_active_redlines(&self) -> Result<Vec<String>, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT rule_text FROM dynamic_redlines WHERE is_active=1 ORDER BY severity DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        let mut result: Vec<String> = Vec::new();
        for row in rows.flatten() { result.push(row); }
        Ok(result)
    }

    pub fn clear_work_memory(&self) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM memories WHERE category='work'", []).map_err(|e| format!("清空工作记忆失败: {}", e))?;
        Ok(())
    }
}

// ============================================================================
// ④ SelfOptimizer — 自适应优化器
// ============================================================================

fn generate_redline_text(violation_type: &str, correct_guidance: &str) -> String {
    match violation_type {
        "fraud_or_cheating" => format!(
            "## 🔴 动态红线（用户反馈触发）\n**禁止任何形式的刷单、补单、虚假好评操作**\n\
             用户已多次反馈AI回答中出现了此类违规建议。\n**正确做法**：{}\n\
             违反此红线的回答将被标记为高风险。", correct_guidance),
        "deceptive_practices" => format!(
            "## 🔴 动态红线（用户反馈触发）\n**禁止建议欺骗、隐瞒、欺瞒等不诚信经营手段**\n\
             用户已反馈AI回答中出现了此类问题。\n**正确做法**：{}\n诚信经营是餐饮行业的根本。", correct_guidance),
        "food_safety_violation" => format!(
            "## 🔴🔴🔴 最高级别红线（食品安全）\n**食品安全是不可触碰的生命线！**\n\
             - 绝不建议掩盖食安问题\n- 过期/变质食材必须销毁\n- 食安事件必须正面回应\n**正确做法**：{}", correct_guidance),
        other => format!(
            "## 🟡 动态提示\n用户对以下类型的回答给出了负面反馈：{}。\n请注意改进：{}",
            other.replace('_', " "), correct_guidance),
    }
}

impl LearningState {
    pub fn generate_dynamic_redline(&self, case_id: i64, violation_type: &str, correct_guidance: &str) -> Result<i64, String> {
        let rule_text = generate_redline_text(violation_type, correct_guidance);
        let severity = match violation_type {
            "fraud_or_cheating" | "deceptive_practices" | "food_safety_violation" => "critical",
            _ => "medium",
        };
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        let existing: Option<(i64, String)> = conn.query_row(
            "SELECT id, rule_text FROM dynamic_redlines WHERE is_active=1 AND rule_text LIKE ?1 LIMIT 1",
            params![format!("%{}%", violation_type)],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))).ok();
        match existing {
            Some((eid, _)) => {
                conn.execute("UPDATE dynamic_redlines SET rule_text=?1, severity=?2, created_at=CURRENT_TIMESTAMP WHERE id=?3",
                    params![rule_text, severity, eid]).map_err(|e| format!("更新红线失败: {}", e))?;
                Ok(eid)
            }
            None => {
                conn.execute("INSERT INTO dynamic_redlines (rule_text, trigger_keywords, severity, source_case_id)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![rule_text, serde_json::to_string(&vec![violation_type]).unwrap_or_default(), severity, case_id])
                    .map_err(|e| format!("插入红线失败: {}", e))?;
                Ok(conn.last_insert_rowid())
            }
        }
    }

    /// 构建完整的动态红线提示词片段（注入到AI系统提示词）
    pub fn build_dynamic_system_prompt_addition(&self) -> Option<String> {
        let redlines = self.get_active_redlines().ok()?;
        if redlines.is_empty() { return None; }
        let mut result = "\n\n## 🧠 ShaoziClaw 勺子Claw 自适应优化规则（基于真实用户反馈自动生成）\n".to_string();
        result.push_str("> 以下规则由学习闭环系统根据用户反馈自动添加。每条规则都来自真实的负面案例。\n\n");
        for (i, line) in redlines.iter().enumerate() { result.push_str(line); if i < redlines.len()-1 { result.push_str("\n---\n"); } }
        result.push_str("\n以上规则与静态价值观红线具有同等效力，必须严格遵守。\n");
        Some(result)
    }

    pub fn deactivate_redline(&self, redline_id: i64) -> Result<(), String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        conn.execute("UPDATE dynamic_redlines SET is_active=0 WHERE id=?1", params![redline_id])
            .map_err(|e| format!("停用红线失败: {}", e))?;
        Ok(())
    }

    // ========================================================================
    // 🧠 v5.2: 话题偏好学习（正向泛化）
    // ========================================================================

    /// 从用户问题中提取话题标签
    fn extract_topic_tags(query: &str) -> Vec<String> {
        let topic_map: &[(&str, &[&str])] = &[
            ("菜单定价", &["菜单", "定价", "价格", "菜品", "套餐", "涨价", "降价"]),
            ("成本控制", &["成本", "毛利", "食材", "损耗", "降本", "省钱", "省成本"]),
            ("外卖运营", &["外卖", "美团", "饿了么", "满减", "配送", "骑手", "平台"]),
            ("选址评估", &["选址", "开店", "位置", "铺子", "商场", "商圈", "租金"]),
            ("营销推广", &["营销", "推广", "抖音", "小红书", "促销", "活动", "引流", "获客"]),
            ("人员管理", &["员工", "招聘", "排班", "薪酬", "绩效", "激励", "离职", "团队"]),
            ("品牌战略", &["品牌", "定位", "品类", "差异化", "竞争", "加盟"]),
            ("财务税务", &["财务", "税务", "报表", "现金流", "利润", "盈亏", "ROI"]),
            ("食品安全", &["食安", "卫生", "安全", "检查", "合规", "证照"]),
            ("供应链", &["供应", "采购", "库存", "仓储", "冷链", "央厨"]),
            ("数据分析", &["数据", "分析", "看板", "指标", "报表", "统计"]),
            ("顾客服务", &["服务", "投诉", "差评", "好评", "口碑", "MOT", "体验"]),
            ("数字化转型", &["数字", "SaaS", "系统", "POS", "小程序", "AI", "智能"]),
            ("融资扩张", &["融资", "扩张", "股权", "估值", "投资", "IPO", "上市"]),
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

    /// 正向反馈时学习话题偏好
    pub fn learn_topic_preference(&self, query: &str) -> Result<(), String> {
        let tags = Self::extract_topic_tags(query);
        let conn = self.db.lock().map_err(|e| e.to_string())?;

        for tag in &tags {
            let exists: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM topic_preferences WHERE topic_tag = ?1",
                params![tag], |r| r.get(0),
            ).unwrap_or(false);

            if exists {
                conn.execute(
                    "UPDATE topic_preferences SET affinity_score = MIN(10.0, affinity_score + 0.5),
                     positive_count = positive_count + 1, last_updated = CURRENT_TIMESTAMP
                     WHERE topic_tag = ?1",
                    params![tag],
                ).ok();
            } else {
                conn.execute(
                    "INSERT INTO topic_preferences (topic_tag, source_query, affinity_score, positive_count)
                     VALUES (?1, ?2, 1.5, 1)",
                    params![tag, &query[..query.len().min(200)]],
                ).ok();
            }
        }
        drop(conn);
        println!("🧠 话题偏好已更新: {:?} (+0.5)", tags);
        Ok(())
    }

    /// 获取用户偏好话题列表（按亲和度降序）
    pub fn get_preferred_topics(&self) -> Result<Vec<(String, f64)>, String> {
        let conn = self.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT topic_tag, affinity_score FROM topic_preferences
             WHERE affinity_score >= 1.5 ORDER BY affinity_score DESC LIMIT 10"
        ).map_err(|e| e.to_string())?;

        let topics: Vec<(String, f64)> = stmt.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        Ok(topics)
    }

    /// 给定话题标签，返回偏好加成系数（1.0 = 无偏好，最高1.5）
    pub fn get_preference_boost(&self, query: &str) -> f64 {
        let tags = Self::extract_topic_tags(query);
        if tags.is_empty() { return 1.0; }

        let conn = match self.db.lock() {
            Ok(c) => c,
            Err(_) => return 1.0,
        };

        let mut max_boost = 1.0;
        for tag in &tags {
            let score: f64 = conn.query_row(
                "SELECT affinity_score FROM topic_preferences WHERE topic_tag = ?1",
                params![tag], |r| r.get(0),
            ).unwrap_or(1.0);

            // 亲和度1.5→加成1.1x, 3.0→加成1.2x, 5.0→加成1.3x, 10.0→加成1.5x
            let boost = 1.0 + (score - 1.0) * 0.05;
            if boost > max_boost { max_boost = boost; }
        }
        max_boost.min(1.5)
    }
}
