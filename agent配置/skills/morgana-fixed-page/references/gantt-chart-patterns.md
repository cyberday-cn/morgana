# Gantt Chart Companion for Kanban 页面

Gantt 图页面（page_9.html）是看板页面（page_8.html）的可视化 companion，从同一张 `kanban_tasks` 表读取数据，展示任务的计划时间和实际时间对比。

## 数据源

- **表名**: `kanban_tasks`
- **连接方式**: Morgana SDK (`Morgana.query`)
- **关键字段**: `id`, `title`, `status`, `planned_start`, `planned_end`, `actual_start`, `actual_end`, `description`
- **起始数据**: `SELECT * FROM kanban_tasks ORDER BY planned_start IS NULL, planned_start ASC, id DESC`

## 核心渲染结构

```
页头筛选区 (status filter / show toggle / sort / zoom)
└── .gantt-scroll (overflow:auto, position:relative)
    ├── .gantt-container
    │   ├── .gantt-header-grid (sticky, z-index:10)
    │   │   ├── 月份行 (display:flex, height:28px, position:relative)
    │   │   │   ├── 180px 空占位标签
    │   │   │   └── 月标签 (按月合并宽度, white-space:nowrap)
    │   │   └── 日期行 (display:flex, height:24px)
    │   │       ├── 180px 空占位标签
    │   │       └── 每日一格 (周末灰底, 今日高亮)
    │   └── .gantt-body
    │       └── .task-row (每行)
    │           ├── .task-label (180px, sticky, 左侧固定)
    │           └── .task-track (flex, 宽度=totalDays*ppd)
    │               ├── .plan-bar (虚线空心, 计划时间)
    │               └── .actual-bar (实心填充, 实际时间)
    ├── .today-line (单根绝对定位竖线, 1px, 全高, z-index:20)
    └── .today-label (在month row内, 绝对定位, 线高28px, z-index:21)
```

## 关键约定与实际遇到的问题

### 1. 今日线必须是单一元素，不是每行一个

**正确做法**: 在 `.gantt-scroll` 上 append 一个 `.today-line` 元素，`top:0; bottom:0; width:1px;`，跨整个甘特图高度。

**不要**: 在 header 和每行 task-row 中各放一个 `.today-line`。这会产生视觉断点（每行之间的 border/padding 导致线不连续），且 2px 宽度看起来太粗。

**"今天" 文字标签** 放在月份的 flex 行内（`.gantt-header-grid` 的第一个子元素），这样标签会随着 sticky header 停留在顶部不随内容滚动。

```javascript
// 渲染后动态添加
var scrollEl = document.querySelector('.gantt-scroll');
var lineEl = document.createElement('div');
lineEl.className = 'today-line';
lineEl.style.left = (labelWidth + todayOffset * ppd) + 'px';
scrollEl.appendChild(lineEl);

var headerGrid = document.querySelector('.gantt-header-grid');
var monthRow = headerGrid.firstElementChild;
if (monthRow) {
  var labelEl = document.createElement('div');
  labelEl.className = 'today-label';
  labelEl.style.left = (labelWidth + todayOffset * ppd) + 'px';
  labelEl.textContent = '今天';
  monthRow.appendChild(labelEl);
}
```

CSS:
```css
.today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #4f46e5;
  z-index: 20;
  pointer-events: none;
}

.today-label {
  position: absolute;
  font-size: 11px;
  font-weight: 600;
  color: #4f46e5;
  white-space: nowrap;
  z-index: 21;
  pointer-events: none;
  height: 28px;
  line-height: 28px;
}
```

`.gantt-scroll` 必须有 `position: relative;` 作为 absolute 定位的参考。

### 2. 今日线对齐问题 — header vs task-track 原点不同

**原因**: header 的日期网格从容器最左边缘 (0px) 开始，但 task-track 的条形图区域在 180px 标签列之后开始。两边的 today line 用了相同的 `left: offset * ppd`，但参照原点不同 — header 从 0，task-track 从 180px。

**已废弃的方案（仅作记录）**：在 header 的日期行加 180px 空占位标签使起点对齐。最终改为单一元素方案（见 item 1），不再有对齐问题。

### 3. `computeDateRange` 比 `render` 先执行，`ppd` 未定义

**原因**: `ppd` (pixelsPerDay) 在 `render()` 函数内部定义，但 `computeDateRange()` 也在 `render()` 内部被调用。如果 `computeDateRange` 的调用位置在 `ppd` 赋值之前，或它被提取到 `render()` 外部执行，就会引用 undefined。

