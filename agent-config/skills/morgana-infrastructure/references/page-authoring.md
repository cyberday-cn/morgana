# Authoring Pages for Morgana

When creating or updating HTML pages served through Morgana's page viewer.

## File Writing: Use Terminal, Not write_file

**write_file silently fails on /mnt/d/ paths.** The tool reports success, read_file confirms, but the file on disk remains unchanged (WSL/Windows caching issue).

Always write via terminal heredoc:
```bash
cat > "<PAGES_ROOT>/index.html" << 'ENDOFFILE'
... full HTML ...
ENDOFFILE
```

Verify with:
```bash
wc -l "<PAGES_ROOT>/index.html"
grep "expected-string" "<PAGES_ROOT>/index.html"
```

## External Assets: Always Local

Morgana's page viewer (browser rendering layer) may block external HTTPS images, fonts, and CDN assets — even when those URLs are reachable from WSL via curl. The page is rendered in a browser context where network restrictions differ from WSL's.

**Rule**: Zero external dependencies. All assets must be local.

### Batch Downloading Flag Images

Example — downloading country flags from flagcdn.com (proven to work from WSL):

```bash
CODES=(cn jp kr ... tv)
DIR="<PAGES_ROOT>/flags"
for code in "${CODES[@]}"; do
  curl -sL -o "${DIR}/${code}.png" -w "%{http_code}\n" \
    --connect-timeout 10 "https://flagcdn.com/w80/${code}.png"
done
```

Reference in HTML with relative paths:
```html
<img src="flags/cn.png" alt="China" loading="lazy">
```

## Refreshing Morgana After Changes

After writing/updating pages, notify Morgana to reload:
```bash
curl -X PUT http://<LAN_IP>:3001/api/infrastructure/config \
  -H "Content-Type: application/json" \
  -d '{"pages":{"root":"<PAGES_ROOT>","port":3002}}'
```

## Page Template Conventions

- Dark theme: background `#0f172a`, cards `#1e293b`, text `#e2e8f0`
- Use `vanilla JS` (no frameworks) — Morgana pages are simple static HTML
- Include search/filter for list-style pages
- Responsive grid: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- Stats bar at top showing counts per category
- Collapsible sections for large grouped content
