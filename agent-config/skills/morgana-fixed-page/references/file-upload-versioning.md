# 文件上传与版本管理参考

适用于 Morgana 固定页面中需要上传文件、管理版本、在线预览的场景。

## 目录

- [文件上传](#文件上传)
- [版本管理](#版本管理)
- [多格式在线预览](#多格式在线预览)
- [关键陷阱](#关键陷阱)

---

## 文件上传

### 文本文件（.md / .txt / .json / .csv 等）

通过 `FileReader.readAsText()` 读取，存储 UTF-8 文本到 MariaDB TEXT 字段：

```js
function handleUpload(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      resolve(e.target.result);       // string
    };
    reader.onerror = function(e) { reject(e); };
    reader.readAsText(file);
  });
}
```

存储到数据库：

```sql
INSERT INTO docs (title, content, file_type, file_size)
VALUES (?, ?, 'md', ?)
```

### 二进制文件（Word / Excel / PPT / PDF 等）

通过 `FileReader.readAsArrayBuffer()` 读取后转为 Base64 字符串，存储到 MariaDB MEDIUMTEXT / LONGTEXT 字段：

```js
function handleUpload(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var arrayBuffer = e.target.result;
      var bytes = new Uint8Array(arrayBuffer);
      var binary = '';
      for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      resolve(btoa(binary));          // Base64 string
    };
    reader.onerror = function(e) { reject(e); };
    reader.readAsArrayBuffer(file);
  });
}
```

⚠️ MariaDB 的 `TEXT` 最大 65535 字节（约 64KB Base64，对应 ~48KB 原文件），大文件建议用 `MEDIUMTEXT`（~16MB）或 `LONGTEXT`（~4GB）。

存储到数据库时拼接 MIME 前缀用于预览：

```js
var mimeBase64 = 'data:' + file.type + ';base64,' + base64Content;
```

### 文件选择器

```html
<input type="file" id="fileInput" accept=".md,.txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" />
```

或拖拽上传：

```js
dropZone.addEventListener('dragover', function(e) { e.preventDefault(); });
dropZone.addEventListener('drop', function(e) {
  e.preventDefault();
  var file = e.dataTransfer.files[0];
  // 处理 file
});
```

### 下载文件

文本文件使用 Blob，二进制文件使用 Base64：

```js
function downloadText(filename, content) {
  var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64(filename, mimeBase64) {
  var a = document.createElement('a');
  a.href = mimeBase64;
  a.download = filename;
  a.click();
}
```

---

## 版本管理

### 数据库表设计

```sql
CREATE TABLE IF NOT EXISTS document_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doc_id INT NOT NULL,                       -- 所属文档 ID
  version INT NOT NULL DEFAULT 1,            -- 版本号（自动递增）
  file_name VARCHAR(255) NOT NULL,           -- 原始文件名
  file_type VARCHAR(20) NOT NULL DEFAULT 'text',  -- text / binary
  content LONGTEXT,                          -- 文本内容 或 Base64 内容
  file_size BIGINT DEFAULT 0,                -- 文件大小（字节）
  changelog VARCHAR(500) DEFAULT '',         -- 版本变更说明
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

### 文档主表

```sql
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  category VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 版本号自动递增

```js
// 获取该文档当前最大版本号
var rows = await Morgana.query(
  "SELECT COALESCE(MAX(version), 0) + 1 AS nextVer FROM document_versions WHERE doc_id = ?",
  [docId]
);
var nextVersion = rows[0].nextVer;  // Morgana.query 返回裸数组
```

### 版本 CRUD

**新增版本：**

```js
await Morgana.insert(
  "INSERT INTO document_versions (doc_id, version, file_name, file_type, content, file_size, changelog) VALUES (?, ?, ?, ?, ?, ?, ?)",
  [docId, nextVersion, fileName, fileType, content, fileSize, changelog]
);
```

**查询版本列表：**

```js
var versions = await Morgana.query(
  "SELECT id, version, file_name, file_type, file_size, changelog, created_at FROM document_versions WHERE doc_id = ? ORDER BY version DESC",
  [docId]
);
```

**删除指定版本：**

```js
// 先检查是否最后一个版本
var count = await Morgana.query(
  "SELECT COUNT(*) AS cnt FROM document_versions WHERE doc_id = ?",
  [docId]
);
if (count[0].cnt < 2) return;  // 最后一个版本不能删除

await Morgana.delete(
  "DELETE FROM document_versions WHERE id = ? AND doc_id = ?",
  [versionId, docId]
);
```

**删除文档（级联删除版本）：**

```js
await Morgana.delete("DELETE FROM documents WHERE id = ?", [docId]);
// 版本表设置 ON DELETE CASCADE，自动删除对应版本
```

### 版本选择交互

```js
var selectedVersionId = null;

function selectVersion(docId, versionId) {
  selectedVersionId = versionId;
  renderDetail(docId);  // 重新渲染，显示选中状态
}

// 渲染时判断行是否选中
function renderVersionRow(v) {
  var isSelected = selectedVersionId === v.id;
  return '<div class="' + (isSelected ? 'selected-version' : '') + '" onclick="selectVersion(' + docId + ',' + v.id + ')">'
    + 'v' + v.version + ' - ' + v.file_name
    + '</div>';
}
```

---

## 多格式在线预览

### 动态加载 CDN 库

为避免增加首屏加载时间，在用户第一次点击预览时动态注入 `<script>`：

```js
function loadScript(url) {
  return new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// 使用示例
await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
```

### PDF 预览

浏览器原生支持 `<embed>` 嵌入 Base64 数据流：

```js
function previewPDF(mimeBase64) {
  return '<embed src="' + mimeBase64 + '" type="application/pdf" style="width:100%;height:100%;border:none;">';
}
```

### Word (.docx) 预览

使用 [mammoth.js](https://github.com/michaelfishman/mammoth) 转换为 HTML：

```js
// 加载 CDN: https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js
async function previewWord(base64Content) {
  // Base64 → ArrayBuffer
  var binaryStr = atob(base64Content);
  var bytes = new Uint8Array(binaryStr.length);
  for (var i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  var arrayBuffer = bytes.buffer;

  var result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
  return result.value;  // HTML string
}
```

⚠️ mammoth.js 只能处理 `.docx`（新格式），旧版 `.doc` 无法解析。

### Excel (.xlsx / .xls) 预览

使用 [SheetJS](https://sheetjs.com/) 解析为 HTML 表格：

```js
// 加载 CDN: https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js
async function previewExcel(base64Content) {
  var workbook = XLSX.read(base64Content, { type: 'base64' });
  var html = '';
  workbook.SheetNames.forEach(function(name) {
    var sheet = workbook.Sheets[name];
    html += '<h4>' + name + '</h4>';
    html += XLSX.utils.sheet_to_html(sheet, { id: 'sheet-' + name });
  });
  // sheet_to_html 生成的表格无边框，需补充 CSS
  return html;
}
```

SheetJS 生成的 HTML `<table>` 需要补充 CSS：

```css
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #ccc; padding: 4px 8px; font-size: 13px; }
```

### PPT (.pptx) 预览（推荐方式）

**不要用 JSZip 提取文字。** JSZip 只能提取 PPTX 中的纯文本，无法显示排版、图片、形状、颜色等。改用后端 LibreOffice 渲染为完整 PNG 图片，效果和在 PowerPoint 中打开一样。

#### 前置条件

WSL 中安装 LibreOffice Impress：
```bash
sudo apt-get install -y libreoffice-impress libreoffice-common
```

需确保 Express 后端 body-parser limit 足够大（至少 50mb）：
```js
app.use(express.json({ limit: '50mb' }));
```

#### 后端路由（Express / TypeScript）

⚠️ **使用两步转换：PPTX→PDF→PNG，不要直接 PPTX→PNG。** LibreOffice 直接转 PNG 对复杂 PPTX 不稳定（可能只输出第一页或失败）。两步法（LibreOffice 转 PDF，再用 pdftoppm 拆分为逐页 PNG）在生产中验证可靠。

Morgana 后端是 TypeScript 项目，路由放在单独文件中（如 `backend/src/routes/render-pptx.ts`），在 `index.ts` 中 import：

```typescript
// backend/src/routes/render-pptx.ts
import { Router, Request, Response } from 'express'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

const router = Router()

router.post('/render-pptx', async (req: Request, res: Response) => {
  try {
    const { base64 } = req.body
    if (!base64) {
      res.status(400).json({ error: 'Missing base64 data' })
      return
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-'))
    const pptxPath = path.join(tmpDir, 'input.pptx')
    const pdfDir = path.join(tmpDir, 'pdf')
    const imgDir = path.join(tmpDir, 'images')

    // Write PPTX file
    fs.writeFileSync(pptxPath, Buffer.from(base64, 'base64'))
    fs.mkdirSync(pdfDir, { recursive: true })
    fs.mkdirSync(imgDir, { recursive: true })

    // Step 1: PPTX → PDF (LibreOffice renders all slides into a multi-page PDF)
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${pdfDir}" "${pptxPath}"`,
      { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
    )

    const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'))
    if (pdfFiles.length === 0) throw new Error('No PDF was generated')
    const pdfPath = path.join(pdfDir, pdfFiles[0])

    // Step 2: PDF → PNG images (one per page) using pdftoppm (poppler-utils)
    let pngFiles: string[] = []
    try {
      execSync(
        `pdftoppm -png -r 150 "${pdfPath}" "${path.join(imgDir, 'slide')}"`,
        { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      )
      pngFiles = fs.readdirSync(imgDir).filter(f => f.endsWith('.png')).sort()
    } catch {
      // Fallback: ImageMagick convert
      execSync(
        `convert -density 150 "${pdfPath}" "${path.join(imgDir, 'slide.png')}"`,
        { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      )
      pngFiles = fs.readdirSync(imgDir).filter(f => f.endsWith('.png')).sort()
    }

    if (pngFiles.length === 0) throw new Error('No images were generated')

    // Read each PNG as base64
    const slides: string[] = pngFiles.map(f =>
      fs.readFileSync(path.join(imgDir, f)).toString('base64')
    )

    fs.rmSync(tmpDir, { recursive: true, force: true })
    res.json({ slides, total: slides.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
})

export { router as renderPptxRouter }
```

```typescript
// backend/src/index.ts (添加 import 和挂载)
import { renderPptxRouter } from './routes/render-pptx.js'
app.use('/api', renderPptxRouter)
```

⚠️ 前置依赖：`sudo apt-get install -y libreoffice-impress libreoffice-common poppler-utils`

#### 测试 render-pptx 端点

⚠️ **不要用 curl -d 直接内联 base64 JSON** — shell 转义会破坏 JSON。正确方式：

```bash
# 1. 用 python-pptx 创建测试文件
python3 -c "
from pptx import Presentation
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = 'Test Slide'
slide.placeholders[1].text = 'Hello World'
prs.save('/tmp/test.pptx')
"

# 2. 生成 JSON payload 文件
python3 -c "
import base64, json
with open('/tmp/test.pptx', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
with open('/tmp/pptx_payload.json', 'w') as f:
    json.dump({'base64': b64, 'filename': 'test.pptx'}, f)
"

# 3. 用 -d @file 发送
curl -s -X POST http://localhost:3001/api/render-pptx \
  -H 'Content-Type: application/json' \
  -d @/tmp/pptx_payload.json | head -c 200
# 预期: {"slides":["iVBORw0KGgo..."],"total":1}
```

#### 前端渲染

```js
async function previewPPT(base64Content) {
  try {
    var resp = await fetch('/api/render-pptx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: base64Content, fileName: 'slide.pptx' })
    });
    if (!resp.ok) throw new Error('渲染失败 (' + resp.status + ')');
    var result = await resp.json();
    var slides = result.slides || [];
    var wrapId = 'ppt-' + Date.now(), curIdx = 0;

    function renderSlide() {
      var wrap = document.getElementById(wrapId);
      if (!wrap) return;
      wrap.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px">' +
          '<button class="btn btn-sm" onclick="pptNav(\'' + wrapId + '\', -1)" ' + (curIdx === 0 ? 'disabled' : '') + '>&#9664; 上一页</button>' +
          '<span style="font-size:13px;color:var(--text3);min-width:120px;text-align:center">第 ' + (curIdx + 1) + ' 页 / 共 ' + slides.length + ' 页</span>' +
          '<button class="btn btn-sm" onclick="pptNav(\'' + wrapId + '\', 1)" ' + (curIdx >= slides.length - 1 ? 'disabled' : '') + '>下一页 &#9654;</button>' +
        '</div>' +
        '<div style="text-align:center;overflow:auto;max-height:65vh;background:#fff;padding:8px;border-radius:8px">' +
          '<img src="data:image/png;base64,' + slides[curIdx] + '" style="max-width:100%;height:auto">' +
        '</div>';
    }

    // 全局导航函数
    window['_pptData_' + wrapId] = { images: slides, idx: 0, wrapId: wrapId, fn: renderSlide };
    setTimeout(renderSlide, 100);
    return '<div id="' + wrapId + '" style="width:100%;min-height:300px;display:flex;align-items:center;justify-content:center">' +
      '<div class="loading-spinner"></div></div>';
  } catch (e) {
    return '<div style="text-align:center;padding:40px 20px;color:var(--text3)">PPT 渲染失败: ' + esc(e.message || e) + '</div>';
  }
}

// 键盘翻页
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // 查找当前可见的 PPT
    for (var k in window) {
      if (k.indexOf('_pptData_') === 0 && document.getElementById(window[k].wrapId)) {
        var d = window[k];
        var dir = e.key === 'ArrowLeft' ? -1 : 1;
        var newIdx = d.idx + dir;
        if (newIdx >= 0 && newIdx < d.images.length) {
          d.idx = newIdx;
          d.fn();
        }
        break;
      }
    }
  }
});
```

#### 备用方案（无 LibreOffice 时）

如果无法安装 LibreOffice，回退到 JSZip 提取纯文本（效果差，无排版/图片/样式）：

```js
var zip = await JSZip.loadAsync(base64Content, { base64: true });
var slideFiles = Object.keys(zip.files).filter(function(f) {
  return f.match(/^ppt\/slides\/slide\d+\.xml$/);
}).sort();
var slidesHtml = '';
for (var i = 0; i < slideFiles.length; i++) {
  var xmlText = await zip.file(slideFiles[i]).async('string');
  var texts = xmlText.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
  var slideText = texts.map(function(t) {
    return t.replace(/<[^>]+>/g, '');
  }).filter(function(t) { return t.trim(); }).join('\n');
  slidesHtml += '<div class="ppt-slide">' +
    '<div class="ppt-slide-header">第 ' + (i+1) + ' 页</div>' +
    '<pre>' + esc(slideText) + '</pre></div>';
}
```

### 文本文件（.md / .txt 等）

直接按原样显示，用 `white-space: pre-wrap` 保持格式：

```html
<pre style="white-space:pre-wrap;word-wrap:break-word;font-size:14px;line-height:1.7;">
<!-- 直接插入文本内容 -->
</pre>
```

### 预览弹窗模板

```html
<div class="modal" id="previewModal">
  <button class="preview-modal-close" onclick="closeModal('previewModal')">&times;</button>
  <div class="preview-modal-head">
    <div>
      <h3 id="previewTitle"></h3>
      <div class="sub" id="previewSub"></div>
    </div>
  </div>
  <div class="preview-modal-body" id="previewBody"></div>
</div>

<style>
.modal { display:none; position:fixed; z-index:1000; left:0; top:0; width:100vw; height:100vh;
  background:rgba(0,0,0,0.4); backdrop-filter:blur(2px); align-items:center; justify-content:center; }
.modal.show { display:flex; }
.preview-modal { width:98vw; max-width:1400px; height:90vh; flex-direction:column; padding:0; overflow:hidden; position:relative; }
.preview-modal-close { position:absolute; top:8px; right:8px; background:none; border:none;
  font-size:24px; cursor:pointer; color:var(--text2); width:36px; height:36px;
  display:flex; align-items:center; justify-content:center; border-radius:50%; z-index:10; }
.preview-modal-head { padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
.preview-modal-body { flex:1; overflow-y:auto; padding:20px; background:var(--bg); }
</style>
```

---

## 关键陷阱

### 1. WSL 写入路径失效与文件截断（致命）

`write_file` 和 `patch` 在 `/mnt/d/` 下有两种失败模式：

**模式 A — 静默失败**：工具返回成功且 `read_file` 返回预期的缓存内容，但磁盘文件未变或只写了部分内容。

**模式 B — 静默截断（更危险）**：工具报告成功，文件确实被写入磁盘，但**只有部分内容**（如写到第 574 行突然中断为 `docume\n`），后续数百行代码全部丢失。`read_file` 也返回同样的截断内容。**后续的 patch 操作在已截断的文件上继续执行，不会报错也不会恢复丢失的内容——因为 patch 匹配的是当前（已损坏的）文件内容。**

⚠️ **模式 B 的识别方法**：
- 文件行数比预期少很多（如预期 1200 行实际只有 573 行）
- 文件中间某行突然中断（函数体写到一半变成无意义短串后接空行）
- `node --check` 对提取的 JS 报语法错误，且错误位置在文件中段而非开头
- `sed -n 'LINEp'` 看到某行内容明显被截断

**正确的写入方式（按推荐顺序）：**

a) **terminal heredoc** — 最可靠，写入大文件（800+行）时不易截断：
```bash
cat > "<PAGES_ROOT>/page_14.html" << 'HERMESEOF'
...完整 HTML 内容...
HERMESEOF
sync   # 强制落盘，避免 WSL 缓存延迟
```
注意：分隔符 `HERMESEOF` 必须加引号 `'HERMESEOF'` 以关闭 shell 变量展开。

b) **Python 分段重建** — 当文件已截断且需要保留完好的前后部分时：
```python
# 1. 提取完好前半部分（到截断点之前）
with open('/mnt/d/path/file.html', 'r') as f:
    lines = f.readlines()
good_start = ''.join(lines[:573])  # 截断点之前的所有行

# 2. 提取完好后半部分（从某个已知完好的行开始）
good_end = ''.join(lines[1069:])   # 截断结束后的所有行

# 3. 重建丢失的中间部分（完整的 JS 函数代码）
middle = """..."""

# 4. 合并、写入临时文件、验证后再复制到目标
full = good_start + middle + good_end
```

c) **`execute_code` 中 Python open/write** — 适合中等大小文件（< 300 行）

**当发现文件截断时的恢复流程：**

1. **立即停止使用 write_file/patch** — 它们在已损坏文件上的操作不可靠
2. 用 `wc -l` 确认实际行数，用 `sed -n 'START,ENDp'` 定位截断范围
3. 提取完好的前缀和后缀（保存到 /tmp/ 备份）
4. 用 Python 或 heredoc 重建完整文件（合并完好部分 + 重写的缺失部分）
5. **写入后必须执行三重验证**：
   ```bash
   # 验证 1：行数和大小
   wc -l <PAGES_ROOT>/page_14.html

   # 验证 2：关键函数存在
   grep "function loadDocs\|function selectDoc\|renderPPTXPreview" <PAGES_ROOT>/page_14.html

   # 验证 3：JS 语法正确
   node --check /tmp/extracted_script.js
   ```
6. 如果任何验证失败，不要刷新页面通知用户，继续修复直到全部通过

**验证必须在 terminal 中执行，不能依赖 read_file。** read_file 和 patch 共享同样的 WSL 缓存层。

### 2. mammoth.js 只支持 .docx

旧版 `.doc`（97-2003 格式）无法解析。检测文件后缀，对 `.doc` 提示"老格式暂不支持在线预览，请下载查看"。

### 3. Base64 字符串引号冲突

Base64 字符串可能包含 `+`、`/`、`=` 等字符，嵌入 JS 字符串时不会与引号冲突，可安全使用。但 SQL 中的 `?` 占位符机制要求 Base64 通过参数传入而非拼接。

### 4. 大文件限制

- MariaDB TEXT 字段上限约 64KB Base64 → ~48KB 原始文件
- 建议用 MEDIUMTEXT (max 16MB) 或 LONGTEXT (max 4GB)
- 预览时超大文件（>50MB）可能导致浏览器崩溃，建议超过 20MB 的 Base64 文件提示下载而非预览

### 5. @keyframes 不能放在 <script> 标签内

CSS 动画规则 `@keyframes` 是 CSS 语法，放在 `<script>` 内会导致 JS 解析到 `@` 时报语法错误，后续所有 JS 代码不执行。务必将其放在 `<style>` 块中：

```html
<!-- ✅ 正确 -->
<style>
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>

<!-- ❌ 错误：导致 JS 解析中断 -->
<script>
@keyframes spin { ... }
</script>
```

### 6. 同一文档多个版本引用同一个 docId

删除文档时必须级联删除所有版本（ON DELETE CASCADE）。新增版本时务必传入正确的 docId。

### 7. CSS 优先级：`.modal` 基类覆盖预览弹窗宽度

当页面同时有基础 `.modal` 类和一个更宽的子类 `.preview-modal` 时，如果 `.modal` 在 CSS 中定义在 `.preview-modal` **之后**，`.modal` 的 `width: 540px` 会覆盖 `.preview-modal` 的更宽值，即使 HTML 元素同时携带两个类。

两种修复方式：

**方式 A — 在 `.preview-modal` 中使用 `!important`：**
```css
.preview-modal { width: 98vw !important; max-width: 1400px !important; }
```

**方式 B — 调整 CSS 顺序，将 `.modal` 基类放在 `.preview-modal` 之前。**

推荐方式 A（更清晰，不依赖 CSS 顺序）。

### 8. 预览弹窗关闭按钮位置

关闭按钮（`&times;`）必须用 `position: absolute; top: 8px; right: 8px` 固定在弹窗最右上角，确保在任何宽度的预览内容下都能方便关闭。按钮使用圆形悬停样式：`width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center`。

不要添加"全屏预览"按钮——预览弹窗本身已经足够宽（98vw），不需要额外的全屏切换。

### 9. 后端 body-parser limit

上传大文件（特别是 Base64 编码的 Office 文档）时，Express 的 `express.json()` 默认 limit 仅 100kb。必须调整为至少 `50mb`：

```js
app.use(express.json({ limit: '50mb' }));
```

Morgana 后端文件：`backend/src/index.ts`（TypeScript，通过 `tsx watch src/index.ts` 启动）

### 10. 前后端字段名不匹配（静默失败）

后端 API 返回的 JSON 字段名与前端代码读取的字段名不一致时，**不会报错**，只是功能不工作（如预览弹窗显示"未能渲染出任何页面"）。

**实际案例**：
- 后端 `/api/render-pptx` 返回 `{ slides: [...], total: N }`
- 前端代码读 `data.pages` → `data.pages` 为 `undefined` → `data.pages.length === 0` → 抛出"未能渲染出任何页面"
- 用户看到的是"预览失败"，而不是有意义的错误信息

**防御性写法** — 前端同时接受两种字段名：
```js
var slideData = data.slides || data.pages;  // 兼容后端可能返回的任一字段名
if (!slideData || slideData.length === 0) {
  throw new Error('未能渲染出任何页面');
}
```

**排查方法**：浏览器 F12 → Network 面板 → 找到失败的 fetch 请求 → 查看 Response 内容中的实际 JSON 结构 → 对比前端代码中读取的字段名。

### 11. 修改页面 JS 后必须验证语法（强制）

每次修改 `<script>` 块内的代码后，**在声明"修改完成"之前**，必须提取 JS 内容并验证语法正确性。不验证就通知用户刷新，会导致用户看到白屏或功能完全失效。

**验证方法**（在 terminal 中执行）：
```bash
# 提取 script 块到临时文件
node -e "
var fs = require('fs');
var src = fs.readFileSync('<PAGES_ROOT>/page_14.html', 'utf8');
var sIdx = src.lastIndexOf('<script>');
var eIdx = src.indexOf('</script>', sIdx);
var js = src.substring(sIdx + 8, eIdx);
fs.writeFileSync('/tmp/doc_js_check.js', js, 'utf8');
"
# 检查语法
node --check /tmp/doc_js_check.js
```

如果报错，`node --check` 会输出精确的行号和错误类型。常见错误：
- `Unexpected string` — 字符串转义问题（见陷阱 #11）
- `Unexpected token` — 括号不匹配、遗漏分号等

⚠️ **不要用 `new Function(js)` 验证**——它对首行空行和非严格模式敏感，可能误报。`node --check` 更可靠。

### 12. 字符串转义导致的 JS 语法错误

在生成的 HTML/JS 中，动态拼接 onclick 属性或 innerHTML 时，字符串内的引号转义极易出错：

```js
// ❌ 危险：反斜杠转义单引号在字符串拼接中产生语法错误
html += '<button onclick="func(this,\'' + name.replace(/'/g, "\\'") + '\')">'

// ✅ 安全：用 JSON.stringify() 处理需要嵌入的动态值
html += '<button onclick="func(this,' + JSON.stringify(name) + ')">'
```

另一个常见问题——三元表达式的空字符串 fallback 在字符串拼接中：
```js
// ❌ 可能出问题：两个相邻的引号 '' 在某些解析器中引起混淆
html += '<button' + (condition ? ' disabled' : '') + '>text</button>'

// ✅ 安全：提取为变量
var disabledAttr = condition ? ' disabled' : '';
html += '<button' + disabledAttr + '>text</button>';
```

### 13. 文件损坏后的完整修复工作流模板

当发现 `/mnt/d/` 上的大文件被截断时，按以下步骤操作（本次 session 验证过的可靠流程）：

```
Step 1: 确认损坏范围
  wc -l <PAGES_ROOT>/page_14.html          → 看总行数是否异常少
  sed -n '570,580p' /mnt/d/.../page_14.html        → 定位截断点（内容突然中断处）

Step 2: 提取完好部分到 /tmp/
  python3 → 读取文件 → lines[:573] 为前缀，lines[1069:] 为后缀 → 各存为 /tmp/doc_good_*.html

Step 3: 用 Python 脚本重建中间部分
  write_file('/tmp/rebuild_doc_page.py') → 包含完整的 middle 字符串（丢失的函数代码）
  python3 /tmp/rebuild_doc_page.py → 合并 start + middle + end → 输出到 /tmp/doc_page_fixed.html

Step 4: 写入前的语法预检
  node --check 提取出的 JS → 必须通过，否则修完再写

Step 5: 复制到目标 + sync
  cp /tmp/doc_page_fixed.html <PAGES_ROOT>/page_14.html && sync

Step 6: 三重验证
  wc -l → 行数合理
  grep "关键函数名" → 所有核心函数存在
  node --check → JS 语法正确

Step 7: 通知用户刷新浏览器
```
