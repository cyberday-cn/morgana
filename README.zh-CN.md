# Morgana（蜃楼）

[English](README.md) | [简体中文](README.zh-CN.md)

---

## 1. 核心理念

### 1.1 什么是 Morgana

Morgana 是一个 **AI 驱动、Spec 驱动的动态应用框架**，同时也是**自生长的用户端产品**。它的核心主张是：业务人员不必写代码，通过自然语言对话即可让 Agent 自动生成可用、可演进的业务应用。

#### 双重视角

- **作为框架**：Morgana 提供 NL（自然语言）和 UI（图形界面）两个对等的核心交互模块，自身不携带任何业务属性。业务能力由 AI Agent + 能力单元配置注入，因此可以承载任意领域的管理系统、看板、数据工具等。
- **作为产品**：面向业务人员（非开发者），用户与 Agent 用自然语言共同产出 Spec（应用规格说明），Morgana 依据 Spec 自动生成业务界面、数据模型和技能。产品随业务变化持续生长，而非一次性交付。

#### 工作方式

1. **对话驱动**：用户在 NL 模块与 Agent 对话，如"我想管理客户信息"，Agent 追问澄清（字段、关系、流程），逐步收敛需求。
2. **Spec 即源码**：对话产出结构化的 Spec（应用名称、数据模型、页面、操作、技能）。Spec 是唯一真相来源，界面、数据表、技能均由它推导。
3. **自动生成**：Agent 依据 Spec 生成 HTML 页面（写入页面服务目录）、建数据表（MariaDB）、按需加载技能，用户在 UI 模块直接使用。

#### 页面体系

Morgana 的 UI 模块管理两类页面，形成"从对话到使用"的完整闭环：

| 类型 | 来源 | 生命周期 |
|------|------|----------|
| 涌现页 | Agent 按对话需求实时生成（跟随对话，唯一） | 由 Agent 回复自动触发，临时性、随对话存在 |
| 固定页 | 用户创建，由 Spec 定义（关联 DB 表） | 持久化，可排序/重命名/分享 |

#### 能力单元层

Agent 生成页面时，可组合以下能力单元，让页面具备真实业务能力而非静态展示：

- **Morgana SDK（浏览器端）**：页面内直接执行数据库 CRUD（`Morgana.query/insert/update/delete`），无需自建中间层 API。
- **业务技能（Skills）**：Agent 的可复用行为规则知识库（如看板拖拽、树形渲染、日期处理、PPT 生成等），按需注入。
- **数据工具**：Agent 经后端 SDK 接口访问 MariaDB 数据，进行查询与变更。
- **外部 API / 文件附件**：上传文件存入共享 tmpfile 目录，Agent 以文件路径读取（含图片走视觉模型）；分享/截图/PPTX 渲染等能力由后端提供。

#### 感知联动

Agent 对 UI 具备结构化感知能力：页面状态镜像到 Agent 上下文（UI State Mirror）、用户操作以事件流上报（UI Event Stream）、Agent 可执行行动协议与页面交互（Action Protocol）。用户在 UI 上的筛选、点击、提交，Agent 都能感知并主动响应，实现"UI 上操作 → 对话中解释 → 数据联动"的完整闭环。

#### 当前落地形态

- **后端**：Express + TypeScript，提供任务/对话/文件/页面/分享/基础设施等 REST + SSE 接口。
- **前端**：Vite + React 18 + TypeScript，NL 模块（对话）与 UI 模块（页面）通过 Layout Engine 编排。
- **AI Agent**：当前对接本地 Hermes（OpenAI-compatible Chat Completions API），Agent 配置持久化于 MariaDB。
- **数据层**：MariaDB（业务数据 + 页面元数据 + Agent 配置），页面文件与上传文件以文件系统存储。

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **Spec 驱动** | 所有业务界面、技能、数据模型由 Spec 描述，Spec 是唯一真相来源 |
| **双模块对等** | NL 和 UI 是独立对等的模块，通过 Agent 协调，而非互相嵌入 |
| **用户主权** | 固定页面的增删改权在业务管理员手中，Agent 不可擅自修改 |
| **感知联动** | Agent 对 UI 的状态和操作有结构化感知能力，实现完整闭环 |
| **媒介无关** | 布局可插拔，适应桌面、平板、手机、穿戴设备等不同形态 |

---

## 2. 整体架构

