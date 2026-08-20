import { getPool } from '../db.js'
import { config } from '../config.js'
import path from 'path'
import os from 'os'
import type { Response } from 'express'

const uploadsDir = config.tmpfile.dir

interface AgentConfig {
  id: number
  name: string
  protocol: string
  endpoint: string
  api_key: string | null
  is_active: number
  init_prompt: string | null
  chat_prompt: string | null
  page_prompt: string | null
  emerge_prompt: string | null
}

// ─── Vision model detection ─────────────────────────────────────

// ─── Shared helpers ──────────────────────────────────────────────

async function saveUserMessage(taskId: number, content: string): Promise<number> {
  const pool = await getPool()
  const [result] = await pool.execute(
    'INSERT INTO messages (task_id, role, content) VALUES (?, ?, ?)',
    [taskId, 'user', content]
  ) as any
  await pool.execute('UPDATE tasks SET updated_at = NOW() WHERE id = ?', [taskId])
  return result.insertId
}

async function attachFiles(messageId: number, fileIds: number[]) {
  const pool = await getPool()
  for (const fileId of fileIds) {
    await pool.execute(
      'UPDATE file_attachments SET message_id = ? WHERE id = ?',
      [messageId, fileId]
    )
  }
}

async function getActiveAgent(): Promise<AgentConfig> {
  const pool = await getPool()
  const [rows] = await pool.execute(
    'SELECT * FROM agent_configs WHERE is_active = 1 LIMIT 1'
  ) as any[]
  if (rows.length === 0) {
    throw new Error('No active agent configuration found. Please set an active agent in settings.')
  }
  const agent: AgentConfig = rows[0]
  if (agent.protocol !== 'api-server') {
    throw new Error(`Protocol "${agent.protocol}" is not supported for chat. Only "api-server" is supported.`)
  }
  return agent
}

async function buildMessages(taskId: number, userMessage: string, fileIds?: number[], initAgentId?: number, chatAgentId?: number): Promise<{ role: string; content: any }[]> {
  const pool = await getPool()
  let [historyRows] = await pool.execute(
    'SELECT role, content FROM messages WHERE task_id = ? ORDER BY created_at DESC LIMIT 40',
    [taskId]
  ) as any[]
  historyRows = (historyRows as any[]).reverse()

  // Use init system prompt when initAgentId is provided
  // Otherwise use chat/page system prompt based on task type
  let systemPrompt = 'You are Morgana, an intelligent AI assistant. Respond helpfully and concisely.'
  if (initAgentId) {
    systemPrompt = await buildInitSystemPrompt(initAgentId)
  } else if (chatAgentId) {
    // Check task type — page tasks use page_prompt, others use chat_prompt
    let taskType = 'chat'
    try {
      const [taskRows] = await pool.execute(
        'SELECT type FROM tasks WHERE id = ?', [taskId]
      ) as any[]
      if (taskRows.length > 0) taskType = taskRows[0].type
    } catch { /* fallback to chat_prompt */ }

    if (taskType === 'page') {
      systemPrompt = await buildPageSystemPrompt(chatAgentId)
    } else {
      systemPrompt = await buildChatSystemPrompt(chatAgentId)
    }
  }

  // If this task has a linked fixed page, inject its file info into the system prompt
  // so the agent knows which page_<id>.html to write when generating/updating content.
  if (!initAgentId) {
    try {
      const [taskRows] = await pool.execute(
        'SELECT page_id FROM tasks WHERE id = ?', [taskId]
      ) as any[]
      if (taskRows.length > 0 && taskRows[0].page_id) {
        const pageId = taskRows[0].page_id
        const [pageRows] = await pool.execute(
          'SELECT name FROM pages WHERE id = ?', [pageId]
        ) as any[]
        if (pageRows.length > 0) {
          systemPrompt += `\n\n⚠️ 当前任务关联了固定页面 page_${pageId}.html（页面名称：${pageRows[0].name}）。如需生成或更新此固定页面的 HTML 内容，请将完整页面写入页面根目录下的 page_${pageId}.html（覆盖写入），写入后务必调用页面刷新回调通知 Morgana 加载新内容。`
        }
      }
    } catch {
      // Non-critical — skip page context on error
    }
  }

  const messages: { role: string; content: any }[] = [
    { role: 'system', content: systemPrompt },
  ]

  for (const msg of historyRows) {
    messages.push({ role: msg.role === 'agent' ? 'assistant' : msg.role, content: msg.content })
  }

  // Add file context if any — emit paths for Hermes to read via filesystem tools
  if (fileIds && fileIds.length > 0) {
    const winToWsl = (p: string): string => {
      const m = p.match(/^([a-zA-Z]):\\(.+)$/)
      return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : p.replace(/\\/g, '/')
    }

    const fileList: string[] = []
    for (const fileId of fileIds) {
      const [fileRows] = await pool.execute(
        'SELECT original_name, stored_name, mime_type FROM file_attachments WHERE id = ?',
        [fileId]
      ) as any[]
      if (fileRows.length > 0) {
        const f = fileRows[0]
        const wslPath = winToWsl(path.join(uploadsDir, f.stored_name))
        fileList.push(`- ${f.original_name} (${f.mime_type}) → \`${wslPath}\``)
      }
    }

    if (fileList.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        lastMsg.content += `\n\n[附件文件]\n${fileList.join('\n')}\n\n请使用你的文件系统工具读取这些文件。`
      }
    }
  }

  return messages
}

