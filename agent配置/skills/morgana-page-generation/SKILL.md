---
name: morgana-page-generation
description: morgana平台“涌现”对话场景，交互式信息页面生成。仅生成page页面，不返回文字。不包含环境配置信息，实际路径/端口/回调地址由系统提示词提供。
version: 3.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [morgana, pages, html, verification, no-text]
---

# Morgana 交互式信息页面生成

**只生成页面，不输出文字回复。**

你的任务是将给定的对话内容转化为一个直观的、可交互的HTML 页面。Agent 回答中提供了核心信息，你需要将这些信息以用户容易理解的形式呈现出来。如果需要用户补充信息或其他互动交互，页面可提供各类表单输入元素，让用户可以提交关键数据和互动。

## 核心原则：只做页面(浅色风格)，不做回复

**整个执行流程如下：**

1. 分析给定的用户提问和 agent 回答内容，确定页面呈现方式
2. 将 HTML 页面写入磁盘
3. 验证文件写入成功且内容正确
4. 调用刷新回调接口，通知 Morgana 加载新页面（刷新回调地址由系统提示词提供）
5. **直接结束，不输出任何文字回复**

## 适用场景

所有场景下生成的都是**交互式信息页面**：
- 主体展示 Agent 回答中的核心信息
- 如需用户补充信息或其他互动交互，页面可提供各类表单输入元素或其他互动元素，让用户可以提交关键数据和互动。

无论哪种情况，Agent均不返回文字给用户，仅执行页面生成和刷新操作。

## 页面设计

页面采用浅色风格，自由结构布局来展示 Agent 回答中的信息和互动要素。页面结构没有固定限制，你可以用卡片、表格、图文、表单元素等任何 HTML 形式来组织内容，只要清晰可读即可。

页面中的互动输入元素需加入到表单中，以便能提交信息给Agent。需要引用 Morgana SDK 并用 `Morgana.submit()` 提交用户输入的数据：

```html
<script src="http://localhost:3001/api/sdk/morgana.js"></script>
<form>
  <label>三角形等于几？<input type="number" name="triangle" placeholder="请输入数字"></label>
  <button type="button" onclick="Morgana.submit(Object.fromEntries(new FormData(this.closest('form'))))">提交</button>
</form>
```

提交后页面保持显示，可提示"已提交"。

## 页面视觉规范

**所有页面均采用浅色风格，背景颜色必须为白色或接近白色的其他浅色。**
所有页面按照以下值设置样式。

### 颜色

| 用途 | 色值 | 说明 |
|---|---|---|
| 页面背景 | `#f5f5f5` | body 背景色 |
| 卡片背景 | `#ffffff` | 内容区/表单区白色卡片 |
| 正文字色 | `#333333` | 所有正文、标题 |
| 辅助文字 | `#666666` | 副标题、说明文字 |
| 弱化标注 | `#999999` | 时间戳、脚注 |
| 品牌色 | `#4f46e5` | 按钮背景、链接、强调 |
| 按钮悬停 | `#4338ca` | 按钮 hover 状态 |
| 边框/分割线 | `#eeeeee` | 表格边框、区块分割 |

### 排版

| 属性 | 值 |
|---|---|
| 字体 | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| 基础字号 | `16px` |
| 行高 | `1.6` |
| 页面标题 | `24px` 粗体 |
| 区块标题 | `20px` 粗体 |
| 卡片标题 | `16px` 粗体 |

### 布局

- 最大内容宽度 `720px`，左右边距 `auto` 居中
- 区块之间间距 `2rem`
- 卡片内边距 `1.5rem 2rem`
- 卡片圆角 `8px`
- 卡片阴影 `0 1px 3px rgba(0,0,0,0.1)`
- 页面左右最小边距 `1rem`
- 表格单元格内边距 `8px 12px`，底部边框 `1px solid #eee`

### 按钮

- 背景色 `#4f46e5`，文字白色，无边框
- 圆角 `6px`，内边距 `10px 16px`
- hover 色 `#4338ca`
- 块级按钮宽度 100%

### 表单输入

- 边框 `1px solid #ddd`，圆角 `6px`
- 内边距 `8px 12px`，字号 `14px`
- 宽度 100%，`box-sizing: border-box`

## 页面生成规则

### 写入 → 验证 → 刷新，绝不假设成功

