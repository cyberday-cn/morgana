# Morgana API DATE 字段处理

## 问题

MariaDB 的 `DATE` 类型（如 `2026-06-25`）经过 Morgana 后端（Node.js + mysql2）序列化为 ISO 8601 UTC 时间戳：

```json
{"planned_start": "2026-06-24T16:00:00.000Z"}
```

这是 `mysql2` 驱动默认行为 — DATE 列被当作 `Date` 对象处理，JSON 序列化时调用 `toISOString()`，输出 UTC 时区的午夜。

## 时区映射

| DB 存储值 | API 返回值 (ISO UTC) | UTC+8 本地值 |
|-----------|---------------------|-------------|
| 2026-06-25 | 2026-06-24T16:00:00.000Z | 2026-06-25 00:00:00 |
| 2026-06-24 | 2026-06-23T16:00:00.000Z | 2026-06-24 00:00:00 |

API 返回的 UTC 午夜在 UTC+8 时区恰好等于正确的本地日期。这是 MySQL 的 `DATE` → JavaScript `Date` 的常见序列化模式。

## 标准处理模式

### 1. 数据加载时统一转换（推荐）

在 `loadTasks()` 中一次性将 ISO 字符串转成 `YYYY-MM-DD`，后续逻辑只操作这个格式：

```javascript
function toDateStr(val) {
  if (!val) return null;
  var d = new Date(val);
  if (isNaN(d.getTime())) return null;
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

tasks = rows.map(function(t) {
  return {
    planned_start: toDateStr(t.planned_start),
    planned_end: toDateStr(t.planned_end),
    actual_start: toDateStr(t.actual_start),
    actual_end: toDateStr(t.actual_end),
    // ...其他字段
  };
});
```

### 2. 日期比较用 `parseDate()` + `setHours(0,0,0,0)`

将 `YYYY-MM-DD` 字符串解析为本地午夜 Date 对象再比较：

```javascript
function parseDate(str) {
  if (!str) return null;
  var d = new Date(str);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}
```

### 3. 日期偏移计算用 `daysBetween`

```javascript
function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
```

### 4. 获取今天日期

```javascript
function getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getTodayDate() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
```

## 必须避免的模式

### 错误：在 render 中用 `const todayStr = new Date()` 遮蔽函数名

```javascript
function todayStr() { return '...'; }

function render() {
  const todayStr = new Date();   // 遮蔽了上面的函数！
  // 后续调用 todayStr() → TypeError: todayStr is not a function
}
```

**方案**：函数用 `getTodayStr()` 命名，变量用 `todayDateObj` 或 `now` 命名，确保不冲突。必要时用 `var` 而非 `const/let` 避免块级作用域遮蔽。

### 错误：直接对 ISO 字符串用 `new Date().getDate()` 

```javascript
const d = new Date("2026-06-24T16:00:00.000Z");
d.getDate();  // 在 UTC+8 返回 25（正确），但其他时区可能不同
```

始终用 `toDateStr()` 统一解析。

### 错误：在 forEach/map 回调中混合使用 `function` 和 `=>`

`this` 绑定问题可能导致日期处理意外错误。优先用 `function() {}` 或仅在顶层用 `=>`。

## 调试技巧

如果实际日期条不显示，用 curl 直接查询 API 看原始返回值：

```bash
curl -s http://<windows-ip>:3001/api/sdk/db/query \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT id, title, actual_start, actual_end FROM kanban_tasks"}'
```

输出示例：
```json
{"rows":[
  {"actual_start":"2026-06-24T16:00:00.000Z","actual_end":"2026-06-25T16:00:00.000Z"}
]}
```

在页面中添加 `console.log(JSON.stringify(task))` 或调试面板，观察 `toDateStr()` 处理后的实际值。
