# Morgana DATE 字段的时区陷阱

## 问题链路（完整版）

当前端页面通过 Morgana SDK 读取 MariaDB DATE 类型字段时，数据流经以下环节：

```
MariaDB DATE 值 (2026-06-29)
  → MariaDB Connector → JavaScript Date 对象
  → JSON.stringify → Date.toISOString() → UTC 时间
  → "2026-06-28T16:00:00.000Z"  ← 在 CST (UTC+8) 下少了 1 天
  → 前端 .substring(0, 10) → "2026-06-28" ← 错误的日期！
```

## 根因

`Date.toISOString()` 始终输出 UTC 时间。`2026-06-29T00:00:00+08:00` 变成 `2026-06-28T16:00:00.000Z`。任何基于字符串截取的日期提取（`.substring(0,10)`, `.split('-')`）都会拿到 UTC 日期而非本地日期。

## 症状（4 层叠加）

| 层 | 症状 | 根因 |
|----|------|------|
| 1 | 新建任务"保存失败" | `const { rows } = Morgana.query(...)` — SDK 返回数组非对象 |
| 2 | 编辑弹窗日期不回显 | `<input type="date">.value` 不接受 ISO 字符串 |
| 3 | 卡片日期比数据库少 1 天 | ISO `.substring(0,10)` 拿到 UTC 日期 |
| 4 | 不该逾期的任务显示逾期 | ISO 字符串与纯日期字符串比较失效 |

## 修复方案

### 1. 统一日期归一化函数

```javascript
function dateToStr(v) {
  if (!v) return '';
  if (v instanceof Date)
    return v.getFullYear() + '-' +
      String(v.getMonth() + 1).padStart(2, '0') + '-' +
      String(v.getDate()).padStart(2, '0');
  if (typeof v === 'string' && v.includes('T')) {
    // ISO 字符串：用 UTC getter 解析并重建正确日期
    var d = new Date(v);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  return String(v).substring(0, 10);
}
```

关键在于 `v.includes('T')` 检测 ISO 字符串，然后用 `new Date(v)` 的**本地时间 getter**（`.getFullYear()`, `.getMonth()`, `.getDate()`）重建正确日期。

### 2. input[type=date] 赋值

```javascript
function toDateInput(v) {
  if (!v) return '';
  // 复用 dateToStr 逻辑
  return dateToStr(v);
}
```

`input.value = toDateInput(task.planned_start)` — 确保传入的是 `YYYY-MM-DD` 格式。

### 3. 逾期判断用纯日期字符串比较

```javascript
var todayStr = new Date().toISOString().slice(0, 10);  // "2026-06-30"
var plannedEnd = dateToStr(task.planned_end);           // "2026-06-29"
var isPastDue = plannedEnd && plannedEnd < todayStr && status !== 'done';
// "2026-06-29" < "2026-06-30" → true → 逾期 ✓
```

不要用 `new Date(x) < new Date()` — 时区会让比较结果错误。

### 4. 实际完成时间用 CURDATE()

拖入"已完成"列时自动填入实际完成时间，用 MySQL 的 `CURDATE()`（服务器本地日期），避免前端时区问题：

```sql
UPDATE kanban_tasks SET
  status = ?,
  actual_end = CASE WHEN ? = 'done' THEN CURDATE() ELSE actual_end END
WHERE id = ?
```

## 禁止的做法

- ❌ `.substring(0, 10)` 直接截取 ISO 字符串 — 拿到的是 UTC 日期
- ❌ `new Date(x) < new Date()` 比较 — 时区偏移导致相同时刻的不同表示
- ❌ `.split('-').join('年') + '日'` — 把月份也映射成"年"
- ❌ `const { rows } = Morgana.query(...)` — SDK 返回数组不是对象
