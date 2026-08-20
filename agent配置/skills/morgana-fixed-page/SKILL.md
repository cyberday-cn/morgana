---
name: morgana-fixed-page
description: morgana固定页面生成 — 持久化数据管理页面，通过morgana-database skill进行数据库表的支持操作，固定页面集成 Morgana SDK 进行数据库 CRUD 操作。覆盖写入已有的 page_<id>.html 文件，不创建新文件。不包含环境配置信息，实际路径/端口/回调地址由系统提示词提供。
version: 1.3.0
author: Hermes Agent
tags: [morgana, fixed-pages, crud, database, sdk]
---

# Morgana 固定页面生成

**只生成固定页面，不输出文字回复。**

固定页面是长期保留的、带有数据存储的业务功能页面。与涌现页面（index.html，每次对话覆盖）不同，固定页面保存为 `page_<id>.html`，所有数据必须通过 Morgana SDK 操作 MariaDB 数据库进行持久化，**禁止使用 localStorage 或任何前端本地存储**。

## 核心原则

1. ⚠️ **文件已存在**：`page_<id>.html` 已在页面根目录存在，是创建固定页面时由系统预先创建的初始文件。必须**覆盖写入**此已有文件，不得创建新文件（如 page_<id+1>.html 等）
2. 确保数据库表已存在（扫描已有表或新建）
3. 将完整固定页面 HTML **覆盖**写入磁盘（`page_<id>.html`），页面内通过 Morgana SDK 操作数据库
4. 验证文件写入成功
5. 调用刷新回调通知 Morgana

**整个流程不输出文字回复。**

## 数据存储规则（必须遵守）

⚠️ **所有数据必须存储在 MariaDB 数据库中，通过 SDK 方法的 SQL 语句操作。禁止使用 localStorage、sessionStorage、IndexedDB 或任何前端本地存储方案。**

| 应该使用 | 禁止使用 |
|---------|---------|
| `Morgana.query('SELECT ...')` 读取数据 | `localStorage.getItem()` |
| `Morgana.insert('INSERT ...')` 保存数据 | `localStorage.setItem()` |
| `Morgana.update('UPDATE ...')` 修改数据 | 前端内存数组变量（刷新后丢失） |
| `Morgana.delete('DELETE ...')` 删除数据 | JSON.parse/stringify 模拟存储 |

## 建表流程

如果涉及持久化存储，必须先确保数据库表存在：

1. 先加载 `morgana-database` 技能
2. 查询已有表结构，判断是否需要新建表
3. 如需建表，在对话中直接执行 CREATE TABLE SQL
4. 建表后再生成固定页面 HTML

```sql
-- 建表示例
CREATE TABLE IF NOT EXISTS customer_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## SDK 集成

固定页面必须引用 Morgana JS SDK 进行数据库操作：

```html
<script src="http://localhost:3001/api/sdk/morgana.js"></script>
SDK 暴露全局 `window.Morgana` 对象。SDK 由 Windows 主机的 Morgana 后端（端口 3001）提供服务，在 Morgana 的 webview（手机/Windows 端）中 `localhost:3001` 正确解析到 Windows 主机。SDK 源码可在 WSL 中验证：`curl -s http://$(ip route show default|awk '{print $3}'):3001/api/sdk/morgana.js`。

### SDK 方法

| 方法 | 用途 | 返回值 |
|------|------|--------|
| `Morgana.query(sql, params)` | SELECT 查询 | **裸数组** `[{id:1, name:'...'}, ...]`，非 `{rows:[...]}` |
| `Morgana.insert(sql, params)` | INSERT 插入 | `{insertId: number, affectedRows: number}`（对象！不是数字） |
| `Morgana.update(sql, params)` | UPDATE 更新 | `{affectedRows: number}` |
| `Morgana.delete(sql, params)` | DELETE 删除 | `{affectedRows: number}` |
| `Morgana.submit(data)` | 提交表单数据到对话 |

params 使用 `?` 占位符（prepared statement），禁止拼接 SQL。

### ⚠️ 常见陷阱

#### 1. JS 中的 SQL 字符串引号冲突（致命）

当 SQL 内部包含字符串字面量（如 `DEFAULT '思维导图'`），外层 JS 字符串**必须用双引号** `"..."`：

