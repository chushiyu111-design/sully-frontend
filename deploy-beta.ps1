# 部署到内测版 (Cloudflare Pages Preview 环境)
# 用法：在终端里运行  .\deploy-beta.ps1

Write-Host "🔨 开始构建内测版 (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败！退出部署。" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "🚀 正在部署到 Cloudflare Pages (Beta/Preview)..." -ForegroundColor Cyan
# 这里通过省略或者指定非 production 环境来做 Preview 部署
# 根据实际使用如果 beta 有单独的 project-name 可以更改这里
npx wrangler pages deploy dist --project-name sully-frontend --branch beta
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 部署失败！请检查 Wrangler 配置/登录状态。" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "部署完成！已上传到 Cloudflare Pages 的测试地址。" -ForegroundColor Green