**修复**: 让 `ppd` 在 `computeDateRange` 之前定义，或在 `computeDateRange` 内部直接使用全局 `pixelsPerDay` 变量。

### 4. `todayStr` 变量名遮蔽函数名

```javascript
function todayStr() { return '2026-06-29'; }  // 全局函数

function render() {
  const todayStr = new Date();  // 遮蔽了上面的函数！
  // 后续调用 todayStr() → TypeError: todayStr is not a function
}
```

**变体 — `todayOffset is not defined`**: 如果 render 函数内部引用了 `todayOffset` 作为变量名但从未定义它（本应调用 `getDayOffset(getTodayStr())`），也会抛出 `ReferenceError` 导致整个 `render()` 崩溃，显示"加载任务数据失败"。务必在代码中检查所有变量引用：特别是条件分支中（in_progress 无 actual_end 时）是否使用了已定义的函数而非未声明的变量名。
- 函数: `getTodayStr()`, `formatDate()`, `getTodayDate()`
- 变量: `todayDateObj`, `todayOffs`

或在 render 中用 `var` 声明大块变量，避免 `const/let` 的块级作用域遮蔽。

### 5. 时间轴不填满容器宽度

**原因**: 如果任务日期范围窄于容器宽度，图表右侧留白。

**修复**: 在 `computeDateRange` 中测量容器宽度，自动扩展结束日期：

```javascript
function computeDateRange() {
  var scrollEl = document.querySelector('.gantt-scroll');
  var containerWidth = scrollEl ? scrollEl.clientWidth : 1200;
  var labelWidth = 180;
  var trackWidth = containerWidth - labelWidth;
  var dayCount = Math.ceil(trackWidth / pixelsPerDay);

  var currentDays = daysBetween(startDate, endDate);
  if (currentDays < dayCount) {
    var extra = dayCount - currentDays;
    endDate.setDate(endDate.getDate() + Math.ceil(extra * 0.7));
    startDate.setDate(startDate.getDate() - Math.floor(extra * 0.3));
  }
}
```

### 6. 月份标签在窄列中被挤换行

**修复**: CSS 加 `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`，当格子宽度 < 55px 时缩写：

```javascript
var monthLabel = (w < 55)
  ? (month + 1) + '月'
  : monthStart.getFullYear() + '年' + (month + 1) + '月';
```

### 7. 用户偏好极简界面

甘特图页面应去除以下元素：
- 调试按钮 + 调试面板（整个调试区域）
- 返回看板链接
- 手动刷新按钮

只保留核心控件：状态筛选、显示开关（计划/实际/今日线）、排序、缩放。

### 8. 颜色规则

| 状态 | 实际条颜色 | 计划条 |
|------|-----------|--------|
| 完成 (done) | `#27ae60` 绿色 | 虚线空心框 |
| 进行中且正常 (in_progress, 未超期) | `#d4c5f9` 浅紫色 | 虚线空心框 |
| 超期（进行中超过计划结束、或未开始超计划开始） | `#e74c3c` 红色，脉冲动画 | 虚线空心框 |
| 未开始且正常 (todo, 未超期) | 不显示 | 虚线空心框 |

超期判定:
```javascript
function isOverdue(task) {
  if (task.status === 'done') return false;
  var today = getTodayDate();
  // 进行中但超过计划结束时间
  if (task.planned_end) {
    var pe = parseDate(task.planned_end);
    if (pe && pe < today) return true;
  }
  // 未开始但超过计划开始时间（无结束日期时也检测开始日期）
  if (task.status === 'todo' && task.planned_start) {
    var ps = parseDate(task.planned_start);
    if (ps && ps < today) return true;
  }
  return false;
}
```

### 9. 实际条推断逻辑（无实际日期时）

| 状态 | 处理方式 |
|------|---------|
| done | 用计划日期显示绿色条，标注"（按计划）" |
| in_progress | 从计划开始到今天显示浅紫条，标注"进行中" |
| todo 且未超期 | 不显示实际条 |
| todo 且超期 (overdue) | **用计划日期显示红色条** — 从 planned_start 到 planned_end（或到今天），因为超期 todo 任务需要红色警示才能被看到。是在 done/in_progress 推断之后的第三个 else-if 分支。 |

