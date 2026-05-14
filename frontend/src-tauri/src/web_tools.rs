// web_tools.rs - 勺子Claw 网络工具模块
// 提供：热榜抓取 / 网页搜索 / 网页抓取 / 浏览器自动化

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const HOT_BOARD_API: &str = "https://api.guiguiya.com/api/hotlist";
const TAVILY_API: &str = "https://api.tavily.com/search";

// ============================================================
// 热榜数据结构
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HotItem {
    pub title: String,
    pub url: String,
    pub hot: String,
    pub desc: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HotBoardResult {
    pub platform: String,
    pub platform_name: String,
    pub update_time: String,
    pub data: Vec<HotItem>,
}

// ============================================================
// 1. 热榜抓取（免费API，无需注册）
// ============================================================

pub async fn fetch_hot_trends(platform: Option<String>) -> Result<Vec<HotBoardResult>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let platforms = if let Some(p) = platform {
        vec![p]
    } else {
        vec![
            "weibo".to_string(),
            "baidu".to_string(),
            "douyin".to_string(),
        ]
    };

    let mut results = Vec::new();

    for p in platforms {
        let url = format!("{}?type={}", HOT_BOARD_API, p);
        match client.get(&url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    match resp.json::<Value>().await {
                        Ok(data) => {
                            // 新API返回格式：{"success":true,"data":[...],"update_time":"..."}
                            if data.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                                let platform_name = match p.as_str() {
                                    "weibo" => "微博热搜",
                                    "zhihu" => "知乎热榜",
                                    "baidu" => "百度热搜",
                                    "douyin" => "抖音热榜",
                                    "bilibili" => "B站热搜",
                                    "toutiao" => "今日头条",
                                    "weixin" => "微信热文",
                                    "sina" => "新浪新闻",
                                    "sspai" => "少数派",
                                    "csdn" => "CSDN热榜",
                                    _ => &p,
                                };

                                let mut items = Vec::new();
                                if let Some(arr) = data["data"].as_array() {
                                    for item in arr.iter().take(20) {
                                        items.push(HotItem {
                                            title: item["title"].as_str().unwrap_or("").to_string(),
                                            url: item["url"].as_str().unwrap_or("").to_string(),
                                            hot: item["hot"].as_str().unwrap_or("").to_string(),
                                            desc: item["desc"].as_str().unwrap_or("").to_string(),
                                        });
                                    }
                                }

                                // 只添加有数据的平台
                                if !items.is_empty() {
                                    let update_time = data["update_time"].as_str()
                                        .unwrap_or(&chrono::Local::now().format("%Y-%m-%d %H:%M").to_string())
                                        .to_string();
                                    results.push(HotBoardResult {
                                        platform: p.clone(),
                                        platform_name: platform_name.to_string(),
                                        update_time,
                                        data: items,
                                    });
                                }
                            } else {
                                let msg = data["msg"].as_str().unwrap_or("API返回失败");
                                eprintln!("{} hot board API error: {}", p, msg);
                            }
                        }
                        Err(e) => eprintln!("Parse {} hot board failed: {}", p, e),
                    }
                } else {
                    eprintln!("Fetch {} hot board HTTP error: {}", p, resp.status());
                }
            }
            Err(e) => eprintln!("Fetch {} hot board failed: {}", p, e),
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    if results.is_empty() {
        return Err("无法获取热榜数据，请检查网络连接".to_string());
    }
    Ok(results)
}

// ============================================================
// 2. 网页搜索（Tavily API）
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub content: String,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResult>,
    pub answer: Option<String>,
}

pub async fn web_search(query: &str, max_results: i32) -> Result<SearchResponse, String> {
    let tavily_key = std::env::var("TAVILY_API_KEY").ok();

    if let Some(key) = tavily_key {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?;

        let body = json!({
            "api_key": key,
            "query": query,
            "max_results": max_results,
            "search_depth": "advanced",
            "include_answer": true,
        });

        let resp = client
            .post(TAVILY_API)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("搜索请求失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("搜索API错误: {}", resp.status()));
        }

        let data: Value = resp.json().await.map_err(|e| e.to_string())?;

        let results: Vec<SearchResult> = data["results"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|r| SearchResult {
                title: r["title"].as_str().unwrap_or("").to_string(),
                url: r["url"].as_str().unwrap_or("").to_string(),
                content: r["content"].as_str().unwrap_or("").to_string(),
                score: r["score"].as_f64().unwrap_or(0.0),
            })
            .collect();

        Ok(SearchResponse {
            query: query.to_string(),
            results,
            answer: data["answer"].as_str().map(|s| s.to_string()),
        })
    } else {
        Err("搜索功能需要配置 TAVILY_API_KEY 环境变量。免费申请：https://tavily.com".to_string())
    }
}

// ============================================================
// 3. 网页内容抓取
// ============================================================

pub async fn web_fetch(url: &str) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let html = resp.text().await.map_err(|e| e.to_string())?;
    Ok(extract_text_from_html(&html))
}

