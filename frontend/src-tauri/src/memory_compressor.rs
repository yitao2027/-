// ============================================================================
// 勺子Claw v5.2 — 记忆压缩模块 (memory_compressor)
// ============================================================================
// 参考 CodeBuddy MEMORY.md 机制，让勺子Claw具备"越用越懂你"的能力
//
// 三层能力：
//   ① 自动压缩：对话结束 → LLM压缩为结构化记忆 → 写入 MEMORY.md
//   ② 智能注入：下次会话 → 读 MEMORY.md → 注入 system prompt
//   ③ 偏好泛化：提取用户偏好 → 影响后续回答风格/格式/内容
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 结构化记忆条目
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub date: String,                  // 日期 YYYY-MM-DD
    pub topic: String,                 // 对话主题（≤30字）
    pub key_decisions: Vec<String>,    // 关键决策
    pub preferences: Vec<String>,      // 新发现偏好
    pub facts: Vec<String>,            // 事实/Bug/配置
    pub lessons: Vec<String>,          // 教训/经验
}

/// 压缩结果（返回给前端）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressResult {
    pub entries_count: usize,
    pub memory_path: String,
    pub preview: String,
}

// ============================================================================
// ① 压缩对话 → 调用 LLM 提取结构化记忆
// ============================================================================

pub async fn compress_conversation(
    messages_json: &str,       // JSON: [{"role":"user","content":"..."}, ...]
    api_key: &str,
    api_base: &str,
    model: &str,
) -> Result<Vec<MemoryEntry>, String> {
    eprintln!("[MEMORY] compress_conversation 开始, api_base={}, model={}", api_base, model);

    // 截断对话内容，避免 prompt 过长（DeepSeek V4 上下文有限）
    let truncated_json = if messages_json.len() > 8000 {
        let mut s = messages_json.to_string();
        s.truncate(8000);
        s.push_str("\n...(对话已截断)");
        s
    } else {
        messages_json.to_string()
    };

    let prompt = format!(
        r#"你是记忆提取助手。分析以下对话，提取所有值得记住的信息。

## 核心原则：宁多勿漏
几乎每次对话都值得提取记忆。只有纯寒暄（"你好""谢谢"等3句以内的无信息对话）才返回空数组。

## 必须提取的内容类型
1. **操作记录**：用户做了什么（修改代码、创建文件、打包发布、运行命令、上传文件等）
2. **Bug / 错误**：遇到的任何报错、异常、失败（即使后来修复了）
3. **决策**：用户的选择（技术选型、方案取舍、配置变更）
4. **偏好 / 习惯**：用户表达的好恶、风格倾向、操作习惯
5. **任务上下文**：在做什么项目、什么阶段、涉及哪些文件/模块
6. **知识 / 经验**：发现的技术细节、踩坑经验、最佳实践
7. **人物 / 关系**：提到的合作方、客户、同事（名字和角色）
8. **文件路径**：操作过的关键文件路径

## 提取格式
返回JSON数组（不要markdown包裹，不要注释）：
[{{"date":"YYYY-MM-DD","topic":"简要主题（≤30字）","key_decisions":["..."],"preferences":["..."],"facts":["..."],"lessons":["..."]}}]

字段说明：
- **date**: 今天日期 YYYY-MM-DD
- **topic**: 这段对话最核心的事（用动宾短语，如"修复PPT导出Bug"、"添加用户认证功能"）
- **key_decisions**: 用户明确做的选择
- **preferences**: 用户的偏好/习惯/风格
- **facts**: 客观事实（报错信息、文件路径、版本号、配置值、操作结果等）
- **lessons**: 经验教训、注意事项

## 示例

对话：用户问"帮我看看这个编译错误"，然后修了一个 typo
→ 提取：
[{{"date":"2026-01-15","topic":"修复编译错误typo","key_decisions":[],"preferences":[],"facts":["main.rs:142 有 typo 错误","缺少分号导致编译失败"],"lessons":["编译错误先看行号和错误信息"]}}]

对话：用户让AI写一个正则表达式，然后测试通过
→ 提取：
[{{"date":"2026-01-15","topic":"编写邮箱验证正则表达式","key_decisions":["使用RFC 5322简化版正则"],"preferences":[],"facts":["正则：^[\\w.-]+@[\\w.-]+\\.\\w{{2,}}$","已通过测试"],"lessons":[]}}]

对话：纯"你好" → "你好呀" → "谢谢"
→ 返回：[]

对话内容：
{}"#,
        truncated_json
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))  // 🔧 v5.5.10: 推理模型需要更长时间
        .build()
        .map_err(|e| format!("client err: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 2048,
        "stream": false
    });

    let resp = client
        .post(&format!("{}/chat/completions", api_base))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("压缩API错误: {}", e))?;

    let status = resp.status();
    eprintln!("[MEMORY] API响应 status={}", status);
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        eprintln!("[MEMORY] API错误body={}", body);
        return Err(format!("压缩API返回 {}", status));
    }

    let v: serde_json::Value = resp.json().await.map_err(|e| format!("{}", e))?;

    // 🔧 v5.5.10: DeepSeek V4 是推理模型，content 可能为空，输出在 reasoning_content 中
    // 优先取 content，fallback 到 reasoning_content
    let msg = &v["choices"][0]["message"];
    let raw = msg["content"].as_str()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| msg["reasoning_content"].as_str())
        .unwrap_or("[]");
    eprintln!("[MEMORY] LLM返回raw len={}, content_empty={}, used_reasoning={}",
        raw.len(),
        msg["content"].as_str().map_or(true, |s| s.trim().is_empty()),
        msg["content"].as_str().map_or(false, |s| s.trim().is_empty())
    );

    // 清理LLM可能包裹的markdown
    let json_str = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let entries: Vec<MemoryEntry> =
        serde_json::from_str(json_str).unwrap_or_default();

    if entries.is_empty() {
        eprintln!("[MEMORY] 对话无长期价值内容，跳过记忆写入");
    } else {
        eprintln!("[MEMORY] 提取到 {} 条记忆", entries.len());
    }

    Ok(entries)
}

