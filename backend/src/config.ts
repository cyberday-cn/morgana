import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface DbConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

interface ServerConfig {
  port: number
}

interface PagesConfig {
  root: string
  port: number
}

interface TmpfileConfig {
  dir: string
}

export interface AppConfig {
  server: ServerConfig
  db: DbConfig
  pages: PagesConfig
  tmpfile: TmpfileConfig
}

/**
 * 尝试从 startup/env.conf 加载 KEY=VALUE 配置
 */
export function getEnvConfPath(): string {
  return join(__dirname, '..', '..', 'startup', 'env.conf')
}

export function loadEnvConf(): Record<string, string> {
  const envPath = getEnvConfPath()
  if (!existsSync(envPath)) return {}

  const result: Record<string, string> = {}
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) result[m[1]] = m[2]
  }
  return result
}

/**
 * 更新 startup/env.conf 中的 KEY=VALUE 条目，并同步更新内存中的 config 对象。
 * 支持 PAGES_ROOT、PAGES_PORT 等页面相关配置。
 */
export function updateEnvConf(changes: Record<string, string>): void {
  const envPath = getEnvConfPath()
  let content = ''
  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf-8')
  }

  // Track which keys were updated in the file
  const updatedKeys = new Set<string>()

  // Process each line: update matching KEY=VALUE lines
  const lines = content.split('\n')
  const newLines = lines.map((line) => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m && m[1] in changes) {
      updatedKeys.add(m[1])
      return `${m[1]}=${changes[m[1]]}`
    }
    return line
  })

  // Append any keys not found (were not in file)
  for (const [key, value] of Object.entries(changes)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${value}`)
    }
  }

  writeFileSync(envPath, newLines.join('\n'), 'utf-8')
  console.log(`[Config] Updated env.conf: ${Object.keys(changes).join(', ')}`)

  // Sync in-memory config
  if ('PAGES_ROOT' in changes) {
    config.pages.root = changes['PAGES_ROOT']
  }
  if ('PAGES_PORT' in changes) {
    config.pages.port = parseInt(changes['PAGES_PORT'], 10)
  }
}

function loadConfig(): AppConfig {
  const configDir = join(__dirname, '..', 'config')
  const defaultPath = join(configDir, 'default.json')

  if (!existsSync(defaultPath)) {
    throw new Error(`Config file not found: ${defaultPath}`)
  }

  const raw = readFileSync(defaultPath, 'utf-8')
  const config: AppConfig = JSON.parse(raw)

  // 优先：环境变量 > env.conf > default.json
  const envConf = loadEnvConf()

  config.db.host = process.env.DB_HOST || envConf['DB_HOST'] || config.db.host
  config.db.port = parseInt(process.env.DB_PORT || envConf['DB_PORT'] || String(config.db.port), 10)
  config.db.database = process.env.DB_DATABASE || envConf['DB_DATABASE'] || config.db.database
  config.db.user = process.env.DB_USER || envConf['DB_USER'] || config.db.user
  config.db.password = process.env.DB_PASSWORD || (envConf['DB_PASSWORD'] ?? config.db.password)
  config.server.port = parseInt(process.env.SERVER_PORT || envConf['SERVER_PORT'] || String(config.server.port), 10)

  // Pages configuration
  config.pages.root = process.env.PAGES_ROOT || envConf['PAGES_ROOT'] || config.pages.root
  config.pages.port = parseInt(process.env.PAGES_PORT || envConf['PAGES_PORT'] || String(config.pages.port), 10)

  // Tmpfile configuration — default to <project-root>/tmpfile
  const projectRoot = resolve(dirname(__dirname), '..')
  config.tmpfile.dir = process.env.TMPFILE_DIR || envConf['TMPFILE_DIR'] || (config.tmpfile.dir || join(projectRoot, 'tmpfile'))

  return config
}

export const config = loadConfig()
