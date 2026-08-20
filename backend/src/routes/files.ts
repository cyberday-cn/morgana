import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import iconv from 'iconv-lite'
import { config } from '../config.js'
import { getPool } from '../db.js'

export const uploadsDir = config.tmpfile.dir

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Multer config: disk storage with UUID filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const uniqueName = `${crypto.randomUUID()}${ext}`
    cb(null, uniqueName)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
})

export const fileRouter = Router()

// Upload a file
fileRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }

    // Fix encoding: busboy decodes multipart header filenames as latin1.
    // Modern browsers send UTF-8 bytes; curl on Chinese Windows sends GBK/CP936.
    // Try UTF-8 first; fall back to GBK if replacement chars appear.
    const rawBytes = Buffer.from(req.file.originalname, 'latin1')
    const utf8Name = rawBytes.toString('utf-8')
    const originalName = utf8Name.includes('�') ? iconv.decode(rawBytes, 'gbk') : utf8Name

    const pool = await getPool()
    const [result] = await pool.execute(
      'INSERT INTO file_attachments (original_name, stored_name, mime_type, file_size) VALUES (?, ?, ?, ?)',
      [originalName, req.file.filename, req.file.mimetype, req.file.size]
    ) as any

    const [rows] = await pool.execute(
      'SELECT id, original_name, stored_name, mime_type, file_size, created_at FROM file_attachments WHERE id = ?',
      [result.insertId]
    ) as any[]

    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload file', details: String(err) })
  }
})

// Serve file inline
fileRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.execute(
      'SELECT * FROM file_attachments WHERE id = ?',
      [req.params.id]
    ) as any[]

    if (rows.length === 0) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const file = rows[0]
    const filePath = path.join(uploadsDir, file.stored_name)

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }

    res.setHeader('Content-Type', file.mime_type)
    res.sendFile(filePath)
  } catch (err) {
    res.status(500).json({ error: 'Failed to serve file', details: String(err) })
  }
})

// Download file with original name
fileRouter.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const pool = await getPool()
    const [rows] = await pool.execute(
      'SELECT * FROM file_attachments WHERE id = ?',
      [req.params.id]
    ) as any[]

    if (rows.length === 0) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const file = rows[0]
    const filePath = path.join(uploadsDir, file.stored_name)

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }

    // RFC 5987 encoding for non-ASCII filenames
    const encodedFilename = encodeURIComponent(file.original_name)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
    res.setHeader('Content-Type', file.mime_type)
    res.sendFile(filePath)
  } catch (err) {
    res.status(500).json({ error: 'Failed to download file', details: String(err) })
  }
})
