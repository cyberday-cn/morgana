---
name: morgana-database
description: Database schema design and CRUD operations for Morgana — create tables with proper schema conventions.
tags: [morgana, database, sdk, crud]
---

# Morgana Database & SDK

数据库操作技能。当需要创建数据表或执行 SQL 操作时使用此技能。

## 数据库连接

- Type: MariaDB 11.4.5 LTS
- Host: `localhost`
- Port: `3306`
- Database: `morgana`
- User: `root`
- Password: empty
- 建表使用对话中的 SQL 语句执行，不要在 HTML 页面中建表

## 建表规范

- 表名使用小写蛇形（snake_case）：`customer_records`, `order_items`
- 必须包含自增 id 主键
- 必须包含 `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- 可选包含 `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`

```sql
CREATE TABLE IF NOT EXISTS customer_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## SDK 数据库操作方法

固定页面通过 Morgana JS SDK 进行数据操作。SDK 地址由系统提示词提供。

| 方法 | 用途 | SQL 约束 |
|------|------|----------|
| `Morgana.query(sql, params)` | 查询数据（SELECT） | 仅 SELECT |
| `Morgana.insert(sql, params)` | 插入数据（INSERT） | 仅 INSERT |
| `Morgana.update(sql, params)` | 更新数据（UPDATE） | 仅 UPDATE |
| `Morgana.delete(sql, params)` | 删除数据（DELETE） | 仅 DELETE |

所有 params 使用 `?` 占位符（prepared statement），禁止拼接 SQL 字符串。

```javascript
// 查询 — Morgana.query() 返回裸数组，非 {rows: [...]}
const rows = await Morgana.query('SELECT * FROM customer_records ORDER BY created_at DESC')

// 插入 — Morgana.insert() 返回 {insertId, affectedRows} 对象
const result = await Morgana.insert(
  'INSERT INTO customer_records (name, email) VALUES (?, ?)',
  ['张三', 'zhang@example.com']
)
const newId = result.insertId  // 自增 ID

// 更新 — Morgana.update() 返回 {affectedRows} 对象
await Morgana.update(
  'UPDATE customer_records SET email = ? WHERE id = ?',
  ['new@example.com', 1]
)

// 删除 — Morgana.delete() 返回 {affectedRows} 对象
await Morgana.delete('DELETE FROM customer_records WHERE id = ?', [1])
```

## DATE 字段时区陷阱

MariaDB 的 DATE 值经 Morgana SDK → JSON 序列化后会变成 ISO 8601 UTC 字符串（如 `"2026-06-28T16:00:00.000Z"` 代表 6月29日 CST）。前端代码用 `.substring(0,10)` 会拿到 UTC 日期而非本地日期，导致所有日期少 1 天。

**始终用 `dateToStr()` 归一化**（检测 `v.includes('T')` 后用 `new Date(v)` 的本地 getter），不要直接截取字符串。完整修复见 `morgana-infrastructure` 技能的 `references/date-timezone-traps.md`。

## 重要：DDL 无法通过 Morgana API 执行

Morgana SDK 的 API 端点（query / execute）**严格限制 SQL 类型**：

| 端点 | 允许 | 拒绝 |
|------|------|------|
| `/api/sdk/db/query` | SELECT | INSERT/UPDATE/DELETE + DDL |
| `/api/sdk/db/execute` | INSERT/UPDATE/DELETE | SELECT + **DDL（CREATE/ALTER/DROP/TRUNCATE）** |

这意味着 **CREATE TABLE、ALTER TABLE、DROP TABLE 等 DDL 操作无法通过 Morgana API 执行**。必须通过 pymysql 或 mysql CLI 直接连接 MariaDB。

### 从 Agent 执行 DDL（推荐 pymysql）

由于 WSL 内没有 mysql 客户端，使用 `execute_code` 的 pymysql 连接：

```python
import pymysql

# 1. 获取 Windows 主机 IP
# ip route show default | awk '{print $3}'  # 通常是 172.x.x.1
HOST = '<WINDOWS_IP>'  # 替换为实际 IP

conn = pymysql.connect(host=HOST, port=3306, user='root', password='', database='morgana')
try:
    with conn.cursor() as cursor:
        cursor.execute('CREATE TABLE IF NOT EXISTS my_table (... ENGINE=InnoDB DEFAULT CHARSET=utf8mb4)')
        # 或 ALTER TABLE
        cursor.execute('ALTER TABLE my_table ADD COLUMN ...')
    conn.commit()
finally:
    conn.close()
```

### 检查表是否存在

使用 SELECT 查询 information_schema（可以通过 Morgana API 执行）：

```sql
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'my_table'
```

### 查看表结构

```sql
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'my_table'
ORDER BY ORDINAL_POSITION
```

### 获取 Windows 主机 IP

```bash
ip route show default | awk '{print $3}'
```

详细的数据库连接参考见 `morgana-infrastructure` 技能的 `references/database.md`。

## 固定页面 vs 涌现页面

| 特性 | 涌现页面 (index.html) | 固定页面 (page_<id>.html) |
|------|----------------------|--------------------------|
| 用途 | 临时信息展示、交互式表单 | 持久化数据管理、业务功能 |
| 文件 | `页面根目录/index.html` | `页面根目录/page_<id>.html` |
| 生命周期 | 每次对话覆盖 | 长期保留，除非用户删除 |
| 数据存储 | 不必须 | 通常配合数据库表 |
