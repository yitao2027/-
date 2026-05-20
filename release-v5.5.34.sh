#!/bin/bash
# 勺子Claw v5.5.34 发版一键脚本
# 从 Step 5 开始执行（Step 1-4 已完成：版本号/CSP/tsc/构建）
set -e

PROJ=~/WorkBuddy/20260328104847/shaoziclaw-app
DMG_SRC="$PROJ/frontend/src-tauri/target/release/bundle/dmg/勺子Claw_5.5.34_aarch64.dmg"
DMG_DST="$PROJ/frontend/src-tauri/target/release/bundle/dmg/ShaoziClaw_5.5.34_aarch64.dmg"
VERSION="5.5.34"
OSS_URL="https://shaoziclaw2026.oss-cn-beijing.aliyuncs.com/releases/ShaoziClaw_${VERSION}_aarch64.dmg"

echo "====== Step 5: 公证 ======"
xcrun notarytool submit "$DMG_SRC" \
    --apple-id "182378252@qq.com" \
    --password "rwvx-qrxc-clrb-bawi" \
    --team-id "7LKY65K92Q" \
    --wait
echo "公证完成"

echo ""
echo "====== Step 6: Staple ======"
xcrun stapler staple "$DMG_SRC"
xcrun stapler validate "$DMG_SRC"
echo "Staple完成"

echo ""
echo "====== Step 7: 英文重命名 + MD5 ======"
cp "$DMG_SRC" "$DMG_DST"
MD5=$(md5 -q "$DMG_DST")
echo "MD5: $MD5"
cp "$DMG_DST" ~/Desktop/勺子Claw_v${VERSION}.dmg
echo "已复制到桌面"

echo ""
echo "====== Step 8: OSS上传 ======"
python3 /tmp/oss_upload.py "$DMG_DST" "releases/ShaoziClaw_${VERSION}_aarch64.dmg"

echo ""
echo "====== Step 9: minisign签名 ======"
minisign -S -s ~/.workbuddy/keys/shaoziclaw_signing.key -m "$DMG_DST" -x "${DMG_DST}.minisig" -t "勺子Claw v${VERSION}" || echo "签名跳过（需密钥密码）"

echo ""
echo "====== 后续手动步骤 ======"
echo "1. 更新 latest.json → 部署到 Vercel"
echo "2. 更新官网 → 部署到 Vercel"
echo ""
echo "✅ v${VERSION} DMG已准备就绪 | MD5: $MD5"
