#!/usr/bin/env python3
"""
PPTX → PNG conversion via LibreOffice + pdf2image.

Accepts Base64-encoded PPTX (or other presentation formats) on stdin as JSON:
  {"base64": "...", "filename": "file.pptx"}

Returns JSON on stdout:
  {"slides": [{"index": 1, "base64": "...", "width": 1500, "height": 1125}, ...]}
  or {"error": "..."}
"""
import sys
import json
import base64
import tempfile
import os
import subprocess

def convert_pptx(base64_data: str, filename: str) -> dict:
    # Decide file extension
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ('.pptx', '.ppt', '.odp'):
        ext = '.pptx'  # default
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Write input file
        input_path = os.path.join(tmpdir, f"input{ext}")
        raw = base64.b64decode(base64_data)
        with open(input_path, 'wb') as f:
            f.write(raw)
        
        # Step 1: Convert to PDF via LibreOffice
        subprocess.run(
            ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmpdir, input_path],
            capture_output=True, timeout=60
        )
        
        pdf_path = input_path.replace(ext, '.pdf')
        if not os.path.exists(pdf_path):
            # Try with .pdf extension
            pdf_path = os.path.join(tmpdir, 'input.pdf')
        if not os.path.exists(pdf_path):
            # Fallback: search for any pdf
            pdfs = [f for f in os.listdir(tmpdir) if f.endswith('.pdf')]
            if not pdfs:
                return {"error": f"LibreOffice conversion failed for {filename}"}
            pdf_path = os.path.join(tmpdir, pdfs[0])
        
        # Step 2: Convert PDF pages to PNG images
        from pdf2image import convert_from_path
        images = convert_from_path(pdf_path, dpi=150, fmt='png')
        
        slides = []
        for i, img in enumerate(images):
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            b64 = base64.b64encode(buf.getvalue()).decode('ascii')
            slides.append({
                "index": i + 1,
                "base64": b64,
                "width": img.width,
                "height": img.height
            })
        
        return {"slides": slides}

if __name__ == '__main__':
    import io
    try:
        data = json.loads(sys.stdin.read())
        result = convert_pptx(data['base64'], data.get('filename', 'slide.pptx'))
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