```
┌───────────────────────────────────────────────────────────────┐
│                         Layout Engine                          │
│              (布局编排：混合 / 对话 / UI 三种模式)              │
├───────────────────────────┬───────────────────────────────────┤
│                           │                                   │
│   NL 模块                 │   UI 模块                          │
│                           │                                   │
│  ┌─────────────────────┐  │  ┌───────────────────────────┐   │
│  │ 侧边栏 (Sidebar)     │  │  │ 页面切换栏 (PageTabs)     │   │
│  │ 展开: tab按钮+任务列表│  │  │ [涌现] [固定页面..] [编辑]│   │
│  │ 收起: 三段手风琴      │  │  └───────────────────────────┘   │
│  │ (chat/config/page)   │  │                                   │
│  │ ─                    │  │  ┌───────────────────────────┐   │
│  │ 模式切换             │  │  │ 页面内容 (PageContent)     │   │
│  │ ─                    │  │  │                           │   │
│  │ 账户 / 设置 / 主题   │  │  │ 涌现页面: iframe → pages   │   │
│  ├─────────────────────┤  │  │ 固定页面: iframe → file    │   │
│  │ (Markdown 渲染)      │  │  └───────────────────────────┘   │
│  │                      │  │                                   │
│  │ 用户 ↔ Agent 流式对话 │  │  ┌───────────────────────────┐   │
│  │                      │  │  │ 快捷对话弹窗 (UI模式)     │   │
│  └─────────────────────┘  │  └───────────────────────────┘   │
│                           │                                   │
│  ┌─────────────────────┐  │                                   │
│  │ 输入区域 (ChatInput)  │  │                                   │
│  │ [输入框 + 附件上传]   │  │                                   │
│  └─────────────────────┘  │                                   │
└───────────────────────────┴───────────────────────────────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                       AI Agent                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │  POST /v1/chat/completions (流式 / 非流式)             │    │
│  │  本地 Hermes，端点 http://127.0.0.1:8899/...          │    │
│  └───────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                    能力单元层                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │业务技能  │  │数据工具  │  │外部API   │  │  Morgana SDK │  │
│  │(Skills)  │  │(DB操作)  │  │(集成)    │  │ (浏览器端)   │  │
│  │          │  │          │  │          │  │ submit/query │  │
│  │          │  │          │  │          │  │ insert/     │  │
│  │          │  │          │  │          │  │ update/delete│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
└───────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                   后端服务 (Express + TypeScript)               │
│                                                               │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ agent-config│  │ tasks    │  │ chat     │  │ files      │  │
│  │ (CRUD)     │  │ (CRUD)   │  │ (stream/ │  │ (upload/   │  │
│  │            │  │          │  │  complet- │  │  download) │  │
│  │            │  │          │  │  ions)    │  │            │  │
│  └────────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                                               │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ pages      │  │ sdk      │  │ infras-  │  │ share      │  │
│  │ (CRUD/图标/ │  │ (morgana │  │ tructure │  │ (分享/截图) │  │
│  │ 重命名/排序) │  │  .js +   │  │ (config/ │  │            │  │
│  │            │  │  db/     │  │  events) │  ├────────────┤  │
│  │            │  │  query/  │  │          │  │ render-pptx│  │
│  │            │  │  execute)│  │          │  │ (PPT渲染)  │  │
│  └────────────┘  └──────────┘  └──────────┘  └────────────┘  │
└───────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                   MySQL 数据库                                 │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ agent_configs │ tasks (type/page_id) │ messages        │    │
│  │ pages         │ file_attachments                      │    │
│  │ (icon/sort_   │ (original_name/                       │    │
│  │  order/share_ │  stored_name/mime)                    │    │
│  │  token)       │                                       │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ 文件存储：tmpfile/（共享目录，Agent 经 WSL 路径读取）    │    │
│  │ 页面存储：PAGES_ROOT/（page_<id>.html + index.html）    │    │
│  └───────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. 布局系统 (Layout Engine)

### 3.1 布局模式

NL 模块和 UI 模块通过 Layout Engine 编排到桌面端，支持三种布局模式。

| 模式 | 名称 | 布局 | 侧边栏状态 | NL 模块宽度 | 适用场景 |
|------|------|------|------------|-------------|----------|
| `split` | 混合模式 | [NL 模块 + 可拖拽分隔条 + UI 模块] | 保持当前（默认收起） | 480px+（可拖拽调整） | 日常工作 |
| `nl-focus` | 对话模式 | [NL 全屏 + UI 窄条] | 自动展开（280px） | 自适应（flex: 1） | 配置/头脑风暴 |
| `ui-focus` | UI 模式 | [侧边栏 + UI 全屏 + 💬 浮动按钮] | 自动收起（48px） | 浮动按钮/弹窗 | 数据查看/操作 |

### 3.2 NL 模块布局

**对话模式（nl-focus）**：
- 聊天历史：`width: 100%`，左右 24px padding，覆盖整个对话区域
- 输入框：`max-width: 720px; margin: 0 auto` 居中，不占满全宽

**混合模式（split）**：
- NL 模块固定宽度（默认 480px，可通过拖拽分隔条调整）
- 聊天历史：左右 24px padding
- 输入框：左右 24px padding

### 3.3 侧边栏行为

- 可折叠/展开（48px ↔ 280px）
- **展开状态**：
  - Logo + "Morgana" 标题
  - 选项卡行：[任务(文字)] [spacer] [⚙️(图标)] [📄(图标)] [+ 新建按钮]
  - 根据当前选中的选项卡（chat/config/page）过滤显示对应类型的任务列表
  - 每个任务项显示：首字符图标 + 标题 + 时间标记
  - 选中任务显示重命名/删除按钮
- **收起状态**：
  - 三段式手风琴（accordion）布局
  - 三个子列表垂直堆叠：chat（+图标）、config（⚙️图标）、page（📄图标）
  - 同一时间仅一个子列表展开，展开区域 flex: 1 占满剩余空间
  - chat 子列表的 "+" 图标：当前在 chat 列表时创建新任务，在其他列表时切换到 chat 列表
- 模式切换时自动调整侧边栏状态：
  - 切换到对话模式 → 侧边栏展开
  - 切换到 UI 模式 → 侧边栏收起
  - 切换到混合模式 → 保持当前状态
- **设置菜单**：点击"设置"按钮展开二级菜单，包含"主题风格"和"Agent 配置"两个选项
  - 展开状态时菜单向下弹出
  - 收起状态时菜单向右侧弹出

---

## 4. NL 模块详述

### 4.1 对话管理

NL 模块以**任务（Task）** 为单位管理对话，每个任务包含一轮或多轮对话。

**任务类型**：
| 类型 | 用途 | 来源 |
|------|------|------|
| `chat` | 普通对话任务 | 用户点击 "+" 或自动创建 |
| `config` | 基础设施初始化任务 | 系统自动创建 |
| `page` | 固定页面关联任务 | 创建固定页面时自动创建 |

**任务生命周期**：
1. 用户点击 "+" 或发送第一条消息时自动创建任务（默认标题"新对话"）
2. 用户在任务中与 Agent 进行多轮对话
3. 首轮对话完成后，后台自动生成标题（5-12 字总结）
4. 任务可重命名（双击标题内联编辑）、删除

**任务列表**：
- 按类型分组显示：任务（chat）、配置（config）、页面（page）
- 各分组内按最后消息时间降序排列
- 每个任务项显示时间标记（今天显示时间、昨天显示"昨天"、更早显示月/日）
- 点击任务加载对应对话历史
- 选中任务显示重命名和删除按钮

### 4.2 对话流

#### 4.2.1 发送消息

1. 用户输入文本 → 按 Enter 或点击发送按钮
2. 如有待上传文件，先上传获取 fileId
3. 前端调用 `POST /api/chat/stream`，body: `{ taskId, message, fileIds, chatAgentId? }`
4. 后端返回 SSE 流：

```
data: {"type":"user_message","id":1}

