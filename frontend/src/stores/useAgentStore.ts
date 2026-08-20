import { create } from 'zustand'
import type { AgentConfig, AgentConfigForm, InfrastructureConfig } from '../types'

const API_BASE = 'http://localhost:3001/api'

interface AgentStore {
  configs: AgentConfig[]
  loading: boolean
  error: string | null
  showDialog: boolean
  editingConfig: AgentConfig | null
  infrastructure: InfrastructureConfig | null
  setShowDialog: (show: boolean) => void
  setEditingConfig: (config: AgentConfig | null) => void
  openNew: () => void
  openEdit: (config: AgentConfig) => void
  closeDialog: () => void
  fetchConfigs: () => Promise<void>
  createConfig: (form: AgentConfigForm) => Promise<void>
  updateConfig: (id: number, form: Partial<AgentConfigForm>) => Promise<void>
  deleteConfig: (id: number) => Promise<void>
  activateConfig: (id: number) => Promise<void>
  initializeAgent: (id: number) => Promise<{ task: any; agent: AgentConfig } | null>
  completeInitAgent: (id: number) => Promise<boolean>
  fetchInfrastructureConfig: () => Promise<void>
  fetchDefaultInitPrompt: (agentId: number) => Promise<string | null>
  fetchDefaultChatPrompt: (agentId: number) => Promise<string | null>
  fetchDefaultPagePrompt: (agentId: number) => Promise<string | null>
  fetchDefaultEmergePrompt: (agentId: number) => Promise<string | null>
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  configs: [],
  loading: false,
  error: null,
  showDialog: false,
  editingConfig: null,
  infrastructure: null,

  setShowDialog: (show) => set({ showDialog: show }),
  setEditingConfig: (config) => set({ editingConfig: config }),

  openNew: () => set({ showDialog: true, editingConfig: null }),
  openEdit: (config) => set({ showDialog: true, editingConfig: config }),
  closeDialog: () => set({ showDialog: false, editingConfig: null }),

  fetchConfigs: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/agent-configs`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const configs = await res.json()
      set({ configs, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  createConfig: async (form) => {
    set({ error: null })
    try {
      const res = await fetch(`${API_BASE}/agent-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const created = await res.json()
      set((s) => ({ configs: [created, ...s.configs], showDialog: false, editingConfig: null }))
    } catch (err) {
      set({ error: String(err) })
      throw err
    }
  },

  updateConfig: async (id, form) => {
    set({ error: null })
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = await res.json()
      set((s) => ({
        configs: s.configs.map((c) => (c.id === id ? updated : c)),
        showDialog: false,
        editingConfig: null,
      }))
    } catch (err) {
      set({ error: String(err) })
      throw err
    }
  },

  deleteConfig: async (id) => {
    set({ error: null })
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      set((s) => ({ configs: s.configs.filter((c) => c.id !== id) }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  activateConfig: async (id) => {
    set({ error: null })
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${id}/activate`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const activated = await res.json()
      set((s) => ({
        configs: s.configs.map((c) => ({ ...c, is_active: c.id === id })),
      }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  initializeAgent: async (id) => {
    set({ error: null })
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${id}/init`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data // { task, agent }
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  completeInitAgent: async (id) => {
    set({ error: null })
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${id}/init-complete`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      set((s) => ({
        configs: s.configs.map((c) => (c.id === id ? { ...c, initialized: 1 } : c)),
      }))
      return true
    } catch (err) {
      set({ error: String(err) })
      return false
    }
  },

  fetchDefaultInitPrompt: async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${agentId}/default-init-prompt`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.prompt || null
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  fetchDefaultChatPrompt: async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${agentId}/default-chat-prompt`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.prompt || null
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  fetchDefaultPagePrompt: async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${agentId}/default-page-prompt`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.prompt || null
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  fetchDefaultEmergePrompt: async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/agent-configs/${agentId}/default-emerge-prompt`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.prompt || null
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  fetchInfrastructureConfig: async () => {
    try {
      const res = await fetch(`${API_BASE}/infrastructure/config`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: InfrastructureConfig = await res.json()
      set({ infrastructure: data })
    } catch (err) {
      set({ error: String(err) })
    }
  },
}))
