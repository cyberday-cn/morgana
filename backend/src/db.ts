import mysql from 'mysql2/promise'
import { config } from './config.js'

let pool: mysql.Pool

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })

    // Test connection
    const conn = await pool.getConnection()
    conn.release()
    console.log(`[DB] Connected to MySQL at ${config.db.host}:${config.db.port}/${config.db.database}`)
  }
  return pool
}

export async function initSchema(): Promise<void> {
  const p = await getPool()
  await p.execute(`
    CREATE TABLE IF NOT EXISTS agent_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      protocol ENUM('acp', 'api-server') NOT NULL DEFAULT 'acp',
      endpoint VARCHAR(500) NOT NULL,
      api_key VARCHAR(500) DEFAULT NULL,
      description TEXT DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('[DB] Schema initialized (agent_configs)')

  // Safe migration: add initialized column if not exists
  try {
    await p.execute('ALTER TABLE agent_configs ADD COLUMN initialized TINYINT(1) DEFAULT 0')
    console.log('[DB] Added initialized column to agent_configs')
  } catch {
    // Column already exists — ignore
  }

  // Safe migration: add init_prompt column if not exists
  try {
    await p.execute('ALTER TABLE agent_configs ADD COLUMN init_prompt TEXT DEFAULT NULL')
    console.log('[DB] Added init_prompt column to agent_configs')
  } catch {
    // Column already exists — ignore
  }

  // Safe migration: add chat_prompt column if not exists
  try {
    await p.execute('ALTER TABLE agent_configs ADD COLUMN chat_prompt TEXT DEFAULT NULL')
    console.log('[DB] Added chat_prompt column to agent_configs')
  } catch {
    // Column already exists — ignore
  }

  // Safe migration: add page_prompt column if not exists
  try {
    await p.execute('ALTER TABLE agent_configs ADD COLUMN page_prompt TEXT DEFAULT NULL')
    console.log('[DB] Added page_prompt column to agent_configs')
  } catch {
    // Column already exists — ignore
  }

  // Safe migration: add emerge_prompt column if not exists
  try {
    await p.execute('ALTER TABLE agent_configs ADD COLUMN emerge_prompt TEXT DEFAULT NULL')
    console.log('[DB] Added emerge_prompt column to agent_configs')
  } catch {
    // Column already exists — ignore
  }

  // Tasks table
  await p.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('[DB] Schema initialized (tasks)')

  // Safe migration: add type column to tasks
  try {
    await p.execute("ALTER TABLE tasks ADD COLUMN type ENUM('chat','config','page') DEFAULT 'chat'")
    console.log('[DB] Added type column to tasks')
  } catch { /* already exists */ }

  // Safe migration: add page_id column to tasks
  try {
    await p.execute('ALTER TABLE tasks ADD COLUMN page_id INT DEFAULT NULL')
    console.log('[DB] Added page_id column to tasks')
  } catch { /* already exists */ }

  // Pages table
  await p.execute(`
    CREATE TABLE IF NOT EXISTS pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      icon VARCHAR(50) DEFAULT 'page',
      task_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('[DB] Schema initialized (pages)')

  // Safe migration: add share_token column to pages
  try {
    await p.execute("ALTER TABLE pages ADD COLUMN share_token VARCHAR(64) UNIQUE DEFAULT NULL")
    console.log('[DB] Added share_token column to pages')
  } catch { /* already exists */ }

  // Backfill existing pages with generated share_token
  try {
    const { randomBytes } = await import('crypto')
    const [rows] = await p.execute('SELECT id FROM pages WHERE share_token IS NULL') as any[]
    for (const row of rows) {
      const token = randomBytes(16).toString('hex')
      await p.execute('UPDATE pages SET share_token = ? WHERE id = ?', [token, row.id])
    }
    if (rows.length > 0) console.log(`[DB] Backfilled share_token for ${rows.length} existing pages`)
  } catch { /* ignore */ }

  // Migration: set existing init tasks to type='config'
  try {
    const [result] = await p.execute(
      "UPDATE tasks SET type = 'config' WHERE type = 'chat' AND id IN (SELECT task_id FROM messages WHERE role = 'user' AND content LIKE '%请开始初始化基础设施%')"
    )
    const upd = result as any
    if (upd.affectedRows > 0) console.log(`[DB] Migrated ${upd.affectedRows} tasks to type=config`)
  } catch { /* ignore if column doesn't exist yet */ }

  // Messages table
  await p.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      role ENUM('user','agent') NOT NULL,
      content TEXT NOT NULL,
      type VARCHAR(20) DEFAULT 'text',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('[DB] Schema initialized (messages)')

  // File attachments table
  await p.execute(`
    CREATE TABLE IF NOT EXISTS file_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT DEFAULT NULL,
      original_name VARCHAR(500) NOT NULL,
      stored_name VARCHAR(200) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('[DB] Schema initialized (file_attachments)')
}
