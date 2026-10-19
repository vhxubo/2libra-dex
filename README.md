# 2Libra 图鉴

2Libra 徽章图鉴:浏览已采集的徽章数据,支持搜索、筛选、排序、分页与详情分享。第一版仅包含徽章图鉴;"潘多拉事件"在导航中标注待开放。

> 数据说明:所有数据来自对 2Libra 徽章卡片的公开页面采集(见根目录 `top/*.html` 与 `extract_badges.py`),当前 31 条记录。本站不宣称是完整官方图鉴,也不推断稀有度名称、获取有效期或当前可获取状态。

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

`badges.json` 是唯一的数据源,构建时直接导入(`src/features/badges/data.ts`),没有第二份数据:

1. 将新的徽章卡片页面快照存入 `top/*.html`;
2. 运行 `python3 extract_badges.py`,脚本会解析、跨用户合并去重、按"等级 + 获得率 + ID"排序并覆盖写回根目录 `badges.json`;
3. 重新构建部署即可,页面与测试均从该 JSON 读取。

字段含义保持采集时的定义:`id / name / icon / level(T0–T3) / rate(获得率,%) / condition(获取条件) / attrType(佩戴属性·描述) / attr(属性文本)`。显示时获得率直接添加 `%`,例如 `0.01 → 0.01%`。

## 目录结构

```
badges.json              # 唯一数据源(采集脚本输出,构建时导入)
extract_badges.py        # 采集解析脚本
top/                     # 采集的原始页面快照(gitignore)
public/                  # favicon 等静态资源
src/
  app/                   # 应用外壳:导航、页脚、路由
  components/            # 共享组件:ui/(shadcn 风格)、Pagination
  features/badges/       # 徽章业务模块
    types.ts data.ts     # 类型与数据接入
    query.ts             # 搜索/筛选/排序/获得率解析(纯函数)
    urlState.ts          # URL 查询参数解析与序列化
    components/          # 卡片、表格视图、详情弹窗、筛选工具栏
    *.test.ts(x)         # 单元测试与交互测试
  test/setup.ts          # Vitest 测试环境准备
```

## 查询与 URL 状态

搜索、筛选、排序、视图、页码与详情徽章 ID 全部同步到 `/badges` 的查询参数,支持刷新恢复、复制分享与浏览器前进后退;非法参数一律恢复默认值:

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| `q` | 搜索词,覆盖名称/ID/获取条件/属性,多关键词空格分隔且须全部命中 | `?q=篝火 金币` |
| `level` | 等级多选,逗号分隔 | `?level=T0,T2` |
| `attr` | 属性类型(佩戴属性/描述) | `?attr=描述` |
| `min` / `max` | 获得率区间,含边界,限 0–100 | `?min=0.06&max=5` |
| `sort` | `default / rate-asc / rate-desc / name-asc / name-desc` | `?sort=rate-asc` |
| `view` | `card`(默认)/ `table` | `?view=table` |
| `page` | 页码,超出范围自动回正 | `?page=2` |
| `badge` | 详情弹窗的徽章 ID | `?badge=followers` |

默认每页 12 条,可选 24、48;筛选或排序变化自动回到第一页。未知徽章链接会得到明确提示。

## 部署(静态托管)

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
- 桌面端卡片多列自适应(2/3/4 列),移动端单列;表格视图可横向滚动。
- 徽章图片懒加载,加载失败显示占位并保留可读名称。

## 版本边界(第一版)

不包含登录、个人收藏、管理后台、自动采集与潘多拉事件数据处理。后续接入事件时复用应用导航与基础 UI,事件数据结构另行定义。
