#!/bin/bash
# post-build: 把 dist 复制进 macOS app bundle
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$PROJECT_ROOT/src-tauri/target/release/bundle/macos/CAN Claw.app"
DIST_DIR="$PROJECT_ROOT/dist"

echo "=== Post-build: 复制 dist 到 app bundle ==="
echo "App: $APP_DIR"
echo "Dist: $DIST_DIR"

# 检查 app 是否存在
if [ ! -d "$APP_DIR" ]; then
    echo "⚠️  App bundle not found at $APP_DIR"
    exit 0
fi

# 创建 Resources/dist 目录
RESOURCES_DIR="$APP_DIR/Contents/Resources/dist"
mkdir -p "$RESOURCES_DIR"

# 复制 dist 所有文件
rm -rf "$RESOURCES_DIR"/*
cp -R "$DIST_DIR/"* "$RESOURCES_DIR/"

echo "✅ 复制完成"
ls "$RESOURCES_DIR/"

# 重新签名 app
codesign --force --deep --sign - "$APP_DIR" 2>&1
echo "✅ 签名完成"
