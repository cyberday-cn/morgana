import { Router, Request, Response } from 'express'
import path from 'path'
import os from 'os'
import { readFileSync, existsSync } from 'node:fs'
import { config } from '../config.js'
import { getPool } from '../db.js'

const router = Router()

// Detect the LAN IP (10.0.x.x) for shareable URLs
function getLanIp(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && iface.address.startsWith('10.')) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

// GET /api/share/external-ip - returns the LAN IP for constructing share URLs
router.get('/external-ip', (_req: Request, res: Response) => {
  res.json({ ip: getLanIp() })
})

// POST /api/share/screenshot - capture a full-page screenshot of a given URL
// Body: { url: string } - the page URL to capture
// Returns: { base64: string } - PNG image as base64
router.post('/screenshot', async (req: Request, res: Response) => {
  try {
    const { url } = req.body
    if (!url) {
      res.status(400).json({ error: 'Missing url in request body' })
      return
    }

    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    })
    try {
      const page = await browser.newPage()
      // Start wide so no responsive breakpoints squeeze content
      await page.setViewport({ width: 1200, height: 800 })
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
      // Find the actual rendered content width from child element bounding rects,
      // rather than body.scrollWidth (which stretches to fill the viewport).
      // This eliminates side whitespace on centered/narrow pages.
      const contentWidth = await page.evaluate(() => {
        let maxW = 0
        for (let i = 0; i < document.body.children.length; i++) {
          const r = document.body.children[i].getBoundingClientRect()
          if (r.width > maxW) maxW = r.width
        }
        return maxW
      })
      // Shrink viewport to content width to minimize side whitespace
      const targetWidth = Math.max(400, Math.min(Math.round(contentWidth), 1920))
      await page.setViewport({ width: targetWidth, height: 800 })
      // Force layout settle after viewport change
      await page.evaluate(() => document.body.offsetHeight)
      await new Promise(r => setTimeout(r, 100))
      const title = await page.evaluate(() => document.title)
      const buffer = await page.screenshot({ fullPage: true, type: 'png' })
      // Puppeteer returns Uint8Array — must wrap in Buffer for toString('base64')
      res.json({ base64: Buffer.from(buffer).toString('base64'), title })
    } finally {
      await browser.close()
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Screenshot failed', details: String(err.message || err) })
  }
})

// GET /api/share/page/:token - serve a fixed page as standalone HTML for external sharing.
// Uses a random share_token (not the numeric ID) so URLs are not guessable.
router.get('/page/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    // Look up page_id from the share_token
    const pool = await getPool()
    const [rows] = await pool.execute(
      'SELECT id FROM pages WHERE share_token = ?',
      [token]
    ) as any[]
    if (rows.length === 0) {
      res.status(404).json({ error: 'Page not found' })
      return
    }
    const pageId = rows[0].id
    const pageFile = path.join(config.pages.root, `page_${pageId}.html`)
    if (!existsSync(pageFile)) {
      res.status(404).json({ error: 'Page not found' })
      return
    }
    const ip = getLanIp()
    let html = readFileSync(pageFile, 'utf-8')
    // Rewrite localhost:backendPort to external IP so the page and SDK work from other machines
    html = html.replace(
      new RegExp(`http://localhost:${config.server.port}`, 'g'),
      `http://${ip}:${config.server.port}`
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to serve page', details: String(err.message || err) })
  }
})

export { router as shareRouter }
