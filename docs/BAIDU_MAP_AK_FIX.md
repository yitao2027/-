# 百度地图 AK 210 错误修复指南

> 创建日期：2026-05-14
> 任务：Task #48 步7-8

## 现象

调用百度地图 API（POI 搜索 / 地理编码）返回：
```json
{"status": 210, "message": "APP IP校验失败"}
```

## 诊断结论

直连测试：
```bash
curl "https://api.map.baidu.com/place/v2/search?query=餐厅&region=北京&output=json&ak=LJX90dXB15WMiONuZfNm4IzbDjX8h3Px"
# → {"status":210,"message":"APP IP校验失败"}
```

代理测试：
```bash
curl "http://47.93.61.79:3900/api/map/search?query=餐厅&page_size=5"
# → {"status":2,"message":"Parameter Invalid"}（代理可达）
```

**结论**：
- AK 本身有效（不是 200 即"无权限"）
- 代理服务 47.93.61.79:3900 在跑
- 210 = AK 在百度后台配的是「IP 白名单校验」，但白名单里**没包含**当前请求 IP（开发机或 ECS 出口 IP）

## 修复方案

### 方案 A（推荐，5 分钟搞定）—— 改 AK 安全模式

1. 登录 https://lbsyun.baidu.com/apiconsole/key
2. 找到 AK：`LJX90dXB15WMiONuZfNm4IzbDjX8h3Px`
3. 点「设置」/「编辑」
4. 把「校验方式」从【IP 白名单校验】改为：
   - **【服务端: IP 白名单校验】+ 添加 `47.93.61.79`**（生产推荐）
   - **或【无校验】**（仅测试，公网调用风险大）
5. 保存。生效时间：5–10 分钟

### 方案 B（更安全）—— SN 签名校验

修改 ECS 代理服务（`47.93.61.79:3900`）的 Express 代码：
1. AK 安全模式改为「SN 校验」
2. 代理服务器在每次转发前用 SK 计算签名 `sn=md5(uri+params+sk)`
3. 把 `&sn=xxx` 加到转发给百度的 query

> **注意**：这个改动在 ECS 代理那边，不在勺子Claw 客户端。

## 验证步骤

修复后用以下命令验证：
```bash
# 直连验证
curl "https://api.map.baidu.com/place/v2/search?query=餐厅&region=北京&output=json&ak=LJX90dXB15WMiONuZfNm4IzbDjX8h3Px"
# 期望：{"status":0, "results":[...]}

# 通过代理验证
curl "http://47.93.61.79:3900/api/map/search?query=餐厅&location=39.915,116.404&radius=2000"
# 期望：{"status":0, "results":[...]}
```

如果都返回 `status:0`，说明 AK 已经能正常工作。

## 客户端代码状态

`frontend/src-tauri/src/baidu_map.rs` 无需修改。代码已正确：
- 走 ECS 代理（隐藏 AK）
- UTF-8 中文 query 已用 `url::form_urlencoded` 正确编码（v4.9.8 修复）
- 超时 10s + 重试 1 次（v4.9.8）

## 责任划分

| 项目 | 责任方 | 状态 |
|------|--------|------|
| AK 白名单 / 安全模式配置 | 涛哥（百度后台） | ⏳ 待操作 |
| ECS 代理 SN 签名（方案 B） | ECS 运维 | 可选 |
| 客户端代码 | — | ✅ 无需改 |