async function saveAgentMessage(taskId: number, content: string): Promise<any> {
  const pool = await getPool()
  const [result] = await pool.execute(
    'INSERT INTO messages (task_id, role, content) VALUES (?, ?, ?)',
    [taskId, 'agent', content]
  ) as any
  await pool.execute('UPDATE tasks SET updated_at = NOW() WHERE id = ?', [taskId])
  const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [result.insertId]) as any[]
  return rows[0]
}

// ─── URL helpers ─────────────────────────────────────────────────

function getAgentBase(agent: AgentConfig): string {
  // Extract just protocol+host, stripping any path
  try {
    const url = new URL(agent.endpoint)
    return `${url.protocol}//${url.host}`
  } catch {
    let base = agent.endpoint
      .replace(/\/chat\/completions\/?$/, '')
      .replace(/\/v1\/runs\/?$/, '')
      .replace(/\/v1\/?$/, '')
      .replace(/\/+$/, '')
    return base
  }
}

function buildAgentEndpoint(agent: AgentConfig): string {
  return `${getAgentBase(agent)}/v1/chat/completions`
}

function buildAgentHeaders(agent: AgentConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (agent.api_key) {
    headers['Authorization'] = `Bearer ${agent.api_key}`
  }
  return headers
}

async function countTaskMessages(taskId: number): Promise<number> {
  const pool = await getPool()
  const [rows] = await pool.execute('SELECT COUNT(*) as cnt FROM messages WHERE task_id = ?', [taskId]) as any[]
  return rows[0].cnt
}

async function generateTitle(taskId: number, userMessage: string): Promise<string | null> {
  try {
    const pool = await getPool()

    // Page-type tasks keep their initial name (the page title), don't auto-rename
    const [taskRows] = await pool.execute('SELECT type, title FROM tasks WHERE id = ?', [taskId]) as any[]
    if (taskRows.length > 0 && taskRows[0].type === 'page') {
      return taskRows[0].title
    }

    const cleanMsg = userMessage.trim()
      .replace(/<[^>]*>/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\s+/g, ' ').trim()
      .slice(0, 400)

    // Call Hermes with the instruction placed in user message (proven far more
    // effective than system prompt — see test notes in git log).
    // Fallback to local extraction on failure/timeout.
    const agent = await getActiveAgent()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000)

    try {
      const res = await fetch(buildAgentEndpoint(agent), {
        method: 'POST',
        headers: buildAgentHeaders(agent),
        body: JSON.stringify({
          model: 'hermes',
          messages: [{
            role: 'user',
            content: `## 指令
请为以下用户问题生成一个标题。要求：用4-10个字概括用户提问的主题。只返回标题本身，不要标点符号和解释。不要续写回答开头。

## 用户问题
${cleanMsg}

## 标题`,
          }],
          max_tokens: 50,
          stream: false,
        }),
        signal: controller.signal,
      })

      if (res.ok) {
        const data = await res.json() as any
        let title: string | null = data.choices?.[0]?.message?.content?.trim() || null
        if (title) {
          title = title.replace(/^[""''「」【】]+|[""''「」【】]+$/g, '').trim()
          if (title.length > 0 && title.length <= 200) {
            await pool.execute('UPDATE tasks SET title = ? WHERE id = ?', [title, taskId])
            return title
          }
        }
      }
    } finally {
      clearTimeout(timeoutId)
    }

    // Fallback: extract title from user message locally
    let fallback = cleanMsg
      .replace(/^(你好|请问|帮我|请|我想|我想问|我想知道|能不能|可以|帮我看|帮我分析|给我|解释|介绍|说明|推荐|建议|分析|评估|评价|告诉)[，,。!！\s]*/i, '').trim()
    if (!fallback) fallback = cleanMsg

    const bp = ['？', '?', '。', '！', '!', '；', ';', '\n']
    for (const p of bp) {
      const idx = fallback.indexOf(p)
      if (idx > 0 && idx <= 25) { fallback = fallback.slice(0, idx); break }
    }
    if (fallback.length > 20) fallback = fallback.slice(0, 16) + '...'
    fallback = fallback.trim()

    if (fallback.length > 0) {
      await pool.execute('UPDATE tasks SET title = ? WHERE id = ?', [fallback, taskId])
      return fallback
    }
    return null
  } catch {
    return null
  }
}

