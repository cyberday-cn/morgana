╔══════════════════════════════════════════════════════════════╗
║                   Morgana（蜃楼）系统配置                      ║
║                    最后更新：2026-08-05                       ║
╚══════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. 启动方式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  所有脚本提供 .sh（跨平台）和 .bat（Windows 可直接双击）两种格式。
  Windows 可直接双击 .bat 文件运行，或通过 Git Bash 执行 .sh 脚本。

  ┌──────────────────────────────────────────────────────┐
  │  一键启停（前后端，不含数据库）：                      │
  │    Windows:    startup\start-all.bat                 │
  │    Git Bash:   bash startup/start-all.sh             │
  │    Linux/Mac:  bash startup/start-all.sh             │
  │                                                      │
  │  数据库独立启停：                                     │
  │    Windows:    startup\start-mariadb.bat              │
  │    Git Bash:   bash startup/start-mariadb.sh          │
  │    Linux/Mac:  bash startup/start-mariadb.sh          │
  │                                                      │
  │  所有配置统一在 startup/env.conf 中管理，              │
  │  修改后重启系统生效。                                 │
  │  优先级：环境变量 > env.conf > backend/config/default.json│
  └──────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 前端（Frontend）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  框架：    Vite + React 18 + TypeScript
  技术栈：  Zustand（状态管理）、Lucide React（图标）
  端口：    5173（在 startup\env.conf 中配置，默认 5173）
  URL：     http://localhost:5173/
  目录：    D:\学习\ClaudeCode\morgana\frontend
  启动：    cd frontend && npm run dev
  配置：    startup\env.conf → FRONTEND_PORT
  页面刷新：通过 SSE 订阅 GET /api/infrastructure/events 实现自动刷新
            Agent 调用 GET /api/infrastructure/refresh 后触发 iframe 重新加载
  页面持久化：固定页面的创建/重命名/排序实时同步到后端（/api/pages），刷新后自动恢复

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. 后端（Backend）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  框架：    Express + TypeScript
  端口：    3001（在 startup\env.conf 中配置，默认 3001）
  URL：     http://localhost:3001/
  目录：    D:\学习\ClaudeCode\morgana\backend
  启动：    cd backend && npm run dev

  配置优先级（高→低）：
    1. 环境变量（DB_HOST, DB_PORT, SERVER_PORT 等）
    2. startup\env.conf
    3. backend\config\default.json

  API 端点：
    GET    /api/health                               — 健康检查
    GET    /api/agent-configs                        — 列表所有 Agent 配置
    GET    /api/agent-configs/:id                    — 获取单个配置
    POST   /api/agent-configs                        — 创建配置
    PUT    /api/agent-configs/:id                    — 更新配置
    DELETE /api/agent-configs/:id                    — 删除配置
    POST   /api/agent-configs/:id/activate           — 激活配置
    POST   /api/agent-configs/:id/init               — 创建初始化任务
    POST   /api/agent-configs/:id/init-complete      — 标记初始化完成
    GET    /api/agent-configs/:id/default-init-prompt — 获取默认初始化提示词
    GET    /api/agent-configs/:id/default-chat-prompt — 获取默认对话提示词
    GET    /api/agent-configs/:id/default-page-prompt — 获取默认页面提示词
    GET    /api/agent-configs/:id/default-emerge-prompt — 获取默认涌现提示词
    GET    /api/tasks                                — 列表任务
    POST   /api/tasks                                — 创建任务
    PUT    /api/tasks/:id                            — 更新任务标题
    DELETE /api/tasks/:id                            — 删除任务（级联删除消息 + 附件文件）
    GET    /api/tasks/:id/messages                   — 获取任务消息（含文件附件）
    POST   /api/chat/stream                          — 流式聊天（SSE）
    POST   /api/chat/completions                     — 非流式聊天
    POST   /api/chat/run                             — Runs API 模式（legacy，当前不采用）
    POST   /api/chat/generate-page                   — 触发涌现页面生成
    POST   /api/chat/generate-page/cancel            — 取消页面生成
    POST   /api/files/upload                         — 上传文件（存入共享 tmpfile 目录）
    GET    /api/files/:id                            — 预览文件（内联返回）
    GET    /api/files/:id/download                   — 下载文件（保留原始文件名）
    GET    /api/pages                                — 页面列表（按 sort_order 排序）
    POST   /api/pages                                — 创建固定页面（关联任务 + 页面文件 + 分享令牌 + 后台 AI 匹配 emoji）
    PUT    /api/pages/:id/rename                     — 重命名页面
    PUT    /api/pages/:id/reorder                    — 调整页面排序
    GET    /api/pages/:id/share-token                — 获取页面分享令牌
    PUT    /api/pages/migrate-icons                  — 批量用 Hermes 语义匹配重建 emoji 图标
    DELETE /api/pages/:id                            — 删除页面（删除页面文件 + 关联任务）
    GET    /api/share/external-ip                    — 获取局域网 IP（10.x.x.x）
    POST   /api/share/screenshot                     — Puppeteer 全页截图（PNG base64）
    GET    /api/share/page/:token                    — 分享固定页面（按 share_token 访问）
    POST   /api/render-pptx                          — 渲染 PPTX（LibreOffice → PNG slides）
    GET    /api/infrastructure/config                — 获取基础设施配置
    PUT    /api/infrastructure/config                — 更新基础设施配置
    GET    /api/infrastructure/refresh               — 触发页面刷新（SSE 广播）
    GET    /api/infrastructure/events                — SSE 事件流（页面刷新通知）
    GET    /api/sdk/morgana.js                       — Morgana 浏览器端 SDK
    POST   /api/sdk/db/query                         — SDK 数据库查询（仅 SELECT）
    POST   /api/sdk/db/execute                       — SDK 数据库执行（INSERT/UPDATE/DELETE）

  共享临时文件目录（tmpfile）：
    Windows 路径： D:\学习\ClaudeCode\morgana\tmpfile（可通过 TMPFILE_DIR / config.tmpfile.dir 修改）
    WSL 路径：     /mnt/d/学习/ClaudeCode/morgana/tmpfile
    说明：上传文件存入此共享目录，Morgana 不内联文件内容，
          而是在消息尾部追加 [附件文件] 块给出文件路径，
          由 Hermes Agent 用文件系统工具自行读取（含视觉模型自动选择）。

  CORS：   已启用（允许前端跨域访问）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. 数据库（Database）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  类型：    MariaDB 11.4.5 LTS（兼容 MySQL）
  安装路径：C:\tools\mariadb-11.4.5-winx64（在 start-mariadb.sh 中配置）
  端口：    3306（可在 startup\env.conf 中修改）
  数据库：  morgana
  用户：    root
  密码：    无（开发模式，--skip-grant-tables）
  启动脚本：startup/start-mariadb.sh
  停止脚本：startup/stop-db.sh

  配置：    startup/env.conf → DB_HOST / DB_PORT / DB_DATABASE / DB_USER / DB_PASSWORD

  ┌─────────────────────────────────────────────────────┐
  │ MariaDB 是 MySQL 的完全兼容替代品，                    │
  │ 所有 MySQL 客户端工具和驱动均可直接使用。               │
  │ 如需使用云数据库，修改 env.conf 中的 DB_* 参数即可，    │
  │ 无需关心数据库安装路径。                               │
  └─────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. AI Agent 对接
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌────────────────────────────────────────────────────┐
  │  当前 Agent：本地 Hermes（已激活）                    │
  │  协议：      API Server（标准 REST API）              │
  │  端点：      http://127.0.0.1:8899/v1/chat/completions │
  │  API Key：   rNyTllttZmwtV5ZzkkrN03DPoBmKPIKfsqMlu9mWAc8SQrel │
  │  数据表：    agent_configs（MariaDB 持久化）          │
  │  初始化提示词：可自定义，用于 Agent 初始化阶段           │
  │  对话提示词：  可自定义，用于日常对话                   │
  │  页面提示词：  可自定义，用于固定页面生成               │
  │  涌现提示词：  可自定义，用于涌现页面生成               │
  └────────────────────────────────────────────────────┘

  重要连接说明：
    ⚠ 必须使用 127.0.0.1（而非 localhost）：
      Windows 下 localhost 会解析为 IPv6 [::1]，而 Hermes 只监听
      IPv4 127.0.0.1:8899，导致 Node fetch 连接失败 → 超时/回退。
      后端所有与 Hermes 通信的地方均已显式替换为 127.0.0.1。

    ⚠ 后台任务超时 30s：
      标题生成、emoji 图标匹配等后台调用使用 AbortController 30s 超时，
      覆盖 Hermes 首次冷启动；超时后降级为默认值（页面图标 → 📄）。

    ⚠ emoji 语义匹配：
      固定页面创建后，后台调用 Hermes 按页面名称语义选择 emoji 图标
      （如"画画"→🎨、"大象"→🐘），前端轮询 /api/pages 获取更新。

    ⚠ 附件文件读取：
      上传文件不内联内容，Hermes 通过消息中 [附件文件] 块给出的
      WSL 路径（/mnt/d/...）用文件系统工具读取，自动选择合适模型。

  Hermes 配置方式：
    编辑 ~/.hermes/.env：
      API_SERVER_ENABLED=true
      API_SERVER_KEY=rNyTllttZmwtV5ZzkkrN03DPoBmKPIKfsqMlu9mWAc8SQrel
    启动：hermes gateway
    默认端口 8642，当前实际使用 8899

  Morgana 配置方式：
    侧边栏 → ⚙️ 设置 → Agent 配置 → 新建/编辑
    支持协议：ACP（Agent Communication Protocol，远端 Agent）
              API Server（标准 REST API，本地 Agent）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. UI 页面系统
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌────────────────────────────────────────────────────┐
  │  首个固定页签："涌现"（机器人图标）                    │
  │    - 默认选中，始终位于最左侧                         │
  │    - 不可删除、不可拖拽移动                           │
  │    - 可编辑名称                                      │
  │    - 与其右侧页签之间有竖线分隔                       │
  │                                                     │
  │  固定页签：用户通过编辑态 "+" 创建                    │
  │    - 编辑态下可拖拽排序、重命名、删除                  │
  │    - 排序/重命名实时持久化到后端（/api/pages），重启不丢 │
  │    - emoji 图标由 Hermes 按名称语义匹配生成（不限固定    │
  │      集合，失败降级为 📄）                            │
  │                                                     │
  │  编辑态：点击右上角"编辑"按钮进入                      │
  │                                                     │
  │  页面分享：                                           │
  │    - 固定页面生成不可猜测的分享链接                    │
  │      http://<局域网IP>:3001/api/share/page/<token>   │
  │    - 涌现页面分享实时链接 http://<局域网IP>:3002/?t=... │
  │    - 支持整页截图下载（Puppeteer 无头浏览器）          │
  │    - PPTX 渲染：Agent 生成 PPTX → LibreOffice 转 PNG   │
  │      预览每页幻灯片                                   │
  └────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. 布局模式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  混合模式（split）：     [侧边栏 | 聊天区 | UI 内容区]
  UI 模式（ui-focus）：   [侧边栏 | UI 全屏 + 浮动聊天按钮]
  对话模式（nl-focus）：  [侧边栏 | 聊天区（窄条）| UI 窄条]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. 设计系统
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  强调色：  靛蓝 #6366f1
  主题：    深色（默认）/ 浅色，通过 data-theme 切换
  配色文件：frontend\src\index.css（CSS 自定义属性）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. 快速启动（系统重启后）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌──────────────────────────────────────────────────────┐
  │  Windows（双击 .bat 或 cmd 中运行）：                   │
  │    startup\start-all.bat                              │
  │    startup\stop-all.bat                               │
  │    startup\start-mariadb.bat                          │
  │    startup\stop-db.bat                                │
  │                                                      │
  │  Git Bash / Linux / macOS（终端中运行）：               │
  │    bash startup/start-all.sh                          │
  │    bash startup/stop-all.sh                           │
  │    bash startup/start-mariadb.sh                      │
  │    bash startup/stop-db.sh                            │
  └──────────────────────────────────────────────────────┘

  Step 1：启动 MariaDB
    startup\start-mariadb.bat          （Windows）
    bash startup/start-mariadb.sh      （Git Bash / Linux）

  Step 2：启动 Hermes Agent（如需）
    hermes gateway

  Step 3：启动后端 + 前端
    startup\start-all.bat              （Windows）
    bash startup/start-all.sh          （Git Bash / Linux）

  Step 4：打开浏览器访问 http://localhost:5173/

  # 停止
  startup\stop-all.bat                 （停止前后端）
  startup\stop-db.bat                  （停止数据库）
