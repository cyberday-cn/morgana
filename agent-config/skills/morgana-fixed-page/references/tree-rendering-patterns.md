# 树形结构页面渲染模式（思维导图/组织图）

从思维导图(page_13)页面实现中提炼的可复用模式。

## 两阶段渲染：先节点后连线

树形图需要先渲染 DOM 再画线，因为线的端点依赖节点的实际渲染宽度：

```
Phase 1: container.innerHTML = nodeHtml     // 节点放入 DOM
Phase 2: var w = el.offsetWidth             // 测量实际宽度
Phase 3: drawLines(positions, actualWidths)  // 用实际宽度画连接线
```

关键：不要用预设的 NODE_W 常量画线，而是等 DOM 渲染后用 `offsetWidth` 获取实际宽度。这解决节点宽度因标签文字长度不同而各异带来的连线间隙问题。

## 由粗变细的贝塞尔曲线

使用三次贝塞尔曲线 + 填充路径模拟渐变锥度，比直线更自然：

```js
function createTaperedPath(x1, y1, x2, y2, w1, w2, color) {
  var cx1 = x1 + (x2 - x1) * 0.4;  // 第一个控制点
  var cx2 = x1 + (x2 - x1) * 0.6;  // 第二个控制点
  var d = 'M ' + x1 + ',' + (y1 - w1/2) +
    ' C ' + cx1 + ',' + (cy1 - w1/2) +
    ' ' + cx2 + ',' + (cy2 - w2/2) +
    ' ' + x2 + ',' + (y2 - w2/2) +
    ' L ' + x2 + ',' + (y2 + w2/2) +
    ' C ' + cx2 + ',' + (cy2 + w2/2) +
    ' ' + cx1 + ',' + (cy1 + w1/2) +
    ' ' + x1 + ',' + (y1 + w1/2) + ' Z';
  return '<path d="' + d + '" fill="' + color + '" opacity="0.35"/>';
}
```

参数：w1=3.5（父端宽），w2=1.5（子端窄），产生锥度渐变效果。

## 撤销系统

在树形编辑器中（删除/新增/修改节点频繁），撤销系统架构：

- 前置快照：每次修改前调用 `pushUndo()`
- 存储内容：`{ nodes: JSON.parse(JSON.stringify(nodes)), collapsedIds: {...}, selectedNodeId }`
- 限制：MAX_UNDO = 50，超限 shift 旧记录
- 触发：工具栏按钮 + Ctrl+Z 键盘绑定
- 还原：恢复三个状态变量后重新 buildTree() + renderMindMap()

## 节点备注气泡

节点上有备注数据时，悬浮显示气泡提示样式：