data: {"type":"chunk","content":"回复片段"}

data: {"type":"done","message":{...},"task_title":"（可选）"}

-- 或（首轮对话，标题生成后）--
data: {"type":"task_renamed","task_title":"新标题"}
```

#### 4.2.2 SSE 事件类型

| 事件类型 | 触发时机 | 前端响应 |
|----------|----------|----------|
| `user_message` | 用户消息保存到 DB | 重新加载当前任务消息列表 |
| `init_started` | 初始化任务开始 | 存储 initTaskInfo |
| `chunk` | Agent 流式输出片段 | 追加到 `streamingContent`，实时 Markdown 渲染 |
| `thinking` | Agent 推理过程 / 心跳（3秒间隔） | 显示思考状态 |
| `done` | Agent 回复完成 | 消息加入列表，清空流转内容；触发页面生成 |
| `task_renamed` | 首轮对话标题生成完毕 | 立即更新任务列表标题 |
| `error` | 处理出错 | 显示错误信息 |

#### 4.2.3 首轮标题生成

- 仅在消息总数 ≤ 2 时触发（即首轮用户+Agent）
- 将首轮 Agent 回复与用户问题发送给 Agent API 生成 4-10 字标题
- 返回标题通过 `task_renamed` 事件推送给前端
- 失败时降级为本地提取（取首句，最长 20 字符）

### 4.3 消息展示

**用户消息**：纯文本，按段落分隔。

**Agent 消息**：通过 `marked` 库将 Markdown 渲染为 HTML，支持：
- 标题（h1-h4）、段落、换行
- 粗体、斜体、内联代码、代码块（带等宽字体）
- 有序/无序列表
- 引用块
- 表格
- 链接、图片
- 水平线

**流式输出**：流式内容也实时经过 Markdown 渲染，右侧显示闪烁光标 `▍` 表示仍在输出。

### 4.4 附件上传

- 支持通过输入框附件按钮选择文件，暂存为 `pendingFiles`，发送消息时一并上传
- 上传到 `POST /api/files/upload`，返回 fileId，绑定到用户消息
- 文件存储到**共享临时目录** `tmpfile/`（`config.tmpfile.dir`，默认 `morgana/tmpfile/`，UUID 文件名保留扩展名）
- **文件读取策略**：Morgana 不读取/内联文件内容，而是在消息尾部追加 `[附件文件]` 块，列出每个文件的原名 + MIME 类型 + **WSL 路径**（`D:\…` → `/mnt/d/…`），由 Agent 用自己的文件系统工具读取，进而自动选择合适模型（含视觉模型）
- **中文文件名**：上传时通过 iconv-lite 做编码修复（UTF-8 优先，GBK/CP936 兜底），对话历史正常显示中文名；下载使用 RFC 5987 `filename*=UTF-8''…` 编码
- **对话历史展示**：图片显示缩略图（`/uploads/<stored_name>`），其他文件显示文件名 + 大小 chip
- **清理机制**：删除任务时，自动删除该任务所有上传文件的磁盘文件并清理 `file_attachments` 记录

### 4.5 UI 模式快捷对话

- UI 模式下，NL 模块显示为浮动按钮（侧边栏右侧）
- 点击展开快捷对话弹窗（400px 宽，80vh 高）
- 弹窗包含完整的对话功能：消息列表、文本输入、附件上传
- 弹窗跟随 UI 内容区移动（侧边栏展开时自动右移）

---

## 5. UI 模块

### 5.1 职责

UI 模块是业务数据和操作的图形化呈现界面。

- 渲染涌现页面（interact）和固定业务页面
- 提供页面切换导航（PageTabs）
- 响应用户的 UI 操作并上报事件给 Agent
- 接收 Agent 指令更新自身状态
- UI 模式下提供快捷对话入口

### 5.2 页面类型

| 类型 | 主权方 | 生命周期 | 特点 |
|------|--------|----------|------|
| 涌现页面 | 系统 | 跟随对话 | 唯一，由 Agent 回复自动触发生成 |
| 固定页面 | 业务管理员 | 持久 | 由 Spec 定义，用户创建/修改/删除，关联 DB 表 |

### 5.3 页面切换栏 (PageTabs)

位于 UI 模块顶部，44px 高度。

**结构**：
- 左侧：固定页面 tab（emoji 图标 + 名称）
  - "涌现"页面固定排列第一（不可删除、不可拖拽）
  - 其他固定页面可通过编辑模式拖拽排序
- 右侧：编辑按钮

**emoji 图标（AI 语义匹配）**：
- 固定页面创建后，后台调用 Agent（Hermes）按页面名称语义匹配最合适的 emoji 图标（如"画画"→🎨、"大象"→🐘）
- 前端轮询 `GET /api/pages` 获取更新后的图标（3s 首查 + 4s × 5 次）
- Hermes 调用失败时降级为默认图标 📄
- 端点使用 `127.0.0.1`（避免 Windows IPv6 解析问题），超时 30s（覆盖冷启动）

**编辑模式**：
- 点击"编辑"按钮进入编辑模式
- 可拖拽排序、双击重命名、删除固定页面
- 点击"+"按钮创建新固定页面（输入名称回车提交）
- 点击"保存"退出编辑模式
- 重命名和排序**实时持久化到后端**：`PUT /api/pages/:id/rename`、`PUT /api/pages/:id/reorder`（`sort_order` 列）

**页面与服务绑定**：
- 固定页面创建时自动关联一个 `page` 类型任务，任务标题保持页面名称（不进行 AI 重命名）
- 页面内容存储在页面根目录 `PAGES_ROOT/` 下：`page_<id>.html`
- 页面服务运行在可配置的 HTTP 端口（默认 3002）

### 5.4 页面内容 (PageContent)

**涌现页面**（interact）：
- 通过 iframe 加载 `http://localhost:{pagesPort}/?t={cacheBuster}`
- 右上角浮动刷新按钮（旋转箭头图标）
- 加载中显示"加载页面中..."提示
- Agent 回复后自动触发页面生成 → SSE 通知刷新 iframe
- 用户可点击"生成页面"按钮手动触发

