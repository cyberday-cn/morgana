# Morgana JS SDK API 参考

## 加载方式

```html
<script src="http://localhost:3001/api/sdk/morgana.js"></script>
```

SDK 暴露全局 `window.Morgana` 对象。

## SDK 自动推导 base URL

SDK 初始化时会从 script 标签的 `src` 属性自动推导 API base URL：

```javascript
var base = 'http://localhost:3001';  // 默认
var scripts = document.getElementsByTagName('script');
var src = scripts[scripts.length - 1].src;
if (src) {
  var idx = src.lastIndexOf('/api/sdk/morgana.js');
  if (idx !== -1) base = src.substring(0, idx);
}
```

**影响：** 如果 Morgana 页面从非 localhost 地址加载（如 WSL 中的 `http://<WINDOWS_IP>:3001`），SDK 仍会使用 script 标签中的地址。但如果 script 标签写的是 `http://localhost:3001/...`，base 就是 `http://localhost:3001`，在 Windows 浏览器中正常工作（localhost 指向 Windows 本机）。

## CORS 配置

Morgana API 服务器设置了以下 CORS 头：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
```

跨域请求不会被浏览器阻止。

## 方法签名与端点映射

所有方法通过 POST 请求调用，SDK 内部自动处理 JSON 序列化。

### `Morgana.query(sql, params)` → POST `/api/sdk/db/query`

执行 SELECT 查询。

| 参数 | 类型 | 说明 |
|------|------|------|
| sql | string | SELECT 语句，用 `?` 占位符 |
| params | array | 与占位符对应的参数数组（可选） |

**请求体**: `{"sql": "SELECT ...", "params": [...]}`

**返回值**：行数组 `rows[]`（非 `{rows: [...]}`）

```js
const rows = await Morgana.query('SELECT * FROM tasks WHERE status = ? ORDER BY sort_order', ['todo'])
// rows = [{id:1, title:"...", status:"todo"}, ...]
```

### `Morgana.insert(sql, params)` → POST `/api/sdk/db/execute`

执行 INSERT 语句。

| 参数 | 类型 | 说明 |
|------|------|------|
| sql | string | INSERT 语句，用 `?` 占位符 |
| params | array | 与占位符对应的参数数组 |

**请求体**: `{"sql": "INSERT ...", "params": [...]}`

**返回值**：`{ insertId: number, affectedRows: number }`

```js
const result = await Morgana.insert(
  'INSERT INTO tasks (title, status) VALUES (?, ?)',
  ['新任务', 'todo']
)
// result.insertId — 自增ID
```

### `Morgana.update(sql, params)` → POST `/api/sdk/db/execute`

执行 UPDATE 语句。

**请求体**: `{"sql": "UPDATE ...", "params": [...]}`

**返回值**：`{ affectedRows: number }`

```js
await Morgana.update(
  'UPDATE tasks SET status = ? WHERE id = ?',
  ['done', 5]
)
```

### `Morgana.delete(sql, params)` → POST `/api/sdk/db/execute`

执行 DELETE 语句。

**请求体**: `{"sql": "DELETE ...", "params": [...]}`

**返回值**：`{ affectedRows: number }`

```js
await Morgana.delete('DELETE FROM tasks WHERE id = ?', [5])
```

### `Morgana.submit(data)`

向 Agent 对话提交表单数据。

| 参数 | 类型 | 说明 |
|------|------|------|
| data | object | JSON 对象，发送到对话流 |

```js
Morgana.submit({ action: 'search', keyword: 'hello' })
```

## 页面刷新

通知 Morgana 重新加载固定页面，需要 PUT 完整的 pages 配置：

```bash
curl -s -X PUT "http://${WSL_HOST}:3001/api/infrastructure/config" \
  -H "Content-Type: application/json" \
  -d '{"pages": {"root": "<PAGES_ROOT>", "port": 3002}}'
```

⚠️ **必须包含 `pages.root` 和 `pages.port`**，省略会返回 `"Request body must include pages.root and/or pages.port"`。格式 `{"pages": ["page_8.html"]}` 无效。

## 常见陷阱

### 1. `query()` 的返回值解构错误

**错误**：`const { rows } = await Morgana.query(...)`
**正确**：`const rows = await Morgana.query(...)`

`Morgana.query()` 内部执行 `return (await res.json()).rows`，已经取出了 `.rows`，返回的是数组本身。`const { rows }` 会在数组上找 `rows` 属性，结果为 `undefined`。

### 2. params 不能省略成裸字符串

**错误**：`Morgana.query('SELECT * FROM t WHERE id = ?', 5)`
**正确**：`Morgana.query('SELECT * FROM t WHERE id = ?', [5])`

params 必须是数组，即使只有一个参数。

### 3. DDL 语句无法通过 SDK 执行

`query()` 只接受 SELECT，`insert/update/delete` 只接受 INSERT/UPDATE/DELETE。CREATE TABLE / ALTER TABLE / DROP TABLE 等 DDL 会被拒绝。需通过 pymysql 直接连接 MariaDB 执行。

### 4. DATE 类型字段返回 ISO UTC 时间戳

MariaDB 的 `DATE` 类型（无时间部分）通过 Morgana API 返回时被序列化为 ISO 8601 UTC 时间戳字符串：

```json
{"planned_start": "2026-06-24T16:00:00.000Z"}
```

在 UTC+8 时区下可能表现为日期少1天。详见 `references/api-date-handling.md`。

### 5. 直接 fetch vs SDK 方法

SDK 方法（`Morgana.insert` 等）和直接调用 `fetch('http://localhost:3001/api/sdk/db/execute', ...)` 功能相同——SDK 内部就是 fetch。优先使用 SDK 方法，代码更短且自动处理 base URL。但两者都可以正常工作——CORS 是开放的，端点路径相同。