// ─── Init system prompt ──────────────────────────────────────────

async function getAgentById(agentId: number): Promise<AgentConfig> {
  const pool = await getPool()
  const [rows] = await pool.execute(
    'SELECT * FROM agent_configs WHERE id = ?',
    [agentId]
  ) as any[]
  if (rows.length === 0) throw new Error(`Agent config ${agentId} not found`)
  return rows[0]
}

// ─── Host IP detection for WSL2/Linux connectivity ────────────────

function getHostIPs(): string[] {
  const interfaces = os.networkInterfaces()
  const ips: string[] = []
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]
    if (!iface) continue
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address)
      }
    }
  }
  return ips
}

export async function buildInitSystemPrompt(agentId: number, forceDefault?: boolean): Promise<string> {
  const agent = await getAgentById(agentId)
  const pagesRoot = path.resolve(config.pages.root)

  const serverPort = config.server.port

  // Detect LAN IPs for WSL2/Linux connectivity (Hermes Agent in WSL2 can't reach localhost)
  const hostIPs = getHostIPs()
  const altUrlList: string[] = [...hostIPs.map(ip => `http://${ip}:${serverPort}`), `http://host.docker.internal:${serverPort}`]
  const altUrlHint = `\n  (from WSL2/Linux, try: ${altUrlList.join(' or ')})`
  const healthCheckHint = `To verify Morgana is reachable, check http://localhost:${serverPort}/api/health (from Windows)\nor use ${altUrlList[0]}/api/health (from WSL2/Linux).`
  const callbackHint = `\n  (from WSL2/Linux, call PUT ${altUrlList[0]}/api/infrastructure/config instead)`

  // Minimal system config — excludes pages root/port so user's custom prompt values
  // (which may differ from env.conf) are not contradicted by appended system info
  const systemConfigMinimal = `## System Information
- Agent Name: ${agent.name}
- Database Host: ${config.db.host}
- Database Port: ${config.db.port}
- Database Name: ${config.db.database}
- Database User: ${config.db.user}
- Database Password: ${config.db.password}
- Morgana Backend: http://localhost:${serverPort}${altUrlHint}

${healthCheckHint}
DO NOT check http://localhost:${serverPort}/ (root) — that path has no route.

When you finalize the pages root and HTTP port you are actually using, notify
Morgana by calling:
  PUT http://localhost:${serverPort}/api/infrastructure/config${callbackHint}
with body: { "pages": { "root": "<actual-path>", "port": <actual-port> } }
This updates env.conf so that future initializations and other agents use the correct values.`

  // If agent has a custom init prompt, use it as-is (no system config appended)
  if (!forceDefault && agent.init_prompt && agent.init_prompt.trim().length > 0) {
    return agent.init_prompt.trim()
  }

  // Default built-in prompt (Simplified Chinese)
  return `你是 Morgana 的基础设施初始化助手。你的任务是为 Agent "${agent.name}" 搭建页面服务基础设施。

## 背景
你正在被初始化为 Morgana（一个多智能体平台）的页面服务 Agent。你的职责是创建和提供动态网页，这些页面将在 Morgana 用户界面中展示。

## 数据库连接
共享系统数据库信息如下：
- 主机：${config.db.host}
- 端口：${config.db.port}
- 数据库名：${config.db.database}
- 用户名：${config.db.user}
- 密码：${config.db.password}

请使用此数据库存储和读取页面相关数据。你可以根据需要创建自己的表。

## 页面服务基础设施
你需要搭建一个 HTTP 服务来提供网页访问。页面文件应放置在：
- 页面根目录：${pagesRoot}
- HTTP 端口：${config.pages.port}

Morgana 后端地址：http://localhost:${config.server.port}
从 WSL2/Linux 访问：${altUrlList.join('、')}

## 需要完成的任务
1. 搭建一个 HTTP 服务（nginx、python http.server、node.js http 服务器等），用于从页面根目录提供静态文件，监听端口 ${config.pages.port}
2. 验证服务是否正常运行并可访问
3. 在页面根目录创建一个测试页面（index.html）确认一切正常
4. 汇报你的设置状态

## 注意事项
- 如果页面根目录不存在，需要先创建
- HTTP 服务必须监听端口 ${config.pages.port}
- 你可以使用文件系统——通过 write_file、execute_code、terminal 等工具来搭建基础设施
- 你在页面根目录创建的页面将立即通过 HTTP 可访问
- 如果使用 nginx，请确保配置其从 ${pagesRoot} 提供服务
- 如果使用 python 的 http.server，请以后台进程方式运行
- 如果使用 node.js，可以创建一个简单的 http 服务脚本

## 系统配置
- Agent 名称：${agent.name}
- 数据库主机：${config.db.host}
- 数据库端口：${config.db.port}
- 数据库名称：${config.db.database}
- 数据库用户：${config.db.user}
- 数据库密码：${config.db.password}
- 页面根目录：${pagesRoot}
- HTTP 服务端口：${config.pages.port}
- Morgana 后端：http://localhost:${config.server.port}
  （从 WSL2/Linux 访问：${altUrlList.join('、')}）

如需检查 Morgana 是否可达：
  - 从 Windows：http://localhost:${config.server.port}/api/health
  - 从 WSL2/Linux：${altUrlList[0]}/api/health
（返回 {"status":"ok"} 即表示正常）
注意：不要检查 http://localhost:${config.server.port}/（根路径），该路径没有对应路由，会返回错误。

如果实际使用的页面根目录或 HTTP 端口与上述配置不一致，请直接调用以下接口通知 Morgana 更新配置（无需预先检查连通性）：
  - 从 Windows 调用：PUT http://localhost:${config.server.port}/api/infrastructure/config
  - 从 WSL2/Linux 调用：PUT ${altUrlList[0]}/api/infrastructure/config
请求体：{ "pages": { "root": "实际路径", "port": 实际端口 } }

请现在开始初始化。`
}

