// ============================================================================
// 勺子Claw v5.5.19 — 资源解包器
// ============================================================================
// 职责：首次启动 / 版本更新时，将随安装包打包的资源（如知识库索引）
//      从 Tauri 资源目录复制到 app_data_dir，供 RAG 等模块直接读取。
//
// 设计：
// - 仅在目标不存在或版本号低于资源版本时执行复制
// - 通过 metadata.json 中的 version 字段做版本比对
// - 单向同步：source → dest，不会反向覆盖用户数据
// - 失败不应阻塞启动：错误打印到日志，调用方自行决定后续行为
// ============================================================================

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 把所有打包资源（目前仅知识库）从 resource_dir 解压到 app_data_dir
///
/// # 行为
/// - 若 app_data_dir/knowledge-base/metadata.json 不存在，整体复制 resources
/// - 若存在但版本号低于打包版本，整体覆盖
/// - 若版本号相等或更高，跳过（用户的索引可能比安装包还新）
pub fn unpack_bundled_resources(app: &AppHandle) -> Result<(), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("无法获取资源目录: {}", e))?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;

    // 知识库子目录
    let src_kb = resource_dir.join("resources").join("knowledge-base");
    let dst_kb = app_data_dir.join("knowledge-base");

    if !src_kb.exists() {
        println!("⏭️  跳过资源解包：源目录不存在 {}", src_kb.display());
        return Ok(());
    }

    let need_copy = should_copy(&src_kb, &dst_kb);
    if !need_copy {
        println!(
            "✅ 知识库已是最新（{}），无需解包",
            read_version(&dst_kb).unwrap_or_else(|| "?".into())
        );
        return Ok(());
    }

    println!(
        "📦 开始解包知识库: {} → {}",
        src_kb.display(),
        dst_kb.display()
    );

    // 删除旧的 lance 表（保留 metadata.json 直到新表写完，避免中断状态）
    let old_lance = dst_kb.join("kb_vectors.lance");
    if old_lance.exists() {
        if let Err(e) = std::fs::remove_dir_all(&old_lance) {
            eprintln!("⚠️ 删除旧 lance 表失败: {}", e);
        }
    }

    // 创建目标目录
    std::fs::create_dir_all(&dst_kb)
        .map_err(|e| format!("创建目标目录失败: {}", e))?;

    // 递归复制
    copy_dir_recursive(&src_kb, &dst_kb)
        .map_err(|e| format!("复制资源失败: {}", e))?;

    let bytes = dir_size(&dst_kb).unwrap_or(0);
    println!(
        "✅ 知识库解包完成（{:.1} MB）",
        bytes as f64 / 1024.0 / 1024.0
    );

    Ok(())
}

/// 决定是否需要复制：目标不存在 / 版本低于源
fn should_copy(src: &Path, dst: &Path) -> bool {
    if !dst.exists() {
        return true;
    }
    let src_ver = read_version(src);
    let dst_ver = read_version(dst);
    match (src_ver, dst_ver) {
        (Some(s), Some(d)) => version_lt(&d, &s),
        (Some(_), None) => true, // 目标元数据缺失视为损坏
        _ => false,
    }
}

/// 读 metadata.json 中的 version 字段
fn read_version(dir: &Path) -> Option<String> {
    let p = dir.join("metadata.json");
    let content = std::fs::read_to_string(p).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("version")?.as_str().map(|s| s.to_string())
}

/// 简单语义版本比较：a < b 返回 true（按数字段比较，不严格 SemVer）
fn version_lt(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.')
            .map(|p| p.parse::<u32>().unwrap_or(0))
            .collect()
    };
    let va = parse(a);
    let vb = parse(b);
    let n = va.len().max(vb.len());
    for i in 0..n {
        let x = *va.get(i).unwrap_or(&0);
        let y = *vb.get(i).unwrap_or(&0);
        if x < y {
            return true;
        }
        if x > y {
            return false;
        }
    }
    false
}

/// 递归复制目录（保留文件结构）
fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        std::fs::create_dir_all(dst)?;
    }
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_file() {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

/// 计算目录总字节数
fn dir_size(dir: &Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let p = entry.path();
        if p.is_dir() {
            total += dir_size(&p)?;
        } else {
            total += entry.metadata()?.len();
        }
    }
    Ok(total)
}

// 显式重导出，便于 main.rs 调用
pub use unpack_bundled_resources as unpack_all;

#[allow(dead_code)]
fn _unused_path_helper(_p: &PathBuf) {}
