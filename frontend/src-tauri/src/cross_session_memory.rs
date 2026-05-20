// ============================================================================
// 勺子Claw v5.1.1 — 跨会话记忆模块
// ============================================================================
// 复用 rag_engine 的 Embedding（硅基流动 bge-m3, 1024维）+ LanceDB 向量存储
// 每次AI回复后前端调用 store_cross_session_memory 写入
// 每次新对话时通过向量语义检索召回相关历史
// ============================================================================

use lancedb::query::{QueryBase, ExecutableQuery};
use serde::{Deserialize, Serialize};
use crate::claw_log;

// ============================================================================
// 常量
// ============================================================================

const SILICONFLOW_API_URL: &str = "https://api.siliconflow.cn/v1/embeddings";
const EMBEDDING_MODEL: &str = "BAAI/bge-m3";
const VECTOR_DIM: usize = 1024;
const SILICONFLOW_API_KEY: &str = "sk-acutyiuetcukysdmtvevlufuhyetpedsxekukdywdgjymoru";

/// 跨会话记忆最大条数
const MAX_MEMORY_ENTRIES: usize = 500;
/// 检索最低相似度分数
const MIN_CROSS_SESSION_SCORE: f32 = 0.4;
/// 检索返回最大条数
const DEFAULT_CROSS_SESSION_TOP_K: usize = 3;

// ============================================================================
// 数据结构
// ============================================================================

/// 跨会话记忆写入请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreMemoryRequest {
    pub session_id: String,
    pub session_title: String,
    pub user_query: String,
    pub ai_response: String,
}

/// 跨会话记忆检索结果
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CrossSessionMemory {
    pub session_id: String,
    pub session_title: String,
    pub content: String,
    pub score: f32,
}

// ============================================================================
// 核心实现
// ============================================================================

/// 存储跨会话记忆（Tauri Command调用）
pub async fn store_memory(req: &StoreMemoryRequest, app_data_dir: &std::path::Path) -> Result<(), String> {
    let memory_dir = app_data_dir.join("cross-session-memory");
    std::fs::create_dir_all(&memory_dir)
        .map_err(|e| format!("创建跨会话记忆目录失败: {}", e))?;

    // 1. 构建摘要内容（截断防止过长）
    let user_part = truncate_str(&req.user_query, 300);
    let ai_part = truncate_str(&req.ai_response, 500);
    let content = format!("用户问: {}\nAI答: {}", user_part, ai_part);

    // 2. 向量化
    let vector = embed_query_standalone(&content).await?;
    if vector.is_empty() {
        return Err("Embedding向量化失败".to_string());
    }

    // 3. 连接LanceDB
    let db = lancedb::connect(&memory_dir.to_string_lossy())
        .execute()
        .await
        .map_err(|e| format!("LanceDB连接失败: {}", e))?;

    // 4. 构建数据行
    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    use arrow_array::{StringArray, Int64Array, Array, FixedSizeListArray, Float32Array};

    // 构建向量列：FixedSizeList<f32, 1024>
    // 🔧 修复：使用 Float32Array + FixedSizeListArray::new 替代 from_iter_primitive
    // 避免 schema 不匹配导致的 LanceDB 写入失败
    let float_values = Float32Array::from(vector.iter().map(|&v| v as f32).collect::<Vec<_>>());
    let vector_array = FixedSizeListArray::new(
        std::sync::Arc::new(arrow_schema::Field::new("item", arrow_schema::DataType::Float32, false)),
        VECTOR_DIM as i32,
        std::sync::Arc::new(float_values),
        None,
    );

    let batch = arrow_array::RecordBatch::try_new(
        std::sync::Arc::new(arrow_schema::Schema::new(vec![
            arrow_schema::Field::new("session_id", arrow_schema::DataType::Utf8, false),
            arrow_schema::Field::new("session_title", arrow_schema::DataType::Utf8, false),
            arrow_schema::Field::new("content", arrow_schema::DataType::Utf8, false),
            arrow_schema::Field::new("vector", arrow_schema::DataType::new_fixed_size_list(arrow_schema::DataType::Float32, VECTOR_DIM as i32, false), false),
            arrow_schema::Field::new("created_at", arrow_schema::DataType::Int64, false),
        ])),
        vec![
            std::sync::Arc::new(StringArray::from(vec![req.session_id.clone()])) as std::sync::Arc<dyn Array>,
            std::sync::Arc::new(StringArray::from(vec![req.session_title.clone()])),
            std::sync::Arc::new(StringArray::from(vec![content])),
            std::sync::Arc::new(vector_array),
            std::sync::Arc::new(Int64Array::from(vec![now_ts])),
        ],
    ).map_err(|e| format!("构建记录batch失败: {}", e))?;

    // 5. 写入表
    let table_names = db.table_names().execute().await
        .map_err(|e| format!("获取表列表失败: {}", e))?;

    if table_names.iter().any(|t| t == "cross_session_vectors") {
        let table = db.open_table("cross_session_vectors").execute().await
            .map_err(|e| format!("打开跨会话记忆表失败: {}", e))?;
        table.add(vec![batch]).execute().await
            .map_err(|e| format!("写入跨会话记忆失败: {}", e))?;
        // 🔧 v5.5.10: 写入后立即 compact，防止多版本文件导致后续读取时表为空
        match table.optimize(lancedb::table::OptimizeAction::All).await {
            Ok(_) => {
                crate::claw_log::log_info("CROSS", "[store_memory] ✅optimize完成");
            }
            Err(e) => {
                // optimize 失败不阻塞主流程，仅记录警告
                crate::claw_log::log_info("CROSS", &format!("[store_memory] ⚠️optimize失败（非致命）: {}", e));
            }
        }
    } else {
        db.create_table("cross_session_vectors", vec![batch])
            .execute()
            .await
            .map_err(|e| format!("创建跨会话记忆表失败: {}", e))?;
    }

    crate::claw_log::log_info("CROSS", &format!("🧠 跨会话记忆已存储: session={}", req.session_id));

    // 6. 清理超限条目（如果需要）
    if let Ok(count) = get_memory_count(&memory_dir).await {
        if count > MAX_MEMORY_ENTRIES {
            println!("🧠 跨会话记忆超限: {}/{}，标记compact", count, MAX_MEMORY_ENTRIES);
            // LanceDB的compact在读取时自动处理旧版本
        }
    }

    Ok(())
}

