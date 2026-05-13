// 订阅与支付管理

use crate::SubscriptionInfo;

pub async fn get_info(_user_id: &str) -> Result<SubscriptionInfo, String> {
    // TODO: 生产环境对接后端API
    // 演示模式返回模拟数据
    
    Ok(SubscriptionInfo {
        plan: "pro".to_string(),
        status: "active".to_string(),
        token_balance: 500_000,
        monthly_limit: 1_000_000,
        used_this_month: 123_456,
        expires_at: "2027-04-10".to_string(),
        price_per_month: 198.0,
    })
}

/// 订阅方案定义
pub fn get_plans() -> Vec<PlanInfo> {
    vec![
        PlanInfo {
            id: "free".to_string(),
            name: "免费版".to_string(),
            price: 0.0,
            token_limit: 50_000,
            features: vec![
                "每月5万Token".to_string(),
                "基础AI对话".to_string(),
                "20个L1 Skills".to_string(),
                "社区支持".to_string(),
            ],
            recommended: false,
        },
        PlanInfo {
            id: "pro".to_string(),
            name: "专业版".to_string(),
            price: 198.0,
            token_limit: 1_000_000,
            features: vec![
                "每月100万Token(超量充值¥0.1/千)".to_string(),
                "全部261个Skill解锁".to_string(),
                "三模型自由切换(GLM/Qwen/DeepSeek)".to_string(),
                "工具插件箱全开".to_string(),
                "知识库完整访问".to_string(),
                "优先技术支持".to_string(),
                "自动更新".to_string(),
            ],
            recommended: true,
        },
        PlanInfo {
            id: "enterprise".to_string(),
            name: "企业版".to_string(),
            price: 498.0,
            token_limit: 5_000_000,
            features: vec![
                "每月500万Token(超量¥0.08/千)".to_string(),
                "包含专业版所有功能".to_string(),
                "多门店管理面板".to_string(),
                "专属成功经理".to_string(),
                "定制化Skill开发".to_string(),
                "数据云同步".to_string(),
                "API接入权限".to_string(),
                "SLA保障99.9%".to_string(),
            ],
            recommended: false,
        },
    ]
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlanInfo {
    pub id: String,
    pub name: String,
    pub price: f64,
    pub token_limit: i64,
    pub features: Vec<String>,
    pub recommended: bool,
}
