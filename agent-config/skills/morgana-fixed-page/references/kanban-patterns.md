# 拖拽看板模式

可复用的看板 UI 模式，适用于任务管理、需求跟踪、缺陷管理等场景。

## 数据库设计

### kanban_boards（多看板支持）

```sql
CREATE TABLE IF NOT EXISTS kanban_boards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 预置默认看板
INSERT INTO kanban_boards (id, name) VALUES (1, '默认看板')
  ON DUPLICATE KEY UPDATE name = name;
```

### kanban_tasks（任务卡片）

```sql
CREATE TABLE IF NOT EXISTS kanban_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  board_id INT DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  status ENUM('todo','in_progress','done') NOT NULL DEFAULT 'todo',
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
);
```

**关键设计决策：**
- 看板删除时级联删除所有任务（`ON DELETE CASCADE`）
- 使用 `updated_at` 而非 `sort_order` 排序——最新移动/编辑的任务在列顶部
- DDL 必须通过 `morgana-database` skill 的 pymysql 直接执行，**不能在页面 HTML 中建表**

## 三列看板布局

```html
<div class="board">
  <div class="board-column column-todo"
       ondragover="onDragOver(event)"
       ondragleave="onDragLeave(event)"
       ondrop="onDrop(event, 'todo')">
    <!-- 未开始卡片列表 -->
  </div>
  <div class="board-column column-progress"
       ondragover="onDragOver(event)"
       ondragleave="onDragLeave(event)"
       ondrop="onDrop(event, 'in_progress')">
    <!-- 进行中卡片列表 -->
  </div>
  <div class="board-column column-done"
       ondragover="onDragOver(event)"
       ondragleave="onDragLeave(event)"
       ondrop="onDrop(event, 'done')">
    <!-- 已完成卡片列表 -->
  </div>
</div>
```

## 拖拽状态更新

拖拽到新列时，同时更新状态和时间：

```javascript
function onDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  var id = draggedTaskId;
  var oldStatus = draggedOldStatus;
  var skipToast = (oldStatus === newStatus);
  draggedTaskId = null;
  draggedOldStatus = null;
  updateStatus(id, newStatus, skipToast);
}

async function updateStatus(id, status, skipToast) {
  await Morgana.update(
    `UPDATE kanban_tasks
     SET status = ?, updated_at = NOW(),
         actual_start = CASE WHEN ? = 'in_progress' AND actual_start IS NULL
                             THEN CURDATE() ELSE actual_start END,
         actual_end = CASE WHEN ? = 'done'
                           THEN CURDATE() ELSE actual_end END
     WHERE id = ?`,
    [status, status, status, id]
  );
  if (!skipToast) showToast('任务已移至「' + columnLabel(status) + '」', 'success');
  loadBoard();
}
```

**关键设计：**
- `updated_at = NOW()` — 确保拖拽后卡片按更新时间排到列顶部
- `actual_start` — 首次拖入"进行中"时自动填入 `CURDATE()`（服务器本地日期，无时区偏移）
- `actual_end` — 拖入"已完成"时自动填入 `CURDATE()`
- `skipToast` — 同列拖拽（放下又拖回）不弹通知，提升用户体验

## 多看板切换

### HTML 结构

```html
<div class="board-selector">
  <button onclick="toggleBoardDropdown()">
    <span id="currentBoardName">默认看板</span>
    <span class="arrow">▼</span>
  </button>
  <div class="board-dropdown">
    <div class="board-list" id="boardList"></div>
    <div class="board-dropdown-footer">
      <button onclick="showCreateBoardDialog()">+ 新建看板</button>
    </div>
  </div>
</div>
```

### 数据加载

所有查询必须按 `board_id` 过滤：

```javascript
async function loadBoards() {
  boards = await Morgana.query('SELECT * FROM kanban_boards ORDER BY id');
  if (!currentBoardId && boards.length) currentBoardId = boards[0].id;
  renderBoardList();
}

async function loadBoard() {
  var rows = await Morgana.query(
    'SELECT * FROM kanban_tasks WHERE board_id = ? ORDER BY updated_at DESC',
    [currentBoardId]
  );
  tasks = rows || [];
  renderBoard();
}
```

### 看板 CRUD

