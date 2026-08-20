---
name: morgana-kanban-development
description: Lessons learned from developing Morgana fixed pages (kanban, CRUD pages) — WSL file write traps, MariaDB date serialization, Morgana SDK quirks, and verification workflow.
---

# Morgana Kanban Page Development — Lessons Learned

## Trigger

Use this skill when developing or debugging **Morgana fixed pages** (page_N.html) that involve:
- MariaDB/MySQL database operations via Morgana SDK
- Kanban boards, task management, or any CRUD-heavy page
- WSL development environment with Morgana backend on Windows host

---

## 1. WSL File Write Trap (MOST IMPORTANT)

**Problem:** `write_file`, `patch`, and `sed` DO NOT reliably write to `/mnt/d/` (Windows mount) from WSL. They report success but the disk file stays unchanged.

**Symptoms:**
- You make a fix, user says "still broken"
- You check with `read_file` and it shows your fix
- But `terminal("cat /mnt/d/path/to/file")` shows OLD content
- `read_file` reads from WSL's in-memory cache, not actual disk

**Solution — WRITE TO /tmp FIRST, THEN cp + sync:**

```bash
python3 -c "
content = '''...full page HTML...'''
with open('/tmp/page_X.html', 'w', encoding='utf-8') as f:
    f.write(content)
"
cp /tmp/page_X.html /mnt/d/path/to/page_X.html && sync
```

Then ALWAYS verify with:
```bash
grep -c 'KEY_PATTERN' /mnt/d/path/to/page_X.html
```

**Never trust `read_file` for WSL-mounted files.** Always verify with `terminal("cat ... | grep ...")`.

---

## 2. Morgana Backend Access from WSL

**Problem:** Morgana backend runs on **Windows host**, not in WSL. WSL's `localhost` is isolated from Windows' `localhost`.

**Solution — Use WSL host IP:**

```bash
# Get the Windows host IP from WSL (reliable method)
WSL_HOST=$(ip route show default | awk '{print $3}')
# Note: /etc/resolv.conf nameserver may be a public DNS (223.5.5.5), NOT the host IP.
# Always use `ip route show default` instead.

# Then all Morgana API calls use this IP
curl -s http://${WSL_HOST}:3001/api/infrastructure/test
```

**Morgana SDK port:** 3001 (Morgana backend default)

**Page refresh callback:**
```bash
MORGANA="http://${WSL_HOST}:3001"
curl -s -X PUT "${MORGANA}/api/infrastructure/config" \
  -H "Content-Type: application/json" \
  -d '{"pages":{"root":"<PAGES_ROOT>","port":3002,"names":["page_N.html"]}}'
```
Format must include `pages.root` and `pages.port`. Sending `{"pages":["page_N.html"]}` returns 400.

---

## 3. MariaDB Date Serialization Pitfall

**Problem:** MySQL `DATE` type → MariaDB SDK → JavaScript `Date` object → `JSON.stringify` → `Date.toISOString()` → UTC shift.

Example: `2026-06-29` (CST, UTC+8) becomes `"2026-06-28T16:00:00.000Z"` after JSON serialization. Then `.substring(0,10)` gives `"2026-06-28"` — **one day earlier!**

**Solution — Always normalize dates to YYYY-MM-DD strings:**

```javascript
// Universal date normalizer
const dateToStr = v => {
  if (!v) return '';
  if (v instanceof Date) {
    const offset = v.getTimezoneOffset();
    const local = new Date(v.getTime() - offset * 60000);
    return local.toISOString().substring(0, 10);
  }
  const s = String(v);
  if (s.includes('T')) {
    const d = new Date(s);
    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0')
    ].join('-');
  }
  return s.substring(0, 10);
};

// For <input type="date"> value assignment
const toDateInput = v => dateToStr(v);

// For display formatting  
const formatDate = v => {
  const s = dateToStr(v);
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
};

// Past-due check — compare date strings, NOT Date objects
const todayStr = dateToStr(new Date());
const isPastDue = dateToStr(task.planned_end) < todayStr 
                  && task.status !== 'done';
```

**Key rules:**
- NEVER compare dates with `new Date(A) < new Date(B)` — timezone ruins it
- ALWAYS normalize to YYYY-MM-DD strings first, then compare lexicographically
- Use `CURDATE()` in SQL, not `NOW()`, for date-only fields

---

## 4. Morgana.query() Return Value

**Problem:** SDK's `Morgana.query()` returns the **rows array directly**, NOT `{rows: [...]}`.

```javascript
// WRONG — rows is undefined!
const { rows } = await Morgana.query('SELECT * FROM kanban_tasks');

// CORRECT
const rows = await Morgana.query('SELECT * FROM kanban_tasks');
```

Also: `Morgana.insert()` returns the insert result object with `insertId`.

---

## 5. SQL Placeholder Counting

**Problem:** Mismatched `?` count vs params array length causes silent query failure.

```javascript
// WRONG — 4 placeholders, 5 params
await Morgana.query(
  'UPDATE t SET a=?, b=?, c=?, d=? WHERE id=?',
  [a, b, c, d, e, id]  // 6 params!
);

// CORRECT — count must match exactly
await Morgana.query(
  'UPDATE t SET a=?, b=?, c=?, d=? WHERE id=?',
  [a, b, c, d, id]  // 5 params = 5 placeholders
);
```

---

## 6. Database DDL — Use pymysql, NOT Page HTML

**per `morgana-database` skill:** All DDL (CREATE TABLE, ALTER TABLE) must be done via pymysql directly, NEVER in page HTML.

```python
import pymysql
conn = pymysql.connect(host='127.0.0.1', user='morgana', password='<DB_PASSWORD>', database='morgana')
conn.cursor().execute('CREATE TABLE IF NOT EXISTS ...')
conn.commit()
```

