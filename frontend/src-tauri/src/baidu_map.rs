// 百度地图API工具模块 (v4.9.8)
//
// 通过ECS代理服务(47.93.61.79:3900)调用百度地图API
// AK隐藏在代理端，客户端无需知道
//
// v4.9.8 变更:
//   - HTTP超时 5s → 10s（ECS代理中转需缓冲）
//   - 所有API调用增加自动重试1次（仅超时/网络错误，间隔500ms）
//   - 🔥 修复：手动URL编码中文参数（reqwest::query对UTF-8处理不一致导致代理端收到乱码）
//
// 端点:
//   /api/map/search           — POI关键词搜索/周边检索
//   /api/map/geocoding        — 地理编码(地址→坐标)
//   /api/map/reverse_geocoding— 逆地理编码(坐标→地址)
//   /api/map/route            — 路线规划(驾车/步行/公交)

/// 代理服务器地址（ECS北京）
const MAP_PROXY_BASE: &str = "http://47.93.61.79:3900";

/// HTTP客户端（带超时，v4.9.8: 10秒超时+ECS代理中转需额外缓冲）
/// 🔧 B073: 增加 connect_timeout(5s) 防止TCP连接层卡死tokio线程
fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))
}

/// 简单日志输出
fn emit_log(msg: &str) {
    eprintln!("[baidu_map] {}", msg);
}

/// 🔥 v4.9.8 关键修复：手动构建带URL编码的查询字符串
/// reqwest::query() 对中文字符的encoding行为不一致
/// 导致Express代理端收到的中文参数为乱码 → 百度API返回"无相关结果"
fn encode_params(pairs: &[(&str, &str)]) -> String {
    let mut ser = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in pairs {
        ser.append_pair(k, v);
    }
    ser.finish()
}

/// 构建完整请求URL（base + endpoint + 编码后的query string）
fn build_url(endpoint: &str, params: &[(&str, &str)]) -> String {
    format!("{}/api/map/{}?{}", MAP_PROXY_BASE, endpoint, encode_params(params))
}

// ============================================================
// Tauri Commands — 对外暴露的地图能力（均含自动重试）
// ============================================================

/// POI关键词搜索 / 周边检索（v4.9.8: 自动重试1次）
#[tauri::command]
pub async fn map_search(
    query: String,
    location: Option<String>,
    radius: Option<u32>,
    page_size: Option<u32>,
) -> Result<serde_json::Value, String> {
    // 预克隆所有参数（用于重试时重新构建请求）
    let q = query.clone();
    let loc = location.clone();
    let ps = page_size;

    // 首次尝试
    match do_map_search(q.clone(), loc.clone(), radius, ps).await {
        Ok(v) => Ok(v),
        Err(e) => {
            // 仅对可重试错误重试
            if is_retryable_error(&e) {
                emit_log(&format!("🔄 [RETRY] map_search首次失败, 重试..."));
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                do_map_search(q, loc, radius, ps).await
            } else {
                Err(e)
            }
        }
    }
}

/// 实际执行搜索的内部函数（v4.9.8: 使用手动URL编码）
async fn do_map_search(
    query: String,
    location: Option<String>,
    radius: Option<u32>,
    page_size: Option<u32>,
) -> Result<serde_json::Value, String> {
    let client = http_client()?;

    // 🔥 手动URL编码中文参数
    let mut params: Vec<(String, String)> = vec![
        ("query".into(), query),
        ("page_size".into(), page_size.unwrap_or(20).to_string()),
    ];
    if let Some(loc) = &location {
        params.push(("location".into(), loc.clone()));
    }
    if let Some(r) = radius {
        params.push(("radius".into(), r.to_string()));
    }

    // 转为 (&str, &str) 引用以调用 build_url
    let param_refs: Vec<(&str, &str)> = params.iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let url = build_url("search", &param_refs);

    emit_log(&format!("🔍 [SEARCH] URL={}", url));

    let resp = client.get(&url)
        .send().await.map_err(|e| format!("搜索请求失败: {}", e))?;
    resp.json::<serde_json::Value>().await.map_err(|e| format!("解析响应失败: {}", e))
}