// ─── Page generation (fire-and-forget via Chat Completions API) ──

// Map of active page generation requests for cancellation via AbortController
const activePageGenerations = new Map<string, AbortController>()

export async function triggerPageGeneration(
  userMessage: string,
  agentMessage: string,
  chatAgentId?: number
): Promise<string> {
  const agent = await getActiveAgent()

  // Build system prompt with env info — use emerge prompt, fall back to chat prompt
  const systemPrompt = chatAgentId
    ? await buildEmergeSystemPrompt(chatAgentId)
    : await buildEmergeSystemPrompt(agent.id)

  const instruction = `请根据以下对话内容，生成或更新页面（index.html）来辅助呈现信息。

对话上下文：

## 用户的提问
${userMessage}

## 你的回答
${agentMessage}

请根据上述对话上下文，创建一个内容充实、视觉美观的交互式页面来呈现和获取相关信息。页面写入后请调用刷新回调接口通知 Morgana 更新显示。（刷新回调地址由系统提示词提供）`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: instruction },
  ]

  const runId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const controller = new AbortController()
  activePageGenerations.set(runId, controller)

  // Fire-and-forget via chat completions API with streaming.
  // Using stream:true so that aborting the connection is detected
  // immediately by Hermes (it tries to write the next chunk and finds
  // the connection broken), stopping further processing.
  const hermesResponse = await fetch(buildAgentEndpoint(agent), {
    method: 'POST',
    headers: buildAgentHeaders(agent),
    body: JSON.stringify({
      model: 'hermes',
      messages,
      max_tokens: 8192,
      stream: true,
    }),
    signal: controller.signal,
  })

  // Drain the streaming response in the background so the connection
  // stays alive — when cancelled, the drain breaks and Hermes sees
  // the dropped connection.
  ;(async () => {
    try {
      if (hermesResponse.body) {
        const reader = hermesResponse.body.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }
    } catch {
      // Expected on abort — connection closed, Hermes should stop
    }
  })().catch(() => {})

  return runId
}

