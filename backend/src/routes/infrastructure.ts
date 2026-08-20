import { Router, type Request, type Response } from 'express'
import path from 'path'
import { execFile } from 'child_process'
import { config, updateEnvConf } from '../config.js'
import { isPageRefreshBlocked } from '../services/chat-proxy.js'

export const infrastructureRouter = Router()

// ─── SSE clients for page refresh notifications ────────────────────

const sseClients: Response[] = []

function addSSEClient(res: Response) {
  sseClients.push(res)
  res.on('close', () => {
    const idx = sseClients.indexOf(res)
    if (idx !== -1) sseClients.splice(idx, 1)
  })
}

function broadcastPageRefresh(): number {
  // Suppress if user recently cancelled page generation
  if (isPageRefreshBlocked()) {
    console.log('[SSE] page_refresh suppressed (blocked)')
    return 0
  }
  const count = sseClients.length
  console.log(`[SSE] Broadcasting page_refresh to ${count} client(s)`)
  const data = JSON.stringify({ type: 'page_refresh', timestamp: Date.now() })
  let sent = 0
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`)
      sent++
    } catch (err) {
      console.warn('[SSE] Failed to write to client:', err)
    }
  }
  return sent
}

// ─── Routes ────────────────────────────────────────────────────────

/**
 * GET /api/pages/events
 * SSE endpoint: frontend subscribes to receive page refresh notifications.
 * When the agent calls PUT /api/infrastructure/config after updating
 * index.html, this stream delivers a 'page_refresh' event so the
 * frontend can reload the iframe once.
 */
infrastructureRouter.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  // Send initial keepalive
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

  addSSEClient(res)
})

/**
 * GET /api/infrastructure/refresh
 * Dedicated endpoint to trigger a page refresh without changing any config.
 * Unlike PUT /api/infrastructure/config, this does not touch env.conf and
 * does not require any request body. Just passes through to broadcastPageRefresh().
 */
infrastructureRouter.get('/refresh', (_req: Request, res: Response) => {
  const sseSent = broadcastPageRefresh()
  res.json({ success: true, sseClients: sseSent })
})

/**
 * GET /api/infrastructure/config
 * Returns infrastructure configuration needed for agent initialization.
 * DB password is masked — the actual password is only included in the
 * init system prompt (server-side), never sent to the frontend.
 */
infrastructureRouter.get('/config', (_req, res) => {
  const pagesRoot = path.resolve(config.pages.root)

  res.json({
    db: {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password_configured: config.db.password.length > 0,
    },
    pages: {
      root: pagesRoot,
      port: config.pages.port,
    },
    server: {
      port: config.server.port,
    },
  })
})

/**
 * PUT /api/infrastructure/config
 * Updates pages root and/or port in env.conf and in-memory config.
 * Called by the Agent when it updates index.html — after persisting,
 * broadcasts a page_refresh event to all connected SSE clients so the
 * frontend reloads the iframe.
 */
infrastructureRouter.put('/config', (req: Request, res: Response) => {
  try {
    const { pages } = req.body

    if (!pages || (pages.root === undefined && pages.port === undefined)) {
      res.status(400).json({ error: 'Request body must include pages.root and/or pages.port' })
      return
    }

    const changes: Record<string, string> = {}
    if (pages.root !== undefined) {
      if (typeof pages.root !== 'string' || pages.root.trim().length === 0) {
        res.status(400).json({ error: 'pages.root must be a non-empty string' })
        return
      }
      changes['PAGES_ROOT'] = pages.root.trim()
    }
    if (pages.port !== undefined) {
      const port = Number(pages.port)
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        res.status(400).json({ error: 'pages.port must be an integer between 1 and 65535' })
        return
      }
      changes['PAGES_PORT'] = String(port)
    }

    updateEnvConf(changes)

    // Notify frontend to refresh the page iframe
    broadcastPageRefresh()

    const pagesRoot = path.resolve(config.pages.root)
    res.json({
      success: true,
      config: {
        pages: {
          root: pagesRoot,
          port: config.pages.port,
        },
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update config', details: String(err) })
  }
})