**固定页面**：
- 通过 iframe 加载 `http://localhost:{pagesPort}/page_{id}.html?t={cacheBuster}`
- 未加载时显示页面名称 + "页面内容由 Agent 动态生成"占位提示
- 右上角浮动刷新按钮 + 分享按钮

### 5.5 页面分享

固定页面和涌现页面可分享给外部用户查看（SharePopover）：

- 固定页面通过**混淆 share_token**（16 字节随机 hex，不可猜测的 URL）：`http://<LAN-IP>:3001/api/share/page/<token>`
- 涌现页面生成实时链接：`http://<LAN-IP>:3002/?t=<cacheBuster>`
- LAN IP 由 `GET /api/share/external-ip` 返回（自动探测 10.x.x.x 网段）
- 分享页面服务会把 `localhost` 后端地址改写为 LAN IP，保证页面内 Morgana SDK 跨机器可用
- 页面分享支持**整页截图下载**（Puppeteer 无头浏览器全页 PNG）：`POST /api/share/screenshot`
- 前端页面工具条提供「分享页面」按钮，弹出分享面板复制链接

### 5.6 表单交互

Agent 生成的 HTML 页面可通过 Morgana JS SDK 实现表单提交与数据库操作。

**数据流**：
```
Agent 生成 HTML（含表单 + 引用 Morgana SDK）
  → 用户填写提交
  → SDK 调用 parent.postMessage({ type: 'user_input', data: {...} }, '*')
  → PageContent 的 message 事件监听器收到
  → 格式化为 "[表单提交]" 标记的用户消息文本
  → 调用 sendMessage() → POST /chat/stream → Agent 继续对话
```

**Morgana JS SDK**（`GET /api/sdk/morgana.js`）：
- `Morgana.submit(data)` — 表单提交，通过 postMessage 回传数据
- `Morgana.query(sql, params)` — SELECT 查询
- `Morgana.insert(sql, params)` — INSERT 插入，返回 `{ insertId, affectedRows }`
- `Morgana.update(sql, params)` — UPDATE 更新，返回 `{ affectedRows }`
- `Morgana.delete(sql, params)` — DELETE 删除，返回 `{ affectedRows }`

### 5.7 快捷对话

- 浮动按钮位于 UI 内容区左下角（侧边栏右侧），点击展开快捷聊天窗口
- 快捷聊天窗口高度为 UI 内容区的 80%，宽度 400px
- 窗口包含标题栏、消息区域、文本输入框
- 按钮和弹窗跟随 UI 内容区域移动（侧边栏展开时自动右移）

---

## 6. AI Agent

Agent 是 Morgana 的智能核心，连接 NL 模块、UI 模块和能力单元。

### 6.1 对接方式

Morgana 通过 **OpenAI-compatible Chat Completions API** 对接外部 AI Agent（本地 Hermes）：

- **流式模式**（默认）：`POST /v1/chat/completions` with `stream: true`，前端通过 SSE 实时接收
- **非流式模式**：`POST /v1/chat/completions` with `stream: false`（标题生成、emoji 选择等后台任务）
- **当前 Agent**：本地 Hermes（API Server 协议），端点 `http://localhost:8899/v1/chat/completions`
- **连接说明**：Windows 下 `localhost` 解析为 IPv6 `[::1]` 会导致连接失败，需使用 `127.0.0.1`；后台任务（标题/图标）超时 30~45s 覆盖模型冷启动

### 6.2 Agent 配置管理

用户可通过侧边栏「设置 → Agent 配置」对话框配置对接参数。

**配置字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| 名称 | string | Agent 配置的标识名称 |
| 协议类型 | enum | `acp` 或 `api-server` |
| 端点地址 | string | Agent 服务的完整 URL |
| API Key | string? | 可选的认证密钥 |
| 描述 | string? | 配置说明 |
| 是否激活 | boolean | 当前使用的 Agent（仅一个可激活） |
| 已初始化 | boolean | 基础设施初始化状态 |
| 初始化提示词 | string? | 自定义初始化 System Prompt |
| 对话提示词 | string? | 自定义对话 System Prompt |
| 页面提示词 | string? | 自定义固定页面生成 System Prompt |
| 涌现提示词 | string? | 自定义涌现页面生成 System Prompt |

