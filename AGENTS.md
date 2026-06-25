# AGENTS.md

本文件为 AI 编码助手(如 Codex)在本仓库中工作时提供指引。其作用域为整个仓库目录树。

## 项目概述

Telegraph-Image:一个部署在 **Cloudflare Pages** 上的免费图床应用。它将上传请求代理到 `telegra.ph` 与 Telegram,把所有访问记录写入 **Cloudflare D1**(SQLite),并提供用于图片管理与内容审核的管理后台。基于 Next.js 14 App Router 构建,完全运行在 **Edge 运行时**中。

本仓库是 `x-dr/telegraph-Image` 的本地化分支(根目录 `name` 为 `2026freetu`)。

## 命令

- `npm run dev` — 本地开发服务器(注意:调用 `getRequestContext()`/D1 的 edge 路由仅在 Cloudflare 上构建/部署时才生效,普通 `next dev` 下不可用)
- `npm run build` / `npm start` — Next.js 构建与生产服务器
- `npm run lint` — 通过 `eslint-config-next` 运行 ESLint
- `npm run d1` — 使用 Wrangler 本地应用数据库 schema:`wrangler d1 execute img --local --file=./tgimglog.sql`

本项目未配置测试框架。

## 部署目标与限制

应用通过 `@cloudflare/next-on-pages` 构建,面向 Cloudflare Pages。每个 API 路由都设置了 `export const runtime = 'edge';`。Cloudflare 相关绑定通过 `@cloudflare/next-on-pages` 的 `getRequestContext()` 访问,而非 Node.js 的 `process`:

- `env.IMG` — **D1 数据库绑定**(SQLite)。存储 `tgimglog.sql` 中定义的两张表:
  - `imginfo`:上传图片的元数据(`url`、`referer`、`ip`、`rating`、`total`、`time`)
  - `tgimglog`:每次请求的访问日志(`url`、`referer`、`ip`、`time`)
- `env.IMGRS` — 可选的 **R2 存储桶**绑定(在 CF 控制台配置,详见 `docs/manage.md`)
- Cloudflare 环境变量(如 `TG_BOT_TOKEN`、`ModerateContentApiKey`、`CUSTOM_DOMAIN`)在运行时从 `env` 读取。

**本地开发注意:** 依赖 `env.IMG`/绑定的路由在普通 `next dev` 下会静默降级。代码中通过 `if (!env.IMG)` 分支判断,仍可直接代理 `telegra.ph` 来提供图片。有意义的测试需要部署到 Cloudflare Pages(并按 README 第 7 步设置 `nodejs_compat` 兼容性标志)。

## 架构

### 请求流程

1. **上传**(`src/app/api/tg/route.js`):客户端 POST 文件 → 该路由将其代理到 `https://telegra.ph/upload` → 返回 `/file/<name>` URL 给客户端。成功后调用审核 API 并向 `imginfo` 插入一行记录。
2. **提供图片**(`src/app/api/file/[name]/route.js`):标准的图片端点,通过 `next.config.mjs` 中的 rewrite 公开暴露(`/file/:name* → /api/file/:name*`)。每次命中时:从 `telegra.ph` 代理图片,插入一条 `tgimglog` 记录,查询 `imginfo` 中缓存的 `rating`,并执行 `total += 1`。若 `rating === 3` 则重定向到 `/img/blocked.png`。
3. **Telegram 支持的变体**位于 `src/app/api/` 下:`cfile/[name]`(带缓存,通过 Telegram Bot API 的 `getFile` 提供)和 `rfile/[name]`。`cfile` 使用 Cloudflare 的 `caches.default`,并对 admin/list/home 等来源跳过 rating 拦截。
4. **辅助上传代理**:`58img`、`tencent`、`vviptuangou` 将上传代理到其他国内图床;`ip` 返回调用者 IP;`total` 返回汇总统计。

### 内容审核(rating)逻辑

`rating` 是一个整数,其中 `3` 表示被屏蔽/NSFW。有两个数据来源,优先级为 `RATINGAPI` > `ModerateContentApiKey`(均为可选环境变量)。`rating === 3` 会触发 `blocked.png` 重定向,且**不得被缓存** —— 参见提交 `a4c1f82`(rating=3 的图片被刻意排除在缓存之外,以保证屏蔽持续生效)。修改缓存/审核相关行为时,必须保留"被屏蔽图片不缓存"这一约定。

### 鉴权模型(NextAuth v5 beta)

`src/auth.js` 配置了单一的 `CredentialsProvider`,通过环境变量校验两种硬编码角色:
- **admin**:`BASIC_USER` / `BASIC_PASS` → `role: 'admin'`
- **user**:`REGULAR_USER` / `REGULAR_PASS` → `role: 'user'`

JWT 会话(24 小时),`secret` 来自 `SECRET` 环境变量(回退默认值在 `.env.example` 中 —— 生产环境务必替换)。角色通过 `jwt`/`session` 回调传递。

`src/middleware.js`(`auth()` 包装器)用静态 `matcher` 守卫三个路由前缀:
- `/admin/:path*` 和 `/api/admin/:path*` — 要求 `admin` 角色;未认证 → 重定向到 `/login`(页面)或返回 401 JSON(API)
- `/api/enableauthapi/:path*` — 可选的访客门控,仅在 `ENABLE_AUTH_API=true` 时生效

`/api/admin/*` 路由(`list`、`log`、`ip`、`block`、`delete`)查询/修改 D1 表以供管理后台使用。

### 前端

- `src/app/page.js` — 公开上传界面(客户端组件,使用 `react-photo-view`、`react-toastify`、FontAwesome)
- `src/app/admin/page.js` — 管理后台仪表盘,使用 `src/components/Table.jsx`;调用 `/api/admin/*`
- `src/app/login/page.jsx` + `src/components/SignIn.jsx` — NextAuth 登录
- 样式:Tailwind CSS(`tailwind.config.js`);`src/app/layout.js` 注入全局 CSS、Toastify/PhotoView CSS 以及 Google Analytics(`G-JVKEXR5XSG`)。

## 约定

- 所有 SQL 均按路由内联编写;许多查询直接拼接值(如 `WHERE url='${url}'`)。修改时应优先使用参数化的 `.bind()` 形式(如 `insertTgImgLog` 中的用法)。
- `get_nowTime()` 和 `getRating()` 等辅助函数在各路由文件中重复存在而非共享 —— 编辑时请与本地副本的签名保持一致。
- 时间通过 `Intl.DateTimeFormat` 以 `Asia/Shanghai` 时区格式化。
