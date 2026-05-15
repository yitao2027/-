//! 阿里云 OSS 上传模块
//! B095: 图生图结果上传到 OSS，返回公网 URL
//! 签名算法: OSS V1 (HMAC-SHA1)
//! 路径规则: image-gen/YYYY-MM-DD/{uuid}.png

use base64::Engine;
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use uuid::Uuid;

type HmacSha1 = Hmac<Sha1>;

// OSS 配置常量
const OSS_ENDPOINT: &str = "oss-cn-beijing.aliyuncs.com";
const OSS_BUCKET: &str = "shaoziclaw2026";
const OSS_ACCESS_KEY_ID: &str = "LTAI5t7yF3ofcsfghMUxHZdr";
const OSS_ACCESS_KEY_SECRET: &str = "vjCcvfMRz9khAc5Td3Ss4HIytBG2Gc";

/// 上传 base64 图片到 OSS，返回公网访问 URL
/// 路径: image-gen/YYYY-MM-DD/{uuid}.png
pub async fn upload_image_to_oss(b64_data: &str) -> Result<String, String> {
    // 1. 解码 base64
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(b64_data)
        .map_err(|e| format!("base64解码失败: {}", e))?;

    // 2. 生成对象路径
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let file_id = Uuid::new_v4().to_string();
    let object_key = format!("image-gen/{}/{}.png", today, file_id);

    // 3. 构造签名
    let date = Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    let content_type = "image/png";
    let string_to_sign = format!(
        "PUT\n\n{}\n{}\n/{}/{}",
        content_type, date, OSS_BUCKET, object_key
    );

    let mut mac = HmacSha1::new_from_slice(OSS_ACCESS_KEY_SECRET.as_bytes())
        .map_err(|e| format!("HMAC初始化失败: {}", e))?;
    mac.update(string_to_sign.as_bytes());
    let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    // 4. PUT Object
    let put_url = format!(
        "https://{}.{}/{}",
        OSS_BUCKET, OSS_ENDPOINT, object_key
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP客户端创建失败: {}", e))?;

    let resp = client.put(&put_url)
        .header("Authorization", format!("OSS {}:{}", OSS_ACCESS_KEY_ID, signature))
        .header("Content-Type", content_type)
        .header("Date", &date)
        .body(image_bytes)
        .send()
        .await
        .map_err(|e| format!("OSS上传请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let err_body = resp.text().await.unwrap_or_default();
        log::error!("[OSS] 上传失败 HTTP {}: {}", status, &err_body[..err_body.len().min(300)]);
        return Err(format!("OSS上传失败 HTTP {}: {}", status, &err_body[..200.min(err_body.len())]));
    }

    // 5. 返回公网 URL
    let public_url = format!(
        "https://{}.{}/{}",
        OSS_BUCKET, OSS_ENDPOINT, object_key
    );
    log::info!("[OSS] ✅ 上传成功: {}", public_url);
    Ok(public_url)
}