```html
<!-- ❌ 错误：JS 单引号与 SQL 单引号冲突，整个 <script> 块无法解析 -->
<script>
await Morgana.insert('CREATE TABLE t (name VARCHAR(100) NOT NULL DEFAULT '默认名')');
</script>

<!-- ✅ 正确：外层用双引号，SQL 内部用单引号 -->
<script>
await Morgana.insert("CREATE TABLE t (name VARCHAR(100) NOT NULL DEFAULT '默认名')");
</script>
```

SQL 中的 `?` 占位符不会出现在字符串字面量中，没有这个问题。仅当 SQL 直接包含单引号字符串（DEFAULT 值、CHECK 约束等）时需要留意。

#### 2. 插入后获取自增 ID

`Morgana.insert()` 返回 `{insertId, affectedRows}`，`insertId` 就是新记录的自增 ID：

```js
var result = await Morgana.insert("INSERT INTO maps (title) VALUES (?)", ['我的地图']);
var newId = result.insertId;  // ✅ 正确的用法
```

#### 3. 页面初始化空数据

如果页面需要预置示例数据，在 `loadMaps` / `loadData` 函数中检测数据为空时自动创建：

```js
async function loadMaps() {
  var result = await Morgana.query("SELECT * FROM maps");
  maps = Array.isArray(result) ? result : [];
  if (maps.length === 0) {
    await createSampleData();  // 插入示例数据
    return await loadMaps();   // 重新加载
  }
  // 正常渲染...
}
```

#### 4. `showInput` / `closeInput` 回调失效（致命）

**症状：** 点击弹窗"确定"按钮后无反应，回调从未执行，数据从未写入数据库。

**根因：** `closeInput()` 在调用回调**之前**把 `inputCallback` 设成了 `null`：

```javascript
// ❌ 错误：closeInput() 先执行 → inputCallback = null → 回调永不触发
document.getElementById('inputOk').onclick = function() {
    var val = input.value.trim();
    if (!val) { showToast('名称不能为空', 'error'); return; }
    closeInput();                              // inputCallback = null
    if (inputCallback) inputCallback(val);     // null → 跳过
};

// ✅ 正确：先保存引用，再 closeInput
document.getElementById('inputOk').onclick = function() {
    var val = input.value.trim();
    if (!val) { showToast('名称不能为空', 'error'); return; }
    var cb = inputCallback;  // 保存引用
    closeInput();            // inputCallback = null
    if (cb) cb(val);         // 用保存的引用执行
};
```

```javascript
function closeInput() {
    document.getElementById('inputOverlay').classList.remove('active');
    inputCallback = null;   // ← 这里清空了回调引用
}
```

这个问题影响所有通过 `showInput` 触发的操作：新建看板、重命名看板、自定义输入等。不会影响使用独立弹窗的操作（如新建/编辑任务卡片）。

#### 5. WSL 写入 /mnt/d/ 路径失效（最高优先级排查项）

⚠️ **`write_file`、`patch`、`sed` 在 `/mnt/d/`（WSL 挂载的 Windows 分区）会静默失败**：工具报告成功、`read_file` 确认内容正确，但磁盘上的文件未更新。

**更致命的是：`read_file` 共享同一层 WSL 缓存**，也会显示\"已更新\"的虚假确认。当用户反复报告相同问题、修复\"无效果\"时，第一怀疑就是 WSL 缓存。

**唯一可靠的写入方式：**

```bash
# 步骤1: 在 execute_code 或 terminal 中将内容写到 /tmp/
python3 -c "open('/tmp/page_fixed.html','w').write(content)"

# 步骤2: cp + sync 覆盖目标文件
cp /tmp/page_fixed.html <PAGES_ROOT>/page_8.html && sync

# 步骤3: 用 terminal grep（非 read_file）验证磁盘内容
grep "确认关键词" <PAGES_ROOT>/page_8.html
```

❌ 不要用以下方式验证（它们都走缓存层，可能虚假成功）：
- `read_file` 工具
- `search_files` 工具
- `patch` 工具
- `sed` 直接修改

✅ 只用 `terminal grep`/`wc -l`/`md5sum` 验证磁盘实际内容。

#### 6. 不要用相对路径 `fetch()` 调用 API（SDK 方法更安全）

页面服务在端口 3002，API 在端口 3001。在页面 JS 中用 `fetch('/api/sdk/db/execute')` 相对路径会解析为 `http://localhost:3002/api/...`（错误！），而非 `http://localhost:3001/api/...`。

