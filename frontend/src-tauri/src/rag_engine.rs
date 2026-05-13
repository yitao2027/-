// ============================================================================
// 勺子Claw v5.1 — RAG知识库引擎
// ============================================================================
// Embedding: 硅基流动 BAAI/bge-m3 (1024维, 免费)
// 向量存储: LanceDB (嵌入式, .lance文件)
// 检索: 余弦相似度 Top-K
// ============================================================================

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use lancedb::query::{QueryBase, ExecutableQuery}; // traits needed for .limit() and .execute()

// ============================================================================
// 数据结构
// ============================================================================

/// 知识库检索到的一条结果
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KbChunk {
    pub text: String,
    pub skill_name: String,
    pub category: String,
    pub subcategory: String,
    pub source_file: String,
    pub chunk_index: i32,
    pub score: f32,
}

/// 知识库状态（前端展示用）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KbStatus {
    pub initialized: bool,
    pub index_version: Option<String>,
    pub total_chunks: i64,
    pub last_used: Option<String>,
}

/// 全局RAG状态（由Tauri管理）
pub struct RagState {
    db_path: PathBuf,
    status: KbStatus,
    embedding_cache: Mutex<std::collections::HashMap<String, Vec<f32>>>,
}

// ============================================================================
// 常量
// ============================================================================

const SILICONFLOW_API_URL: &str = "https://api.siliconflow.cn/v1/embeddings";
const EMBEDDING_MODEL: &str = "BAAI/bge-m3";
const VECTOR_DIM: usize = 1024;
const DEFAULT_TOP_K: usize = 5;
const MIN_SCORE: f32 = 0.3; // 低于此分数的结果丢弃

// 硅基流动API Key（用于Embedding，bge-m3）
const SILICONFLOW_API_KEY: &str = "sk-acutyiuetcukysdmtvevlufuhyetpedsxekukdywdgjymoru";

// 知识库索引下载地址
const KB_INDEX_BASE_URL: &str = "https://releases.shaoziclaw.com/knowledge-base";

// ============================================================================
// 实现
// ============================================================================

