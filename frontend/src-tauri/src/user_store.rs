// 用户数据存储 - 简化版（本地JSON文件）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredUser {
    pub id: String,
    pub email: String,
    pub name: String,
    pub password: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionData {
    pub user_id: String,
    pub token: String,
}

fn get_data_dir() -> Result<PathBuf, String> {
    // 使用用户 home 目录下的 .shaoziclaw
    let dir = std::env::var("HOME")
        .map(|h| PathBuf::from(h).join(".shaoziclaw"))
        .unwrap_or_else(|_| PathBuf::from("/tmp/shaoziclaw"));
    
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    Ok(dir)
}

fn get_users_file() -> Result<PathBuf, String> {
    Ok(get_data_dir()?.join("users.json"))
}

fn get_session_file() -> Result<PathBuf, String> {
    Ok(get_data_dir()?.join("session.json"))
}

pub fn get_users() -> Result<Vec<StoredUser>, String> {
    let path = get_users_file()?;
    
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let data = fs::read_to_string(&path).map_err(|e| format!("读取用户数据失败: {}", e))?;
    let users: Vec<StoredUser> = serde_json::from_str(&data)
        .map_err(|e| format!("解析用户数据失败: {}", e))?;
    Ok(users)
}

pub fn save_user(user: &StoredUser) -> Result<(), String> {
    let mut users = get_users()?;
    users.push(user.clone());
    
    let path = get_users_file()?;
    let data = serde_json::to_string_pretty(&users)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("写入用户数据失败: {}", e))?;
    Ok(())
}

pub fn save_session(session: &SessionData) -> Result<(), String> {
    let path = get_session_file()?;
    let data = serde_json::to_string_pretty(session)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("写入session失败: {}", e))?;
    Ok(())
}

pub fn get_session() -> Result<Option<SessionData>, String> {
    let path = get_session_file()?;
    
    if !path.exists() {
        return Ok(None);
    }
    
    let data = fs::read_to_string(&path).map_err(|e| format!("读取session失败: {}", e))?;
    let session: SessionData = serde_json::from_str(&data)
        .map_err(|e| format!("解析session失败: {}", e))?;
    Ok(Some(session))
}

pub fn clear_session() -> Result<(), String> {
    let path = get_session_file()?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("删除session失败: {}", e))?;
    }
    Ok(())
}