**新建看板：**
```javascript
async function showCreateBoardDialog() {
  closeBoardDropdown();
  var name = prompt('请输入看板名称：');
  if (!name || !name.trim()) return;
  name = name.trim();
  try {
    var result = await Morgana.insert(
      'INSERT INTO kanban_boards (name) VALUES (?)', [name]);
    if (!result || !result.insertId) throw new Error('服务器返回异常');
    await loadBoards();
    currentBoardId = result.insertId;
    var nb = boards.find(function(b) { return b.id === result.insertId; });
    document.getElementById('currentBoardName').textContent = nb ? nb.name : name;
    renderBoardList();
    await loadBoard();
    showToast('看板「' + name + '」已创建', 'success');
  } catch(e) {
    console.error(e);
    showToast('创建失败: ' + (e.message || '请重试'), 'error');
  }
}
```

**关键点：**
- 使用原生 `prompt()` 而非自定义 `showInput` 弹窗——后者存在 `closeInput()` 回调失效的致命陷阱（详见 skill #4 陷阱）
- 函数声明为 `async function` 而非 `function` 内包裹 `(async () => {...})()` IIFE——`async function` 的调用栈更清晰，错误不会丢失
- `Morgana.insert` 返回 `{insertId, affectedRows}`，取 `result.insertId` 获取新看板 ID

**重命名看板：**
```javascript
async function renameBoard(id, newName) {
  await Morgana.update(
    'UPDATE kanban_boards SET name = ? WHERE id = ?', [newName, id]);
  await loadBoards();
}
```

**删除看板：**
```javascript
async function deleteBoard(id) {
  // 先删任务（级联），再删看板
  await Morgana.delete('DELETE FROM kanban_tasks WHERE board_id = ?', [id]);
  await Morgana.delete('DELETE FROM kanban_boards WHERE id = ?', [id]);
  // 如果删除的是当前看板，切回第一个看板
  if (currentBoardId === id) {
    await loadBoards();
    currentBoardId = boards.length ? boards[0].id : null;
  }
  await loadBoard();
}
```

### ⚠️ 关键陷阱

1. **`showInput` 回调失效** — `closeInput()` 先执行 `inputCallback = null`，然后检查 `if (inputCallback)`，导致回调永不触发。修复：保存引用后再调用 `closeInput()`。详见 `morgana-fixed-page` SKILL.md 的"常见陷阱"第4条。

   **推荐替代方案 — 原生 `prompt()`**：对于简单文本输入（新建看板、重命名），直接用浏览器原生 `prompt()` 避开 `showInput` 的闭包陷阱：
   ```javascript
   async function showCreateBoardDialog() {
     closeBoardDropdown();
     var name = prompt('请输入看板名称：');
     if (!name || !name.trim()) return;
     name = name.trim();
     var result = await Morgana.insert(
       'INSERT INTO kanban_boards (name) VALUES (?)', [name]);
     // ... 切换看板、刷新列表
   }
   ```
   同时将函数声明为 async function（而非 function 包裹 IIFE），调用栈更清晰，错误不会丢失。——`showInput` 自定义弹窗的闭包/事件绑定链路在多次调试后仍不稳定，改用 `prompt()` 一举解决。

2. **`Morgana.insert()` 返回对象** — `{insertId, affectedRows}`，取 `insertId` 获取新记录的自增 ID，不能用整数比较。

3. **默认看板不可删除** — `id=1` 是预置的默认看板，删除按钮对其隐藏或禁用。

## 日期显示与逾期判断

详见 `morgana-date-handling` 技能：
- `dateToStr()` — 日期归一化（处理 Date 对象、ISO 字符串、纯日期字符串）
- `formatDate()` — 中文格式化（YYYY年MM月DD日）
- 逾期判断 — YYYY-MM-DD 字符串字典序比较，不用 Date 对象
- 状态变更自动填入日期 — 用 `CURDATE()`，不用前端 `new Date()`

## 视觉设计

参考 `references/modern-list-patterns.md`。看板页面使用 Linear.app 风格：
- 渐变背景 + 毛玻璃标题栏
- 三列独立配色（蓝/琥珀/绿）
- 卡片左侧彩色状态条
- 拖拽动效（旋转+缩小+高阴影）
- Toast 通知（右上角滑入，2.5秒自动消失）