```javascript
if (!actStart && task.status === 'done' && task.planned_start) {
  actStart = task.planned_start;
  actEnd = task.planned_end || task.planned_start;
  isInferred = true;
} else if (!actStart && task.status === 'in_progress') {
  actStart = task.planned_start || getTodayStr();
  actEnd = null;
  isInferred = true;
} else if (!actStart && task.overdue && task.planned_start) {
  // Overdue todo — show red bar from planned_start to planned_end or today
  actStart = task.planned_start;
  actEnd = task.planned_end || getTodayStr();
  isInferred = true;
}
```

工具提示文本也要同步处理 overdue 分支：
```javascript
var tipText = '实际: ' + (task.actual_start || (isInferred && (task.status === 'done' || task.overdue) ? actStart : '?')) + ' ~ ' +
              (task.actual_end || (isInferred && task.status === 'done' ? actEnd : (isInferred && task.overdue && !task.actual_end ? actEnd : (task.status === 'in_progress' ? '进行中' : '?'))));
if (task.overdue) tipText += ' (超期!)';
```

### 10. `toDateStr` 函数处理 ISO UTC 日期

Morgana API 返回的 DATE 字段是 ISO UTC 时间戳（如 `"2026-06-24T16:00:00.000Z"`），在中国时区 UTC+8 下，`new Date(str)` 再调用 `.getFullYear()` 会得到正确的本地日期。但空值、非标准格式可能需要额外处理。建议使用统一的 `toDateStr` 函数：

```javascript
function parseDate(str) {
  if (!str) return null;
  var d = new Date(str);
  if (isNaN(d)) return null;
  return d;
}

function getTodayDate() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getTodayStr() {
  var d = getTodayDate();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}

function daysBetween(a, b) {
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
```

### 11. 多看板切换（board selector）

Gantt 图页面需要与看板页面（page_8.html）共享数据源，支持按 `kanban_boards` 表的 `board_id` 过滤任务。

**数据表**：`kanban_boards` (id, name) 和 `kanban_tasks` (…, board_id 外键)。

**组件结构**（与 page_8.html 一致）：

```html
<!-- Header 中标题右侧 -->
<div class="board-selector" id="boardSelector">
  <button class="board-selector-btn" onclick="toggleBoardDropdown()">
    <span id="currentBoardName">全部看板</span>
    <span class="arrow">▼</span>
  </button>
  <div class="board-dropdown">
    <div class="board-list" id="boardList"></div>
  </div>
</div>
```

**CSS 关键样式**：
```css
.board-selector { position: relative; margin-left: 4px; }
.board-selector.open .board-dropdown { display: block; }
.board-dropdown { display: none; position: absolute; top: calc(100% + 6px); left: 0; }
.board-item.active { background: #eef2ff; color: #4f46e5; font-weight: 600; }
```

**加载与切换逻辑**：

```javascript
var boards = [];
var currentBoardId = null;  // null = 全部看板

// 页面加载时
async function loadBoards() {
  boards = await Morgana.query('SELECT * FROM kanban_boards ORDER BY id');
  // 从 localStorage 恢复上次选中的看板
  var saved = localStorage.getItem('gantt_board_id');
  if (saved && boards.find(function(b) { return String(b.id) === saved; })) {
    currentBoardId = parseInt(saved);
  }
  renderBoardList();
}

// 切换看板
async function switchBoard(id) {
  currentBoardId = id;
  localStorage.setItem('gantt_board_id', id || '');
  renderBoardList();
  document.getElementById('boardSelector').classList.remove('open');
  await loadTasks();
}

// 加载任务 — 按 board_id 过滤
async function loadTasks() {
  var sql = 'SELECT * FROM kanban_tasks';
  var params = [];
  if (currentBoardId) {
    sql += ' WHERE board_id = ?';
    params.push(currentBoardId);
  }
  sql += ' ORDER BY planned_start ASC, id ASC';
  var rows = await Morgana.query(sql, params);
  // ...
}

// 点击外部关闭下拉
document.addEventListener('click', function(e) {
  var sel = document.getElementById('boardSelector');
  if (sel && !sel.contains(e.target)) {
    sel.classList.remove('open');
  }
});
```

**下拉列表渲染**：第一项固定为「全部看板」(onclick=switchBoard(null))，后续动态遍历 boards 数组。选中项加 `.active` 类名（紫色高亮）。

**localStorage 约定**：键名为 `gantt_board_id`，存看板 id 字符串。`null` 或空字符串 = 全部看板。页面初始化时优先从 localStorage 恢复。
