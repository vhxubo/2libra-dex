# 2Libra 图鉴

2Libra 徽章图鉴:浏览已采集的徽章数据,支持搜索、筛选、排序、分页与详情分享;「潘多拉事件」页以纯表格展示已采集的事件记录,支持按稀有度与 tier_code 排序;内置数据来源页(`/sources`)与浅色/深色主题切换;支持使用 2libra 账号 OAuth 登录(Cloudflare Worker 代理授权码交换并签发会话),登录后自动标记已获得的徽章并可按获得状态筛选。站点包含徽章图鉴、潘多拉事件与数据来源三个页面。

> 数据说明:徽章数据来自对 2Libra 徽章卡片的公开页面采集(见根目录 `top/*.html` 与 `extract_badges.py`),当前 32 条记录;潘多拉事件数据来自社区收集贴([forum-function/nRdljKG](https://2libra.com/post/forum-function/nRdljKG))与其公开通知接口,当前 29 条采集记录,内容完全重复的仅保留最新一条,页面展示 21 条。本站不宣称是完整官方图鉴,也不推断稀有度名称、获取有效期或当前可获取状态。

## 技术栈

- Vite + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui 风格组件(Radix primitives)+ Lucide 图标
- TanStack Table(表格视图)、React Router(URL 状态同步)
- Cloudflare Worker(登录 API:`/api/auth/*`)+ 静态资产部署
- Vitest + React Testing Library
- pnpm 管理依赖

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器(`/api/auth` 代理到本地 wrangler,须另开 `pnpm dev:worker`) |
| `pnpm dev:worker` | 启动 Worker + 静态资产本地服务(需先 `pnpm build` 产出 `dist/`,读取 `.dev.vars`) |
| `pnpm build` | 类型检查 + 产出 `dist/` 静态文件 |
| `pnpm preview` | 本地预览构建产物(自动带 SPA 回退) |
| `pnpm typecheck` | 类型检查(`tsc -b` + worker 独立 tsconfig) |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 运行全部测试(Vitest,单次) |
| `pnpm test:watch` | 测试-watch 模式 |

## 数据更新

`badges.json` 是唯一的数据源,构建时直接导入(`src/features/badges/data.ts`),没有第二份数据。文件结构为 `{ meta: { badgeCount, updatedAt }, badges: [...] }`,`meta.badgeCount` 为采集到的唯一徽章数,`meta.updatedAt` 为脚本生成日期(YYYY-MM-DD),图鉴页头部展示为"数据更新于":

1. 将新的徽章卡片页面快照存入 `top/*.html`;
2. 运行 `python3 extract_badges.py`,脚本会解析、跨用户合并去重、按"等级 + 获得率 + ID"排序并覆盖写回根目录 `badges.json`;
3. 重新构建部署即可,页面与测试均从该 JSON 读取。

字段含义保持采集时的定义:`id / name / icon / level(T0–T3) / rate(获得率,%) / condition(获取条件) / attrType(佩戴属性·描述) / attr(属性文本)`。显示时获得率直接添加 `%`,例如 `0.01 → 0.01%`。

### 潘多拉事件数据

`pandora.json` 是潘多拉事件页的唯一数据源,同样构建时导入(`src/features/pandora/data.ts`),文件结构为 `{ meta: { eventCount }, events: [...] }`,每条事件保留 `id / payload / created_at`,`payload` 内含 `rarity(bronze·silver·gold·purple) / tier_code / event_code / event_name / event_title / rolled_value(可为 null)`。数据按 `created_at` 从新到旧存放,页面不展示时间列,`created_at` 仅作同稀有度/同 tier_code 内的排序回退;`message` 字段与 `event_name：event_title` 重复,接入时丢弃。

数据出处为社区收集贴 [【💰】潘多拉事件收集贴](https://2libra.com/post/forum-function/nRdljKG)(帖内含按稀有度排序的去重事件表,与本站 bronze < silver < gold < purple 的高低序一致),更新数据时可参考帖内说明调用通知接口 `GET /api/notifications/list?type=pandora` 采集。

## 目录结构

```
badges.json              # 徽章唯一数据源(采集脚本输出,构建时导入)
pandora.json             # 潘多拉事件唯一数据源(采集输出,构建时导入)
extract_badges.py        # 采集解析脚本
top/                     # 采集的原始页面快照(gitignore)
wrangler.jsonc           # Cloudflare Workers 部署配置(main + assets)
worker/                  # Cloudflare Worker(登录 API 与 SPA 回退)
  index.ts               # 路由:/api/auth/* 五个端点,其余转静态资产
  oauth.ts               # 2libra OAuth 调用(token 交换、拉取 /me)
  userBadges.ts          # 抓取用户 about 页解析已获得徽章 id
  session.ts             # 会话令牌签发/校验(HMAC 签名 cookie)
  tsconfig.json          # worker 独立类型检查配置
.dev.vars                # 本地开发密钥(gitignore)
public/                  # favicon 等静态资源
src/
  app/                   # 应用外壳:导航、页脚、路由、主题切换按钮
  components/            # 共享组件:ui/(shadcn 风格)、Pagination
  lib/                   # theme.ts(主题读写)、useOverflowTitle.ts、utils.ts
  features/auth/         # 登录业务模块
    types.ts oauth.ts    # 类型与纯函数(授权地址、state 存取、回调解析)
    AuthContext.tsx      # 会话状态 Provider(login/logout/refresh)
    AuthCallbackPage.tsx # /auth/callback 回调处理页
    components/          # 导航栏用户菜单
    *.test.ts(x)         # 单元测试与交互测试
  features/badges/       # 徽章业务模块
    types.ts data.ts     # 类型与数据接入
    query.ts             # 搜索/筛选/排序/获得率解析(纯函数)
    urlState.ts          # URL 查询参数解析与序列化
    components/          # 卡片、表格视图、详情弹窗、筛选工具栏
    *.test.ts(x)         # 单元测试与交互测试
  features/pandora/      # 潘多拉事件业务模块(结构同上,纯表格视图)
  features/sources/      # 数据来源页
  test/setup.ts          # Vitest 测试环境准备
```

## 路由

| 路径 | 页面 |
| --- | --- |
| `/badges` | 徽章图鉴(首页,`/` 重定向至此) |
| `/pandoras` | 潘多拉事件(纯表格,表头排序) |
| `/sources` | 数据来源(徽章图鉴页头入口进入) |
| `/auth/callback` | OAuth 授权回跳处理(无界面内容,完成后跳回图鉴) |

未知路径一律重定向回 `/badges`。

## 查询与 URL 状态

搜索、筛选、排序、视图、页码与详情徽章 ID 全部同步到 `/badges` 的查询参数,支持刷新恢复、复制分享与浏览器前进后退;非法参数一律恢复默认值:

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| `q` | 搜索词,覆盖名称/ID/获取条件/属性,多关键词空格分隔且须全部命中 | `?q=篝火 金币` |
| `level` | 等级多选,逗号分隔 | `?level=T0,T2` |
| `attr` | 属性类型(佩戴属性/描述) | `?attr=描述` |
| `earned` | 登录用户的获得状态筛选,`owned / missing`,需已登录拉到已获得数据才生效 | `?earned=owned` |
| `sort` | `rate-desc / rate-asc / name-asc / name-desc`,默认 `rate-desc` | `?sort=rate-asc` |
| `view` | `card`(默认)/ `table` | `?view=table` |
| `page` | 页码,超出范围自动回正 | `?page=2` |
| `badge` | 详情弹窗的徽章 ID | `?badge=followers` |

默认每页 12 条,可选 24、48;筛选或排序变化自动回到第一页。未知徽章链接会得到明确提示。

`/pandoras` 为两级表格:接入时先对内容完全一致(payload 各字段)的重复记录去重、仅保留最新一条,同名事件合并为一级行(展示最高稀有度、tier_code 汇总),组内多于一条时点击行展开二级表查看各条事件(稀有度、tier_code、效果,时间从新到旧),仅一条时直接在「事件效果」列展示、不提供展开;搜索框覆盖事件名称/事件代码/效果文本/tier_code/稀有度(代码或中文标签),多关键词空格分隔且须全部命中,输入法组合期间不上报,搜索在分组前过滤;一级行默认按组内最高稀有度从高到低(bronze < silver < gold < purple)排列,点击表头「最高稀有度」「tier_code」在升降序间切换(tier 按组内字典序最小的 tier_code 比较,跨列点击稀有度落降序、tier_code 落升序);`?q=金币雨&sort=rarity-asc` 等值支持刷新恢复,非法值恢复默认。

## 主题(浅色 / 深色)

- 首次访问跟随系统 `prefers-color-scheme`,之后通过导航栏按钮切换并持久化到 `localStorage`(键 `theme`)。
- `index.html` 内联脚本在首屏渲染前应用主题,避免深色模式闪白。
- 切换时同步 `meta[name="theme-color"]`,移动端地址栏颜色跟随主题。

## 数据来源页

`/sources` 展示采集时参考的公开用户页面:2Libra 管理员与金币排行榜 Top 10,均链接到对应的用户介绍页,数据维护在 `src/features/sources/data.ts`。

## 登录(2libra OAuth 2.0)

使用 2libra 账号授权登录,`client_secret` 只存在于 Cloudflare Worker 服务端,不进前端产物;前端不保存任何 access_token,localStorage 无敏感数据。

流程:导航栏「登录」→ 跳转 `https://2libra.com/oauth/authorize`(带随机 `state`,存 sessionStorage 防 CSRF)→ 用户确认后回跳 `/auth/callback` → 前端校验 `state`,把授权码 POST 给 Worker `/api/auth/exchange` → Worker 用 secret 换 access_token、拉取 `/api/oauth/me` 后立即丢弃 token,签发 httpOnly 签名 cookie(HMAC-SHA256,30 天)并返回用户资料 → 跳回图鉴,导航栏显示头像与用户名(菜单含 2libra 主页外链与退出登录)。

Worker 端点(`worker/index.ts`,同源 `/api/auth/*`):

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/auth/config` | GET | 返回 `client_id` 与 `redirect_uri`;未配置 secret 时 503,前端登录按钮自动降级为「登录暂未开放」 |
| `/api/auth/exchange` | POST | 授权码换会话(code 单次、10 分钟有效由 2libra 保证) |
| `/api/auth/session` | GET | 依据 cookie 返回当前用户,无效会话 401 |
| `/api/auth/user-badges` | GET | 登录用户的已获得徽章 id 列表(Worker 代理抓取其 about 页解析,无会话 401) |
| `/api/auth/logout` | POST | 清除会话 cookie |

### 已获得徽章(登录后)

登录成功后,前端调用 `/api/auth/user-badges`,Worker 以会话中的用户名抓取 `https://2libra.com/user/{用户名}/about`:该页会把佩戴徽章与徽章墙(客户端 `user-badge-display-modal` 弹窗的同一数据源)SSR 成 `r2.2libra.com/badge/svg/{id}.svg` 的图片引用,Worker 提取这些 id 即已获得徽章,无需用户在 2libra 侧额外授权。前端缓存 5 分钟,图鉴卡片/表格/详情弹窗展示「已获得」标记,并可在工具栏按 全部/已获得/未获得 筛选(URL 参数 `earned`);未登录或拉取失败时筛选与标记自动隐藏,不影响基础图鉴功能。

会话为无状态签名 cookie,不依赖数据库;后续接入 Cloudflare D1 等存储时,加 wrangler binding 即可让 API 调用天然携带身份,登录流程无需重构。2libra 的 access_token 有效期 2 小时且无 refresh token,仅展示资料不受影响,需刷新资料时重新走一次授权。

本地联调:`.dev.vars` 写入三个键(`OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` / `AUTH_SESSION_KEY`,gitignore 已忽略),`pnpm build && pnpm dev:worker` 后用 `wrangler dev` 的地址访问;`pnpm dev` 的 Vite 已把 `/api/auth` 代理到 `127.0.0.1:8787`。注意 redirect_uri 须与 2libra 注册值完全一致,完整授权回跳需在注册的域名下进行(本地仅适合调试 API 与界面)。

## 部署(Cloudflare Workers)

Worker 脚本 + 静态资产部署,配置见 `wrangler.jsonc`:`main` 指向 `worker/index.ts`,`assets.directory` 指向 `dist/`(显式 `binding: ASSETS`),Worker 处理 `/api/auth/*` 与 SPA 回退,其余请求命中静态资产时直接返回。

首次部署前配置三个 secret(申请 OAuth 应用时注册回调地址 `https://2libra-dex.vhxubo.com/auth/callback`):

```sh
pnpm build
npx wrangler secret put OAUTH_CLIENT_ID
npx wrangler secret put OAUTH_CLIENT_SECRET
npx wrangler secret put AUTH_SESSION_KEY   # 任意高强度随机串,用于会话签名
npx wrangler deploy
```

未配置 secret 时站点其余功能不受影响,仅登录入口显示「登录暂未开放」。

## 部署(其他静态托管)

`pnpm build` 产出纯静态 `dist/`,可部署到任意静态托管,但登录依赖 Worker(`/api/auth/*`),纯静态托管下登录按钮会自动降级为不可用,其余功能不受影响。应用使用 BrowserRouter,**必须配置 SPA 路由回退**:除真实文件外,其余路径统一返回 `index.html`(200),否则刷新/直达 `/badges` 会 404。

- **Nginx**

  ```nginx
  server {
    listen 80;
    root /var/www/2libra-dex/dist;
    index index.html;
    location / {
      try_files $uri $uri/ /index.html;
    }
  }
  ```

- **Netlify**:仓库根放置 `public/_redirects`(会随构建拷入 `dist/`):

  ```
  /*    /index.html   200
  ```

- **Vercel**:`vercel.json`

  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

- **Caddy**:`try_files {path} /index.html`

- **GitHub Pages**:需 SPA 回退补丁(如 404 页脚本方案)或改用 HashRouter(当前未采用)。

本地验证回退:`pnpm build && pnpm preview`,直接访问 `http://localhost:4173/badges?badge=followers` 应正常打开详情弹窗。

## 无障碍与响应式

- 卡片、筛选、详情弹窗均可键盘操作,焦点态明确;弹窗由 Radix Dialog 提供焦点圈定与 Esc 关闭。
- 桌面端卡片多列自适应(2/3/4 列),移动端单列;表格视图可横向滚动;工具栏在窄屏下换行重排,文本溢出截断并保留悬停提示。
- 徽章图片懒加载,加载失败显示占位并保留可读名称。

## 版本边界

登录已完成(OAuth 授权 + 会话 cookie + 导航栏用户菜单);不包含个人收藏、管理后台与自动采集。潘多拉事件当前为静态数据快照展示,不含事件效果实时解析。数据库(D1/KV)为后续规划,当前会话为无状态签名 cookie,接入时无需重构登录流程。
