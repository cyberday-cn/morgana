# Morgana 页面服务架构

理解此架构是排查"页面看不到变化"问题的基础。

## 双端口架构

Morgana 使用两个独立的 HTTP 服务：

| 端口 | 用途 | 技术栈 | 路径 |
|------|------|--------|------|
| **3001** | API 后端（SDK、数据库、路由） | Express + TypeScript (`src/index.ts`) | `backend/src/` |
| **3002** | 静态页面文件服务 | Express static 或 Python http.server | `pages/` 或 `<PAGES_ROOT>/` |

### 端口 3001 — API 后端

提供所有数据操作接口：
- `POST /api/sdk/db/query` — SDK 查询入口，body: `{sql: "SELECT ...", params: [...]}`
- `POST /api/sdk/db/insert` — SDK 插入
- `POST /api/render-pptx` — PPTX → PNG 渲染
- `GET /api/health` — 健康检查
- `PUT /api/infrastructure/config` — **触发页面刷新 SSE 事件**
- `GET /api/infrastructure/events` — SSE 事件流（前端监听此端点接收刷新信号）

后端代码结构：
```
backend/src/
├── index.ts          # 入口：挂载路由、启动服务器
├── config.ts         # 配置加载（default.json + env.conf + 环境变量）
├── db.ts             # 数据库连接池 (mysql2)
└── routes/
    ├── sdk.ts        # Morgana JS SDK 的后端实现
    ├── render-pptx.ts # LibreOffice PPTX 渲染路由
    ├── pages.ts      # 页面 CRUD（创建时写初始 HTML 文件）
    ├── files.ts      # 文件上传/下载
    └── ...
```

配置文件：
- `backend/config/default.json` — 默认配置（端口、数据库、pages root）
- `backend/startup/env.conf` — 运行时覆盖（可选）

### 端口 3002 — 静态文件服务

直接从磁盘目录提供 `.html` 文件。固定页面的实际文件位置：
```
<PAGES_ROOT>/page_14.html    ← 文档管理页面
<PAGES_ROOT>/page_9.html     ← 甘特图看板
<PAGES_ROOT>/page_13.html    ← 思维导图
...
```

## 前端加载机制

Morgana 前端（React SPA）通过 `<iframe>` 嵌入固定页面：

```tsx
// PageContent.tsx 中的关键逻辑
const pagesPort = infrastructure?.pages.port ?? 3002;
const pageUrl = `http://localhost:${pagesPort}/page_${page.id}.html?t=${refreshKey}`;

<iframe
  key={refreshKey}
  src={pageUrl}
  className="fixed-page-iframe"
  onLoad={() => setLoaded(true)}
/>
```

关键点：
1. **iframe 加载** — 固定页面运行在独立 iframe 中，与 Morgana 前端隔离
2. **缓存破坏** — URL 带 `?t={timestamp}` 参数，每次刷新生成新值强制浏览器重新请求
3. **refreshKey 递增** — 触发刷新时 `setRefreshKey(k => k + 1)`，改变 URL 导致 iframe 重新加载

## 页面刷新触发方式

有三种方式让用户看到最新页面内容（按推荐顺序）：

### 方式 A：通过 infrastructure config API（推荐）

```bash
curl -s -X PUT http://localhost:3001/api/infrastructure/config \
  -H "Content-Type: application/json" \
  -d '{"pages":{"root":"<PAGES_ROOT>","port":3002}}'
```

这会触发后端广播 `page_refresh` SSE 事件，前端监听到后自动更新 `refreshKey` 并重新加载 iframe。

⚠️ body 必须包含 `pages.root` 和/或 `pages.port`，不能传空对象 `{}`。

### 方式 B：SSE 事件流自动推送

前端在挂载时连接 `http://localhost:3001/api/infrastructure/events`（EventSource），监听 `page_refresh` 事件。任何调用 `PUT /api/infrastructure/config` 的操作都会触发此事件。

### 方式 C：用户手动 Ctrl+F5

用户在浏览器中按 Ctrl+F5 强制刷新整个 Morgana 前端页面。这会重新加载 React SPA，iframe 也会带着新的 cache buster 重新请求。

⚠️ 方式 C 不一定可靠——如果 Morgana 前端本身有缓存，可能需要多次刷新。

## 排查"页面空白/无数据"的命令速查

```bash
# 1. 检查后端 API 是否存活
curl -s http://localhost:3001/api/health
# 预期: {"status":"ok","timestamp":"..."}

# 2. 检查静态文件服务是否存活
curl -s http://localhost:3002/page_14.html | head -3
# 预期: <!DOCTYPE html>...

# 3. 检查数据库查询是否正常
curl -s -X POST http://localhost:3001/api/sdk/db/query \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT id, title FROM documents LIMIT 5"}'
# 预期: {"rows":[{...}, ...]}

# 4. 检查特定路由是否可用
curl -s -X POST http://localhost:3001/api/render-pptx \
  -H "Content-Type: application/json" \
  -d '{"base64":"test"}'
# 预期: {"error":"No slides were generated"} （说明路由存在且可响应）

# 5. 检查页面文件完整性
wc -l <PAGES_ROOT>/page_14.html
# 预期: 合理的行数（如 1000+ 行），不是 21 行或异常少
```

## 新增后端路由的步骤

当需要为固定页面添加新的后端功能（如 PPTX 渲染）时：

1. 在 `backend/src/routes/` 下新建路由文件（如 `render-pptx.ts`）
2. 在 `backend/src/index.ts` 中 import 并挂载：
   ```ts
   import { renderPptxRouter } from './routes/render-pptx.js'
   app.use('/api', renderPptxRouter)
   ```
3. 重启后端服务（tsx watch 应该自动重启，否则手动重启）
4. 用 curl 测试路由是否响应
5. 更新前端代码调用新路由
6. 验证前后端字段名一致