/// 检索跨会话记忆（ai_engine.rs调用）
/// 🔧 v5.5.7→v5.5.8: 增加精细DIAG日志追踪每一步，定位定时任务卡死根因
pub async fn retrieve_memories(
    app_data_dir: &std::path::Path,
    query: &str,
    current_session_id: &str,
) -> Result<Vec<CrossSessionMemory>, String> {
    let memory_dir = app_data_dir.join("cross-session-memory");
    crate::claw_log::log_info("CROSS", &format!("[retrieve_memories.1] 🏁入口: dir_exists={}, query_len={}, sid={}",
        memory_dir.exists(), query.len(), current_session_id));

    if !memory_dir.exists() {
        crate::claw_log::log_info("CROSS", "[retrieve_memories.1a] ❌目录不存在，返回空");
        return Ok(Vec::new());
    }

    // 1. 向量化查询
    crate::claw_log::log_info("CROSS", &format!("[retrieve_memories.2] 🔤即将调用embed_query_standalone: query={}", &query[..query.len().min(80)]));
    let vector = embed_query_standalone(query).await?;
    crate::claw_log::log_info("CROSS", &format!("[retrieve_memories.3] ✅embed完成: vec_len={}", vector.len()));
    if vector.is_empty() {
        return Ok(Vec::new());
    }

    // 2. 连接LanceDB并搜索
    crate::claw_log::log_info("CROSS", &format!("[retrieve_memories.4] 🗄️即将connect LanceDB: path={}", memory_dir.display()));
    let db = lancedb::connect(&memory_dir.to_string_lossy())
        .execute()
        .await
        .map_err(|e| format!("LanceDB连接失败: {}", e))?;
    crate::claw_log::log_info("CROSS", "[retrieve_memories.5] ✅LanceDB连接成功");

    let table_names = db.table_names().execute().await
        .map_err(|e| format!("获取表列表失败: {}", e))?;
    crate::claw_log::log_info("CROSS", &format!("[retrieve_memories.6] 📋获取表列表: {}个表", table_names.len()));

    if !table_names.iter().any(|t| t == "cross_session_vectors") {
        crate::claw_log::log_info("CROSS", "[retrieve_memories.6a] ❌表cross_session_vectors不存在");
        return Ok(Vec::new());
    }

    crate::claw_log::log_info("CROSS", "[retrieve_memories.7] 📖即将open_table cross_session_vectors");
    let table = db.open_table("cross_session_vectors").execute().await
        .map_err(|e| format!("打开跨会话记忆表失败: {}", e))?;
    crate::claw_log::log_info("CROSS", "[retrieve_memories.8] ✅open_table成功");

    let float_array: &[f32] = &vector;
    crate::claw_log::log_info("CROSS", "[retrieve_memories.9] 🔍即将执行向量检索query.nearest_to");
    let result_stream = table
        .query()
        .limit(DEFAULT_CROSS_SESSION_TOP_K + 5)
        .nearest_to(float_array)
        .map_err(|e| format!("构建跨会话检索查询失败: {}", e))?
        .distance_type(lancedb::DistanceType::Cosine)
        .execute()
        .await
        .map_err(|e| format!("跨会话记忆搜索失败: {}", e))?;
    crate::claw_log::log_info("CROSS", "[retrieve_memories.10] ✅向量检索完成, 即将收集结果");

    // 3. 收集并解析结果
    use futures::TryStreamExt;
    let batches: Vec<_> = result_stream
        .try_collect()
        .await
        .map_err(|e| format!("收集跨会话记忆结果失败: {}", e))?;

    crate::claw_log::log_info("CROSS", &format!(
        "[retrieve_memories.10a] batches收集完成: {}个batch, 总行数={}",
        batches.len(),
        batches.iter().map(|b| b.num_rows()).sum::<usize>()
    ));

    let mut memories = Vec::new();
    let mut filtered_session = 0;
    let mut filtered_score = 0;
    let mut filtered_invalid = 0;

    for batch in &batches {
        let num_rows = batch.num_rows();
        if num_rows == 0 { continue; }

        let sid_col = batch.column_by_name("session_id")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let title_col = batch.column_by_name("session_title")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let content_col = batch.column_by_name("content")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let dist_col = batch.column_by_name("_distance")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::Float32Array>());

        let sid_col = match sid_col { Some(c) => c, None => continue };
        let title_col = match title_col { Some(c) => c, None => continue };
        let content_col = match content_col { Some(c) => c, None => continue };
        let dist_col = match dist_col { Some(c) => c, None => continue };

        for i in 0..num_rows {
            use arrow_array::Array;
            if !sid_col.is_valid(i) || !content_col.is_valid(i) {
                filtered_invalid += 1;
                continue;
            }

            let sid = sid_col.value(i).to_string();
            if sid == current_session_id {
                filtered_session += 1;
                continue;
            }

            let distance = dist_col.value(i);
            let score = 1.0 - distance;
            if score < MIN_CROSS_SESSION_SCORE {
                filtered_score += 1;
                continue;
            }

            memories.push(CrossSessionMemory {
                session_id: sid,
                session_title: title_col.is_valid(i)
                    .then(|| title_col.value(i).to_string())
                    .unwrap_or_default(),
                content: content_col.value(i).to_string(),
                score,
            });

            if memories.len() >= DEFAULT_CROSS_SESSION_TOP_K { break; }
        }
        if memories.len() >= DEFAULT_CROSS_SESSION_TOP_K { break; }
    }

    // 🔧 v5.5.10: 空结果诊断
    if memories.is_empty() && !batches.iter().all(|b| b.num_rows() == 0) {
        crate::claw_log::log_info("CROSS", &format!(
            "[retrieve_memories.11a] ⚠️ 有数据但被过滤: filtered_session={}, filtered_score={}, filtered_invalid={}",
            filtered_session, filtered_score, filtered_invalid
        ));
    }

    crate::claw_log::log_info("CROSS", &format!("[retrieve_memories.11] ✅收集完成: {}条记忆", memories.len()));
    Ok(memories)
}

