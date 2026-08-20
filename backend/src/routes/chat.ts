import { Router, type Request, type Response } from 'express'
import { proxyToAgent, proxyToAgentStream, proxyToAgentRun, triggerPageGeneration, cancelPageGeneration } from '../services/chat-proxy.js'

export const chatRouter = Router()

// Non-streaming chat completion (legacy)
chatRouter.post('/completions', async (req: Request, res: Response) => {
  try {
    const { taskId, message, fileIds, initAgentId, chatAgentId } = req.body

    if (!taskId || typeof taskId !== 'number') {
      res.status(400).json({ error: 'taskId is required and must be a number' })
      return
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'message is required' })
      return
    }

    const result = await proxyToAgent(taskId, message.trim(), fileIds || [], initAgentId, chatAgentId)
    res.json(result)
  } catch (err: any) {
    const status = err.message?.includes('No active agent') ? 400 : 500
    res.status(status).json({ error: err.message || 'Failed to process chat', details: String(err) })
  }
})

// Streaming chat completion (SSE)
chatRouter.post('/stream', async (req: Request, res: Response) => {
  const { taskId, message, fileIds, initAgentId, chatAgentId } = req.body

  if (!taskId || typeof taskId !== 'number') {
    res.status(400).json({ error: 'taskId is required and must be a number' })
    return
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  await proxyToAgentStream(taskId, message.trim(), fileIds || [], res, initAgentId, chatAgentId)
})

// Runs API — structured events with tool call visibility
chatRouter.post('/run', async (req: Request, res: Response) => {
  const { taskId, message, fileIds, initAgentId, chatAgentId } = req.body

  if (!taskId || typeof taskId !== 'number') {
    res.status(400).json({ error: 'taskId is required and must be a number' })
    return
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  await proxyToAgentRun(taskId, message.trim(), fileIds || [], res, initAgentId, chatAgentId)
})

// Fire-and-forget page generation based on conversation context
chatRouter.post('/generate-page', async (req: Request, res: Response) => {
  try {
    const { chatAgentId, userMessage, agentMessage } = req.body

    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      res.status(400).json({ error: 'userMessage is required' })
      return
    }
    if (!agentMessage || typeof agentMessage !== 'string' || !agentMessage.trim()) {
      res.status(400).json({ error: 'agentMessage is required' })
      return
    }

    const runId = await triggerPageGeneration(userMessage.trim(), agentMessage.trim(), chatAgentId || undefined)
    res.json({ success: true, runId })
  } catch (err: any) {
    const status = err.message?.includes('No active agent') ? 400 : 500
    res.status(status).json({ error: err.message || 'Failed to generate page' })
  }
})

// Cancel a running page generation (best-effort)
chatRouter.post('/generate-page/cancel', async (req: Request, res: Response) => {
  try {
    const { runId } = req.body
    if (!runId || typeof runId !== 'string') {
      res.status(400).json({ error: 'runId is required' })
      return
    }
    await cancelPageGeneration(runId)
    res.json({ success: true })
  } catch {
    res.json({ success: true })
  }
})