// ─── Page refresh suppression (for cancellation) ─────────────────

// When the user cancels page generation, the Hermes task may still complete
// and call PUT /api/infrastructure/config. This timestamp suppresses the
// resulting page_refresh SSE broadcast so the iframe doesn't reload.
let _blockPageRefreshUntil = 0

export function blockPageRefresh(durationMs: number) {
  _blockPageRefreshUntil = Date.now() + durationMs
}

export function isPageRefreshBlocked(): boolean {
  return Date.now() < _blockPageRefreshUntil
}

// ─── Cancel page generation ──────────────────────────────────────

export async function cancelPageGeneration(runId: string): Promise<void> {
  const controller = activePageGenerations.get(runId)
  if (controller) {
    controller.abort()
    activePageGenerations.delete(runId)
  }
  // Suppress any page_refresh broadcasts for the next 12 seconds.
  // Even if Hermes has already finished processing and calls the
  // callback, the SSE event won't reach the frontend.
  blockPageRefresh(12000)
}

// ─── Chat system prompt ──────────────────────────────────────────

export async function buildChatSystemPrompt(agentId: number, forceDefault?: boolean): Promise<string> {
  const agent = await getAgentById(agentId)
  const serverPort = config.server.port

  // Detect LAN IPs for WSL2/Linux connectivity
  const hostIPs = getHostIPs()
  const refreshUrl = hostIPs.length > 0
    ? `http://${hostIPs[0]}:${serverPort}/api/infrastructure/refresh`
    : `http://localhost:${serverPort}/api/infrastructure/refresh`

  // Default conversation prompt — users can override via agent config
  const wslTmpDirHint = ((): string => {
    const m = uploadsDir.match(/^([a-zA-Z]):\\(.+)$/)
    return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : uploadsDir.replace(/\\/g, '/')
  })()

  const systemConfig = `## 当前场景
现在是Morgana平台任务对话场景。你作为morgana（AI Agent），积极分析和解答用户提出的问题。注意：
- 金融类问题优先加载financial-data skill，再结合skill做解答。
- 遇到需要你查询外部信息时，请主动调用网络搜索能力，以收集更多信息再回答。
- 当用户的问题缺少关键条件信息时（存在多个合理答案、缺少约束条件、需要用户选择维度/参数），**不要猜测答案**，而是：在文字回复中说明需要哪些补充信息。
- 如果用户问的是morgana平台固定页面的业务，则优先加载morgana-database skill，然后结合数据库的业务数据情况进行分析和回答。

# 补充信息：
- Morgana平台除任务对话外，还支持自动生成的页面展示。如有必要你可以协助进行页面刷新。
- 页面服务端口：${config.pages.port}
- 页面刷新回调接口：GET ${refreshUrl}
- Morgana JS SDK 地址：http://localhost:${serverPort}/api/sdk/morgana.js
- 文件访问：用户上传的附件保存在共享目录中。消息中的[附件文件]块会列出文件路径（WSL格式），请使用你的文件系统工具读取这些文件。共享目录WSL路径：${wslTmpDirHint}`

  // If agent has a custom chat prompt, use it as-is (no system config appended)
  if (!forceDefault && agent.chat_prompt && agent.chat_prompt.trim().length > 0) {
    return agent.chat_prompt.trim()
  }

  // Default built-in prompt — just the environment config
  return systemConfig
}

// ─── Page system prompt ──────────────────────────────────────────

