// ============ Layout ============

export type LayoutMode = 'split' | 'ui-focus' | 'nl-focus'

export interface LayoutState {
  mode: LayoutMode
  nlVisible: boolean
  uiVisible: boolean
}

// ============ NL Module ============

export interface Author {
  role: 'user' | 'agent'
  name: string
}

export interface Message {
  id: string
  author: Author
  content: string
  timestamp: Date
  type?: 'text' | 'spec' | 'command'
}

export interface StoredMessage {
  id: number
  task_id: number
  role: 'user' | 'agent'
  content: string
  type: string
  created_at: string
  files?: FileAttachment[]
}

export type TaskType = 'chat' | 'config' | 'page'

export interface Task {
  id: number
  title: string
  type: TaskType
  page_id: number | null
  created_at: string
  updated_at: string
  last_message_at?: string | null
}

export interface FileAttachment {
  id: number
  message_id: number | null
  original_name: string
  stored_name: string
  mime_type: string
  file_size: number
  created_at: string
}

export interface NLModuleState {
  messages: Message[]
  inputValue: string
  isProcessing: boolean
}

// ============ UI Module ============

export type PageType = 'fixed' | 'temporary'

export interface Page {
  id: string
  name: string
  type: PageType
  icon?: string
  taskId?: number | null
  shareToken?: string | null
  createdAt: Date
  expiresAt?: Date
}

export interface UIState {
  pages: Page[]
  activePageId: string | null
  editMode: boolean
}

// ============ Agent ============

export interface EventPayload {
  type: string
  source: string
  payload: Record<string, unknown>
  timestamp: string
}

export interface Action {
  command: string
  params: Record<string, unknown>
}

// ============ Agent Config ============

export type AgentProtocol = 'acp' | 'api-server'

export interface AgentConfig {
  id: number
  name: string
  protocol: AgentProtocol
  endpoint: string
  api_key: string | null
  description: string | null
  is_active: boolean
  initialized: boolean | number
  init_prompt: string | null
  chat_prompt: string | null
  page_prompt: string | null
  emerge_prompt: string | null
  created_at: string
  updated_at: string
}

export interface InfrastructureConfig {
  db: {
    host: string
    port: number
    database: string
    user: string
    password_configured: boolean
  }
  pages: {
    root: string
    port: number
  }
  server: {
    port: number
  }
}

export interface AgentConfigForm {
  name: string
  protocol: AgentProtocol
  endpoint: string
  api_key: string
  description: string
  init_prompt: string
  chat_prompt: string
  page_prompt: string
  emerge_prompt: string
}
