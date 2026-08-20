import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { initSchema } from './db.js'
import { agentConfigRouter } from './routes/agent-config.js'
import { taskRouter } from './routes/tasks.js'
import { chatRouter } from './routes/chat.js'
import { fileRouter, uploadsDir } from './routes/files.js'
import { infrastructureRouter } from './routes/infrastructure.js'
import { sdkRouter } from './routes/sdk.js'
import { pageRouter } from './routes/pages.js'
import { renderPptxRouter } from './routes/render-pptx.js'
import { shareRouter } from './routes/share.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Routes
app.use('/api/agent-configs', agentConfigRouter)
app.use('/api/tasks', taskRouter)
app.use('/api/chat', chatRouter)
app.use('/api/files', fileRouter)
app.use('/api/infrastructure', infrastructureRouter)
app.use('/api/sdk', sdkRouter)
app.use('/api/pages', pageRouter)
app.use('/api', renderPptxRouter)
app.use('/api/share', shareRouter)

// Serve uploads as static files
app.use('/uploads', express.static(uploadsDir))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
async function main() {
  try {
    await initSchema()
  } catch (err) {
    console.warn('[Server] DB unavailable — running without persistence:', err)
  }

  app.listen(config.server.port, () => {
    console.log(`[Server] Morgana backend running on http://localhost:${config.server.port}`)
  })
}

main()