**System Prompt 体系**：
| 层级 | 用途 | 优先级 |
|------|------|--------|
| `init_prompt` | 初始化阶段（搭建页面服务） | 自定义 > 内置默认值 |
| `chat_prompt` | 普通对话（Agent 回复） | 自定义 + 环境配置 > 仅环境配置 |
| `page_prompt` | 固定页面生成（page 类型任务触发） | 自定义 + 环境配置 > 仅环境配置 |
| `emerge_prompt` | 涌现页面生成（按钮/自动触发） | 自定义 > 聊天提示词 > 内置默认值 |

**Chat System Prompt 环境配置包含**：
- 页面服务端口
- 页面刷新回调接口（`GET /api/infrastructure/refresh`）
- Morgana JS SDK 地址

### 6.3 核心能力

#### 意图理解
将用户的自然语言输入解析为结构化意图，决定下一步行动。

#### 模态仲裁
根据当前场景判断交互形态：
- 查看/浏览型 → UI 主导
- 输入/配置型 → UI 主导（表单）
- 模糊探索型 → NL 主导
- 操作/确认型 → NL + 轻量 UI

#### Spec 编译器
与用户对话共同产出 Spec，然后：
1. 生成 UI 页面（页面结构和布局 Schema）
2. 生成 Skills（业务操作工具集）
3. 生成数据库表结构（如需要）

#### UI 感知与控制
详见第 8 节「感知联动协议」。

### 6.4 初始化流程

1. 用户激活一个 Agent 配置
2. 点击"初始化"按钮创建初始化任务（`type: config`）
3. 后端发送 `init_prompt` 或内置默认初始化提示词给 Agent
4. Agent 搭建页面服务（HTTP 服务、目录结构、测试页面）
5. Agent 调用 `PUT /api/infrastructure/config` 回传页面配置（或调用 `GET /api/infrastructure/refresh` 仅触发刷新）
6. 后端广播 `page_refresh` SSE 事件 → 前端刷新 iframe
7. 初始化完成后标记 `initialized: true`

### 6.5 页面生成流程

**涌现页面（chat 任务）**：
1. Agent 回复结束后，前端自动调用 `POST /api/chat/generate-page`（或用户点击"生成页面"按钮）
2. 后端将对话上下文发给 Agent（使用 emerge_prompt/chat_prompt），触发页面生成
3. Agent 写入 `pages/` 目录下的 `index.html`
4. Agent 调用 `GET /api/infrastructure/refresh` → 后端广播 `page_refresh` SSE 事件 → 前端 reload iframe
5. 支持取消（取消时设置 `_skipNextPageRefresh = true`，抑制 12s 内的刷新事件）

**固定页面（page 任务）**：
1. 对话在关联了固定页面的 `page` 类型任务中进行
2. System Prompt 注入固定页面文件名（`page_<id>.html`）
3. Agent 生成页面内容并写入 `page_<id>.html`
4. Agent 调用刷新回调通知前端加载
5. 任务标题始终等于页面名称（page 类型任务不调用 Hermes 生成标题，避免与页面重名产生歧义）

---

## 7. Spec 语言

### 7.1 定位

Spec 是 Morgana 的"唯一真相来源"。它由用户与 Agent 共同产出，一个 App 一个 Spec。

### 7.2 格式

Spec 使用 **Markdown 格式**，结构化描述应用的全部业务内容。

### 7.3 结构草案

```markdown
# {应用名称}

## 数据模型

### {模型名称}
- {字段名}: {类型} [{约束}]
  - e.g. 姓名: string [required]
  - e.g. 创建时间: datetime [auto]

## 页面

### {页面名称} [{类型}]
- 类型: table | form | chart | kanban | custom
- 数据来源: {数据模型}

#### 布局
{页面的布局描述}

#### 操作
- {操作名称}: {触发条件} → {执行技能}

## 技能

### {技能名称}
- 触发: "{自然语言触发词}"
- 描述: {技能说明}
- 动作: {数据工具调用}
```

> **注**：Spec 的精确格式将在后续迭代中确定，当前为概念草案。

---

## 8. 感知联动协议

Agent 与 UI 模块之间通过三条结构化通道通信。

### 8.1 UI State Mirror（状态镜像）

UI 模块维护一个结构化的语义状态树，Agent 可随时读取。

```json
{
  "currentPage": "客户列表",
  "pages": {
    "客户列表": {
      "type": "table",
      "dataSummary": { "rows": 25, "selectedId": "张三" },
      "state": { "filters": { "等级": "VIP" }, "sort": "创建时间 desc" }
    }
  }
}
```

- 状态是**语义化的**，而非像素/DOM 级别
- Agent 通过此通道了解 UI "正在发生什么"

### 8.2 UI Event Stream（事件流）

用户在 UI 上的操作以结构化事件推送给 Agent。

```json
{
  "type": "row_select | filter_change | sort_change | chart_click | page_switch | button_click",
  "source": "客户列表",
  "payload": { "...": "..." },
  "timestamp": "2026-06-11T10:30:00Z"
}
```

Agent 收到事件后可即时响应（通过 NL 模块输出或 Action Protocol 操作 UI）。

### 8.3 Action Protocol（行动协议）

Agent 通过结构化指令操控 UI。

| 指令 | 参数 | 效果 |
|------|------|------|
| `navigate` | page, params | 切换到指定页面，预加载数据 |
| `updateComponent` | page, state | 局部刷新组件状态（筛选/数据/排序） |
| `notify` | message, level | 显示通知提示 |
| `confirm` | message | 弹出确认对话框 |
| `refresh` | page | 刷新页面数据 |