/// 地理编码（地址文字 → 经纬度坐标）（v4.9.8: 自动重试1次）
#[tauri::command]
pub async fn map_geocoding(
    address: String,
    city: Option<String>,
) -> Result<serde_json::Value, String> {
    let addr = address.clone();
    let c = city.clone();

    match do_map_geocoding(addr.clone(), c.clone()).await {
        Ok(v) => Ok(v),
        Err(e) => {
            if is_retryable_error(&e) {
                emit_log("🔄 [RETRY] map_geocoding首次失败, 重试...");
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                do_map_geocoding(addr, c).await
            } else {
                Err(e)
            }
        }
    }
}

async fn do_map_geocoding(
    address: String,
    city: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = http_client()?;

    let mut params: Vec<(String, String)> = vec![("address".into(), address)];
    if let Some(c) = &city {
        params.push(("city".into(), c.clone()));
    }

    let param_refs: Vec<(&str, &str)> = params.iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let url = build_url("geocoding", &param_refs);

    emit_log(&format!("📍 [GEOCODE] URL={}", url));

    let resp = client.get(&url)
        .send().await.map_err(|e| format!("地理编码请求失败: {}", e))?;
    resp.json::<serde_json::Value>().await.map_err(|e| format!("解析响应失败: {}", e))
}

/// 逆地理编码（经纬度坐标 → 地址+周边POI）（v4.9.8: 自动重试1次）
#[tauri::command]
pub async fn map_reverse_geocoding(
    location: String,
    pois: Option<String>,
) -> Result<serde_json::Value, String> {
    let loc = location.clone();
    let p = pois.clone();

    match do_map_reverse_geocoding(loc.clone(), p.clone()).await {
        Ok(v) => Ok(v),
        Err(e) => {
            if is_retryable_error(&e) {
                emit_log("🔄 [RETRY] map_reverse_geocoding首次失败, 重试...");
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                do_map_reverse_geocoding(loc, p).await
            } else {
                Err(e)
            }
        }
    }
}

async fn do_map_reverse_geocoding(
    location: String,
    pois: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = http_client()?;
    let pois_val = pois.unwrap_or_else(|| "1".to_string());

    let params: Vec<(&str, &str)> = vec![
        ("location", location.as_str()),
        ("pois", pois_val.as_str()),
    ];
    let url = build_url("reverse_geocoding", &params);

    emit_log(&format!("📍 [REVERSE_GEO] URL={}", url));

    let resp = client.get(&url)
        .send().await.map_err(|e| format!("逆地理编码请求失败: {}", e))?;
    resp.json::<serde_json::Value>().await.map_err(|e| format!("解析响应失败: {}", e))
}

/// 路线规划（驾车/步行/公交）（v4.9.8: 自动重试1次）
#[tauri::command]
pub async fn map_route(
    origin: String,
    destination: String,
    mode: Option<String>,
) -> Result<serde_json::Value, String> {
    let o = origin.clone();
    let d = destination.clone();
    let m = mode.clone();

    match do_map_route(o.clone(), d.clone(), m.clone()).await {
        Ok(v) => Ok(v),
        Err(e) => {
            if is_retryable_error(&e) {
                emit_log("🔄 [RETRY] map_route首次失败, 重试...");
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                do_map_route(o, d, m).await
            } else {
                Err(e)
            }
        }
    }
}

async fn do_map_route(
    origin: String,
    destination: String,
    mode: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = http_client()?;
    let mode_val = mode.unwrap_or_else(|| "driving".to_string());

    let params: Vec<(String, String)> = vec![
        ("origin".into(), origin),
        ("destination".into(), destination),
        ("mode".into(), mode_val),
    ];

    let param_refs: Vec<(&str, &str)> = params.iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let url = build_url("route", &param_refs);

    emit_log(&format!("🛣️ [ROUTE] URL={}", url));

    let resp = client.get(&url)
        .send().await.map_err(|e| format!("路线规划请求失败: {}", e))?;
    resp.json::<serde_json::Value>().await.map_err(|e| format!("解析响应失败: {}", e))
}

/// 判断错误是否可重试（仅超时/网络类错误）
fn is_retryable_error(e: &str) -> bool {
    e.contains("timeout")
        || e.contains("timed out")
        || e.contains("请求失败")
        || e.contains("连接")
        || e.contains("dns")
        || e.contains("connection")
        || e.contains("reset")
}