impl RagState {
    /// 创建未初始化的状态（索引不存在时）
    pub fn uninitialized(db_path: PathBuf) -> Self {
        Self {
            db_path,
            status: KbStatus {
                initialized: false,
                index_version: None,
                total_chunks: 0,
                last_used: None,
            },
            embedding_cache: Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// 初始化RAG系统（检查索引是否存在并加载）
    pub async fn init(app_data_dir: PathBuf) -> Result<Self, String> {
        let kb_dir = app_data_dir.join("knowledge-base");
        let index_dir = kb_dir.join("kb_vectors.lance");

        if !index_dir.exists() {
            println!("📚 RAG知识库索引不存在，等待用户下载");
            return Ok(Self::uninitialized(kb_dir));
        }

        // LanceDB connect到kb_dir（数据库根目录），表在kb_vectors.lance子目录下

        // 读取metadata.json
        let metadata_path = kb_dir.join("metadata.json");
        let (version, total_chunks) = if metadata_path.exists() {
            match std::fs::read_to_string(&metadata_path) {
                Ok(content) => {
                    match serde_json::from_str::<serde_json::Value>(&content) {
                        Ok(meta) => {
                            let ver = meta.get("version")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string();
                            let chunks = meta.get("total_chunks")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            (Some(ver), chunks)
                        }
                        Err(e) => {
                            eprintln!("⚠️ 解析metadata.json失败: {}", e);
                            (None, 0)
                        }
                    }
                }
                Err(e) => {
                    eprintln!("⚠️ 读取metadata.json失败: {}", e);
                    (None, 0)
                }
            }
        } else {
            (None, 0)
        };

        println!(
            "✅ RAG知识库已加载: version={}, chunks={}",
            version.as_deref().unwrap_or("?"),
            total_chunks
        );

        Ok(Self {
            db_path: kb_dir,
            status: KbStatus {
                initialized: true,
                index_version: version,
                total_chunks,
                last_used: None,
            },
            embedding_cache: Mutex::new(std::collections::HashMap::new()),
        })
    }

    /// 获取当前状态
    pub fn get_status(&self) -> KbStatus {
        self.status.clone()
    }

    /// 检索知识库（核心方法）
    pub async fn retrieve(&self, query: &str, top_k: usize) -> Result<Vec<KbChunk>, String> {
        if !self.status.initialized {
            return Ok(Vec::new());
        }

        let k = top_k.min(DEFAULT_TOP_K);

        // 1. 将查询向量化
        let vector = self.embed_query(query).await?;
        if vector.is_empty() {
            return Ok(Vec::new());
        }

        // 2. 连接LanceDB并搜索（connect到kb_dir根目录）
        let db = lancedb::connect(&self.db_path.to_string_lossy())
            .execute()
            .await
            .map_err(|e| format!("LanceDB连接失败: {}", e))?;

        let table = db
            .open_table("kb_vectors")
            .execute()
            .await
            .map_err(|e| format!("打开知识库表失败: {}", e))?;

        let float_array: &[f32] = &vector;
        let result_stream = table
            .query()
            .limit(k)
            .nearest_to(float_array)
            .map_err(|e| format!("构建查询失败: {}", e))?
            .distance_type(lancedb::DistanceType::Cosine)
            .execute()
            .await
            .map_err(|e| format!("向量搜索失败: {}", e))?;

        // 3. 收集所有batches并解析结果
        use futures::TryStreamExt;
        let batches: Vec<_> = result_stream
            .try_collect()
            .await
            .map_err(|e| format!("收集结果失败: {}", e))?;

        let mut chunks = Vec::new();
        for batch in &batches {
            let num_rows = batch.num_rows();
            if num_rows == 0 { continue; }

            let text_col = batch
                .column_by_name("text")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
            let skill_col = batch
                .column_by_name("skill_name")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
            let cat_col = batch
                .column_by_name("category")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
            let subcat_col = batch
                .column_by_name("subcategory")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
            let file_col = batch
                .column_by_name("source_file")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
            let idx_col = batch
                .column_by_name("chunk_index")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::Int32Array>());
            let dist_col = batch
                .column_by_name("_distance")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::Float32Array>());

            // 安全获取可选列
            let text_col = match text_col { Some(c) => c, None => continue };
            let skill_col = match skill_col { Some(c) => c, None => continue };
            let cat_col = match cat_col { Some(c) => c, None => continue };
            let subcat_col = match subcat_col { Some(c) => c, None => continue };
            let file_col = match file_col { Some(c) => c, None => continue };
            let idx_col = match idx_col { Some(c) => c, None => continue };
            let dist_col = match dist_col { Some(c) => c, None => continue };

            for i in 0..num_rows {
                use arrow_array::Array;
                if !text_col.is_valid(i) { continue; }

                let distance = dist_col.value(i);
                let score = 1.0 - distance;
                if score < MIN_SCORE { continue; }

                chunks.push(KbChunk {
                    text: text_col.value(i).to_string(),
                    skill_name: skill_col.is_valid(i)
                        .then(|| skill_col.value(i).to_string())
                        .unwrap_or_default(),
                    category: cat_col.is_valid(i)
                        .then(|| cat_col.value(i).to_string())
                        .unwrap_or_default(),
                    subcategory: subcat_col.is_valid(i)
                        .then(|| subcat_col.value(i).to_string())
                        .unwrap_or_default(),
                    source_file: file_col.is_valid(i)
                        .then(|| file_col.value(i).to_string())
                        .unwrap_or_default(),
                    chunk_index: idx_col.value(i),
                    score,
                });
            }
        }

        Ok(chunks)
    }