### 8.4 数据层共享

UI 展示的数据来自 Data Context——Agent 管理的共享数据空间：

```
Agent 查询 → Data Context → UI 渲染层读取 → 显示
                                  ↑
用户操作 → Event Stream → Agent感知 → 重新查询 → 更新 Data Context
```

---

## 9. 数据层

### 9.1 分层存储

```
┌─────────────────────────────────┐
│ Agent 短期记忆                    │
│ (会话上下文，会话结束后消失)        │
├─────────────────────────────────┤
│ Agent 工作记忆                    │
│ (向量数据库 / RAG)               │
├─────────────────────────────────┤
│ 业务持久化存储                     │
│ (关系型数据库，由 Spec 定义结构)    │
└─────────────────────────────────┘
```

### 9.2 后端服务

Morgana 后端是一个 Express + TypeScript 服务，提供 REST API。

**后端项目结构**：
```
backend/
  config/
    default.json              # 配置文件（数据库、服务器端口、共享临时目录）
  tmpfile/                    # 共享临时文件目录（Windows 与 Hermes/WSL 共用）
  src/
    index.ts                  # 入口，Express 服务器启动
    config.ts                 # 配置加载器（支持环境变量覆盖）
    db.ts                     # MySQL 连接池 + 自动建表 + 安全迁移
    routes/
      agent-config.ts         # Agent 配置 CRUD + 激活 + 初始化 + 默认提示词
      tasks.ts                # 任务 CRUD（支持 type/pageId）+ 消息加载
      chat.ts                 # 聊天代理（流式/非流式/Runs）+ 页面生成
      files.ts                # 文件上传/下载（存入共享 tmpfile 目录）
      pages.ts                # 固定页面 CRUD + 重命名/排序/分享令牌 + emoji 语义匹配
      share.ts                # 页面分享（LAN IP 检测、Puppeteer 截图、分享页服务）
      render-pptx.ts          # PPTX 渲染（LibreOffice headless → PNG base64）
      sdk.ts                  # Morgana JS SDK + 数据库 query/execute 端点
      infrastructure.ts       # 基础设施配置获取/更新 + SSE 事件流 + 页面刷新
    services/
      chat-proxy.ts           # Agent 代理服务（4 种 system prompt 构建、流式转发、
                              # 标题生成、页面生成触发、取消、刷新抑制、附件路径注入）
```

**API 路由一览**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/agent-configs | Agent 配置列表 |
| POST | /api/agent-configs | 新建 Agent 配置 |
| GET | /api/agent-configs/:id | 获取单个配置 |
| PUT | /api/agent-configs/:id | 更新 Agent 配置 |
| DELETE | /api/agent-configs/:id | 删除 Agent 配置 |
| POST | /api/agent-configs/:id/activate | 激活 Agent 配置 |
| POST | /api/agent-configs/:id/init | 初始化 Agent（创建 init task） |
| POST | /api/agent-configs/:id/init-complete | 标记初始化完成（Agent 回调） |
| GET | /api/agent-configs/:id/default-init-prompt | 获取默认初始化提示词 |
| GET | /api/agent-configs/:id/default-chat-prompt | 获取默认对话提示词 |
| GET | /api/agent-configs/:id/default-page-prompt | 获取默认页面提示词 |
| GET | /api/agent-configs/:id/default-emerge-prompt | 获取默认涌现提示词 |
| GET | /api/tasks | 任务列表（含 last_message_at、按 type 排序） |
| POST | /api/tasks | 创建任务（支持 type/pageId） |
| GET | /api/tasks/:id | 获取单个任务 |
| PUT | /api/tasks/:id | 更新任务标题 |
| DELETE | /api/tasks/:id | 删除任务（级联删除消息） |
| GET | /api/tasks/:id/messages | 获取任务消息列表 |
| POST | /api/chat/stream | 流式聊天（SSE，支持 chatAgentId/initAgentId） |
| POST | /api/chat/completions | 非流式聊天（legacy） |
| POST | /api/chat/run | Runs API 模式（legacy，当前不采用） |
| POST | /api/chat/generate-page | 触发涌现页面生成（fire-and-forget） |
| POST | /api/chat/generate-page/cancel | 取消页面生成 |
| POST | /api/files/upload | 上传文件（multipart，存入共享 tmpfile 目录） |
| GET | /api/files/:id | 预览文件（内联返回） |
| GET | /api/files/:id/download | 下载文件（保留原始文件名，RFC 5987 编码） |
| GET | /api/pages | 页面列表（按 sort_order 排序） |
| POST | /api/pages | 创建固定页面（自动创建关联任务、页面文件、分享令牌，后台 Hermes 匹配 emoji） |
| PUT | /api/pages/:id/rename | 重命名页面 |
| PUT | /api/pages/:id/reorder | 调整页面排序（更新 sort_order） |
| GET | /api/pages/:id/share-token | 获取页面分享令牌 |
| PUT | /api/pages/migrate-icons | 批量用 Hermes 语义匹配重建所有页面 emoji 图标 |
| DELETE | /api/pages/:id | 删除页面（同时删除页面文件并级联删除关联任务） |
| GET | /api/share/external-ip | 获取局域网 IP（10.x.x.x）用于构造分享链接 |
| POST | /api/share/screenshot | Puppeteer 全页截图（返回 PNG base64 + 页面标题） |
| GET | /api/share/page/:token | 分享固定页面（按随机 share_token 查找，重写后端地址为局域网 IP） |
| POST | /api/render-pptx | 渲染 PPTX（接收 base64，LibreOffice 转 PNG，返回 slides 数组） |
| GET | /api/infrastructure/config | 获取基础设施配置 |
| PUT | /api/infrastructure/config | 更新基础设施配置（触发页面刷新广播） |
| GET | /api/infrastructure/refresh | 触发页面刷新（不修改配置，调用后广播 SSE） |
| GET | /api/infrastructure/events | SSE 事件流（页面刷新通知） |
| GET | /api/sdk/morgana.js | Morgana 浏览器端 SDK（submit/query/insert/update/delete） |
| POST | /api/sdk/db/query | SDK 数据库查询（仅 SELECT） |
| POST | /api/sdk/db/execute | SDK 数据库执行（INSERT/UPDATE/DELETE） |
| GET | /api/health | 健康检查 |

