import { Router, type Request, type Response } from 'express'
import { getPool } from '../db.js'
import { config } from '../config.js'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export const pageRouter = Router()

/** Fallback emoji when Hermes call fails or doesn't return a result for a name */
const FALLBACK_EMOJI = '📄'

/**
 * Call Hermes to pick semantically appropriate emojis for page names.
 * Sends all names in one prompt and expects a JSON response mapping name→emoji.
 */
async function pickEmojis(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {}
  try {
    const pool = await getPool()
    const [agents] = await pool.execute(
      'SELECT * FROM agent_configs WHERE is_active = 1 LIMIT 1'
    ) as any[]
    if (agents.length === 0) throw new Error('No active agent')
    const agent = agents[0]

    // Build endpoint URL
    const ep = agent.endpoint
      .replace(/\/chat\/completions\/?$/, '')
      .replace(/\/v1\/runs\/?$/, '')
      .replace(/\/v1\/?$/, '')
      .replace(/\/+$/, '')
    // Use 127.0.0.1 explicitly to avoid IPv6 resolution issues on Windows
    const endpoint = `${ep}/v1/chat/completions`.replace('://localhost:', '://127.0.0.1:')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (agent.api_key) headers['Authorization'] = `Bearer ${agent.api_key}`

    const nameList = names.map(n => `"${n}"`).join('\n')
    const controller = new AbortController()
    // 30s timeout — Hermes may need cold-start time on the first request
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: 'hermes',
          messages: [{
            role: 'user',
            content: `为以下每个名称选择一个最合适的单个emoji图标。只返回一个JSON对象，key为名称，value为emoji字符。不要其他文字。\n\n${nameList}`,
          }],
          max_tokens: 500,
          stream: false,
        }),
      })
      if (!response.ok) throw new Error(`Hermes error: ${response.status}`)

      const data = await response.json() as any
      const text = data.choices?.[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
      // Validate: each value should be a single emoji character
      for (const name of names) {
        if (typeof parsed[name] !== 'string' ||
            !/^(\p{Emoji}\p{Emoji_Modifier}?️?|\p{Emoji_Presentation})+$/u.test(parsed[name])) {
          parsed[name] = FALLBACK_EMOJI
        }
      }
      return parsed
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    console.warn('[Pages] Hermes emoji pick failed, using fallback:', err)
    const fallback: Record<string, string> = {}
    for (const name of names) fallback[name] = FALLBACK_EMOJI
    return fallback
  }
}

// Migrate all existing page icons to semantically appropriate emoji
pageRouter.put('/migrate-icons', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT id, name, icon FROM pages') as any[]
    const names = rows.map((r: any) => r.name)
    const emojiMap = await pickEmojis(names)

    let updated = 0
    for (const page of rows) {
      const emoji = emojiMap[page.name]
      if (emoji && emoji !== page.icon) {
        await pool.execute('UPDATE pages SET icon = ? WHERE id = ?', [emoji, page.id])
        updated++
      }
    }
    res.json({ updated })
  } catch (err) {
    res.status(500).json({ error: 'Failed to migrate icons', details: String(err) })
  }
})
pageRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.query(
      'SELECT id, name, icon, task_id, share_token, created_at, updated_at FROM pages ORDER BY sort_order ASC'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pages', details: String(err) })
  }
})

