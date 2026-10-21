# 2Libra 图鉴

2Libra 徽章图鉴:浏览已采集的徽章数据,支持搜索、筛选、排序、分页与详情分享;「潘多拉事件」页以纯表格展示已采集的事件记录,支持按稀有度与 tier_code 排序;内置数据来源页(`/sources`)与浅色/深色主题切换。站点包含徽章图鉴、潘多拉事件与数据来源三个页面。

> 数据说明:徽章数据来自对 2Libra 徽章卡片的公开页面采集(见根目录 `top/*.html` 与 `extract_badges.py`),当前 31 条记录;潘多拉事件数据来自社区收集贴([forum-function/nRdljKG](https://2libra.com/post/forum-function/nRdljKG))与其公开通知接口,当前 29 条采集记录,内容完全重复的仅保留最新一条,页面展示 21 条。本站不宣称是完整官方图鉴,也不推断稀有度名称、获取有效期或当前可获取状态。

## 技术栈

- Vite + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui 风格组件(Radix primitives)+ Lucide 图标
- TanStack Table(表格视图)、React Router(URL 状态同步)
- Vitest + React Testing Library
- pnpm 管理依赖

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查 + 产出 `dist/` 静态文件 |
| `pnpm preview` | 本地预览构建产物(自动带 SPA 回退) |
| `pnpm typecheck` | 仅类型检查(`tsc -b`) |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 运行全部测试(Vitest,单次) |
| `pnpm test:watch` | 测试-watch 模式 |

## 数据更新

`badges.json` 是唯一的数据源,构建时直接导入(`src/features/badges/data.ts`),没有第二份数据。文件结构为 `{ meta: { badgeCount }, badges: [...] }`,`meta.badgeCount` 为采集到的唯一徽章数:

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
wrangler.jsonc           # Cloudflare Workers 部署配置
public/                  # favicon 等静态资源
src/
  app/                   # 应用外壳:导航、页脚、路由、主题切换按钮
  components/            # 共享组件:ui/(shadcn 风格)、Pagination
  lib/                   # theme.ts(主题读写)、useOverflowTitle.ts、utils.ts
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
| `/pandora` | 潘多拉事件(纯表格,表头排序) |
| `/sources` | 数据来源(徽章图鉴页头入口进入) |

未知路径一律重定向回 `/badges`。

## 查询与 URL 状态

搜索、筛选、排序、视图、页码与详情徽章 ID 全部同步到 `/badges` 的查询参数,支持刷新恢复、复制分享与浏览器前进后退;非法参数一律恢复默认值:

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| `q` | 搜索词,覆盖名称/ID/获取条件/属性,多关键词空格分隔且须全部命中 | `?q=篝火 金币` |
| `level` | 等级多选,逗号分隔 | `?level=T0,T2` |
| `attr` | 属性类型(佩戴属性/描述) | `?attr=描述` |
| `sort` | `rate-desc / rate-asc / name-asc / name-desc`,默认 `rate-desc` | `?sort=rate-asc` |
| `view` | `card`(默认)/ `table` | `?view=table` |
| `page` | 页码,超出范围自动回正 | `?page=2` |
| `badge` | 详情弹窗的徽章 ID | `?badge=followers` |

默认每页 12 条,可选 24、48;筛选或排序变化自动回到第一页。未知徽章链接会得到明确提示。

`/pandora` 为两级表格:接入时先对内容完全一致(payload 各字段)的重复记录去重、仅保留最新一条,同名事件合并为一级行(展示最高稀有度、tier_code 汇总),组内多于一条时点击行展开二级表查看各条事件(稀有度、tier_code、效果,时间从新到旧),仅一条时直接在「事件效果」列展示、不提供展开;搜索框覆盖事件名称/事件代码/效果文本/tier_code/稀有度(代码或中文标签),多关键词空格分隔且须全部命中,输入法组合期间不上报,搜索在分组前过滤;一级行默认按组内最高稀有度从高到低(bronze < silver < gold < purple)排列,点击表头「最高稀有度」「tier_code」在升降序间切换(tier 按组内字典序最小的 tier_code 比较,跨列点击稀有度落降序、tier_code 落升序);`?q=金币雨&sort=rarity-asc` 等值支持刷新恢复,非法值恢复默认。

## 主题(浅色 / 深色)

- 首次访问跟随系统 `prefers-color-scheme`,之后通过导航栏按钮切换并持久化到 `localStorage`(键 `theme`)。
- `index.html` 内联脚本在首屏渲染前应用主题,避免深色模式闪白。
- 切换时同步 `meta[name="theme-color"]`,移动端地址栏颜色跟随主题。

## 数据来源页

`/sources` 展示采集时参考的公开用户页面:2Libra 管理员与金币排行榜 Top 10,均链接到对应的用户介绍页,数据维护在 `src/features/sources/data.ts`。

## 部署(Cloudflare Workers)

当前部署方式为 Cloudflare Workers 静态资产,配置见 `wrangler.jsonc`:`assets.directory` 指向 `dist/`,`not_found_handling: "single-page-application"` 自动提供 SPA 回退,并绑定自定义域名 `2libra-dex.vhxubo.com`。

```sh
pnpm build
npx wrangler deploy
```

## 部署(其他静态托管)

`pnpm build` 产出纯静态 `dist/`,可部署到任意静态托管。应用使用 BrowserRouter,**必须配置 SPA 路由回退**:除真实文件外,其余路径统一返回 `index.html`(200),否则刷新/直达 `/badges` 会 404。

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

不包含登录、个人收藏、管理后台与自动采集。潘多拉事件当前为静态数据快照展示,不含事件效果实时解析。
