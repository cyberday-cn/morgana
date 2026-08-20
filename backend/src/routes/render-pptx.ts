import { Router, Request, Response } from 'express'
import { execSync, exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

const router = Router()

interface RenderRequest {
  base64: string
}

router.post('/render-pptx', async (req: Request, res: Response) => {
  try {
    const { base64 } = req.body as RenderRequest
    if (!base64) {
      res.status(400).json({ error: 'Missing base64 data' })
      return
    }

    // Create temp dir
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-'))
    const pptxPath = path.join(tmpDir, 'input.pptx')
    const outDir = path.join(tmpDir, 'slides')

    // Write PPTX file
    const buf = Buffer.from(base64, 'base64')
    fs.writeFileSync(pptxPath, buf)
    fs.mkdirSync(outDir, { recursive: true })

    // Use libreoffice to convert each slide to PNG
    // --headless: no GUI
    // --convert-to png: convert to PNG
    // --outdir: output directory
    try {
      execSync(
        `cd "${tmpDir}" && libreoffice --headless --convert-to png --outdir "${outDir}" "${pptxPath}"`,
        { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      )
    } catch (loErr: any) {
      // Clean up and return error
      fs.rmSync(tmpDir, { recursive: true, force: true })
      res.status(500).json({ error: 'LibreOffice rendering failed: ' + (loErr.message || loErr) })
      return
    }

    // Read generated PNG files, sorted
    const pngFiles = fs.readdirSync(outDir)
      .filter(f => f.endsWith('.png'))
      .sort()

    if (pngFiles.length === 0) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      res.status(500).json({ error: 'No slides were generated' })
      return
    }

    // Read each PNG as base64
    const slides: string[] = []
    for (const pngFile of pngFiles) {
      const pngData = fs.readFileSync(path.join(outDir, pngFile))
      slides.push(pngData.toString('base64'))
    }

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true })

    res.json({ slides, total: slides.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
})

export { router as renderPptxRouter }
