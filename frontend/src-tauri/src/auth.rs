// 认证模块 - 用户注册/登录 + 邀请码验证（v5.5.x B100修复）
// 
// 🔒 B100修复：邀请码由前端迁移至后端 invite_store 模块
//    - 前端不再持有邀请码列表
//    - 后端验证 + 一码一用追踪

use crate::{AuthResponse, UserInfo, SubscriptionInfo};
use crate::user_store;
use crate::invite_store;

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

/// 🔑 验证邀请码（调用后端 invite_store）
/// 返回 JSON 友好的结果
pub fn verify_invite_code(code: &str) -> invite_store::VerifyResult {
    match invite_store::verify_invite_code(code) {
        Ok(result) => result,
        Err(e) => invite_store::VerifyResult {
            valid: false,
            message: format!("验证失败: {}", e),
        },
    }
}

/// 🔐 兑换邀请码（注册时标记已使用）
pub fn redeem_invite_code(code: &str, email: &str) -> invite_store::RedeemResult {
    match invite_store::redeem_invite_code(code, email) {
        Ok(result) => result,
        Err(e) => invite_store::RedeemResult {
            success: false,
            message: format!("兑换失败: {}", e),
        },
    }
}

/// 获取邀请码统计
pub fn get_invite_code_stats() -> invite_store::CodeStats {
    match invite_store::get_code_stats() {
        Ok(stats) => stats,
        Err(_) => invite_store::CodeStats {
            total: 0,
            used: 0,
            remaining: 0,
        },
    }
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
    
    // 🔒 B100修复：注册时强制验证邀请码（一码一用）
    let invite_code = request.invite_code.as_deref().unwrap_or("");
    if invite_code.is_empty() {
        return Ok(AuthResponse {
            success: false,
            user: None,
            subscription: None,
            token: None,
            message: "邀请码不能为空".to_string(),
        });
    }
    
    let redeem_result = invite_store::redeem_invite_code(invite_code, &request.email)
        .map_err(|e| format!("邀请码验证失败: {}", e))?;
    
    if !redeem_result.success {
        return Ok(AuthResponse {
            success: false,
            user: None,
            subscription: None,
            token: None,
            message: redeem_result.message,
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