### 9.3 配置文件

数据库和服务器的配置信息存储在 `backend/config/default.json` 中：

```json
{
  "server": { "port": 3001 },
  "db": {
    "host": "localhost",
    "port": 3306,
    "database": "morgana",
    "user": "root",
    "password": ""
  },
  "pages": {
    "root": "./pages",
    "port": 3002
  },
  "tmpfile": {
    "dir": ""
  }
}
```

支持通过环境变量覆盖：

| 配置项 | 环境变量 | 默认值 |
|--------|----------|--------|
| `server.port` | `SERVER_PORT` | 3001 |
| `db.host` | `DB_HOST` | localhost |
| `db.port` | `DB_PORT` | 3306 |
| `db.database` | `DB_DATABASE` | morgana |
| `db.user` | `DB_USER` | root |
| `db.password` | `DB_PASSWORD` | (空) |
| `pages.root` | `PAGES_ROOT` | `./pages` |
| `pages.port` | `PAGES_PORT` | 3002 |
| `tmpfile.dir` | `TMPFILE_DIR` | `<项目根目录>/tmpfile`（Windows 与 Hermes/WSL 共享） |

基础设施配置可通过 `PUT /api/infrastructure/config` 动态更新（持久化到 `env.conf`）。

### 9.4 数据库表结构

**agent_configs**：Agent 连接配置

```sql
CREATE TABLE agent_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  protocol ENUM('acp', 'api-server') NOT NULL DEFAULT 'acp',
  endpoint VARCHAR(500) NOT NULL,
  api_key VARCHAR(500) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 0,
  initialized TINYINT(1) DEFAULT 0,
  init_prompt TEXT DEFAULT NULL,
  chat_prompt TEXT DEFAULT NULL,
  page_prompt TEXT DEFAULT NULL,
  emerge_prompt TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**tasks**：对话任务（含 type 和 page_id）

```sql
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  type ENUM('chat','config','page') DEFAULT 'chat',
  page_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**messages**：对话消息

```sql
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  role ENUM('user','agent') NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**pages**：固定页面元数据

```sql
CREATE TABLE pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  icon VARCHAR(50) DEFAULT '📄',
  task_id INT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  share_token VARCHAR(32) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
```

- `icon`：页面标签 emoji 图标，由 Hermes 按页面名称语义匹配生成（后台异步更新）
- `sort_order`：页面排序序号，拖拽排序后持久化
- `share_token`：随机 32 位 hex 分享令牌（16 字节），分享链接不可猜测

**file_attachments**：上传文件记录

```sql
CREATE TABLE file_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT DEFAULT NULL,
  original_name VARCHAR(500) NOT NULL,
  stored_name VARCHAR(200) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);
```

### 9.5 数据库访问原则

Agent **不直接执行原始 SQL**。Agent 通过 Morgana SDK 的数据库端点与数据库交互：

```
Agent 生成 HTML 页面 → 页面中的 JS 调用 Morgana.query/insert/update/delete
  → fetch http://localhost:3001/api/sdk/db/{query|execute}
  → 后端参数校验（query 仅 SELECT，execute 仅 INSERT/UPDATE/DELETE）
  → 执行 SQL → 返回结果
