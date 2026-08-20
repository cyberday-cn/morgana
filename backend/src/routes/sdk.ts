import { Router, type Request, type Response } from 'express'
import { config } from '../config.js'
import { getPool } from '../db.js'

export const sdkRouter = Router()

const serverPort = config.server.port

const SDK_CONTENT = `(function() {
  // Infer API base from where this script was loaded, so the SDK
  // works correctly even when accessed from external LAN addresses.
  var base = 'http://localhost:${serverPort}';
  try {
    var scripts = document.getElementsByTagName('script');
    if (scripts.length) {
      var src = scripts[scripts.length - 1].src;
      if (src) {
        var idx = src.lastIndexOf('/api/sdk/morgana.js');
        if (idx !== -1) base = src.substring(0, idx);
      }
    }
  } catch(e) {}

  window.Morgana = {
    submit: function(data) {
      parent.postMessage({ type: 'user_input', data: data }, '*')
    },

    /** Execute SELECT and return result rows */
    query: async function(sql, params) {
      var res = await fetch(base + '/api/sdk/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql, params: params || [] })
      })
      if (!res.ok) {
        var err = await res.text()
        throw new Error(err)
      }
      return (await res.json()).rows
    },

    /** Execute INSERT and return { insertId, affectedRows } */
    insert: async function(sql, params) {
      var res = await fetch(base + '/api/sdk/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql, params: params || [] })
      })
      if (!res.ok) {
        var err = await res.text()
        throw new Error(err)
      }
      return await res.json()
    },

    /** Execute UPDATE and return { affectedRows } */
    update: async function(sql, params) {
      var res = await fetch(base + '/api/sdk/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql, params: params || [] })
      })
      if (!res.ok) {
        var err = await res.text()
        throw new Error(err)
      }
      return await res.json()
    },

    /** Execute DELETE and return { affectedRows } */
    delete: async function(sql, params) {
      var res = await fetch(base + '/api/sdk/db/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql, params: params || [] })
      })
      if (!res.ok) {
        var err = await res.text()
        throw new Error(err)
      }
      return await res.json()
    }
  }
})();
`

// Morgana JS SDK file
sdkRouter.get('/morgana.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript')
  res.setHeader('Cache-Control', 'no-cache')
  res.send(SDK_CONTENT)
})

// DB query endpoint — SELECT only
sdkRouter.post('/db/query', async (req: Request, res: Response) => {
  try {
    const { sql, params } = req.body
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'sql is required' })
      return
    }
    const trimmed = sql.trim().toUpperCase()
    if (!trimmed.startsWith('SELECT')) {
      res.status(400).json({ error: 'Only SELECT queries are allowed on this endpoint' })
      return
    }
    const pool = await getPool()
    const [rows] = await pool.execute(sql, params || [])
    res.json({ rows })
  } catch (err) {
    res.status(500).json({ error: 'Query failed', details: String(err) })
  }
})

// DB execute endpoint — INSERT/UPDATE/DELETE only
sdkRouter.post('/db/execute', async (req: Request, res: Response) => {
  try {
    const { sql, params } = req.body
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'sql is required' })
      return
    }
    const trimmed = sql.trim().toUpperCase()
    if (!trimmed.startsWith('INSERT') && !trimmed.startsWith('UPDATE') && !trimmed.startsWith('DELETE')) {
      res.status(400).json({ error: 'Only INSERT, UPDATE, DELETE are allowed on this endpoint' })
      return
    }
    const pool = await getPool()
    const [result] = await pool.execute(sql, params || [])
    const r = result as any
    res.json({ affectedRows: r.affectedRows, insertId: r.insertId })
  } catch (err) {
    res.status(500).json({ error: 'Execute failed', details: String(err) })
  }
})
