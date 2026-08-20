import { Router, type Request, type Response } from 'express'
import { getPool } from '../db.js'
import { buildInitSystemPrompt, buildChatSystemPrompt, buildPageSystemPrompt, buildEmergeSystemPrompt } from '../services/chat-proxy.js'

export const agentConfigRouter = Router()

// Helper to get agent by ID
async function getAgentById(id: string): Promise<any> {
  const pool = await getPool()
  const [rows] = await pool.execute(
    'SELECT * FROM agent_configs WHERE id = ?',
    [id]
  )
  const configs = rows as any[]
  if (configs.length === 0) return null
  return configs[0]
}

// List all configs
agentConfigRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.query(
      'SELECT * FROM agent_configs ORDER BY updated_at DESC'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent configs', details: String(err) })
  }
})

// Get single config
agentConfigRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.execute(
      'SELECT * FROM agent_configs WHERE id = ?',
      [req.params.id]
    )
    const configs = rows as any[]
    if (configs.length === 0) {
      res.status(404).json({ error: 'Agent config not found' })
      return
    }
    res.json(configs[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent config', details: String(err) })
  }
})

// Get default init prompt template for an agent
agentConfigRouter.get('/:id/default-init-prompt', async (req: Request, res: Response) => {
  try {
    const prompt = await buildInitSystemPrompt(Number(req.params.id), true)
    res.json({ prompt })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate default init prompt', details: String(err) })
  }
})

// Get default chat prompt template for an agent
agentConfigRouter.get('/:id/default-chat-prompt', async (req: Request, res: Response) => {
  try {
    const prompt = await buildChatSystemPrompt(Number(req.params.id), true)
    res.json({ prompt })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate default chat prompt', details: String(err) })
  }
})

// Get default page prompt template for an agent
agentConfigRouter.get('/:id/default-page-prompt', async (req: Request, res: Response) => {
  try {
    const prompt = await buildPageSystemPrompt(Number(req.params.id), true)
    res.json({ prompt })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate default page prompt', details: String(err) })
  }
})

// Get default emerge prompt template for an agent
agentConfigRouter.get('/:id/default-emerge-prompt', async (req: Request, res: Response) => {
  try {
    const prompt = await buildEmergeSystemPrompt(Number(req.params.id), true)
    res.json({ prompt })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate default emerge prompt', details: String(err) })
  }
})

// Create config
agentConfigRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, protocol, endpoint, api_key, description, init_prompt, chat_prompt, page_prompt, emerge_prompt } = req.body
    if (!name || !endpoint) {
      res.status(400).json({ error: 'name and endpoint are required' })
      return
    }
    if (!['acp', 'api-server'].includes(protocol)) {
      res.status(400).json({ error: 'protocol must be "acp" or "api-server"' })
      return
    }

    const pool = await getPool()
    const [result] = await pool.execute(
      'INSERT INTO agent_configs (name, protocol, endpoint, api_key, description, init_prompt, chat_prompt, page_prompt, emerge_prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, protocol, endpoint, api_key || null, description || null, init_prompt || null, chat_prompt || null, page_prompt || null, emerge_prompt || null]
    )

    const insertResult = result as any
    const [rows] = await pool.execute(
      'SELECT * FROM agent_configs WHERE id = ?',
      [insertResult.insertId]
    )
    const configs = rows as any[]
    res.status(201).json(configs[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to create agent config', details: String(err) })
  }
})

// Update config
agentConfigRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, protocol, endpoint, api_key, description, init_prompt, chat_prompt, page_prompt, emerge_prompt } = req.body
    if (protocol && !['acp', 'api-server'].includes(protocol)) {
      res.status(400).json({ error: 'protocol must be "acp" or "api-server"' })
      return
    }

    const pool = await getPool()
    const [result] = await pool.execute(
      `UPDATE agent_configs
       SET name = COALESCE(?, name),
           protocol = COALESCE(?, protocol),
           endpoint = COALESCE(?, endpoint),
           api_key = COALESCE(?, api_key),
           description = COALESCE(?, description),
           init_prompt = COALESCE(?, init_prompt),
           chat_prompt = COALESCE(?, chat_prompt),
           page_prompt = COALESCE(?, page_prompt),
           emerge_prompt = COALESCE(?, emerge_prompt)
       WHERE id = ?`,
      [name || null, protocol || null, endpoint || null, api_key !== undefined ? api_key : null, description !== undefined ? description : null, init_prompt !== undefined ? init_prompt : null, chat_prompt !== undefined ? chat_prompt : null, page_prompt !== undefined ? page_prompt : null, emerge_prompt !== undefined ? emerge_prompt : null, req.params.id]
    )

    const updateResult = result as any
    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: 'Agent config not found' })
      return
    }

    const [rows] = await pool.execute(
      'SELECT * FROM agent_configs WHERE id = ?',
      [req.params.id]
    )
    const configs = rows as any[]
    res.json(configs[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to update agent config', details: String(err) })
  }
})

// Delete config
agentConfigRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [result] = await pool.execute(
      'DELETE FROM agent_configs WHERE id = ?',
      [req.params.id]
    )
    const deleteResult = result as any
    if (deleteResult.affectedRows === 0) {
      res.status(404).json({ error: 'Agent config not found' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete agent config', details: String(err) })
  }
})

// Set as active
agentConfigRouter.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    // Deactivate all first
    await pool.execute('UPDATE agent_configs SET is_active = 0')
    // Activate target
    const [result] = await pool.execute(
      'UPDATE agent_configs SET is_active = 1 WHERE id = ?',
      [req.params.id]
    )
    const updateResult = result as any
    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: 'Agent config not found' })
      return
    }
    const [rows] = await pool.execute(
      'SELECT * FROM agent_configs WHERE id = ?',
      [req.params.id]
    )
    const configs = rows as any[]
    res.json(configs[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate agent config', details: String(err) })
  }
})

// Initialize: create an init task for this agent
agentConfigRouter.post('/:id/init', async (req: Request, res: Response) => {
  try {
    const agent = await getAgentById(req.params.id)
    if (!agent) {
      res.status(404).json({ error: 'Agent config not found' })
      return
    }

    const pool = await getPool()
    const title = `初始化 - ${agent.name}`
    const [result] = await pool.execute(
      'INSERT INTO tasks (title) VALUES (?)',
      [title]
    )

    const insertResult = result as any
    const [taskRows] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ?',
      [insertResult.insertId]
    )
    const tasks = taskRows as any[]

    res.status(201).json({
      task: tasks[0],
      agent,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create init task', details: String(err) })
  }
})

// Mark initialization as complete
agentConfigRouter.post('/:id/init-complete', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [result] = await pool.execute(
      'UPDATE agent_configs SET initialized = 1 WHERE id = ?',
      [req.params.id]
    )
    const updateResult = result as any
    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: 'Agent config not found' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark init complete', details: String(err) })
  }
})