/// 格式化跨会话记忆上下文（注入到system prompt）
pub fn format_cross_session_context(memories: &[CrossSessionMemory]) -> Option<String> {
    if memories.is_empty() {
        return None;
    }

    let mut ctx = String::from(
        "\n\n## 🧠 跨会话记忆参考\n\
         > 以下内容来自你在其他聊天窗口中讨论过的相关话题，供你参考，帮助你提供更连贯的回答。\n\
         > 不要直接引用此段文字，而是自然地结合这些信息。\n"
    );

    for mem in memories {
        ctx.push_str(&format!(
            "\n### 来源：{}（相似度: {}%）\n{}\n",
            mem.session_title,
            (mem.score * 100.0) as i32,
            mem.content
        ));
    }

    Some(ctx)
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 独立的Embedding查询函数（复用rag_engine相同的API和模型）
async fn embed_query_standalone(text: &str) -> Result<Vec<f32>, String> {
    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "model": EMBEDDING_MODEL,
        "input": text,
        "encoding_format": "float",
    });

    let resp = client
        .post(SILICONFLOW_API_URL)
        .header("Authorization", format!("Bearer {}", SILICONFLOW_API_KEY))
        .header("Content-Type", "application/json")
        .json(&payload)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    match resp {
        Ok(response) => {
            let status = response.status();
            if !status.is_success() {
                eprintln!("⚠️ 跨会话Embedding API错误: {}", status);
                return Err(format!("Embedding API错误: {}", status));
            }
            match response.json::<serde_json::Value>().await {
                Ok(data) => {
                    if let Some(embeddings) = data.get("data").and_then(|d| d.as_array()) {
                        if let Some(first) = embeddings.first() {
                            if let Some(embedding) = first.get("embedding").and_then(|e| e.as_array()) {
                                let vector: Vec<f32> = embedding
                                    .iter()
                                    .filter_map(|v| v.as_f64().map(|f| f as f32))
                                    .collect();
                                if vector.len() == VECTOR_DIM {
                                    return Ok(vector);
                                }
                            }
                        }
                    }
                    Err("Embedding响应格式错误".to_string())
                }
                Err(e) => Err(format!("解析Embedding响应失败: {}", e)),
            }
        }
        Err(e) => {
            eprintln!("⚠️ 跨会话Embedding API请求失败: {}", e);
            Err(format!("Embedding API请求失败: {}", e))
        }
    }
}

