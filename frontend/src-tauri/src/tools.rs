// 工具插件箱 - 实用计算器和模板工具

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub icon: String,
}

pub fn list_available() -> Result<Vec<ToolInfo>, String> {
    Ok(vec![
        ToolInfo { id: "cost-calculator".to_string(), name: "成本计算器".to_string(), category: "财务".to_string(), description: "菜品成本、毛利率、售价一键计算".to_string(), icon: "Calculator".to_string() },
        ToolInfo { id: "rent-roi".to_string(), name: "租金ROI测算".to_string(), category: "财务".to_string(), description: "租金占营收比、保本营业额计算".to_string(), icon: "TrendingUp".to_string() },
        ToolInfo { id: "pricing-psychology".to_string(), name: "心理定价器".to_string(), category: "营销".to_string(), description: "基于心理学的最优定价建议".to_string(), icon: "DollarSign".to_string() },
        ToolInfo { id: "staff-scheduler".to_string(), name: "排班表生成".to_string(), category: "人力".to_string(), description: "根据客流预测自动生成排班表".to_string(), icon: "Calendar".to_string() },
        ToolInfo { id: "menu-matrix".to_string(), name: "菜单工程矩阵".to_string(), category: "产品".to_string(), description: "明星/耕牛/谜题/瘦狗四象限分析".to_string(), icon: "Grid3x3".to_string() },
        ToolInfo { id: "location-scorecard".to_string(), name: "选址打分卡".to_string(), category: "开店".to_string(), description: "8维度100项指标选址评分".to_string(), icon: "MapPin".to_string() },
        ToolInfo { id: "breakeven".to_string(), name: "盈亏平衡分析".to_string(), category: "财务".to_string(), description: "固定成本/变动成本/盈亏平衡点".to_string(), icon: "Scale".to_string() },
        ToolInfo { id: "promotion-planner".to_string(), name: "活动策划模板".to_string(), category: "营销".to_string(), description: "促销活动方案自动生成".to_string(), icon: "Megaphone".to_string() },
        ToolInfo { id: "inventory-tracker".to_string(), name: "库存盘点表".to_string(), category: "运营".to_string(), description: "标准库存盘点和损耗追踪".to_string(), icon: "Package".to_string() },
        ToolInfo { id: "recipe-card".to_string(), name: "配方卡生成".to_string(), category: "出品".to_string(), description: "标准配方SOP卡片生成工具".to_string(), icon: "FileText".to_string() },
    ])
}

pub fn execute(tool_id: &str, params: &serde_json::Value) -> Result<serde_json::Value, String> {
    match tool_id {
        "cost-calculator" => cost_calculator(params),
        "rent-roi" => rent_roi(params),
        "pricing-psychology" => pricing_psychology(params),
        "menu-matrix" => menu_matrix(params),
        "breakeven" => breakeven_analysis(params),
        "location-scorecard" => location_score(params),
        _ => Err(format!("工具 '{}' 不存在", tool_id)),
    }
}

fn cost_calculator(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let food_cost = params["food_cost"].as_f64().unwrap_or(0.0);
    let target_margin = params["target_margin"].as_f64().unwrap_or(30.0) / 100.0;
    
    if food_cost <= 0.0 || target_margin <= 0.0 || target_margin >= 1.0 {
        return Err("参数无效：食材成本必须>0，目标毛利必须在1%-99%之间".to_string());
    }
    
    let suggested_price = food_cost / target_margin;
    let gross_profit = suggested_price - food_cost;
    
    Ok(serde_json::json!({
        "tool": "成本计算器",
        "input": { "food_cost": food_cost, "target_margin_pct": target_margin * 100.0 },
        "result": {
            "suggested_price": format!("¥{:.2}", suggested_price),
            "gross_profit_per_unit": format!("¥{:.2}", gross_profit),
            "gross_margin_pct": format!("{:.1}%", (gross_profit / suggested_price) * 100.0),
            "price_range_low": format!("¥{:.2}", suggested_price * 0.9),
            "price_range_high": format!("¥{:.2}", suggested_price * 1.1),
        }
    }))
}

fn rent_roi(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let monthly_rent = params["monthly_rent"].as_f64().unwrap_or(0.0);
    let expected_revenue = params["expected_revenue"].as_f64().unwrap_or(0.0);
    
    if monthly_rent <= 0.0 || expected_revenue <= 0.0 {
        return Err("参数无效".to_string());
    }
    
    let rent_ratio = (monthly_rent / expected_revenue) * 100.0;
    let breakeven_daily = (monthly_rent / 30.0) / 0.12; // 假设净利率12%
    
    let status = if rent_ratio <= 10.0 {
        "✅ 租金占比健康"
    } else if rent_ratio <= 15.0 {
        "⚠️ 租金占比偏高，需关注"
    } else {
        "🚨 租金占比过高，风险较大"
    };
    
    Ok(serde_json::json!({
        "tool": "租金ROI测算",
        "result": {
            "monthly_rent": format!("¥{:.0}", monthly_rent),
            "monthly_revenue": format!("¥{:.0}", expected_revenue),
            "rent_ratio": format!("{:.1}%", rent_ratio),
            "status": status,
            "breakeven_daily": format!("¥{:.0}/天", breakeven_daily),
            "industry_benchmark": "餐饮租金占比健康线: ≤10%"
        }
    }))
}