```

SDK 数据库端点内置 SQL 类型校验：
- `POST /api/sdk/db/query` — 仅接受 SELECT 语句
- `POST /api/sdk/db/execute` — 仅接受 INSERT / UPDATE / DELETE 语句

---

## 10. 设计系统

### 10.1 主题系统

支持深色/浅色双主题，通过 `data-theme` 属性在 `<html>` 上切换。所有色彩定义为 CSS 自定义属性，主题切换时自动级联。

- **深色主题**：深灰底色（#0c0c14）搭配白色文字
- **浅色主题**：浅灰底色（#f4f5f7）搭配深色文字

### 10.2 色彩体系

- **强调色**：靛蓝（#6366f1），现代简洁
- **磨砂玻璃**：半透明背景叠加深色/浅色背景
- **层级**：`--bg-deep` → `--bg-surface` → `--bg-elevated`（由深到浅）
- **文字层级**：`--text-primary`（92%）→ `--text-secondary`（60%）→ `--text-tertiary`（30%）

### 10.3 组件样式

- **侧边栏**：圆角 6px，可折叠（48px/280px），磨砂玻璃 hover 效果
  - 展开态：tabs-row + 扁平任务列表
  - 收起态：三段手风琴（chat/config/page），仅展开当前选中部分
- **聊天气泡**：最大宽度 80%，Agent 气泡深色/白色背景，用户气泡靛蓝强调色
- **Markdown 内容**：代码块深色背景等宽字体，表格有边框，引用左侧竖线
- **流式输出**：右端闪烁光标 `▍`，内容实时 Markdown 渲染
- **页面标签**：44px 高度，图标 + 名称，选中态靛蓝强调
  - 涌现页面固定居左，不可删除/拖拽
  - 编辑模式下可拖拽排序、重命名、删除固定页面
- **固定页面容器**：相对定位，浮动刷新按钮（12px 图标，右上角）
- **涌现页面容器**：同固定页面，加载中显示"加载页面中..."
- **浮动按钮**：48px 圆形，靛蓝渐变，悬浮阴影
- **快捷对话框**：400px 宽，80vh 高，浮出动画，左下角弹出
- **动画**：`floatIn`、`fadeIn`、`slideIn` 三种 CSS 动画，ease-out 曲线
- **主题选择对话框（ThemeDialog）**：
  - 可选择不同主题风格（预设多组色板）
  - 深色/浅色模式独立切换
  - 实时生效，持久化至 localStorage

### 10.4 主题切换

- 通过设置菜单 → "主题风格"打开 ThemeDialog
- 侧边栏底部深色/浅色快捷切换按钮
- 切换时所有 CSS 变量即时生效，无需刷新
- 布局模式（`morgana-layout`）和主题偏好持久化到 localStorage

---

## 11. 前端项目结构

```
frontend/
  src/
    types/index.ts              # TypeScript 类型定义（TaskType, Page, FileAttachment, AgentConfig, InfrastructureConfig 等）
    theme/index.ts              # 主题定义（色板、预设主题列表）
    stores/
      useLayoutStore.ts         # 布局状态管理（模式、主题、配色方案）
      useNLStore.ts             # NL 模块状态管理（任务列表、消息、流式对话、页面生成）
      useUIStore.ts             # UI 模块状态管理（页面列表、选中页签、编辑模式、页面 CRUD、拖拽排序）
      useAgentStore.ts          # Agent 配置状态管理（configs CRUD、基础设施配置）
    components/
      layout/
        LayoutEngine.tsx         # 布局引擎（三种模式编排）
        DesktopSplit.tsx         # 桌面分栏模式（NL + UI 并排）
        NLFocus.tsx              # NL 聚焦模式
        UIFocus.tsx              # UI 聚焦模式
        NLModule.tsx             # NL 模块容器
      nl/
        ChatHistory.tsx          # 对话历史列表
        ChatMessage.tsx          # 单条消息（Markdown + 附件渲染 + 生成页面按钮）
        ChatInput.tsx            # 输入框 + 附件上传
        Sidebar.tsx              # 侧边栏（展开/收起、任务列表、模式切换、账户/设置）
        MarkdownRenderer.tsx     # Markdown 渲染组件
        AgentConfigDialog.tsx    # Agent 配置对话框（含 init/chat/page/emerge 四套提示词）
        ThemeDialog.tsx          # 主题选择对话框
      ui/
        UIModule.tsx             # UI 模块容器（PageTabs + PageContent）
        PageTabs.tsx             # 页面切换栏（涌现 + 固定页面 tabs + 编辑/重命名/排序/删除 + 分享按钮）
        PageContent.tsx          # 页面内容区域（涌现/固定页面 + iframe + postMessage 监听）
        SharePopover.tsx         # 页面分享弹层（获取 LAN IP、复制分享链接、截图预览）
        FloatingNLButton.tsx     # UI 模式浮动按钮
        QuickChatPopup.tsx       # 快捷对话弹窗
      common/
        Logo.tsx                 # 品牌 Logo 组件
    index.css                    # 全局样式（CSS 自定义属性、组件样式、主题变量）
```

---

## 12. 交互场景示例

### 场景：业务管理员创建一个客户管理系统

```
用户：我想管理客户信息
Agent：好的，客户需要哪些信息？
用户：姓名、电话、等级、来源、备注
Agent：了解。我建议加一个"创建时间"自动记录。
      确认后我将为你生成客户管理页面和数据表。
用户：可以
Agent：[生成 Spec → 生成 UI → 生成 DB 表]

用户现在看到客户列表页面，添加了几条数据。
几天后...

用户：再加一个"最近联系时间"字段
Agent：好的，进入编辑模式为你添加。
      [切换到编辑维护模式 → 用户确认 → 更新 Spec → 更新 UI]
```

### 场景：日常使用中的感知联动

```
用户在 UI 上点击了 VIP 筛选标签。

Event → Agent 感知到: { type: "filter_change", filter: {等级: "VIP"} }
Agent 推理: 用户想只看 VIP 客户
Agent 查询: query_records("customers", {等级: "VIP"})
Agent 更新 Data Context → UI 刷新
Agent 在 NL 模块说: "已筛选出 15 位 VIP 客户"
```

### 场景：Agent 通过表单收集信息

```
用户：帮我分析销售数据
Agent：好的，我需要一些信息来定制分析。让我生成一个表单页面。

[Agent 生成含表单的 HTML 页面，引用 Morgana SDK]
页面中有：时间范围选择器、分析维度、图表类型选择

用户：选择"2026年1-6月"、"按产品类别"、"柱状图" → 提交

[表单数据通过 postMessage 回传到对话]
对话中出现：[表单提交]
时间范围：2026年1-6月
分析维度：按产品类别
图表类型：柱状图

Agent：好的，这是 2026 年上半年各产品类别的销售分析...

[Agent 同时生成展示分析结果的页面]
```

---

## 13. 未定事项（待后续讨论）

1. **多租户/多用户** — 一个 Morgana 实例是否支持多个用户的独立数据？权限模型与数据隔离如何设计？
2. **安全性** — 权限模型、数据隔离、Agent 行为边界（当前分享链接使用随机 share_token 防猜测，权限控制尚未细化）