    /// 将查询文本向量化
    async fn embed_query(&self, text: &str) -> Result<Vec<f32>, String> {
        // 检查缓存
        {
            let cache = self.embedding_cache.lock().unwrap();
            if let Some(cached) = cache.get(text) {
                return Ok(cached.clone());
            }
        }

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
                    let body = response.text().await.unwrap_or_default();
                    eprintln!(
                        "⚠️ Embedding API错误: {} - {}",
                        status, &body[..body.len().min(200)]
                    );
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

                                    if vector.len() != VECTOR_DIM {
                                        eprintln!(
                                            "⚠️ Embedding维度不匹配: 期望{}, 实际{}",
                                            VECTOR_DIM, vector.len()
                                        );
                                        return Err("Embedding维度不匹配".to_string());
                                    }

                                    // 写入缓存
                                    let mut cache = self.embedding_cache.lock().unwrap();
                                    if cache.len() < 1000 { // 限制缓存大小
                                        cache.insert(text.to_string(), vector.clone());
                                    }

                                    return Ok(vector);
                                }
                            }
                        }
                        Err("Embedding响应格式错误".to_string())
                    }
                    Err(e) => Err(format!("解析Embedding响应失败: {}", e)),
                }
            }
            Err(e) => {
                eprintln!("⚠️ Embedding API请求失败: {}", e);
                Err(format!("Embedding API请求失败: {}", e))
            }
        }
    }

    /// 格式化RAG上下文（注入到system prompt）
    pub fn format_rag_context(chunks: &[KbChunk]) -> Option<String> {
        if chunks.is_empty() {
            return None;
        }

        let mut ctx = String::from(
            "\n\n## 📚 知识库参考内容\n\
             > 以下内容来自勺子Claw专业餐饮知识库，请参考这些内容回答用户问题。\n\
             > 如果知识库内容与用户问题不完全匹配，优先基于你的专业知识回答。\n\
             > 不要直接引用此段文字。\n"
        );

        for chunk in chunks {
            ctx.push_str(&format!(
                "\n### 来源：{} / {}（{}）\n{}\n",
                chunk.category,
                chunk.skill_name,
                chunk.source_file,
                chunk.text
            ));
        }

        Some(ctx)
    }

    /// 获取知识库本地路径
    pub fn get_kb_dir(&self) -> PathBuf {
        self.db_path.clone()
    }
}

// ============================================================================
// 独立函数：无需持有RagState引用的异步检索（避免MutexGuard跨await）
// ============================================================================

/// 从知识库索引中检索相关知识（async-safe，不持有任何锁）
pub async fn retrieve_knowledge(
    kb_dir: &std::path::Path,
    query: &str,
    top_k: usize,
) -> Result<Vec<KbChunk>, String> {
    let k = top_k.min(DEFAULT_TOP_K);

    // 1. 向量化查询
    let vector = embed_query_standalone(query).await?;
    if vector.is_empty() {
        return Ok(Vec::new());
    }

    // 2. 连接LanceDB并搜索（connect到kb_dir根目录）
    let db = lancedb::connect(&kb_dir.to_string_lossy())
        .execute()
        .await
        .map_err(|e| format!("LanceDB连接失败: {}", e))?;

    let table = db
        .open_table("kb_vectors")
        .execute()
        .await
        .map_err(|e| format!("打开知识库表失败: {}", e))?;

    let float_array: &[f32] = &vector;
    let result_stream = table
        .query()
        .limit(k)
        .nearest_to(float_array)
        .map_err(|e| format!("构建查询失败: {}", e))?
        .distance_type(lancedb::DistanceType::Cosine)
        .execute()
        .await
        .map_err(|e| format!("向量搜索失败: {}", e))?;

    // 3. 收集并解析结果
    use futures::TryStreamExt;
    let batches: Vec<_> = result_stream
        .try_collect()
        .await
        .map_err(|e| format!("收集结果失败: {}", e))?;

    let mut chunks = Vec::new();
    for batch in &batches {
        let num_rows = batch.num_rows();
        if num_rows == 0 { continue; }

        let text_col = batch.column_by_name("text")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let skill_col = batch.column_by_name("skill_name")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let cat_col = batch.column_by_name("category")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let subcat_col = batch.column_by_name("subcategory")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let file_col = batch.column_by_name("source_file")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());
        let idx_col = batch.column_by_name("chunk_index")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::Int32Array>());
        let dist_col = batch.column_by_name("_distance")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::Float32Array>());

        let text_col = match text_col { Some(c) => c, None => continue };
        let skill_col = match skill_col { Some(c) => c, None => continue };
        let cat_col = match cat_col { Some(c) => c, None => continue };
        let subcat_col = match subcat_col { Some(c) => c, None => continue };
        let file_col = match file_col { Some(c) => c, None => continue };
        let idx_col = match idx_col { Some(c) => c, None => continue };
        let dist_col = match dist_col { Some(c) => c, None => continue };

        for i in 0..num_rows {
            use arrow_array::Array;
            if !text_col.is_valid(i) { continue; }
            let distance = dist_col.value(i);
            let score = 1.0 - distance;
            if score < MIN_SCORE { continue; }

            chunks.push(KbChunk {
                text: text_col.value(i).to_string(),
                skill_name: skill_col.is_valid(i).then(|| skill_col.value(i).to_string()).unwrap_or_default(),
                category: cat_col.is_valid(i).then(|| cat_col.value(i).to_string()).unwrap_or_default(),
                subcategory: subcat_col.is_valid(i).then(|| subcat_col.value(i).to_string()).unwrap_or_default(),
                source_file: file_col.is_valid(i).then(|| file_col.value(i).to_string()).unwrap_or_default(),
                chunk_index: idx_col.value(i),
                score,
            });
        }
    }

    Ok(chunks)
}