**Credentials (from memory/SKILL.md):**
- Host: `127.0.0.1` (from WSL)
- User: `morgana`
- Password: `<DB_PASSWORD>`
- Database: `morgana`

---

## 7. Browser Cache Awareness

Always instruct user to **Ctrl+F5** (hard refresh) after page updates. Normal F5 may serve stale cached version.

---

## 8. Incremental Verification Workflow

After every modification:
1. Write to `/tmp/` first
2. `cp /tmp/page_X.html /mnt/d/path/ && sync`
3. `grep -c 'KEY_PATTERN' /mnt/d/path/page_X.html` to verify on disk
4. Call Morgana refresh API
5. Tell user to Ctrl+F5

---

## 9. Quick Checklist

- [ ] WSL `/mnt/d/` paths? → `cp + sync`, verify with `grep`
- [ ] Date fields? → Normalize with `dateToStr()`, never raw Date comparison
- [ ] `Morgana.query()`? → Destructure as array, not `{rows}`
- [ ] SQL placeholders? → Count `?` = count params
- [ ] DDL statements? → Use pymysql directly
- [ ] Page refreshed? → Call Morgana API + tell user Ctrl+F5
- [ ] Morgana port? → 3001 on Windows host, use WSL host IP from `ip route show default`
- [ ] UI state to persist across visits? → Cookie (see §11)
- [ ] Large lists that grow over time? → Time-window query + lazy load toggle (see §12)

---

## 10. Page Refresh API

**Correct format** — `PUT /api/infrastructure/config` with the full pages config object:

```bash
MORGANA="http://${WSL_HOST}:3001"
curl -s -X PUT "${MORGANA}/api/infrastructure/config" \
  -H "Content-Type: application/json" \
  -d '{"pages": {"root": "<PAGES_ROOT>", "port": 3002}}'
```

**Note:** The request must include `pages.root` and `pages.port`. Omitting either returns `"Request body must include pages.root and/or pages.port"`. The format `{"pages": ["page_8.html"]}` does NOT work.

SDK methods: `Morgana.query()`, `Morgana.insert()`, `Morgana.update()`, `Morgana.delete()`, `Morgana.submit()`.

---

## 11. Cookie-Based UI State Persistence

Use cookies to remember the user's last-selected state (board, tab, filter) so the page restores it on next visit.

```javascript
// Cookie helpers
function setCookie(name, value, days) {
  var d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/';
}
function getCookie(name) {
  var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}
```

**Pattern — Restore last state on init:**
```javascript
async function initApp() {
  // ... load boards ...
  var savedBoardId = getCookie('kanban_board_id');
  if (savedBoardId) {
    var found = boards.find(function(b) { return String(b.id) === savedBoardId; });
    if (found) currentBoardId = found.id;
  }
  if (!currentBoardId) currentBoardId = boards[0].id;  // fallback
  loadBoard();
}

async function switchBoard(id, name) {
  currentBoardId = id;
  setCookie('kanban_board_id', id, 365);
  // ... render dropdown highlight, reload tasks ...
}
```

**Key rule:** Update cookie in the same function that changes state (e.g., `switchBoard`), NOT in the rendering function. Cookie should reflect the *user's explicit choice*, not incidental renders.

---

## 12. Progressive Data Loading — Time-Window Queries

When a column can accumulate many items over time (e.g., completed tasks), default to loading only a recent window and offer a "load more" toggle for historical data. This optimizes both SQL query speed and DOM rendering.

**Pattern:**
```javascript
var olderDoneTasks = [];
var olderDoneLoaded = false;

// Helper: get Monday of current week as YYYY-MM-DD
function getWeekMonday() {
  var now = new Date();
  var day = now.getDay();  // 0=Sun, 1=Mon, ..., 6=Sat
  var diff = day === 0 ? -6 : 1 - day;
  var mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

// Main query — only this week's done tasks
async function loadBoard() {
  var monday = getWeekMonday();
  var rows = await Morgana.query(
    'SELECT * FROM kanban_tasks WHERE board_id = ? AND (status != \'done\' OR actual_end >= ?)',
    [currentBoardId, monday]
  );
  // ... render ...
  loadOlderDoneCount();  // check if there are older items
}

// Count older items (lightweight) — controls button visibility
async function loadOlderDoneCount() {
  var rows = await Morgana.query(
    'SELECT COUNT(*) AS cnt FROM kanban_tasks WHERE board_id = ? AND status = \'done\' AND actual_end < ?',
    [currentBoardId, getWeekMonday()]
  );
  var cnt = rows[0] ? rows[0].cnt : 0;
  document.getElementById('toggleBtn').style.display = cnt > 0 ? '' : 'none';
}

// Load older items on demand (only when user clicks)
async function loadOlderDone() {
  olderDoneTasks = await Morgana.query(
    'SELECT * FROM kanban_tasks WHERE board_id = ? AND status = \'done\' AND actual_end < ? ORDER BY actual_end DESC',
    [currentBoardId, getWeekMonday()]
  );
}

// Toggle: load-and-show / collapse / expand-cached
function toggleOlderDone() {
  if (!olderDoneLoaded) {
    loadOlderDone().then(function() {
      olderDoneLoaded = true;
      // append cards to column DOM
    });
  } else {
    // remove or re-insert cached cards
  }
}
```

**HTML button** — placed below the column body, hidden by default (`display:none`), shown when `loadOlderDoneCount()` finds items.

**Performance:** The main `loadBoard` query never fetches old completed tasks. The count query uses `COUNT(*)` which is fast even on large tables. The full historical query only fires on explicit user action.