// ============================================================================
// ② 写入 MEMORY.md（去重合并）
// ============================================================================

pub fn write_memory_md(
    app_data_dir: &std::path::Path,
    new_entries: &[MemoryEntry],
) -> Result<String, String> {
    if new_entries.is_empty() {
        return Ok("无新记忆".to_string());
    }

    let memory_dir = app_data_dir.join("memory");
    eprintln!("[MEMORY] write_memory_md dir={}", memory_dir.display());
    fs::create_dir_all(&memory_dir)
        .map_err(|e| {
            eprintln!("[MEMORY] 创建目录失败: {}", e);
            format!("创建memory目录失败: {}", e)
        })?;

    let memory_path = memory_dir.join("MEMORY.md");

    // 读取已有内容
    let existing = if memory_path.exists() {
        fs::read_to_string(&memory_path).unwrap_or_default()
    } else {
        String::from("# MEMORY.md — 勺子Claw 长期记忆\n\n> 自动压缩维护，越用越懂你\n\n")
    };

    let mut new_content = existing.clone();

    for entry in new_entries {
        // 简单去重：topic已存在则跳过
        if existing.contains(&format!("## {}", entry.date))
            && existing.contains(&entry.topic)
        {
            continue;
        }

        new_content.push_str(&format!("\n## {} — {}\n\n", entry.date, entry.topic));

        if !entry.key_decisions.is_empty() {
            new_content.push_str("**决策**：\n");
            for d in &entry.key_decisions {
                new_content.push_str(&format!("- {}\n", d));
            }
            new_content.push('\n');
        }

        if !entry.preferences.is_empty() {
            new_content.push_str("**偏好**：\n");
            for p in &entry.preferences {
                new_content.push_str(&format!("- {}\n", p));
            }
            new_content.push('\n');
        }

        if !entry.facts.is_empty() {
            new_content.push_str("**事实**：\n");
            for f in &entry.facts {
                new_content.push_str(&format!("- {}\n", f));
            }
            new_content.push('\n');
        }

        if !entry.lessons.is_empty() {
            new_content.push_str("**教训**：\n");
            for l in &entry.lessons {
                new_content.push_str(&format!("- {}\n", l));
            }
            new_content.push('\n');
        }
    }

    fs::write(&memory_path, &new_content)
        .map_err(|e| format!("写入MEMORY.md失败: {}", e))?;

    let path_str = memory_path.to_string_lossy().to_string();
    println!("🧠 记忆压缩完成: {} (+{} 条)", path_str, new_entries.len());
    Ok(path_str)
}

