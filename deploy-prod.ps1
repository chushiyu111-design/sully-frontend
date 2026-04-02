# ============================================================
# deploy-prod.ps1 - 正式链接部署脚本 (Cloudflare Pages)
# ============================================================
# 警告：此脚本会更新正式链接！请确认功能已在测试环境验证通过。
#
# 正式链接（如关联了 GitHub）在推送 main 分支时即可自动部署。
# 只有在需要绕过 GitHub 自动部署，或直接通过本地构建上传时，才需运行此脚本。
# ============================================================

Write-Host ""
Write-Host "=========================================" -ForegroundColor Red
Write-Host "  ⚠️  警告：即将部署到正式链接 (Cloudflare Pages)  ⚠️" -ForegroundColor Red
Write-Host "=========================================" -ForegroundColor Red
Write-Host ""
Write-Host "当前 Git 分支：$(git branch --show-current)" -ForegroundColor Cyan
Write-Host "最新 Commit：$(git log --oneline -1)" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  如果你已在 Cloudflare 关联了 GitHub 仓库，推送代码即可自动部署。" -ForegroundColor Yellow
Write-Host "    手动上传会创建 Direct Upload 版本的部署。" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "确定要手动构建并部署到正式链接吗？输入 'YES' 确认，其他任意键取消"

if ($confirm -ne "YES") {
    Write-Host ""
    Write-Host "✅ 已取消，未部署任何内容。" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "🔨 开始构建项目 (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败！退出部署。" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "🚀 正在部署到 Cloudflare Pages 正式环境..." -ForegroundColor Cyan
# 请确保你的 Cloudflare Pages 项目名称正确（这里预设为 aetheros-simulator 或你的线上项目名）
# 如果你需要更换项目名，请修改 --project-name 后的参数
npx wrangler pages deploy dist --project-name sully-frontend 

Write-Host ""
Write-Host "部署完成！" -ForegroundColor Green
Write-Host "✅ 你的应用已部署到 Cloudflare Pages。" -ForegroundColor Green

