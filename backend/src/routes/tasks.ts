import { Router, type Request, type Response } from 'express'
import { getPool } from '../db.js'
import { config } from '../config.js'
import path from 'path'
import fs from 'fs'

export const taskRouter = Router()

// List all tasks
taskRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.query(
      "SELECT t.*, (SELECT MAX(m.created_at) FROM messages m WHERE m.task_id = t.id) AS last_message_at FROM tasks t ORDER BY FIELD(t.type, 'chat', 'config', 'page'), COALESCE(last_message_at, t.created_at) DESC"
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: String(err) })
  }
})

// Create a task
taskRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, type, pageId } = req.body
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'title is required' })
      return
    }
    const trimmed = title.trim().slice(0, 200)
    const taskType = ['chat', 'config', 'page'].includes(type) ? type : 'chat'

    const pool = await getPool()
    let result
    if (pageId) {
      const [existing] = await pool.execute(
        'SELECT id FROM pages WHERE id = ?',
        [pageId]
      )
      if ((existing as any[]).length > 0) {
        // Reuse existing page binding
        result = await pool.execute(
          'INSERT INTO tasks (title, type, page_id) VALUES (?, ?, ?)',
          [trimmed, taskType, pageId]
        )
      } else {
        result = await pool.execute(
          'INSERT INTO tasks (title, type) VALUES (?, ?)',
          [trimmed, taskType]
        )
      }
    } else {
      result = await pool.execute(
        'INSERT INTO tasks (title, type) VALUES (?, ?)',
        [trimmed, taskType]
      )
    }

    const [insertResult] = result as any
    const [rows] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ?',
      [insertResult.insertId]
    )
    const tasks = rows as any[]
    res.status(201).json(tasks[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task', details: String(err) }
  )
  }
})

// Get single task
taskRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ?',
      [req.params.id]
    )
    const tasks = rows as any[]
    if (tasks.length === 0) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json(tasks[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task', details: String(err) })
  }
})

// Update task title
taskRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title } = req.body
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'title is required' })
      return
    }
    const trimmed = title.trim().slice(0, 200)

    const pool = await getPool()
    const [result] = await pool.execute(
      'UPDATE tasks SET title = ? WHERE id = ?',
      [trimmed, req.params.id]
    )

    const updateResult = result as any
    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: 'Task not found' })
      return
    }

    const [rows] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ?',
      [req.params.id]
    )
    const tasks = rows as any[]
    res.json(tasks[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task', details: String(err) })
  }
})

// Delete task (cascade deletes messages, cleans up file attachments)
taskRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()

    // 1. Collect file_attachments stored_names for messages of this task
    const [fileRows] = await pool.execute(
      `SELECT f.stored_name FROM file_attachments f
       JOIN messages m ON f.message_id = m.id
       WHERE m.task_id = ?`,
      [req.params.id]
    ) as any[]

    // 2. Delete files from disk
    const uploadsDir = config.tmpfile.dir
    for (const row of fileRows) {
      const filePath = path.join(uploadsDir, row.stored_name)
      try { fs.unlinkSync(filePath) } catch { /* file may already be gone */ }
    }

    // 3. Delete file_attachment records (ON DELETE SET NULL leaves orphaned rows)
    await pool.execute(
      `DELETE f FROM file_attachments f
       JOIN messages m ON f.message_id = m.id
       WHERE m.task_id = ?`,
      [req.params.id]
    )

    // 4. Delete task (cascade deletes messages)
    const [result] = await pool.execute(
      'DELETE FROM tasks WHERE id = ?',
      [req.params.id]
    )
    const deleteResult = result as any
    if (deleteResult.affectedRows === 0) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task', details: String(err) })
  }
})

// Get messages for a task (with file attachments)
taskRouter.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.execute(
      `SELECT m.*,
        COALESCE(
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', f.id, 'original_name', f.original_name, 'stored_name', f.stored_name, 'mime_type', f.mime_type, 'file_size', f.file_size, 'created_at', f.created_at))
           FROM file_attachments f WHERE f.message_id = m.id),
          '[]'
        ) AS files
      FROM messages m
      WHERE m.task_id = ?
      ORDER BY m.created_at ASC`,
      [req.params.id]
    )
    // Parse the 'files' JSON string for each row
    const parsed = (rows as any[]).map((row) => ({
      ...row,
      files: typeof row.files === 'string' ? JSON.parse(row.files) : row.files,
    }))
    res.json(parsed)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages', details: String(err) })
  }
})
