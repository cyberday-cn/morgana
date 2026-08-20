# Morgana Service Health Check Pattern

When the user asks "服务都正常吗?" or reports issues with Morgana, follow this systematic scan:

## 1. Process Check

```
ps aux | grep -E '(node|server\.py|hermes)' | grep -v grep
```

Identifies:
- Hermes Gateway (`hermes gateway run`)
- Morgana backend (`tsx src/index.ts` / node process)
- Pages server (`python3 -m http.server`)
- Other services (search-proxy, xiaohongshu MCP, LSP servers)

## 2. Port Check

```
ss -tlnp | grep -E ':(3001|3002|9099|18060|8899)'
```

Expected ports:
| Port | Service | Should be running? |
|------|---------|-------------------|
| 3001 | Morgana backend (Express/tsx, TypeScript) | Yes |
| 3002 | Pages server (Python http.server) | Yes |
| 5173 | Morgana frontend (Vite dev server) | Yes |
| 8899 | Hermes Gateway | Yes |
| 18060 | 小红书 MCP | If configured |
| 9099 | SearXNG / firecrawl | If configured |

## 3. HTTP Health Probe

```
for port in 3001 3002 5173; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ 2>/dev/null)
  echo "port $port → $code"
done
```

- Port 3002 should return `200` (directory listing or index.html)
- Port 3001: hit a known route like `/api/pages` — `200` is healthy, `500` means backend is up but DB is broken, `000` means nothing listening
- Port 5173: Vite dev server, should return `200` (HTML page)

## 4. DB Reachability Check

When the backend returns 500, check if MariaDB is reachable:

```
timeout 2 bash -c 'echo > /dev/tcp/<WINDOWS_HOST_IP>/3306' 2>/dev/null && echo "MySQL reachable" || echo "MySQL NOT reachable"
```

Windows host IP: `ip route show default | awk '{print $3}'`

Common issue: `startup/env.conf` has `DB_HOST=localhost` but Morgana backend runs in WSL. WSL's localhost != Windows host localhost. Fix: change DB_HOST to the Windows host IP.

## 5. Pages Content Verification

```
ls <PAGES_ROOT>/*.html 2>/dev/null | wc -l
for f in <PAGES_ROOT>/*.html; do
  name=$(basename "$f")
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/$name")
  echo "$name → $code"
done
```

## 6. Direct Browser URL

If pages are in WSL, provide the user:
- `http://localhost:3002/` (Windows auto-forwards localhost to WSL2)
- `http://<WSL_IP>:3002/` as fallback

WSL IP: `ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1`

## Diagnostic Decision Tree

```
Pages not visible in Morgana?
├── Check port 3002 (Python HTTP server)
│   ├── Not listening → start: `cd <PAGES_ROOT> && python3 -m http.server 3002 --bind 0.0.0.0`
│   ├── Listening but curl returns 000/empty reply → zombie state, kill and restart (see SKILL.md)
│   └── Listening → give user direct URL to test
│       ├── Direct URL works → Morgana frontend-to-backend link is broken
│       │   └── Check Morgana backend health (port 3001)
│       │       ├── 500 with ECONNREFUSED → DB_HOST wrong (localhost vs Windows IP)
│       │       └── 000 (not responding) → Express server down, restart it
│       └── Direct URL fails → pages server issue, check <PAGES_ROOT>/
└── Check port 3001 (Morgana backend)
    └── Server down → start via start-all.sh (see below) or individually:
        cd <PROJECT_ROOT>/backend && ./node_modules/.bin/tsx src/index.ts
```

## Starting Morgana Backend + Frontend

The canonical way to start both backend (3001) and frontend (5173):

```bash
bash <PROJECT_ROOT>/startup/start-all.sh
```

This reads `startup/env.conf` and starts:
- Backend: `npx tsx watch src/index.ts` on port 3001
- Frontend: `npx vite --port 5173 --strictPort` on port 5173

Logs go to `startup/logs/backend.log` and `startup/logs/frontend.log`.

To stop both: `bash <PROJECT_ROOT>/startup/stop-all.sh`

Note: start-all.sh uses shell-level background (`&`) internally. When calling from Hermes, run it via `terminal(background=true)` or let the script manage its own backgrounding. The script writes PIDs to `startup/logs/.running`.
