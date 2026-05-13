# 勺子Claw Windows打包脚本
# 用法：右键"使用PowerShell运行"，或在PowerShell中执行 .\build-windows.ps1

Write-Host "===== 勺子Claw Windows打包脚本 =====" -ForegroundColor Green

# 检查Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js未安装" -ForegroundColor Red
    Write-Host "请下载安装：https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi" -ForegroundColor Yellow
    Write-Host "安装时全部点'Next'即可" -ForegroundColor Gray
    exit 1
}

$nodeVersion = node --version
Write-Host "✅ Node.js版本：$nodeVersion" -ForegroundColor Green

# 检查Rust
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Rust未安装" -ForegroundColor Red
    Write-Host "请访问 https://rustup.rs 下载安装" -ForegroundColor Yellow
    Write-Host "下载后双击运行，按提示完成安装" -ForegroundColor Gray
    exit 1
}

$rustVersion = cargo --version
Write-Host "✅ Rust版本：$rustVersion" -ForegroundColor Green

# 安装前端依赖
Write-Host "" 
Write-Host "📦 安装前端依赖（约2分钟）..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 依赖安装失败" -ForegroundColor Red
    exit 1
}

# 打包Windows版
Write-Host ""
Write-Host "🔨 开始打包Windows版（约5-10分钟）..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 打包失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 打包完成！" -ForegroundColor Green
Write-Host "安装包位置：src-tauri\target\release\bundle\nsis\" -ForegroundColor Cyan

# 自动打开目录
$bundlePath = Join-Path $PSScriptRoot "src-tauri\target\release\bundle\nsis"
if (Test-Path $bundlePath) {
    Start-Process explorer.exe $bundlePath
}
