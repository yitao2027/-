// 认证模块 - 用户注册/登录 + 邀请码验证（v4.6 邀请制）

use crate::{AuthResponse, UserInfo, SubscriptionInfo};
use crate::user_store;

// 🔑 MVP本地模式有效邀请码（后续对接后端API后移除此列表）
// 与前端 LoginScreen.tsx 的 VALID_INVITE_CODES 同步
const VALID_INVITE_CODES: &[&str] = &[
    "SHAOZICLAW2026",
    // SCL- 开头的码全部放行（宋宣按需添加具体码）
];

fn simple_id(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:x}{:x}", h.finish(), now)
}

/// 验证邀请码是否有效（MVP本地模式）
pub fn verify_invite_code(code: &str) -> Result<bool, String> {
    let code_upper = code.trim().to_ascii_uppercase();
    
    if code_upper.is_empty() {
        return Err("邀请码不能为空".to_string());
    }
    
    if code_upper.len() < 4 {
        return Err("邀请码格式不正确".to_string());
    }
    
    // 精确匹配
    if VALID_INVITE_CODES.iter().any(|c| *c == code_upper) {
        return Ok(true);
    }
    
    // SCL- 通配
    if code_upper.starts_with("SCL-") {
        return Ok(true);
    }
    
    Ok(false)
}

pub async fn login(email: &str, password: &str) -> Result<AuthResponse, String> {
    let users = user_store::get_users().map_err(|e| e.to_string())?;
    
    let user = users.iter().find(|u| u.email == email);
    
    match user {
        Some(u) if u.password == password => {
            let subscription = SubscriptionInfo {
                plan: "pro".to_string(),
                status: "active".to_string(),
                token_balance: 500_000,
                monthly_limit: 1_000_000,
                used_this_month: 0,
                expires_at: "2027-04-10".to_string(),
                price_per_month: 198.0,
            };
            
            Ok(AuthResponse {
                success: true,
                user: Some(UserInfo {
                    id: u.id.clone(),
                    email: u.email.clone(),
                    name: u.name.clone(),
                    avatar: None,
                    created_at: u.created_at.clone(),
                }),
                subscription: Some(subscription),
                token: Some("demo-token-xxx".to_string()),
                message: "登录成功".to_string(),
            })
        }
        Some(_) => {
            Ok(AuthResponse {
                success: false,
                user: None,
                subscription: None,
                token: None,
                message: "密码错误".to_string(),
            })
        }
        None => {
            Err(format!("用户 {} 不存在，请先注册", email))
        }
    }
}

pub async fn register(request: &crate::RegisterRequest) -> Result<AuthResponse, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let users = user_store::get_users()?;
    
    // 检查是否已注册
    if users.iter().any(|u| u.email == request.email) {
        return Ok(AuthResponse {
            success: false,
            user: None,
            subscription: None,
            token: None,
            message: "该邮箱已注册".to_string(),
        });
    }
    
    // 创建新用户
    let new_user = user_store::StoredUser {
        id: simple_id(&request.email),
        email: request.email.clone(),
        name: request.name.clone(),
        password: request.password.clone(), // TODO: 实际应该hash
        created_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            .to_string(),
    };
    
    user_store::save_user(&new_user)?;
    
    // 新用户获得免费试用
    let subscription = SubscriptionInfo {
        plan: "free_trial".to_string(),
        status: "active".to_string(),
        token_balance: 50_000,
        monthly_limit: 50_000,
        used_this_month: 0,
        // 7天后过期
        expires_at: "2026-04-17".to_string(),
        price_per_month: 0.0,
    };
    
    Ok(AuthResponse {
        success: true,
        user: Some(UserInfo {
            id: new_user.id.clone(),
            email: new_user.email.clone(),
            name: new_user.name.clone(),
            avatar: None,
            created_at: new_user.created_at.clone(),
        }),
        subscription: Some(subscription),
        token: Some("demo-trial-xxx".to_string()),
        message: "注册成功！欢迎加入 ShaoziClaw 勺子Claw 🦞".to_string(),
    })
}