fn pricing_psychology(_params: &serde_json::Value) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "tool": "心理定价器",
        "strategies": [
            {"name": "尾数定价法", "example": "¥29 而不是 ¥30", "theory": "左位效应——顾客更注意第一位数字"},
            {"name": "锚点定价法", "example": "设置一个¥128的高价菜作为锚点", "theory": "高价锚让其他菜显得便宜"},
            {"name": "套餐捆绑", "example": "单品总价¥95 → 套餐价¥78", "theory": "顾客觉得省了17元，实际提高了客单价"},
            {"name": "分级选择", "example": "小份38 / 中份58(推荐) / 大份88", "theory": "中间选项被选中的概率最高(60%+)"},
            {"name": "溢价命名", "example": "'和牛'比'牛肉'可多卖300%", "theory": "高品质描述词提升感知价值"}
        ]
    }))
}

fn menu_matrix(_params: &serde_json::Value) -> Result<serde_json::Value, String> {
    // 返回菜单矩阵模板
    Ok(serde_json::json!({
        "tool": "菜单工程矩阵",
        "matrix": {
            "star": { "quadrant": "明星(高利高销)", "action": "重点推广、放在菜单C位、服务员主推", "color": "#22c55e" },
            "plowhorse": { "quadrant": "耕牛(高利低销)", "action": "优化展示位置、尝试组合销售、调整分量或价格", "color": "#3b82f6" },
            "puzzle": { "quadrant": "谜题(低利高销)", "action": "微调提价、寻找替代原料降本、考虑是否保留", "color": "#f59e0b" },
            "dog": { "quadrant": "瘦狗(低利低销)", "action": "果断删除、释放菜单空间和厨房资源", "color": "#ef4444" }
        },
        "tip": "将每道菜的毛利率和销量排名填入矩阵即可自动归类。建议每季度做一次菜单矩阵分析。"
    }))
}

fn breakeven_analysis(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let fixed_cost = params["fixed_cost"].as_f64().unwrap_or(0.0); // 月固定成本
    let avg_check = params["avg_check"].as_f64().unwrap_or(0.0);     // 客单价
    let variable_rate = params["variable_rate"].as_f64().unwrap_or(0.55); // 变动成本率
    
    let contribution_margin = avg_check * (1.0 - variable_rate);
    let breakeven_units = fixed_cost / contribution_margin;
    let breakeven_revenue = breakeven_units * avg_check;
    
    Ok(serde_json::json!({
        "tool": "盈亏平衡分析",
        "input": {
            "fixed_cost_monthly": fixed_cost,
            "avg_check": avg_check,
            "variable_cost_rate": format!("{:.0}%", variable_rate * 100.0)
        },
        "result": {
            "contribution_per_customer": format!("¥{:.2}", contribution_margin),
            "breakeven_customers_monthly": format!("{:.0} 位", breakeven_units.ceil()),
            "breakeven_customers_daily": format!("{:.0} 位/天", (breakeven_units / 30.0).ceil()),
            "breakeven_revenue_monthly": format!("¥{:.0}", breakeven_revenue),
            "safety_margin_tip": "建议按盈亏点的1.3倍设定月度目标（含20%安全边际）"
        }
    }))
}

fn location_score(_params: &serde_json::Value) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "tool": "选址打分卡",
        "dimensions": [
            { "name": "人流量", "weight": "25%", "max_score": 250, "items": ["工作日日流量", "周末日流量", "高峰时段分布"] },
            { "name": "可见性", "weight": "15%", "max_score": 150, "items": ["招牌可见距离", "是否需要拐弯到达", "门面宽度"] },
            { "name": "可达性", "weight": "15%", "max_score": 150, "items": ["停车便利性", "公交地铁距离", "步行道通畅度"] },
            { "name": "竞争环境", "width": null, "weight": "15%", "max_score": 150, "items": ["直接竞品数量及距离", "竞品评分对比", "差异化空间"] },
            { "name": "客群匹配", "weight": "15%", "max_score": 150, "items": ["周边人群画像", "消费能力匹配度", "用餐习惯匹配度"] },
            { "name": "成本合理性", "weight": "10%", "max_score": 100, "items": ["租金单价", "转让费/装修预算", "物业条件"] },
            { "name": "配套设施", "weight": "5%", "max_score": 50, "items": ["排污排烟能力", "电力负荷", "消防合规性"] }
        ],
        "passing_score": 700,
        "excellent_score": 850,
        "total_max": 1000
    }))
}
