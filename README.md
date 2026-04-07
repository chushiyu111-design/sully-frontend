# SULLYTEST2

`SULLYTEST2` 是当前主前端仓库。

它不是传统的 `src/` 单入口项目。当前真实源码主要分布在仓库根层的:

- `App.tsx`
- `index.tsx`
- `apps/`
- `components/`
- `context/`
- `hooks/`
- `utils/`

如果你是第一次接手这个仓库，先不要默认去 `src/` 里找入口。

## 当前定位

- 技术栈: React 18 + Vite 5 + TypeScript + Capacitor 6 + IndexedDB + Vitest
- 部署目标: Cloudflare Pages
- 主后端依赖: `csyos-workers`
- 配套语音代理: `cloudflare-ws-proxy`

## 先看哪些文件

最小入口认知建议先看:

1. `index.tsx`
2. `App.tsx`
3. `context/OSContext.tsx`
4. `context/CharacterContext.tsx`
5. `context/ConfigContext.tsx`
6. `utils/backendConfig.ts`
7. `utils/backendClient.ts`
8. `utils/autonomousAgent.ts`

## 目录说明

### 活目录

| 路径 | 作用 |
| --- | --- |
| `apps/` | 页面和功能入口 |
| `components/` | 公共组件 |
| `context/` | 全局状态与编排 |
| `hooks/` | 自定义 hooks |
| `utils/` | 业务逻辑、service、client |
| `utils/db/` | IndexedDB 本地数据层 |
| `functions/` | Cloudflare Pages Functions |
| `worker/` | worker 逻辑 |
| `test/` | 测试入口 |

### 需要特别注意的目录

| 路径 | 说明 |
| --- | --- |
| `api/` | 当前为空，属于退役占位目录 |
| `src/` | 当前不是主源码树，主要是残留资产 |
| `.vercel/` | 历史残留，不再是当前部署真相源 |
| `dist/` | 构建产物，不要直接修改 |

## `apps/` 里的一个坑

`apps/` 里有活页面，也有恢复快照和备份文件，例如:

- `*.recovered.tsx`
- `*.backup-*`
- `*.pre-rebuild-*`
- `*.pre-recovery-*`

改动前先确认自己改的是当前真正被引用的文件。

## 常用命令

本地开发:

```powershell
npm run dev
```

测试:

```powershell
npm run test:run
```

构建:

```powershell
npm run build
```

Beta 预发:

```powershell
.\deploy-beta.ps1
```

生产发布:

```powershell
.\deploy-prod.ps1
```

## 当前已验证基线

最近一次本地验证时间: 2026-04-07

- `npm run test:run` 通过
- 结果: 11 个测试文件、72 个测试通过
- `npm run build` 通过

构建仍会出现一些已知警告:

- `pdfjs-dist` 的 `eval` 警告
- 动态导入和静态导入混用警告
- 大 chunk 警告

## 环境变量

优先参考:

- `.env.example`
- `.env.staging.local`
- `.env.production.local`

目前最关键的是:

- `VITE_CSYOS_BACKEND_URL`
- `VITE_CSYOS_BACKEND_TOKEN`
- `VITE_CSYOS_TTS_WS_PROXY_URL`
- `VITE_CSYOS_FRONTEND_ORIGIN`

## 部署真相源

当前前端部署以以下文件为准:

- `wrangler.toml`
- `deploy-beta.ps1`
- `deploy-prod.ps1`

`.vercel/` 目录不应再作为当前部署判断依据。

## 配套文档

如果要理解整个工作区，不要只看这个 README，还要看工作区根目录中的:

- `ARCHITECTURE_INVENTORY.md`
- `WORKSPACE_ROLE_MAP.md`
- `DIRECTORY_FEATURE_MAP.md`
- `DOMAIN_OWNERSHIP.md`
- `TESTING_AND_DEPLOY.md`
