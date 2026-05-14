@echo off
REM ============================================
REM   勺子Claw Windows版 - 一键构建脚本
REM   版本: v4.6.0 (2026-04-27 LOGO+UI+自动更新)
REM ============================================

echo.
echo ============================================
echo   勺子Claw Windows 版构建脚本
echo   品牌色: 薄荷绿 #57CC86
echo ============================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js 版本:
node --version

REM 检查 Rust
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Rust/Cargo，请先安装 Rust
    echo 下载地址: https://rustup.rs/
    pause
    exit /b 1
)
echo [OK] Rust 已安装

REM 安装前端依赖
echo.
echo [1/4] 安装前端依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] npm install 失败
    pause
    exit /b 1
)

REM 构建 Tauri 应用（Windows x64）
echo.
echo [2/4] 构建 Windows 版本...
call npm run tauri build
if %errorlevel% neq 0 (
    echo [错误] 构建失败，请检查上方错误信息
    pause
    exit /b 1
)

echo.
echo [3/4] 构建完成！输出文件：
dir /b target\release\bundle\msi\*.msi 2>nul
dir /b target\release\bundle\nsis\*.exe 2>nul

echo.
echo [4/4] ✅ 全部完成！
echo.
echo 输出目录: frontend\src-tauri\target\release\bundle\
pause