- `onmouseenter` 触发，`onmouseleave` 隐藏
- 定位在鼠标附近，自动修正避免溢出视口
- 深色背景(#1a1a2e) + 白色文字 + 三角箭头
- 只有备注非空时才绑定事件处理器

## 展开/折叠 UI

树形节点的折叠按钮设计：

- 折叠状态：箭头指向右侧，按钮带蓝色边框/背景
- 展开状态：箭头指向下方，按钮灰色背景
- hover：整个按钮变为紫色(#667eea)白色箭头，带缩放动画
- 折叠时子节点隐藏，同时显示子节点数量 badge
- 折叠状态通过 `collapsedIds` 对象跟踪（key = nodeId, value = true）

## 节点拖拽自由重定位（Drag-to-Reposition）

思维导图节点支持鼠标拖拽到任意位置，位置持久化到数据库，连线实时跟随变化。

### 数据库扩展

在 nodes 表增加两个可空列：

```sql
pos_x INT DEFAULT NULL,
pos_y INT DEFAULT NULL
```

NULL 表示使用自动布局位置，非 NULL 表示用户手动放置的位置。

### 位置优先级：手动 > 自动

渲染时先调用自动布局算法得到初始位置，再用 DB 存储的手动位置覆盖：

```js
currentPositions = layoutTree();        // 自动布局算法
for (var id in savedPositions) {        // DB 加载的手动位置
    if (currentPositions[id]) {
        currentPositions[id].x = savedPositions[id].x;
        currentPositions[id].y = savedPositions[id].y;
    }
}
```

### 拖拽事件处理

三层事件协作，避免冲突：

| 事件 | 触点 | 行为 |
|------|------|------|
| 节点 mousedown | `.mm-node` 但 `!expander && !dot && !input` | 启动节点拖拽 |
| 空白区 mousedown | `.canvas-wrapper` 但 `!.mm-node` | 启动画布平移 |
| window mousemove | - | 更新节点位置 或 更新画布平移 |
| window mouseup | - | 结束拖拽，持久化位置 或 结束平移 |

关键细节：

```js
// 拖拽阈值：移动超过 3px 才算拖拽，否则视为点击（选中节点）
var DRAG_THRESHOLD = 3;

// 拖拽开始：记录鼠标和节点初始位置
dragStartMouseX = e.clientX;
dragStartMouseY = e.clientY;
dragStartNodeX = currentPositions[dragNodeId].x;  // 从 currentPositions 读取
dragStartNodeY = currentPositions[dragNodeId].y;

// 拖拽移动：除以 zoom 抵消缩放
var dx = (e.clientX - dragStartMouseX) / zoom;
var dy = (e.clientY - dragStartMouseY) / zoom;

// 拖拽结束：写 DB
Morgana.update("UPDATE mind_map_nodes SET pos_x = ?, pos_y = ? WHERE id = ?",
    [Math.round(x), Math.round(y), dragNodeId]);
```

### 与画布缩放/平移的配合

- 节点拖拽坐标除以 zoom 保证在不同缩放比下拖拽距离一致
- 节点拖拽时使用 `e.preventDefault()` 阻止画布平移
- 确保 `!e.target.closest('.mm-node-expander')` 等排除内部控件

### 撤销支持

拖拽也进撤销栈。`pushUndo()` 的快照需同时包含 `savedPositions`：

```js
function pushUndo() {
    undoStack.push({
        nodes: JSON.parse(JSON.stringify(nodes)),
        collapsedIds: JSON.parse(JSON.stringify(collapsedIds)),
        selectedNodeId: selectedNodeId,
        savedPositions: JSON.parse(JSON.stringify(savedPositions))  // ← 关键
    });
}
```

### 视觉反馈

- 拖拽中：节点加紫色边框阴影 `box-shadow: 0 8px 28px rgba(0,0,0,.18), 0 0 0 3px rgba(102,126,234,.2)`
- 光标变为抓手：`.mm-node { cursor: grab }` → `.mm-node.dragging { cursor: grabbing }`
- 拖拽时隐藏备注气泡和右键菜单

## 画布缩放与拖拽（Zoom & Pan）

将传统的 `overflow: auto` 滚动替换为 CSS transform 驱动的缩放+拖拽，用户体验更流畅。

### 核心架构

用三个变量控制画布：`zoom`（缩放比例）、`panX`/`panY`（平移偏移）。所有变化通过 `transform: translate(panX, panY) scale(zoom)` 应用在 `canvas-container` 上。

```css
.canvas-wrapper { overflow: hidden; cursor: grab; }
.canvas-wrapper.dragging { cursor: grabbing; }
.canvas-container {
  position: absolute; top: 0; left: 0;
  transform-origin: 0 0;
  will-change: transform;  /* GPU 加速 */
}
```

### 鼠标拖拽平移

```js
var isDragging = false, dragStartX, dragStartY, panStartX, panStartY;

wrapper.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  if (e.target.closest('.mm-node')) return;  // 不拦截节点点击
  isDragging = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  panStartX = panX; panStartY = panY;
  wrapper.classList.add('dragging');
});

window.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  panX = panStartX + (e.clientX - dragStartX);
  panY = panStartY + (e.clientY - dragStartY);
  applyTransform();
});

window.addEventListener('mouseup', function() {
  isDragging = false;
  wrapper.classList.remove('dragging');
});
```

### 滚轮缩放（以光标为中心）

关键数学：缩放时保持光标指向的 canvas 坐标点不动。

```js
wrapper.addEventListener('wheel', function(e) {
  e.preventDefault();
  var rect = wrapper.getBoundingClientRect();
  var cx = e.clientX - rect.left;  // 光标在 wrapper 内的位置
  var cy = e.clientY - rect.top;

  var factor = e.deltaY < 0 ? 1.08 : 1/1.08;
  var newZoom = Math.max(0.2, Math.min(zoom * factor, 3.0));

  // 保持光标下的点不动
  panX = cx - (cx - panX) * (newZoom / zoom);
  panY = cy - (cy - panY) * (newZoom / zoom);
  zoom = newZoom;
  applyTransform();
}, { passive: false });
```

### 一键适应屏幕（zoomFit）

```js
function zoomFit() {
  var wrapper = document.getElementById('canvasWrapper');
  var cw = wrapper.clientWidth, ch = wrapper.clientHeight;
  var contentW = parseInt(container.style.width);
  var contentH = parseInt(container.style.height);
  zoom = Math.min((cw - 80) / contentW, (ch - 80) / contentH, 1.5);
  panX = (cw - contentW * zoom) / 2;
  panY = (ch - contentH * zoom) / 2;
  applyTransform();
}
```

### 浮动缩放控件

在画布区域右下角放置固定的缩放按钮组（± 按钮 + 百分比显示），独立于 canvas transform，始终可见。

### 设计要点

- `canvas-container` 的 `width/height` 由 layout 算法计算（基于节点位置），不随 zoom 变化
- 仅通过 CSS transform 改变视觉呈现，布局计算始终在 zoom=1 下进行
- 点状网格背景（`radial-gradient`）在平移时提供空间参照感
- `{ passive: false }` 在 wheel 事件上必需，否则无法 `preventDefault` 阻止页面滚动

### 路径：双击编辑标签后点击空白区无法退出（SVG 事件吞掉 blur）

**症状：** 双击节点标签进入编辑状态（input 替换 span）后，点击节点以外的画布空白区域，input 仍然存在，文本保持编辑状态，`onblur` 从未触发。

**根因：** canvas wrapper 的 `mousedown` 事件处理器调用了 `e.preventDefault()`（用于启动画布平移），这个调用阻止了焦点从 input 自然转移到其他元素，input 的 `blur` 事件永远不触发。

**不生效的尝试：** 在 document 的 `click` 事件中调用 `input.blur()` — click 的传播链也被 mousedown 的 `preventDefault` 破坏了。

**修复：** 在 wrapper 的 `mousedown` 处理器**最开头**（`e.button !== 0` 检查之后），主动检测并 blur 活跃编辑中的 input：

```js
wrapper.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;

  /* Exit label editing when clicking outside the input */
  var activeInput = document.querySelector('input.mm-node-input');
  if (activeInput && !e.target.closest('.mm-node-input')) { activeInput.blur(); }

  // ... 后续节点拖拽、画布平移逻辑
});
```

`!e.target.closest('.mm-node-input')` 保证点击编辑框内部时不触发 blur（用户可能想选中部分文字），而点击节点其他位置、画布空白、工具栏等都会正确退出编辑状态。input 的自然 `onblur` 回调保存编辑内容、替换回 span，与 Enter/Escape 的行为一致。
