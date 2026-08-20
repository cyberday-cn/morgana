# Morgana Database Connection

## Connection Details

| Field    | Value                |
|----------|----------------------|
| Type     | MariaDB 11.4.5 LTS   |
| Host     | `localhost`          |
| Port     | `3306`               |
| Database | `morgana`            |
| User     | `root`               |
| Password | (empty — dev mode)   |

## Configuration Sources (priority order)

1. Environment variables: `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`
2. `startup/env.conf`: `DB_HOST=`, `DB_PORT=`, `DB_DATABASE=`, `DB_USER=`, `DB_PASSWORD=`
3. `backend/config/default.json`: default values

The runtime config is assembled in `backend/src/config.ts` → `loadConfig()`.

## Startup

```bash
cd <PROJECT_ROOT>/startup
./start-mariadb.sh
```

Parameters can be overridden via `startup/env.conf`.

## Dev Mode Note

MariaDB runs with `--skip-grant-tables` in development, so the password field is empty and any user/password combination is accepted. This is NOT for production use.

## Connecting from CLI

```bash
mysql -u root -h localhost -P 3306 morgana
# or simply:
mysql -u root morgana
```

## Connecting from WSL

MariaDB runs on the Windows host, not inside the WSL VM. `localhost` inside WSL points to the WSL VM's own loopback, not the Windows host. Use the Windows host IP instead.

**Discover the Windows host IP:**
```bash
ip route show default | awk '{print $3}'
# Example output: <WINDOWS_IP>
```

**Connect from WSL:**
```bash
mysql -u root -h <WINDOWS_IP> morgana
```

**From Python (pymysql):**
```python
import pymysql
conn = pymysql.connect(host='<WINDOWS_IP>', port=3306, user='root', password='', database='morgana')
```

**TCP probe before connecting (fast pre-check):**
```python
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
result = s.connect_ex(('<WINDOWS_IP>', 3306))
# result == 0 means reachable
s.close()
```

## Common Tables (morgana database)

### `kanban_tasks` — 任务看板

| Column        | Type          | Notes                               |
|---------------|---------------|-------------------------------------|
| id            | int(11) PK    | AUTO_INCREMENT                      |
| title         | varchar(255)  | 任务标题                             |
| description   | text          | 任务描述                             |
| planned_start | date          | 计划开始日期                         |
| planned_end   | date          | 计划结束日期                         |
| actual_start  | date          | 实际开始日期                         |
| actual_end    | date          | 实际结束日期                         |
| status        | enum          | 'todo' / 'in_progress' / 'done'     |
| sort_order    | int(11)       | 排序权重（默认0）                    |
| created_at    | datetime      | DEFAULT CURRENT_TIMESTAMP           |
| updated_at    | datetime      | ON UPDATE CURRENT_TIMESTAMP         |

**Common queries:**

```python
import pymysql
WSL_HOST = '<WINDOWS_IP>'  # or discover via: ip route show default | awk '{print $3}'

conn = pymysql.connect(host=WSL_HOST, port=3306, user='root', password='root', database='morgana')
try:
    with conn.cursor() as cur:
        # All tasks created this week
        cur.execute("SELECT id, title, status, created_at FROM kanban_tasks WHERE created_at >= CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY ORDER BY created_at")
        rows = cur.fetchall()

        # Tasks by status
        cur.execute("SELECT status, COUNT(*) as cnt FROM kanban_tasks GROUP BY status")

        # Overdue tasks (planned_end passed but not done)
        cur.execute("SELECT id, title, planned_end FROM kanban_tasks WHERE status != 'done' AND planned_end < CURDATE()")
finally:
    conn.close()
```

### `defects` — 缺陷管理

| Column       | Type          | Notes                                    |
|--------------|---------------|------------------------------------------|
| id           | int(11) PK    | AUTO_INCREMENT                           |
| title        | varchar(255)  | 缺陷标题                                  |
| description  | text          | 缺陷描述                                  |
| severity     | varchar(20)   | critical/major/minor/trivial              |
| priority     | varchar(10)   | p0/p1/p2/p3                              |
| status       | varchar(20)   | open/in_progress/resolved/closed/reopened |
| assignee     | varchar(100)  | 负责人                                    |
| created_at   | datetime      |                                          |
| updated_at   | datetime      |                                          |

### `requirements` — 需求管理

Same structure as `defects` — title, description, severity, priority, status, assignee, timestamps.

## Agent Querying Pattern

When a user asks about data in Morgana (kanban tasks, defects, requirements):

1. **Do NOT assume localStorage** — data lives in the Windows-host MariaDB, not in the browser.
2. **Connect via PyMySQL** from execute_code — the `mysql` CLI is not installed in WSL.
3. **Use the Windows host IP** (discovered from `ip route show default`), not `localhost`.
4. **Password**: `root` works in dev mode (`--skip-grant-tables` accepts any password).
5. **Database name**: `morgana`, not `hermes_pages`.
