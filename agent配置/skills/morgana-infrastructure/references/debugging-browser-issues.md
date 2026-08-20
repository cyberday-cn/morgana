# Morgana 页面浏览器端调试

## 适用场景

当 Morgana 固定页面（page_<id>.html）的按钮点击后无反应、数据未保存到数据库、或前端行为异常时使用。

## 调试模式：`[DEBUG]` console.log

在可疑函数中插入 `console.log('[DEBUG] ...')` 语句，追踪异步执行流：

```javascript
function showCreateBoardDialog() {
  console.log('[DEBUG] showCreateBoardDialog 被调用');
  closeBoardDropdown();
  showInput('新建看板', '输入看板名称', '', async function(boardName) {
    console.log('[DEBUG] 回调执行, boardName:', boardName);
    try {
      console.log('[DEBUG] 准备执行 INSERT');
      var result = await Morgana.insert('INSERT ...', [boardName]);
      console.log('[DEBUG] INSERT 返回:', JSON.stringify(result));
      // ...
    } catch(e) {
      console.error('[DEBUG] 创建失败:', e);
      console.error('[DEBUG] 错误堆栈:', e.stack);
      showToast('创建失败: ' + (e.message || '请重试'), 'error');
    }
  });
}
```

用户按 F12 → Console 后可看到每一步的执行情况：
- 如果没有任何 `[DEBUG]` 输出 → 函数未被调用（按钮绑定问题）
- 如果有第一条但没有回调日志 → `showInput` 的确认按钮回调未触发
- 如果有回调但没有 INSERT 日志 → fetch 调用失败（网络/CORS 问题）
- 如果进入了 catch → 查看具体错误信息

## Morgana SDK 方法失败时的 fallback

当 `Morgana.insert/update/delete` 不工作时，先用终端 curl 验证 API 本身是否正常：

```bash
# 从 WSL 终端测试（使用 Windows 宿主 IP，不是 localhost）
curl -s -X POST http://<WINDOWS_IP>:3001/api/sdk/db/execute \
  -H "Content-Type: application/json" \
  -d '{"sql":"INSERT INTO kanban_boards (name) VALUES (?)","params":["测试"]}'
```

如果终端 curl 成功但浏览器端失败，改用 raw `fetch` 作为 SDK fallback：

```javascript
var res = await fetch('http://localhost:3001/api/sdk/db/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: 'INSERT INTO my_table (name) VALUES (?)', params: [val] })
});
if (!res.ok) { var errText = await res.text(); throw new Error('服务器错误: ' + errText); }
var result = await res.json();
// result = { insertId: N, affectedRows: 1 }
```

## showInput 回调闭包陷阱

`showInput` 的确认按钮回调通过闭包捕获。每个 `showInput` 调用都会重新设置 `inputOk.onclick`。如果同一 modal 被多次调用（如先创建看板、再重命名看板），回调会互相覆盖。

```javascript
function showInput(title, placeholder, currentVal, cb) {
  var capturedCb = cb;  // 闭包捕获当前回调
  document.getElementById('inputOk').onclick = async function() {
    var fn = capturedCb;  // 始终使用当前闭包的 cb
    closeInput();
    if (fn) { try { await fn(val); } catch(e) { ... } }
  };
}
```

**关键**：`inputOk.onclick` 每次都会被重新赋值，且通过 `capturedCb` 闭包变量引用正确的回调。但如果 `showInput` 被快速连续调用两次（如弹出重命名 → 快速取消 → 弹出创建），第二次调用可能覆盖第一次的 `onclick` 而第一次的 DOM 还未清理。**始终在调用 `showInput` 前确保之前的 modal 已关闭**。

## Morgana.query 返回陷阱

```javascript
// ❌ WRONG — rows 为 undefined
const { rows } = await Morgana.query('SELECT ...');

// ✓ RIGHT — Morgana.query 返回裸数组
const rows = await Morgana.query('SELECT ...');
```

`Morgana.insert` 和 `Morgana.delete` 正常返回 `{insertId, affectedRows}` 对象。

## 网络诊断快速检查

在浏览器 F12 → Network 标签页：
1. 筛选 XHR/Fetch 请求
2. 点击触发操作（新建看板等）
3. 查看是否有 `/api/sdk/db/execute` 请求发出
4. 检查响应状态码和响应体

如果请求未发出 → JavaScript 执行出错（查看 Console 标签页的红字报错）
如果请求发出但返回非 200 → 查看响应体中的错误信息
如果 200 但数据未写入 → 检查 `insertId` 是否为 0（可能外键约束或权限问题）

## prompt() 是调试盲区 — 优先使用 showInput

浏览器原生 `prompt()` 对话框会阻塞 JavaScript 执行，它不在 DOM 中、Console 看不到、无法打断点。当用户点击 `prompt()` 的"确定"后如果没反应，无法判断是 `prompt()` 被浏览器静默屏蔽了，还是后续代码执行失败了。

**始终用 `showInput(title, placeholder, currentVal, callback)` 替代 `prompt()`**：
- 自定义 modal，DOM 可见，DevTools 可检查
- 回调函数中可加完整的 `[DEBUG]` console.log 追踪
- 用户体验更好（与页面风格统一）

```javascript
// ❌ 调试盲区
var name = prompt('请输入名称：');

// ✓ 可调试
showInput('新建看板', '输入看板名称', '', async function(name) {
    console.log('[DEBUG] 用户输入:', name);
    // ... 后续操作
});
