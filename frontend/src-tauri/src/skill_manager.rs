// Skill 管理器 - ShaoziClaw 勺子Claw v4.0 动态Skill加载器
//
// 🔄 从 v4.0 起改为动态扫描 shaozi-claw-v4 目录
// 不再硬编码每个 SkillItem，而是自动发现并解析 SKILL.md 的 frontmatter
// 支持四大来源：
//   1. shaozi-claw-v4/ — v4 业务 Skills（M1-M20 模块体系）
//   2. catering-tools/ — L0 通用办公 Skills
//   3. shaozi-claw/ / shaozi-claw-v2/ / shaozi-claw-v3/ — 兼容旧版
//   4. shaoziclaw-app/shaoziclaw-core/skills/ — APP 内置核心（总控/外卖指挥官）

use crate::SkillItem;
use std::fs;
use std::path::PathBuf;

/// 动态扫描所有可用的 Skills
/// 扫描路径优先级：v4 > catering-tools(通用) > v1/v2/v3(兼容) > APP内置
pub fn load_all_skills() -> Vec<SkillItem> {
    let mut all_skills = Vec::new();
    
    // 1️⃣ v4 业务 Skills（核心）— 宋宣20模块体系
    if let Ok(skills) = scan_v4_skills() {
        all_skills.extend(skills);
    }
    
    // 2️⃣ L0 通用办公 Skills
    if let Ok(skills) = scan_catering_tools() {
        all_skills.extend(skills);
    }
    
    // 3️⃣ APP 内置核心 Skills（总控/外卖指挥官等不可被覆盖的核心）
    all_skills.extend(get_builtin_core_skills());
    
    // 按 id 去重（后面的覆盖前面的）
    dedup_skills(&mut all_skills);
    
    println!("📊 ShaoziClaw 勺子Claw Skill 加载完成: 共 {} 个", all_skills.len());
    all_skills
}

/// 扫描 shaozi-claw-v4 目录下的所有 SKILL.md
fn scan_v4_skills() -> Result<Vec<SkillItem>, String> {
    let base_dirs = [
        ("L1 日常运营".to_string(), "shaozi-claw-v4/L1-daily"),
        ("L2 进阶能力".to_string(), "shaozi-claw-v4/L2-advanced"),
        ("L3 战略决策".to_string(), "shaozi-claw-v4/L3-strategy"),
        ("L4 生态对接".to_string(), "shaozi-claw-v4/L4-ecosystem"),
        ("🎯 总指挥官".to_string(), "shaozi-claw-v4/_coordinators"),
    ];
    
    let mut skills = Vec::new();
    
    for (category_name, dir_path) in &base_dirs {
        let full_path = get_skills_dir().join(dir_path);
        
        if !full_path.exists() {
            println!("⚠️ 目录不存在: {:?}", full_path);
            continue;
        }
        
        // 遍历子目录找 SKILL.md
        if let Ok(entries) = fs::read_dir(&full_path) {
            for entry in entries.flatten() {
                let skill_md = entry.path().join("SKILL.md");
                if skill_md.exists() {
                    if let Some(skill) = parse_skill_md(&skill_md, category_name, dir_path) {
                        skills.push(skill);
                    }
                }
            }
        }
    }
    
    Ok(skills)
}

/// 扫描 catering-tools（L0通用办公）目录
fn scan_catering_tools() -> Result<Vec<SkillItem>, String> {
    let base_path = get_skills_dir().join("catering-tools");
    let mut skills = Vec::new();
    
    if !base_path.exists() {
        return Ok(skills); // 不存在则跳过
    }
    
    if let Ok(entries) = fs::read_dir(&base_path) {
        for entry in entries.flatten() {
            let skill_md = entry.path().join("SKILL.md");
            if skill_md.exists() {
                if let Some(skill) = parse_skill_md(&skill_md, "L0 通用办公", "catering-tools") {
                    skills.push(skill);
                }
            }
        }
    }
    
    Ok(skills)
}

/// 解析单个 SKILL.md 文件，提取元数据生成 SkillItem
fn parse_skill_md(file_path: &std::path::Path, category: &str, subcategory_base: &str) -> Option<SkillItem> {
    match fs::read_to_string(file_path) {
        Ok(content) => {
            let dir_name = file_path.parent()?.file_name()?.to_string_lossy().to_string();
            
            // 提取 name（从 description 字段或文件名）
            let name = extract_frontmatter_field(&content, "name")
                .unwrap_or_else(|| extract_frontmatter_field(&content, "title")
                .unwrap_or(dir_name.replace("-", " ")));
            
            // 提取 description
            let description = extract_frontmatter_field(&content, "description")
                .unwrap_or_else(|| format!("ShaoziClaw 勺子Claw 专业技能模块：{}", name));
            
            // 提取 triggerWords 作为 tags
            let tags: Vec<String> = content.lines()
                .filter(|l| l.contains("triggerWords") || l.contains("触发词") || l.contains("关键词"))
                .flat_map(|l| {
                    // 尝试提取数组内容
                    l.split(|c: char| c == '[' || c == ']' || c == '"' || c == ',' || c == ':')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty() && s.len() <= 20 && !s.contains('{') && !s.contains('}'))
                        .collect::<Vec<_>>()
                })
                .take(10)
                .collect();
            
            // 如果没提取到tags，用subcategory和name作为fallback
            let tags_final = if tags.is_empty() {
                vec![name.clone(), category.to_string()]
            } else {
                tags
            };
            
            // 检查 references 是否存在
            let has_references = file_path.parent()
                .map(|p| p.join("references").exists())
                .unwrap_or(false);
            
            Some(SkillItem {
                id: format!("v4-{}", dir_name),
                name,
                category: category.to_string(),
                subcategory: subcategory_base.to_string(),
                description,
                tags: tags_final,
                version: "4.0".to_string(),
                has_references,
                file_path: file_path.to_string_lossy().to_string(),
            })
        }
        Err(e) => {
            println!("⚠️ 无法读取 {:?}: {}", file_path, e);
            None
        }
    }
}