// ============================================================================
// ③ 读取记忆 → 注入 system prompt
// ============================================================================

pub fn get_memory_context(
    app_data_dir: &std::path::Path,
    max_chars: usize,
) -> Option<String> {
    let memory_path = app_data_dir.join("memory").join("MEMORY.md");

    if !memory_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&memory_path).unwrap_or_default();
    let trimmed = content.trim();
    if trimmed.is_empty() || trimmed == "# MEMORY.md — 勺子Claw 长期记忆" {
        return None;
    }

    // 截断
    let display = if content.len() > max_chars {
        format!(
            "{}...\n*(记忆已截断至{}字符)*",
            &content[..max_chars],
            max_chars
        )
    } else {
        content
    };

    Some(format!(
        "\n\n## 🧠 长期记忆（自动维护）\n\n\
        以下是从你之前的对话中自动提取的关键记忆，包含你的偏好、决策和经验：\n\n\
        {}\n\n\
        ---\n\
        **用法**：如果当前对话涉及上述主题，请结合记忆提供更个性化的回答。\
        如果记忆中提到用户偏好（如偏好简洁回复、喜欢表格对比），请主动遵循。\n",
        display
    ))
}

// ============================================================================
// ④ 提取全局偏好（从所有记忆中汇总）
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GlobalPreferences {
    pub reply_style: Vec<String>,     // 回复风格偏好
    pub content_format: Vec<String>,  // 内容格式偏好
    pub domain_focus: Vec<String>,    // 关注领域
    pub tool_habits: Vec<String>,     // 工具使用习惯
}

pub fn extract_global_preferences(
    app_data_dir: &std::path::Path,
) -> GlobalPreferences {
    let memory_path = app_data_dir.join("memory").join("MEMORY.md");
    let content = fs::read_to_string(&memory_path).unwrap_or_default();

    let mut prefs = GlobalPreferences {
        reply_style: Vec::new(),
        content_format: Vec::new(),
        domain_focus: Vec::new(),
        tool_habits: Vec::new(),
    };

    // 从 **偏好** 段中提取
    for line in content.lines() {
        let line = line.trim().trim_start_matches("- ").trim();
        if line.contains("简洁") || line.contains("短") {
            prefs.reply_style.push(line.to_string());
        }
        if line.contains("表格") || line.contains("列表") || line.contains("对比") {
            prefs.content_format.push(line.to_string());
        }
        if line.contains("WPS") || line.contains("直接打开") || line.contains("docx") {
            prefs.tool_habits.push(line.to_string());
        }
    }

    prefs
}

// ============================================================================
// ⑤ 构建偏好注入文本（添加到 system prompt）
// ============================================================================

pub fn build_preference_injection(
    app_data_dir: &std::path::Path,
) -> Option<String> {
    let prefs = extract_global_preferences(app_data_dir);

    let mut lines: Vec<String> = Vec::new();

    if !prefs.reply_style.is_empty() {
        lines.push(format!(
            "**回复风格**：{}",
            prefs.reply_style.join("、")
        ));
    }
    if !prefs.content_format.is_empty() {
        lines.push(format!(
            "**内容格式**：{}",
            prefs.content_format.join("、")
        ));
    }
    if !prefs.tool_habits.is_empty() {
        lines.push(format!(
            "**工具习惯**：{}",
            prefs.tool_habits.join("、")
        ));
    }

    if lines.is_empty() {
        return None;
    }

    Some(format!(
        "\n\n## 👤 用户画像（自动学习）\n\n{}",
        lines.join("\n")
    ))
}