export async function buildPageSystemPrompt(agentId: number, forceDefault?: boolean): Promise<string> {
  const agent = await getAgentById(agentId)
  const serverPort = config.server.port

  const hostIPs = getHostIPs()
  const refreshUrl = hostIPs.length > 0
    ? `http://${hostIPs[0]}:${serverPort}/api/infrastructure/refresh`
    : `http://localhost:${serverPort}/api/infrastructure/refresh`

  const pagesRoot = path.resolve(config.pages.root).replace(/\\/g, '\\\\')
  const systemConfig = `## 当前场景
现在是Morgana平台固定页面生成场景。你作为morgana（AI Agent），根据用户要求，生成对应的固定页面。注意生成页面前需要进行数据库表的规划，可复用已有或规划直接操作数据库进行表的创建和调整等。

## 当前环境信息：
- 页面根目录：${pagesRoot}
- 页面服务端口：${config.pages.port}
- 页面刷新回调接口：GET ${refreshUrl}
- 数据库地址：${config.db.host}:${config.db.port}
- Morgana JS SDK 地址：http://localhost:${serverPort}/api/sdk/morgana.js

- 固定页面文件命名：page_<id>.html，保存在页面根目录下（与 index.html 同目录）。⚠️ 固定页面的文件是创建时由系统预先创建的（在页面根目录下），并非新文件。对话任务中如果关联了固定页面，系统提示词中会注入具体的文件名，必须覆盖写入该已有文件，不得另存为文件名不同的新文件
- SDK 数据库操作：Morgana.query(sql, params) — SELECT 查询、Morgana.insert(sql, params) — INSERT 插入、Morgana.update(sql, params) — UPDATE 更新、Morgana.delete(sql, params) — DELETE 删除（通过 http://localhost:${serverPort}/api/sdk/db/{query|execute} 接口）

## 固定页面生成规则

你的任务是根据对话内容生成固定页面（page_<id>.html）。固定页面是持久化的业务功能页面，**必须配合数据库表进行数据存储**。

1. **先建表** — 如不确认表是否存在，先查询已有表。涉及持久化数据的，必须先确保对应的数据库表存在（CREATE TABLE IF NOT EXISTS）
2. **引用 SDK** — 页面必须引用 Morgana JS SDK（<script src="http://localhost:${serverPort}/api/sdk/morgana.js">）
3. **用 SDK 操作数据库** — 所有数据读写必须通过 Morgana.query/insert/update/delete 方法操作数据库
4. **禁止 localStorage** — 不得使用 localStorage、sessionStorage、IndexedDB 或纯前端变量存储数据（页面刷新后数据必须保留）
5. **写入并刷新** — 页面写入后调用刷新回调通知 Morgana 加载新页面
6. **只生成页面，不输出文字回复`

  // If agent has a custom page prompt, use it as-is (no system config appended)
  if (!forceDefault && agent.page_prompt && agent.page_prompt.trim().length > 0) {
    return agent.page_prompt.trim()
  }

  return systemConfig
}

// ─── Emerge system prompt ───────────────────────────────────────

export async function buildEmergeSystemPrompt(agentId: number, forceDefault?: boolean): Promise<string> {
  const agent = await getAgentById(agentId)
  const serverPort = config.server.port

  const hostIPs = getHostIPs()
  const refreshUrl = hostIPs.length > 0
    ? `http://${hostIPs[0]}:${serverPort}/api/infrastructure/refresh`
    : `http://localhost:${serverPort}/api/infrastructure/refresh`

  const pagesRoot = path.resolve(config.pages.root).replace(/\\/g, '\\\\')
  const defaultPrompt = `## 当前场景
现在是Morgana平台涌现信息交互式页面生成场景。你作为morgana（AI Agent），根据用户与agent对话内容，生成对应的涌现交互页面（index.html,临时页面）。

## 当前环境信息：
- 页面根目录：${pagesRoot}
- 页面服务端口：${config.pages.port}
- 页面刷新回调接口：GET ${refreshUrl}
- Morgana JS SDK 地址：http://localhost:${serverPort}/api/sdk/morgana.js

## 涌现页面（Emerge Page）生成规则

根据对话内容生成交互式信息展示页面（index.html），以直观方式呈现信息。

1. **写入 index.html** — 将完整 HTML 写入页面根目录下的 index.html（每次覆盖写入）
2. **引用 SDK** — 页面引用 Morgana JS SDK（<script src="http://localhost:${serverPort}/api/sdk/morgana.js">），用于表单提交
3. **验证写入** — 检查文件存在且非空，搜索内容中本次回答的标志性关键词确认是新内容
4. **调用刷新回调** — 写入成功后调用刷新回调接口，通知 Morgana 加载新页面
5. **只生成页面，不输出文字回复**

## 页面设计

- 浅色风格，背景 #f5f5f5，卡片白色，字号 16px
- 最大宽度 720px 居中，卡片圆角 8px
- 品牌色 #4f46e5（按钮/链接），正文字色 #333333
- 如需用户补充信息，在页面中添加表单，表单提交调用 Morgana.submit() 将数据发回对话继续处理
- 提交后页面保持显示不要跳转，可提示「已提交」

## 表单交互规则
当用户的问题缺少关键条件信息时（存在多个合理答案、缺少约束条件、需要用户选择维度/参数），Agent会在文字回复中说明需要哪些补充信息。这时需要你：
1. 在生成的页面中包含表单，引用 SDK（http://localhost:${serverPort}/api/sdk/morgana.js），表单提交调用 Morgana.submit({字段名: 值, ...})
2. 用户通过表单提交数据后会自动继续对话`

  // If agent has a custom emerge prompt, use it as-is
  if (!forceDefault && agent.emerge_prompt && agent.emerge_prompt.trim().length > 0) {
    return agent.emerge_prompt.trim()
  }

  // Default built-in emerge prompt
  return defaultPrompt
}