/// 从 Markdown frontmatter 中提取字段值
fn extract_frontmatter_field(content: &str, field: &str) -> Option<String> {
    // 支持 --- YAML frontmatter 格式
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(field) && (trimmed.contains(':') || trimmed.contains('=')) {
            // 提取冒号或等号后的值
            if let Some(pos) = trimmed.find(':').or(trimmed.find('=')) {
                let value = trimmed[pos+1..].trim().trim_matches('"').trim().to_string();
                if !value.is_empty() && value.len() < 200 {
                    return Some(value);
                }
            }
        }
    }
    None
}

/// APP 内置核心 Skills（不可被外部覆盖的总控类）
fn get_builtin_core_skills() -> Vec<SkillItem> {
    vec![
        SkillItem {
            id: "core-master-chef".to_string(),
            name: "餐饮总厨（总控）".to_string(),
            category: "🎯 核心总控".to_string(),
            subcategory: "总控".to_string(),
            description: "ShaoziClaw 勺子Claw 全链路AI总指挥，自动调度所有专业Skills协同工作。输入任何餐饮问题，自动匹配最优Skill组合给出答案。".to_string(),
            tags: vec!["总控", "智能调度", "全链路", "AI"].iter().map(|s| s.to_string()).collect(),
            version: "4.0".to_string(),
            has_references: true,
            file_path: "shaoziclaw-app/shaoziclaw-core/skills/L0-commander/master-chef/SKILL.md".to_string(),
        },
        SkillItem {
            id: "core-waimai-commander".to_string(),
            name: "外卖运营专家（总控）".to_string(),
            category: "🎯 核心总控".to_string(),
            subcategory: "外卖总控".to_string(),
            description: "外卖领域总调度官：统一协调美团外卖/淘宝闪购/京东外卖三大平台的规则咨询、运营优化、策略制定。".to_string(),
            tags: vec!["外卖", "三平台", "美团", "淘宝闪购", "京东外卖"].iter().map(|s| s.to_string()).collect(),
            version: "4.0".to_string(),
            has_references: true,
            file_path: "shaoziclaw-app/shaoziclaw-core/skills/L0-commander/waimai-expert/SKILL.md".to_string(),
        },
    ]
}

/// 获取 Skills 根目录
fn get_skills_dir() -> PathBuf {
    // 优先从环境变量读取
    if let Ok(path) = std::env::var("SHAOZICLAW_SKILLS_DIR") {
        return PathBuf::from(path);
    }
    
    // 默认路径：~/.workbuddy/skills/
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".workbuddy").join("skills")
}

/// 按 id 去重，保留最后一个（优先级高的在后面）
fn dedup_skills(skills: &mut Vec<SkillItem>) {
    let mut seen = std::collections::HashSet::new();
    skills.retain(|s| seen.insert(s.id.clone()));
}

// ===== 向后兼容的公共 API =====

pub fn list_skills(category: Option<&str>) -> Result<Vec<SkillItem>, String> {
    let all_skills = load_all_skills();
    
    match category {
        Some(cat) => {
            let filtered: Vec<SkillItem> = all_skills
                .into_iter()
                .filter(|s| {
                    s.category.contains(cat) 
                        || s.subcategory.contains(cat)
                        || s.tags.iter().any(|t| t.contains(cat))
                })
                .collect();
            Ok(filtered)
        }
        None => Ok(all_skills),
    }
}

pub fn get_skill(skill_id: &str) -> Result<SkillItem, String> {
    let all = load_all_skills();
    all.into_iter()
        .find(|s| s.id == skill_id || s.name.contains(skill_id))
        .ok_or_else(|| format!("Skill '{}' 不存在", skill_id))
}

pub fn search_skills(query: &str) -> Result<Vec<SkillItem>, String> {
    let query_lower = query.to_lowercase();
    let all = load_all_skills();
    
    let results: Vec<SkillItem> = all.into_iter()
        .filter(|s| {
            s.name.to_lowercase().contains(&query_lower)
                || s.description.to_lowercase().contains(&query_lower)
                || s.tags.iter().any(|t: &String| t.to_lowercase().contains(&query_lower))
                || s.subcategory.to_lowercase().contains(&query_lower)
                || s.category.to_lowercase().contains(&query_lower)
        })
        .collect();
    
    Ok(results)
}

/// 获取统计信息
pub fn get_skill_stats() -> serde_json::Value {
    let skills = load_all_skills();
    let total = skills.len();
    
    let mut by_category = std::collections::HashMap::new();
    for s in &skills {
        *by_category.entry(s.category.clone()).or_insert(0) += 1;
    }
    
    let with_refs = skills.iter().filter(|s| s.has_references).count();
    
    serde_json::json!({
        "total": total,
        "with_references": with_refs,
        "categories": by_category,
        "version": "4.0",
        "loaded_at": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
    })
}
