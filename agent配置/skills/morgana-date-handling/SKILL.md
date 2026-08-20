---
name: morgana-date-handling
title: Morgana 页面日期时区处理
description: MySQL DATE 经 MariaDB SDK → JSON.stringify 时 Date.toISOString() 转 UTC 导致日期少1天的修复方案
---

## 触发条件

使用 Morgana SDK 处理日期字段（MySQL DATE 类型）时，以下场景需要加载此技能：
- 页面数据显示比数据库少1天
- `<input type="date">` 回显为空或日期不对
- `new Date()` 比较日期时出现时区导致的偏差

## 根因

MySQL DATE 类型 → MariaDB SDK → JavaScript Date 对象
→ `JSON.stringify` 调用 `Date.toISOString()` 将 `2026-06-29T00:00:00+08:00` 转为 UTC 时间 `"2026-06-28T16:00:00.000Z"`
→ 前端 `.substring(0,10)` 提取为 `"2026-06-28"` → 日期少1天

`<input type="date">.value` 只接受 `YYYY-MM-DD` 格式，不接受 ISO 字符串或 Date 对象。

## 标准修复方案

### 1. 日期归一化函数
将任意格式的日期值统一转为 YYYY-MM-DD 字符串：

```javascript
const dateToStr = v => {
  if (!v) return '';
  if (typeof v === 'string' && v.includes('T')) {
    const d = new Date(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  if (v instanceof Date) {
    const tzDate = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return tzDate.toISOString().split('T')[0];
  }
  return v.substring(0,10);
};
```

### 2. 日期显示函数（渲染用）
```javascript
const formatDate = v => {
  if (!v) return '—';
  const str = dateToStr(v);
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`;
};
```

### 3. 编辑弹窗回显（input type=date）
```javascript
const toDateInput = v => dateToStr(v);
```

### 4. 逾期判断
只比较 YYYY-MM-DD 字符串，不用 Date 对象：
```javascript
const todayStr = new Date().toISOString().split('T')[0];
const isPastDue = dateToStr(task.planned_end) < todayStr && status !== 'done';
```

## 常见陷阱

1. **WSL /mnt/d/ 写入缓存（最高优先级）**：`write_file`、`patch` 和 `sed` 在 WSL 的 Windows 挂载路径上会静默失败。`read_file` 也走同一缓存，给出虚假的"内容正确"确认。唯一可靠流程：写到 `/tmp/` → `cp + sync` 覆盖 → `terminal grep` 验证。`read_file` 也共享同一缓存层，会给出虚假的"内容正确"确认。**唯一可靠方案**：先写到 `/tmp/`，再用 `cp` + `sync` 覆盖目标文件，最后用 `terminal` 的 `grep` 验证（而非 `read_file`）：
   ```bash
   # 在 execute_code 中用 Python open().write() 写到 /tmp/
   cp /tmp/fixed.html <PAGES_ROOT>/page_8.html && sync
   grep "确认关键词" <PAGES_ROOT>/page_8.html
   ```
2. **MySQL DATE 无时区**：DATE 类型无时区信息，经 SDK 序列化时 `Date.toISOString()` 直接减8小时。DATETIME 同理。
3. **JSON.parse 不恢复 Date**：Date 经 `toISOString()` 转字符串后，`JSON.parse` 不会复原为 Date 对象，前端拿到的是 ISO 字符串。
4. **`new Date('YYYY-MM-DD')` 时区歧义**：`new Date('2026-06-30')` 浏览器中解析为 UTC 午夜，`new Date()` 是本地时间，边界日期比较会差1天。**始终用 YYYY-MM-DD 字符串字典序比较**，不用 Date 对象比较。
5. **多轮修复假象**：WSL 缓存导致修复看似生效（`read_file` 确认内容已变）但实际未落盘。用户反复报告同样问题、多次修复"无效果"时，第一怀疑就是 WSL 缓存。立即改用 `terminal` 的 `grep` 直接检查磁盘文件。

## 完整调试链路

当用户报告"显示日期比数据库少1天"时，按以下顺序逐层排查：

1. **确认数据库原始值** — 直接 `SELECT` 日期字段，确认不是数据本身的问题
2. **确认 API 返回 JSON** — `curl Morgana API` 查看日期字段在实际 HTTP 响应中的格式（是 `"2026-06-29"` 还是 `"2026-06-28T16:00:00.000Z"`）
3. **检查前端解析路径** — 从 `Morgana.query()` 返回值到 `renderCard()` 的完整链路，确认每一步日期值的变化
4. **怀疑 WSL 缓存** — 如果修复已"写入"但用户仍看到旧行为，用 `terminal grep` 直接验证磁盘文件

## 状态变更时的自动日期填入

当任务/记录状态变为"已完成"时，用 MySQL `CURDATE()`（服务器本地日期，无时区偏移）代替前端 `new Date()`：

```javascript
// 拖拽到"已完成"列时自动填入 actual_end
await Morgana.update(
  `UPDATE kanban_tasks SET status = ?, updated_at = NOW(),
   actual_end = CASE WHEN ? = 'done' THEN CURDATE() ELSE actual_end END
   WHERE id = ?`,
  [status, status, id]
);
```

CURDATE() 优于前端 `new Date().toISOString().split('T')[0]`——前者是 MySQL 服务器的本地日期，和 DATE 列一致；后者可能因时区偏移导致日期差1天。

## 验证步骤
1. 确认数据库实际值：直接 SELECT 查字段
2. 确认 API 返回 JSON 中日期是否含 T/Z
3. 检查前端 dateToStr 是否覆盖所有格式分支
4. 强制 Ctrl+F5 刷新浏览器缓存
5. 对比前端显示日期和数据库原始值，不一致时先怀疑 ISO→UTC 时区偏移
