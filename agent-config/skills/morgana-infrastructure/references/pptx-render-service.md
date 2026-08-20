# PPTX Render Service

独立的 WSL HTTP 服务，将 PPTX 文件渲染为逐页 PNG 图片，供 Morgana 页面调用。

## 端口

3005（避免与 3001/3002/3003/5173 冲突）

## 关键技术路径

**PPTX → PDF（LibreOffice headless）→ PNG 逐页（pdftoppm）**

为什么不用 LibreOffice 直接转 PNG？

```
libreoffice --headless --convert-to png input.pptx
```

**只输出第一页。** LibreOffice 的 impress_png_Export filter 只导出当前幻灯片，不是全部。必须先转 PDF（保留所有页面），再用 `pdftoppm` 逐页拆成 PNG。

## 完整流程

```bash
# Step 1: PPTX → PDF
libreoffice --headless --convert-to pdf --outdir /tmp/dir input.pptx

# Step 2: PDF → PNG per page
pdftoppm -png -r 150 input.pdf slide
# 输出: slide-1.png, slide-2.png, slide-3.png, ...
```

`-r 150` 设置 150 DPI，平衡清晰度和文件大小。

## 依赖

- `libreoffice-core`（LibreOffice headless）
- `poppler-utils`（提供 `pdftoppm`）

## API

```
POST /render-pptx
Content-Type: application/json

请求体: {"base64": "<base64编码的PPTX文件>"}

成功响应 (200):
{"slides": ["<base64-png-slide1>", "<base64-png-slide2>", ...]}

失败响应 (500):
{"error": "错误描述"}
```

## 页面调用方式

```javascript
async function renderPPTX(content) {
  const base64 = extractBase64(content);  // 从 data URI 提取
  const resp = await fetch('http://localhost:3005/render-pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: base64 })
  });
  const result = await resp.json();
  // result.slides 是 base64 PNG 数组
  // 渲染: <img src="data:image/png;base64,${slide}">
}
```

## 服务代码模板

见 WSL 中的 `~/pptx-render-service/server.py`。

## 健康检查

该服务没有独立的 `/health` 端点。检测服务可用性用端口连通性：

```bash
curl -s --max-time 2 http://localhost:3005/ > /dev/null 2>&1
```

任何 HTTP 响应（包括 4xx/5xx）都说明服务在运行。

## restore-hermes.sh 注册

```bash
echo "[4/4] 启动 PPTX 渲染服务 (端口 3005)..."
if pgrep -f "pptx-render-service/server.py" > /dev/null; then
    echo "  ✓ 已在运行"
else
    nohup python3 ~/pptx-render-service/server.py > /dev/null 2>&1 &
    sleep 2
    # 没有 /health 端点，用端口检测替代
    if curl -s --max-time 2 http://localhost:3005/ > /dev/null 2>&1; then
        echo "  ✓ PPTX 渲染服务启动成功"
    else
        echo "  ✗ PPTX 渲染服务启动失败（可能是启动较慢，请稍后手动检查）"
    fi
fi
```

## 已占用端口速查

| 端口 | 服务 | 运行位置 |
|------|------|----------|
| 3001 | Morgana 后端（Express） | Windows 宿主 |
| 3002 | Morgana 页面 HTTP 服务（python http.server） | WSL |
| 3005 | PPTX 渲染服务 | WSL |
| 3306 | MariaDB | Windows 宿主 |
| 5173 | Morgana 前端（Vite dev server） | WSL |
| 8899 | Hermes API Server | WSL |
| 9099 | Hermes 搜索代理 | WSL |
| 9119 | Hermes Web Dashboard | WSL |