/// 独立的Embedding查询函数（无状态）
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
        Err(e) => Err(format!("Embedding API请求失败: {}", e)),
    }
}

// ============================================================================
// Tauri Command: 下载知识库索引
// ============================================================================

#[derive(serde::Deserialize, serde::Serialize)]
pub struct DownloadProgress {
    pub progress: i32,
    pub message: String,
}

/// 下载知识库索引（供Tauri command调用）
pub async fn download_kb_index(
    kb_dir: PathBuf,
    on_progress: tauri::ipc::Channel<DownloadProgress>,
) -> Result<(), String> {
    let index_url = format!("{}/kb_vectors.lance.tar.gz", KB_INDEX_BASE_URL);
    let meta_url = format!("{}/metadata.json", KB_INDEX_BASE_URL);

    // 确保目录存在
    std::fs::create_dir_all(&kb_dir)
        .map_err(|e| format!("创建知识库目录失败: {}", e))?;

    on_progress.send(DownloadProgress {
        progress: 5,
        message: "正在连接下载服务器...".to_string(),
    }).ok();

    // 1. 下载 metadata.json
    let client = reqwest::Client::new();
    let meta_resp = client
        .get(&meta_url)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("下载metadata失败: {}", e))?;

    if meta_resp.status().is_success() {
        let meta_content = meta_resp.text().await.unwrap_or_default();
        let meta_path = kb_dir.join("metadata.json");
        std::fs::write(&meta_path, meta_content)
            .map_err(|e| format!("写入metadata失败: {}", e))?;
    }

    on_progress.send(DownloadProgress {
        progress: 10,
        message: "正在下载知识库索引...".to_string(),
    }).ok();

    // 2. 下载索引压缩包
    let resp = client
        .get(&index_url)
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| format!("下载索引失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("下载索引失败: HTTP {}", resp.status()));
    }

    let total_bytes = resp.content_length().unwrap_or(50 * 1024 * 1024); // 默认50MB
    let temp_path = kb_dir.join("kb_vectors.lance.tar.gz.tmp");

    // 流式下载
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("创建临时文件失败: {}", e))?;

    use futures::StreamExt;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载中断: {}", e))?;
        std::io::Write::write_all(&mut file, &chunk)
            .map_err(|e| format!("写入文件失败: {}", e))?;
        downloaded += chunk.len() as u64;

        let progress = 10 + (downloaded as f64 / total_bytes as f64 * 85.0) as i32;
        let progress = progress.min(95);
        let mb = downloaded as f64 / 1024.0 / 1024.0;
        let total_mb = total_bytes as f64 / 1024.0 / 1024.0;

        on_progress.send(DownloadProgress {
            progress,
            message: format!("正在下载: {:.1} / {:.1} MB", mb, total_mb),
        }).ok();
    }
    drop(file);

    on_progress.send(DownloadProgress {
        progress: 95,
        message: "正在解压索引...".to_string(),
    }).ok();

    // 3. 解压（tar.gz格式）
    let extract_dir = kb_dir.join("kb_vectors.lance");
    std::fs::create_dir_all(&extract_dir)
        .map_err(|e| format!("创建索引目录失败: {}", e))?;

    // 使用tar命令解压（跨平台兼容）
    let output = std::process::Command::new("tar")
        .arg("xzf")
        .arg(&temp_path)
        .arg("-C")
        .arg(&extract_dir)
        .arg("--strip-components=1")
        .output()
        .map_err(|e| format!("解压失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("解压失败: {}", stderr));
    }

    // 清理临时文件
    let _ = std::fs::remove_file(&temp_path);

    on_progress.send(DownloadProgress {
        progress: 100,
        message: "知识库下载完成！".to_string(),
    }).ok();

    println!("✅ 知识库索引下载并解压完成");
    Ok(())
}