✅ **始终使用 `Morgana.insert/query/update/delete` SDK 方法**——它们从 SDK 脚本标签的 `src` 属性推断 `base` URL，生成 `http://localhost:3001/api/sdk/db/execute` 的绝对路径。

❌ 不要直接 `fetch('/api/...')`——除非你明确构造了完整的绝对 URL（如 `'http://localhost:3001/api/sdk/db/execute'`）。

#### 8. 表升级加列：undefined ≠ null 陷阱（致命）

当升级已有页面、给现有表增加新列时，容易出现一个隐蔽 bug：

1. `CREATE TABLE IF NOT EXISTS` 发现表已存在 → 什么都不做（不会加新列）
2. 即使紧随其后写 `ALTER TABLE ADD COLUMN`，如果它放在 `catch {}` 块内（且 CREATE TABLE 没抛异常），ALTER TABLE 永远不会执行
3. `SELECT *` 返回的结果中，新列的值是 `undefined`（不是 `null`！）
4. 用 `n.pos_x !== null` 判断 → `undefined !== null` 是 `true` → 误判为"有值"
5. `Number(undefined)` → `NaN` → 所有位置变 NaN → 节点全部堆叠在 (0,0)

**修复三步：**

```javascript
// ❌ 错误：ALTER TABLE 在 catch 块内，CREATE TABLE IF NOT EXISTS 不抛异常时永远不执行
try {
  await Morgana.insert("CREATE TABLE IF NOT EXISTS t (..., new_col INT DEFAULT NULL)");
  // 表已存在 → 静默跳过，new_col 没加
} catch(e) {
  await Morgana.insert("ALTER TABLE t ADD COLUMN new_col INT DEFAULT NULL"); // 永远不会执行！
}

// ✅ 正确：ALTER TABLE 始终执行（重复添加列会静默忽略）
await Morgana.insert("CREATE TABLE IF NOT EXISTS t (...)");
// ALTER TABLE 放 try-catch 外面，保证每次都跑
try { await Morgana.insert("ALTER TABLE t ADD COLUMN new_col INT DEFAULT NULL"); } catch(e) {}

// ✅ 正确：用 != null 而非 !== null，同时处理 undefined 和 null
if (row.new_col != null) { ... }  // undefined != null → false ✓
if (row.new_col !== null) { ... } // undefined !== null → true ✗（陷阱！）
```

核心教训：`!= null` 同时命中 `null` 和 `undefined`，`!== null` 只命中 `null`。JS 里从不存在列读取到的值是 `undefined`，所以升级加列场景必须用 `!= null`。

#### 7. 不要为 Morgana 页面创建独立的 API 服务（反模式）

Morgana SDK 已提供完整的数据库 CRUD 能力（`Morgana.query/insert/update/delete`），直接从前端 JS 操作 MariaDB。**不需要**再搭建 Python/Node.js 中间层 API 服务。

反模式示例（不应这样做）：
- 写一个 `mindmap_api.py` 用 Flask/FastAPI 提供 REST 接口
- 页面用 `fetch()` 调用这个独立 API
- 在 `restore-hermes.sh` 中注册额外服务的启动逻辑

正确做法：
- 页面 `<script>` 中直接引入 Morgana SDK
- 所有数据库操作通过 `Morgana.insert/query/update/delete` 完成
- DDL 建表在页面初始化时 `CREATE TABLE IF NOT EXISTS`，或在对话中通过 pymysql 执行
- 不引入额外的网络端口、进程或启动脚本

### 完整 CRUD 页面示例

```html
<script src="http://localhost:3001/api/sdk/morgana.js"></script>
<script>
// 页面加载时从数据库读取数据
async function loadData() {
  const rows = await Morgana.query('SELECT * FROM customer_records ORDER BY created_at DESC')
  renderTable(rows)
}

// 新增 — 写入数据库
async function handleAdd(e) {
  e.preventDefault()
  const data = Object.fromEntries(new FormData(e.target))
  await Morgana.insert('INSERT INTO customer_records (name, email, notes) VALUES (?, ?, ?)',
    [data.name, data.email, data.notes])
  e.target.reset()
  loadData()
}

// 删除 — 从数据库移除
async function deleteRecord(id) {
  if (!confirm('确定删除？')) return
  await Morgana.delete('DELETE FROM customer_records WHERE id = ?', [id])
  loadData()
}

// 页面初始化
document.addEventListener('DOMContentLoaded', loadData)
</script>
```

### 表单提交到对话