```
步骤 A — 写入文件
  将完整 HTML 写入页面根目录下的 index.html（每次覆盖写入）
  注意：如果页面根目录在 WSL 挂载路径（如 /mnt/d/...），write_file 工具会
  报告成功但实际文件不变（WSL/Windows 文件系统缓存问题）。必须使用
  terminal 的 heredoc 方式写入：cat > "path/page.html" << 'EOF' ... EOF

步骤 B — 验证（至少两项检查）
  检查 1：文件行数 > 0（文件存在且非空）
  检查 2：在文件中搜索本次回答的标志性关键词（内容是本次的，不是旧内容）

步骤 C — 通知 Morgana 刷新
  调用 GET /api/infrastructure/refresh 通知 Morgana 重载页面（无需请求体）。
  ```bash
  HOST_IP=$(ip route show default | awk '{print $3}')
  curl -s http://$HOST_IP:3001/api/infrastructure/refresh
  ```
  后端广播 SSE page_refresh 事件给所有前端，前端收到后刷新 iframe。
  localhost 在 WSL 中不可用（Morgana 运行在 Windows 宿主），需用宿主 IP。

**禁止跳过步骤 B**。如果验证失败，回到步骤 A 修复后重试。

## 常见陷阱

1. **生成了文字回复** — 本技能只生成页面，不输出任何文字。完成写入→验证→刷新后直接结束。
2. **Agent 要求补充信息但页面底部没有表单** — Agent 回答中已经指出条件不足或提出了反问，但页面内容区下面没有表单区。这种情况需要在内容区后追加表单区域，让用户可以提交补充信息。
3. **未分析对话内容直接套模板** — 页面表现形式应根据实际内容灵活选择，不应固定套用一种模板。
4. **只做了数据罗列** — 页面应具有可读性，用合适的视觉层级和布局帮助用户理解信息，而非简单堆砌。
5. **`write_file` 在 WSL 挂载路径（`/mnt/d/`、`/mnt/c/` 等）下静默失败** — 工具返回成功、`read_file` 也能确认内容，但磁盘上的实际文件不变。原因是 WSL/Windows 文件系统缓存。**`patch` 工具有同样的静默失败问题。** 安全写入方式有三种：（a）terminal 的 heredoc（`cat > file << 'EOF'`），（b）`sed -i` 修改已有文件，（c）`execute_code` 中用 Python 的 `open().write()`（可读性最佳，适合需要写入较复杂内容时使用）。

6. **terminal heredoc 分隔符必须加引号** — 正确的写法是 `cat > file << 'EOF'` 或 `cat > file << 'HERMESEOF'`。**分隔符必须用单引号包裹**（如 `'EOF'`），关闭 shell 对 `$`、反引号等字符的变量展开。如果写 `<< EOF`（无引号），HTML/JS 中的 `$` 符号（如 jQuery、模板字符串）会导致 shell 变量替换，内容被破坏。确认分隔符在整个内容中不重复出现。

7. **验证必须用 terminal，不要只用 read_file** — `/mnt/d/` 路径下 read_file 和 patch 共享 WSL 缓存层，可能同时报告虚假成功。正确的验证方式：
   ```bash
   wc -l <PAGES_ROOT>/page_14.html         # 文件存在且非空
   grep "render-pptx\|补充关键词" <PAGES_ROOT>/page_14.html  # 新内容已落盘
   ```

8. **@keyframes 和 @media 不能放在 `<script>` 标签内** — CSS 规则以 `@` 开头，放在 `<script>` 内会导致 JS 解析到 `@` 时立即报语法错误，**该 `<script>` 块内所有后续代码不执行**，但不会报错到控制台（ES 模块模式下）。排查方法：在文件中搜索 `<script>` 和 `@keyframes` 或 `@media` 之间的距离。如果 CSS 动画规则在 `<script>` 块内，整个页面的数据加载、交互逻辑全部失效，但视觉上页面骨架正常显示。

9. **onclick 调用异步回调时必须加 await** — 当 onclick 处理函数需调用 `Morgana.insert/update/delete` 等异步 SDK 方法时，处理函数自身必须是 `async` 且用 `await` 调用回调。如果同步调用异步函数（`fn(val)` 无 `await`），回调返回的 Promise 若 reject，异常会被浏览器静默吞掉——不弹错误提示，不写数据库，但控制台可能有 `Unhandled Promise Rejection` 警告。表现为「点击确定后什么都没发生」。正确写法：

```javascript
// ❌ 错误：异步回调被吞掉
document.getElementById('okBtn').onclick = function() {
  var cb = capturedCallback;
  if (cb) cb(val);  // 异步函数，reject 被静默吞掉
};

// ✅ 正确：async onclick + await + try/catch
document.getElementById('okBtn').onclick = async function() {
  var cb = capturedCallback;
  if (cb) {
    try { await cb(val); } catch(e) { showToast('失败: ' + e.message, 'error'); }
  }
};
```

同样适用于 `onkeydown`、`onsubmit` 等事件绑定。如果事件处理函数本身是同步的但内部调用了异步回调，必须改造为上述模式。

## 验证清单

- [ ] 已加载配套技能（morgana-infrastructure 等）并确认页面根目录路径
- [ ] 已检查同级已有页面，确认数据源和存储模式
- [ ] 文件已写入页面根目录下的 index.html
- [ ] 文件行数 > 0（存在且非空）
- [ ] 搜索能命中本次回答的标志性关键词（内容是新的）
- [ ] 所有资源已下载到本地（HTML 中无外部 HTTPS 引用）
- [ ] 资源文件数量符合预期
- [ ] 每个 `<img>` 都有回退显示（非 `display:none`）
- [ ] 刷新回调返回了成功状态
- [ ] HTML 格式正确（标签闭合、无 heredoc 残留）
- [ ] 页面呈现了用户提问和 agent 回答中的核心信息

### 仅当使用后端 API 时的额外检查项

- [ ] 数据库表已创建（对话中手动 CREATE TABLE，或页面加载时自动建表）
- [ ] 所有数据操作使用 `Morgana.query/insert/update/delete`，无 fetch API 调用
- [ ] SQL 中的单引号与 JS 字符串引号无冲突（外层用双引号包裹含单引号的 SQL）
- [ ] 页面引用 Morgana SDK（`<script src="http://localhost:3001/api/sdk/morgana.js">`）
- [ ] 如使用后端 API：API 服务器已启动、CORS 头已设置、restore-hermes.sh 已更新
- [ ] 页面已复制到 `<PAGES_ROOT>/`（如果需从 Morgana 访问）
