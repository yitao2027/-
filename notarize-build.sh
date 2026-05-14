#!/bin/bash
# 勺子Claw macOS公证打包脚本
# 用法：在终端执行 cd ~/WorkBuddy/20260328104847/shaoziclaw-app && bash notarize-build.sh

set -e

echo "===== 勺子Claw macOS公证打包 ====="
echo ""

# 环境变量
export APPLE_ID="182378252@qq.com"
export APPLE_PASSWORD="izto-kxyq-yzqx-qwcj"
export APPLE_TEAM_ID="7LKY65K92Q"

echo "APPLE_ID: $APPLE_ID"
echo "APPLE_TEAM_ID: $APPLE_TEAM_ID"
echo ""

cd /Users/182378252qq.com/WorkBuddy/20260328104847/shaoziclaw-app/frontend

# 清理旧包
echo "🧹 清理旧包..."
rm -rf src-tauri/target/aarch64-apple-darwin/release/bundle/

# 设置Node路径
export PATH="/Users/182378252qq.com/.workbuddy/binaries/node/versions/22.12.0/bin:$PATH"

echo ""
echo "🔨 开始打包+公证（约3-5分钟，请等待）..."
echo ""

# 执行打包（公证会自动进行）
npx tauri build --target aarch64-apple-darwin 2>&1 | tee /tmp/notarize-build.log

echo ""
echo "===== 打包完成 ====="

# 检查是否成功
if [ -f "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/ShaoziClaw_4.3.1_aarch64.dmg" ]; then
    echo "✅ DMG文件已生成"
    ls -lh src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/ShaoziClaw_4.3.1_aarch64.dmg
    echo ""
    echo "📋 检查公证结果："
    grep -i "notariz" /tmp/notarize-build.log | tail -5 || echo "未找到公证相关日志"
else
    echo "❌ DMG文件未生成，请检查 /tmp/notarize-build.log"
fi