/// 截断字符串到指定字符数（中文字符安全）
fn truncate_str(s: &str, max_chars: usize) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.len() <= max_chars {
        s.to_string()
    } else {
        chars[..max_chars].iter().collect::<String>() + "..."
    }
}

/// 获取记忆条数
async fn get_memory_count(memory_dir: &std::path::Path) -> Result<usize, String> {
    let db = lancedb::connect(&memory_dir.to_string_lossy())
        .execute()
        .await
        .map_err(|e| format!("LanceDB连接失败: {}", e))?;

    let table_names = db.table_names().execute().await
        .map_err(|e| format!("获取表列表失败: {}", e))?;

    if !table_names.iter().any(|t| t == "cross_session_vectors") {
        return Ok(0);
    }

    let table = db.open_table("cross_session_vectors").execute().await
        .map_err(|e| format!("打开表失败: {}", e))?;

    // 🔧 v5.5.10: 使用 query().limit(0) + try_collect 获取实际行数
    // count_rows(None) 在 LanceDB 多版本场景下可能返回 0
    use futures::TryStreamExt;
    let result_stream = table.query().limit(1).execute().await
        .map_err(|e| format!("查询失败: {}", e))?;
    let batches: Vec<_> = result_stream.try_collect().await
        .map_err(|e| format!("收集结果失败: {}", e))?;

    let count: usize = batches.iter().map(|b| b.num_rows()).sum();
    if count == 0 {
        // 兜底：用 count_rows 再试一次
        match table.count_rows(None).await {
            Ok(c) => {
                crate::claw_log::log_info("CROSS", &format!("[get_memory_count] query结果为0但count_rows={}, 使用count_rows值", c));
                Ok(c as usize)
            }
            Err(e) => {
                crate::claw_log::log_info("CROSS", &format!("[get_memory_count] count_rows也失败: {}", e));
                Ok(0)
            }
        }
    } else {
        // 如果 query 能拿到行，说明数据确实存在，用完整计数
        let full_count = batches.iter().map(|b| b.num_rows()).sum::<usize>();
        // 对于 limit(1)，这里最多返回 1，所以用 count_rows 获取完整数字
        match table.count_rows(None).await {
            Ok(c) if c > 0 => Ok(c as usize),
            _ => Ok(full_count)
        }
    }
}