// ─── Non‑streaming (legacy) ──────────────────────────────────────

export async function proxyToAgent(
  taskId: number,
  userMessage: string,
  fileIds?: number[],
  initAgentId?: number,
  chatAgentId?: number
): Promise<any> {
  const pool = await getPool()
  const userMsgId = await saveUserMessage(taskId, userMessage)
  if (fileIds?.length) await attachFiles(userMsgId, fileIds)

  const agent = await getActiveAgent()
  const messages = await buildMessages(taskId, userMessage, fileIds, initAgentId, chatAgentId)

  // Ensure the last message (user's) is fresh after save
  const response = await fetch(buildAgentEndpoint(agent), {
    method: 'POST',
    headers: buildAgentHeaders(agent),
    body: JSON.stringify({ model: 'hermes', messages, max_tokens: 8192, stream: false }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Agent API error (${response.status}): ${errorText}`)
  }

  const data = await response.json() as any
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Agent returned empty response')

  const saved = await saveAgentMessage(taskId, content)

  // Auto-rename if this is the very first exchange
  const msgCount = await countTaskMessages(taskId)
  if (msgCount <= 2) {
    const newTitle = await generateTitle(taskId, userMessage)
    if (newTitle) (saved as any).task_title = newTitle
  }

  return saved
}

// ─── Streaming ───────────────────────────────────────────────────

export async function proxyToAgentStream(
  taskId: number,
  userMessage: string,
  fileIds: number[],
  res: Response,
  initAgentId?: number,
  chatAgentId?: number
): Promise<void> {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    // 1. Save user message
    const userMsgId = await saveUserMessage(taskId, userMessage)
    if (fileIds.length) await attachFiles(userMsgId, fileIds)

    // Send user message event
    res.write(`data: ${JSON.stringify({ type: 'user_message', id: userMsgId })}\n\n`)

    // Send init_started event if initializing (frontend uses this to show init UI)
    if (initAgentId) {
      res.write(`data: ${JSON.stringify({ type: 'init_started', agentId: initAgentId })}\n\n`)
    }

    // 2. Build messages
    const agent = await getActiveAgent()
    const messages = await buildMessages(taskId, userMessage, fileIds, initAgentId, chatAgentId)
    const endpoint = buildAgentEndpoint(agent)

    // 3. Stream from agent
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildAgentHeaders(agent),
      body: JSON.stringify({ model: 'hermes', messages, max_tokens: 8192, stream: true }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Agent API error (${response.status}): ${errorText}`)
    }

    // 4. Read streaming response
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const dataStr = trimmed.slice(6) // remove 'data: ' prefix
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)
          const delta = parsed.choices?.[0]?.delta

          // Check for reasoning content (thinking process)
          const reasoning = delta?.reasoning_content
          if (reasoning) {
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: reasoning })}\n\n`)
          }

          // Check for regular content
          const content = delta?.content
          if (content) {
            fullContent += content
            res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6)
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr)
            const delta = parsed.choices?.[0]?.delta

            const reasoning = delta?.reasoning_content
            if (reasoning) {
              res.write(`data: ${JSON.stringify({ type: 'thinking', content: reasoning })}\n\n`)
            }

            const content = delta?.content
            if (content) {
              fullContent += content
              res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
            }
          } catch {}
        }
      }
    }

    if (!fullContent) throw new Error('Agent returned empty response')

    // 5. Save full response to DB
    const saved = await saveAgentMessage(taskId, fullContent)

    // 6. Send done event immediately (message is ready for display)
    res.write(`data: ${JSON.stringify({
      type: 'done',
      message: saved,
    })}\n\n`)

    // 7. Auto-rename if first exchange (sends task_renamed event when ready)
    const msgCount = await countTaskMessages(taskId)
    if (msgCount <= 2) {
      const newTitle = await generateTitle(taskId, userMessage)
      if (newTitle) {
        res.write(`data: ${JSON.stringify({
          type: 'task_renamed',
          task_title: newTitle,
        })}\n\n`)
      }
    }

    res.end()
  } catch (err: any) {
    // Send error event
    const status = err.message?.includes('No active agent') ? 400 : 500
    res.write(`data: ${JSON.stringify({
      type: 'error',
      status,
      error: err.message || 'Failed to process chat',
    })}\n\n`)
    res.end()
  }
}

// ─── Chat Completions API (streaming, with tool execution) ──────

export async function proxyToAgentRun(
  taskId: number,
  userMessage: string,
  fileIds: number[],
  res: Response,
  initAgentId?: number,
  chatAgentId?: number
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  let hbInterval: ReturnType<typeof setInterval> | undefined
  function cleanupHeartbeat() {
    if (hbInterval !== undefined) clearInterval(hbInterval)
  }
  try {
    // 1. Save user message
    const userMsgId = await saveUserMessage(taskId, userMessage)
    if (fileIds.length) await attachFiles(userMsgId, fileIds)
    res.write(`data: ${JSON.stringify({ type: 'user_message', id: userMsgId })}\n\n`)

    // Send init_started event if initializing
    if (initAgentId) {
      res.write(`data: ${JSON.stringify({ type: 'init_started', agentId: initAgentId })}\n\n`)
    }

    // 2. Build messages with full history + system prompt
    const agent = await getActiveAgent()
    const messages = await buildMessages(taskId, userMessage, fileIds, initAgentId, chatAgentId)
    const endpoint = buildAgentEndpoint(agent)

    // 3. Stream from agent via Chat Completions
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildAgentHeaders(agent),
      body: JSON.stringify({ model: 'hermes', messages, max_tokens: 8192, stream: true }),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Agent API error (${response.status}): ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    // Heartbeat: send progress messages every 3s until first real content
    let receivedContent = false
    let heartbeatTick = 0
    const heartbeatMessages = [
      '正在准备中...',
      '正在思考中...',
      '正在分析中...',
      '正在处理中...',
    ]
    hbInterval = setInterval(() => {
      if (receivedContent) return
      heartbeatTick++
      const elapsed = heartbeatTick * 3
      const msg = heartbeatTick <= heartbeatMessages.length
        ? heartbeatMessages[heartbeatTick - 1]
        : `仍在处理中 (${elapsed}s)...`
      res.write(`data: ${JSON.stringify({ type: 'thinking', content: msg })}\n\n`)
    }, 3000)

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const dataStr = trimmed.slice(6)
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)
          const delta = parsed.choices?.[0]?.delta

          // Check for reasoning content (thinking process)
          const reasoning = delta?.reasoning_content
          if (reasoning) {
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: reasoning })}\n\n`)
          }

          // Check for regular content
          const content = delta?.content
          if (content) {
            receivedContent = true
            cleanupHeartbeat()
            fullContent += content
            res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6)
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr)
            const delta = parsed.choices?.[0]?.delta
            const reasoning = delta?.reasoning_content
            if (reasoning) {
              res.write(`data: ${JSON.stringify({ type: 'thinking', content: reasoning })}\n\n`)
            }
            const content = delta?.content
            if (content) {
              receivedContent = true
              cleanupHeartbeat()
              fullContent += content
              res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
            }
          } catch {}
        }
      }
    }

    cleanupHeartbeat()
    if (!fullContent) throw new Error('Agent returned empty response')

    // 4. Save full response to DB
    const saved = await saveAgentMessage(taskId, fullContent)

    // 5. Auto-rename if first exchange
    let taskTitle: string | undefined
    const msgCount = await countTaskMessages(taskId)
    if (msgCount <= 2) {
      const newTitle = await generateTitle(taskId, userMessage)
      if (newTitle) taskTitle = newTitle
    }

    // 6. Send done event
    res.write(`data: ${JSON.stringify({
      type: 'done',
      message: saved,
      task_title: taskTitle,
    })}\n\n`)

    res.end()
  } catch (err: any) {
    cleanupHeartbeat()
    const status = err.message?.includes('No active agent') ? 400 : 500
    res.write(`data: ${JSON.stringify({
      type: 'error',
      status,
      error: err.message || 'Failed to process chat',
    })}\n\n`)
    res.end()
  }
}