fn extract_text_from_html(html: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;

    let chars: Vec<char> = html.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '<' {
            in_tag = true;
            let rest: String = chars[i..chars.len().min(i+10)].iter().collect();
            let rest_lower = rest.to_lowercase();
            if rest_lower.starts_with("<script") { in_script = true; }
            else if rest_lower.starts_with("<style") { in_style = true; }
            else if rest_lower.starts_with("</script") { in_script = false; }
            else if rest_lower.starts_with("</style") { in_style = false; }
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag && !in_script && !in_style {
            text.push(ch);
        }
        i += 1;
    }

    // 清理多余空白
    text.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

// ============================================================
// 4. 浏览器自动化（Playwright）
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct BrowserScrapeResult {
    pub url: String,
    pub title: String,
    pub text: String,
    pub success: bool,
    pub error: Option<String>,
}

pub async fn browser_scrape(url: &str) -> Result<BrowserScrapeResult, String> {
    let url_owned = url.to_string();

    // v5.5.9: 使用 spawn_blocking 包裹同步进程调用，避免阻塞 tokio runtime
    match tokio::time::timeout(
        Duration::from_secs(60),
        tokio::task::spawn_blocking(move || {
            // 检查 Playwright 是否安装（同步）
            let python_check = std::process::Command::new("python3")
                .args(&["-c", "import playwright; print('ok')"])
                .output();

            match python_check {
                Ok(output) if output.status.success() => {}
                _ => {
                    return Err("Playwright未安装。请先安装Chrome浏览器，然后执行: pip3 install playwright && playwright install chromium".to_string());
                }
            }

            let script = format!(
                "import asyncio\nfrom playwright.async_api import async_playwright\nasync def main():\n    async with async_playwright() as p:\n        browser = await p.chromium.launch(headless=True)\n        page = await browser.new_page()\n        await page.goto('{}', wait_until='networkidle', timeout=30000)\n        title = await page.title()\n        text = await page.evaluate('() => document.body.innerText')\n        await browser.close()\n        print('TITLE:' + title)\n        print('TEXT:' + text[:5000])\nasyncio.run(main())",
                url_owned.replace("'", "\\'")
            );

            let output = std::process::Command::new("python3")
                .arg("-c")
                .arg(&script)
                .output()
                .map_err(|e| format!("无法执行Playwright: {}", e))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if !output.status.success() && stdout.is_empty() {
                return Err(format!("Playwright执行失败: {}", stderr));
            }

            let mut title = String::new();
            let mut text = String::new();
            let mut in_text = false;

            for line in stdout.lines() {
                if line.starts_with("TITLE:") {
                    title = line[6..].to_string();
                } else if line.starts_with("TEXT:") {
                    text = line[5..].to_string();
                    in_text = true;
                } else if in_text {
                    text.push('\n');
                    text.push_str(line);
                }
            }

            Ok::<(String, String, String), String>((url_owned, title, text))
        })
    ).await {
        Ok(Ok((url_res, title, text))) => {
            let is_success = !text.is_empty();
            Ok(BrowserScrapeResult {
                url: url_res,
                title,
                text,
                success: is_success,
                error: if !is_success { Some("未能提取页面内容".to_string()) } else { None },
            })
        }
        Ok(Err(e)) => {
            Ok(BrowserScrapeResult {
                url: url.to_string(),
                title: String::new(),
                text: String::new(),
                success: false,
                error: Some(e),
            })
        }
        Err(_) => {
            Ok(BrowserScrapeResult {
                url: url.to_string(),
                title: String::new(),
                text: String::new(),
                success: false,
                error: Some("Playwright执行超时(60s)".to_string()),
            })
        }
    }
}

// ============================================================
// 格式化工具
// ============================================================

pub fn format_hot_board(results: &[HotBoardResult]) -> String {
    let mut text = String::from("## 实时热榜数据\n\n");
    for board in results {
        text.push_str(&format!("### {}\n", board.platform_name));
        text.push_str(&format!("_更新时间: {}_\n\n", board.update_time));
        for (i, item) in board.data.iter().enumerate().take(15) {
            text.push_str(&format!("{}. **{}**", i + 1, item.title));
            if !item.hot.is_empty() {
                text.push_str(&format!(" ({})", item.hot));
            }
            text.push('\n');
            if !item.desc.is_empty() {
                text.push_str(&format!("   > {}\n", item.desc));
            }
        }
        text.push('\n');
    }
    text
}

pub fn format_search_results(resp: &SearchResponse) -> String {
    let mut text = String::from(&format!("## 搜索结果: {}\n\n", resp.query));
    if let Some(ref answer) = resp.answer {
        text.push_str(&format!("> AI总结: {}\n\n", answer));
    }
    for (i, r) in resp.results.iter().enumerate() {
        text.push_str(&format!("{}. **{}**\n", i + 1, r.title));
        text.push_str(&format!("   {}\n", r.content));
        text.push_str(&format!("   [来源]({})\n\n", r.url));
    }
    text
}
