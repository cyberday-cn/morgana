# Mind Map Page (SDK-Only Fixed Page Example)

Concrete implementation of a fixed page with tree-structured data persistence, using Morgana JS SDK directly (no backend API).

## Database Tables

```sql
CREATE TABLE mind_maps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT '思维导图',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE mind_map_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    map_id INT NOT NULL,
    parent_id INT DEFAULT NULL,
    label VARCHAR(500) NOT NULL DEFAULT '新节点',
    note TEXT,
    color VARCHAR(20) DEFAULT '#4f46e5',
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (map_id) REFERENCES mind_maps(id) ON DELETE CASCADE
);
```

## Key Architecture Decisions

### SDK-only, no API server
All database operations happen in the browser via Morgana.query/insert/update/delete.
No Python API server, no port conflicts, no extra service to manage on WSL restart.

### SQL string quoting
CRITICAL: SQL containing string literals (DEFAULT '思维导图') requires JS double quotes:
```js
await Morgana.insert("CREATE TABLE t (name VARCHAR(100) DEFAULT '默认名')");  // correct
await Morgana.insert('CREATE TABLE t (name VARCHAR(100) DEFAULT \'默认名\')'); // wrong - syntax error
```

### Sample data seeding
Init flow checks if database is empty and creates sample data if needed:
```js
async function loadMaps() {
  var result = await Morgana.query("SELECT * FROM mind_maps");
  if (result.length === 0) {
    await createSampleData();
    return await loadMaps();
  }
  // ...
}
```

### Tree rendering approach
- DOM-based nodes (not canvas/SVG for interactivity)
- SVG overlay for connector lines
- Layout: recursive pass calculating subtree heights → assign (x,y) positions
  - x = LVL_GAP + depth * (NODE_WIDTH + H_GAP)
  - y = parent subtree start + (children total height - node height) / 2
- Variables (var) instead of let/const for browser compatibility
- No external dependencies (no D3.js, no libraries)

## Key Functions

| Function | Purpose |
|----------|---------|
| `initDb()` | CREATE TABLE IF NOT EXISTS both tables |
| `createSampleData()` | Insert 13-node mind map with parent-child relationships |
| `loadMaps()` | SELECT all maps → auto-select first or create sample data |
| `selectMap(id)` | SELECT map + nodes → build tree → render canvas |
| `buildTree()` | Link nodes by parent_id → calc subtree heights |
| `renderMindMap()` | DOM rendering + SVG connectors + collapsed node handling |
| `createMap()` | INSERT map + root node via SDK |
| `addChildNode()` / `addSiblingNode()` | INSERT new node, push to local array, re-render |
| `deleteSelectedNode()` | Collect descendant IDs → DELETE each → filter local array |

## Pitfalls Encountered

1. **JS single-quote vs SQL single-quote**: Using `'CREATE TABLE ... DEFAULT '默认名''` creates a JS syntax error. Always use `"` for JS strings containing SQL that has string literals.

2. **Morgana.insert() returns an object**: `{insertId, affectedRows}` — NOT a plain number. Use `result.insertId` to get the auto-increment ID.

3. **WSL /mnt/d/ write issue**: write_file and patch silently fail. Use Python open().write() via execute_code for `<PAGES_ROOT>/`.

4. **Morgana SDK source**: Served from the Windows host at `http://localhost:3001/api/sdk/morgana.js`. Not available inside WSL directly — but when the page loads in Morgana's webview (on Windows/phone), localhost resolves to the Windows host and the SDK loads correctly.

## File Location

- **Page file**: `<PAGES_ROOT>/page_13.html` (served by HTTP server on port 3002)
- **Old API server**: Removed (mindmap_api.py deleted)