当用户需要补充条件时（搜索、筛选、确认等），使用 Morgana.submit() 将数据发回对话由 Agent 继续处理：

```html
<button type="button" onclick="Morgana.submit({ action: 'search', keyword: document.getElementById('search').value })">
  搜索
</button>
```

## 生成步骤

1. **检查数据表** — 如不确认表是否存在，先查询已有表结构。如需新表，加载 morgana-database 技能并 CREATE TABLE
2. **⚠️ 识别当前文件名** — 检查对话系统提示词中注入的具体文件名（如 `page_5.html`），确认要**覆盖**的是哪个已有文件。**禁止创建新文件**
3. **覆盖写入页面** — 将完整 HTML **覆盖**写入页面根目录下的 `page_<id>.html`（覆盖已有文件，不是另存为新文件），页面内所有数据操作使用 Morgana SDK（禁止 localStorage）
   - ⚠️ **SQL 引号陷阱**：当 SQL 包含字符串字面量（如 `DEFAULT '默认值'`），外层 JS 字符串必须用双引号 `"..."` 包裹，否则 JS 单引号与 SQL 单引号冲突导致整个 `<script>` 块语法错误。详见下方"常见陷阱"第1条。
4. **验证** — 检查文件存在且非空，搜索内容中的标志性关键词
5. **刷新** — 调用 `PUT /api/infrastructure/config` 通知 Morgana 重载页面。**必须使用完整配置格式**（仅传 `["page_N.html"]` 会缺少 `pages.root`/`pages.port` 返回 400 错误）：

```bash
WSL_HOST=$(ip route show default | awk '{print $3}')
curl -s -X PUT "http://${WSL_HOST}:3001/api/infrastructure/config" \
  -H "Content-Type: application/json" \
  -d '{"pages":{"root":"<PAGES_ROOT>","port":3002,"names":["page_N.html"]}}'
```

❌ 错误格式：`{"pages":["page_N.html"]}` — 缺少 root/port 字段  
✅ 正确格式：`{"pages":{"root":"...","port":...,"names":["page_N.html"]}}`

WSL 下需用 `ip route show default | awk '{print $3}'` 获取 Windows 宿主 IP。注意：`/etc/resolv.conf` 的 nameserver 可能是公共 DNS（如 223.5.5.5）而非宿主 IP，不可用于此目的。Morgana 后端收到配置更新后广播 `page_refresh` 事件，前端收到后刷新 iframe。
6. **结束** — 不输出文字回复

## 参考资料

- `references/kanban-patterns.md` — 拖拽看板模式：多看板切换、拖拽状态更新、排序、日期自动填入、Toast 通知
- `references/tree-rendering-patterns.md` — 树形结构页面渲染模式（思维导图/组织图的连线、折叠、撤销、备注气泡等可复用 UI 模式）

## 页面视觉规范

浅色风格，背景 `#f5f5f5`。以下是**最低基线标准**——实际生产页面（看板、需求、缺陷管理等）使用更现代的视觉风格（见 `references/modern-list-patterns.md`），可根据场景选择使用。

| 类别 | 基线值 | 现代模式参考值 |
|------|--------|---------------|
| 颜色 | 页面背景 `#f5f5f5`，卡片背景 `#ffffff`，正文字色 `#333333`，品牌色 `#4f46e5` | 页面背景 `#f0f4ff` 或渐变色，毛玻璃标题栏(`backdrop-filter: blur`)，渐变品牌按钮 |
| 字体 | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`，基础 16px | 追加中文字体栈 `"Noto Sans SC", "PingFang SC", "Microsoft YaHei"` |
| 布局 | 最大宽度 720px，居中，卡片圆角 8px，阴影 `0 1px 3px rgba(0,0,0,0.1)` | 最大宽度 960px 适配列表场景，卡片圆角 10-12px，多级阴影系统 |
| 按钮 | 背景 `#4f46e5`，文字白色，圆角 6px，内边距 10px 16px | 渐变背景 `linear-gradient(135deg, #6366f1, #8b5cf6)`，hover 上浮效果 |
| 输入框 | 边框 `1px solid #ddd`，圆角 6px，内边距 8px 12px | 边框 `1px solid #e2e8f0`，focus 态蓝色光晕 `box-shadow: 0 0 0 3px rgba(99,102,241,0.1)` |

详见 `references/modern-list-patterns.md` 了解生产页面使用的完整设计系统。