// Create a page (optionally with a linked task)
pageRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    const trimmed = name.trim().slice(0, 200)
    const pageIcon = typeof icon === 'string' ? icon.slice(0, 50) : ''

    const pool = await getPool()

    // Create a linked task first
    const [taskResult] = await pool.execute(
      "INSERT INTO tasks (title, type) VALUES (?, 'page')",
      [trimmed]
    )
    const taskInsert = taskResult as any
    const taskId = taskInsert.insertId

    // Create the page with task binding and share token
    const shareToken = crypto.randomBytes(16).toString('hex')
    const [pageResult] = await pool.execute(
      'INSERT INTO pages (name, icon, task_id, share_token) VALUES (?, ?, ?, ?)',
      [trimmed, pageIcon, taskId, shareToken]
    )
    const pageInsert = pageResult as any
    const pageId = pageInsert.insertId

    // Update task with page_id
    await pool.execute(
      'UPDATE tasks SET page_id = ? WHERE id = ?',
      [pageId, taskId]
    )

    // Write initial page file to the pages root directory
    try {
      const pagesRoot = path.resolve(config.pages.root)
      const initialHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${trimmed}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
    height: 100vh; color: #666; background: #fafafa;
  }
  .msg { text-align: center; }
  .msg h2 { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 8px; }
  .msg p { font-size: 14px; color: #999; }
</style>
</head>
<body>
  <div class="msg">
    <h2>${trimmed}</h2>
    <p>页面内容由 Agent 动态生成</p>
  </div>
</body>
</html>`
      await fs.mkdir(pagesRoot, { recursive: true })
      await fs.writeFile(path.join(pagesRoot, `page_${pageId}.html`), initialHtml, 'utf-8')
    } catch {
      // Non-critical — page will show a fallback if file can't be written
      console.warn('[Pages] Could not write initial page file')
    }

    const [rows] = await pool.execute(
      'SELECT * FROM pages WHERE id = ?',
      [pageId]
    )
    const pages = rows as any[]

    // Pick emoji in background via Hermes semantic matching
    pickEmojis([trimmed]).then((emojiMap) => {
      const better = emojiMap[trimmed]
      if (better && better !== pageIcon) {
        pool.execute('UPDATE pages SET icon = ? WHERE id = ?', [better, pageId])
          .then(() => console.log(`[Pages] Set icon for "${trimmed}" to ${better}`))
          .catch((err) => console.warn('[Pages] Failed to update emoji in DB:', err))
      }
    })

    res.status(201).json({ page: pages[0], taskId })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create page', details: String(err) })
  }
})

// PUT /api/pages/:id/rename — update page name
pageRouter.put('/:id/rename', async (req: Request, res: Response) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    const pool = await getPool()
    await pool.execute('UPDATE pages SET name = ? WHERE id = ?', [name.trim(), req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename page', details: String(err) })
  }
})

// PUT /api/pages/:id/reorder — update page sort order
pageRouter.put('/:id/reorder', async (req: Request, res: Response) => {
  try {
    const { sortOrder } = req.body
    if (typeof sortOrder !== 'number') {
      res.status(400).json({ error: 'sortOrder must be a number' })
      return
    }
    const pool = await getPool()
    await pool.execute('UPDATE pages SET sort_order = ? WHERE id = ?', [sortOrder, req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder page', details: String(err) })
  }
})

// GET /api/pages/:id/share-token — returns the share token for a fixed page
pageRouter.get('/:id/share-token', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.execute(
      'SELECT share_token FROM pages WHERE id = ?',
      [req.params.id]
    ) as any[]
    if (rows.length === 0) {
      res.status(404).json({ error: 'Page not found' })
      return
    }
    res.json({ shareToken: rows[0].share_token })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get share token', details: String(err) })
  }
})

// Delete a page (cascade deletes linked task)
pageRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()

    // Find the linked task before deleting the page
    const [pages] = await pool.execute(
      'SELECT task_id FROM pages WHERE id = ?',
      [req.params.id]
    )
    const pageRows = pages as any[]
    if (pageRows.length === 0) {
      res.status(404).json({ error: 'Page not found' })
      return
    }
    const taskId = pageRows[0].task_id

    // Delete the page file from pages root
    try {
      const pagesRoot = path.resolve(config.pages.root)
      await fs.unlink(path.join(pagesRoot, `page_${req.params.id}.html`))
    } catch (e) {
      // File may not exist — log for diagnostics
      console.warn(`[Pages] Could not delete page file for page ${req.params.id}:`, e)
    }

    // Delete the page
    await pool.execute('DELETE FROM pages WHERE id = ?', [req.params.id])

    // Delete the linked task (cascade deletes messages)
    if (taskId) {
      await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId])
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete page', details: String(err) })
  }
})
