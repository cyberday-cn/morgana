import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StoredMessage, Task, FileAttachment } from '../types'
import { useAgentStore } from './useAgentStore'
import { useLayoutStore } from './useLayoutStore'

const API_BASE = 'http://localhost:3001/api'

const TYPE_GROUP_LABELS: Record<string, string> = {
  chat: '任务',
  config: '配置',
  page: '页面',
}

const TYPE_GROUP_ORDER = ['chat', 'config', 'page']

function computeGroupedTasks(tasks: Task[]): [string, Task[]][] {
  const groups = new Map<string, Task[]>()

  for (const t of tasks) {
    const label = TYPE_GROUP_LABELS[t.type] || '其他'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(t)
  }

  const result: [string, Task[]][] = []
  for (const type of TYPE_GROUP_ORDER) {
    const label = TYPE_GROUP_LABELS[type]
    if (groups.has(label)) {
      const sorted = groups.get(label)!.sort((a, b) => {
        const aTime = a.last_message_at ?? a.created_at
        const bTime = b.last_message_at ?? b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
      result.push([label, sorted])
    }
  }
  return result
}

export interface InitTaskInfo {
  taskId: number
  agentId: number
}

type NLStore = {
  // State
  messages: StoredMessage[]
  inputValue: string
  sidebarExpanded: boolean
  tasks: Task[]
  groupedTasks: [string, Task[]][]
  selectedTaskId: number | null
  quickChatOpen: boolean
  isProcessing: boolean
  streamingContent: string
  streamingTaskId: number | null  // which task owns the current SSE stream
  generatingPage: boolean
  generatingPageTaskId: number | null  // which task is generating a page
  currentRunId: string | null
  pendingFiles: File[]
  error: string | null
  initTaskInfo: InitTaskInfo | null
  activeTaskType: 'chat' | 'config' | 'page'

  // UI actions
  setInputValue: (value: string) => void
  addMessage: (message: StoredMessage) => void
  toggleSidebar: () => void
  setSidebarExpanded: (expanded: boolean) => void
  expandSidebar: () => void
  selectTask: (id: number) => void
  toggleQuickChat: () => void
  closeQuickChat: () => void
  setPendingFiles: (files: File[]) => void
  addPendingFile: (file: File) => void
  removePendingFile: (index: number) => void
  clearPendingFiles: () => void
  clearError: () => void
  clearInitTaskInfo: () => void
  setGeneratingPage: (generating: boolean, taskId?: number) => void
  stopPageGeneration: () => void
  setActiveTaskType: (type: 'chat' | 'config' | 'page') => void

  // API actions
  fetchTasks: () => Promise<void>
  createTask: (title?: string) => Promise<Task | null>
  updateTask: (id: number, title: string) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  loadTaskMessages: (taskId: number) => Promise<void>
  sendMessage: (taskId: number, initAgentId?: number, message?: string) => Promise<void>
  sendInitMessage: (taskId: number, agentId: number) => Promise<void>
  generatePage: (userMessage: string, agentMessage: string) => Promise<boolean>
  uploadFiles: (files: File[]) => Promise<number[]>
}

// Counter to track sendMessage generations (prevents stale finally block overwrites)
let _sendSeq = 0
let _generatingTimeout: ReturnType<typeof setTimeout> | null = null

// Shared flag: when the user cancels page generation, set to true so that
// PageContent's SSE handler ignores the next page_refresh event.
// This is a module-level variable, not React state, because two independent
// components (ChatHistory, PageContent) both need to check it synchronously
// in their SSE event handlers.
export let _skipNextPageRefresh = false
export function clearSkipNextPageRefresh() { _skipNextPageRefresh = false }

// Flag: set when emerge page generation starts, consumed by PageContent's SSE
// handler to auto-switch to the "涌现" tab on page_refresh.
export let _expectEmergeRefresh = false
export function clearExpectEmergeRefresh() { _expectEmergeRefresh = false }

export const useNLStore = create<NLStore>()(
  persist(
    (set, get) => ({
  // ---- Initial State ----
  messages: [],
  inputValue: '',
  sidebarExpanded: false,
  tasks: [],
  groupedTasks: [],
  selectedTaskId: null,
  quickChatOpen: false,
  isProcessing: false,
  streamingContent: '',
  streamingTaskId: null,
  generatingPage: false,
  generatingPageTaskId: null,
  currentRunId: null,
  pendingFiles: [],
  error: null,
  initTaskInfo: null,
  activeTaskType: 'chat',

  // ---- UI Actions ----
  setInputValue: (value) => set({ inputValue: value }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  toggleSidebar: () =>
    set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
  expandSidebar: () => set({ sidebarExpanded: true }),
  selectTask: (id) => {
    const task = get().tasks.find((t) => t.id === id)
    const activeTaskType = task?.type === 'config' || task?.type === 'page' ? task.type : 'chat'
    // Clear streaming content when switching to a different task
    const { streamingTaskId } = get()
    if (streamingTaskId !== null && streamingTaskId !== id) {
      set({ streamingContent: '' })
    }
    set({ selectedTaskId: id, activeTaskType })
  },
  toggleQuickChat: () =>
    set((state) => ({ quickChatOpen: !state.quickChatOpen })),
  closeQuickChat: () => set({ quickChatOpen: false }),
  setPendingFiles: (files) => set({ pendingFiles: files }),
  addPendingFile: (file) =>
    set((state) => ({ pendingFiles: [...state.pendingFiles, file] })),
  removePendingFile: (index) =>
    set((state) => ({
      pendingFiles: state.pendingFiles.filter((_, i) => i !== index),
    })),
  clearPendingFiles: () => set({ pendingFiles: [] }),
  clearError: () => set({ error: null }),
  clearInitTaskInfo: () => set({ initTaskInfo: null }),
  setGeneratingPage: (generating, taskId?: number) => {
    if (_generatingTimeout !== null) {
      clearTimeout(_generatingTimeout)
      _generatingTimeout = null
    }
    if (generating) {
      _skipNextPageRefresh = false // new generation starts fresh
      _expectEmergeRefresh = true
      _generatingTimeout = setTimeout(() => {
        _generatingTimeout = null
        _expectEmergeRefresh = false
        set({ generatingPage: false, currentRunId: null })
      }, 60000)
    }
    const genTaskId = taskId ?? (generating ? get().selectedTaskId : null)
    set({ generatingPage: generating, generatingPageTaskId: genTaskId, currentRunId: generating ? get().currentRunId : null })
  },
  stopPageGeneration: () => {
    // Cancel the Hermes run (best-effort), then reset state
    const { currentRunId } = get()
    if (currentRunId) {
      fetch(`${API_BASE}/chat/generate-page/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: currentRunId }),
      }).catch(() => {})
    }
    if (_generatingTimeout !== null) {
      clearTimeout(_generatingTimeout)
      _generatingTimeout = null
    }
    _skipNextPageRefresh = true // tell PageContent to ignore the incoming refresh
    _expectEmergeRefresh = false
    set({ generatingPage: false, currentRunId: null })
  },

  setActiveTaskType: (type) => set({ activeTaskType: type }),

  // ---- API Actions ----
  fetchTasks: async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const tasks: Task[] = await res.json()
      set((state) => {
        const update: Partial<NLStore> = {
          tasks,
          groupedTasks: computeGroupedTasks(tasks),
          error: null,
        }
        // Auto-select the latest task if none is selected
        if (state.selectedTaskId === null && tasks.length > 0) {
          update.selectedTaskId = tasks[0].id
        }
        return update
      })
      // Auto-load messages for the newly auto-selected task
      const { selectedTaskId } = get()
      if (selectedTaskId !== null && tasks.length > 0 && selectedTaskId === tasks[0].id) {
        get().loadTaskMessages(selectedTaskId)
      }
    } catch (err) {
      set({ error: String(err) })
    }
  },

  createTask: async (title = '新对话') => {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error('Failed to create task')
      const task: Task = await res.json()
      set((state) => {
        const newTasks = [task, ...state.tasks]
        return {
          tasks: newTasks,
          groupedTasks: computeGroupedTasks(newTasks),
          selectedTaskId: task.id,
          messages: [],
          error: null,
        }
      })
      return task
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  updateTask: async (id, title) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error('Failed to update task')
      const updated: Task = await res.json()
      set((state) => {
        const newTasks = state.tasks.map((t) =>
          t.id === id ? updated : t
        )
        return { tasks: newTasks, groupedTasks: computeGroupedTasks(newTasks), error: null }
      })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  deleteTask: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete task')
      set((state) => {
        const newTasks = state.tasks.filter((t) => t.id !== id)
        return {
          tasks: newTasks,
          groupedTasks: computeGroupedTasks(newTasks),
          selectedTaskId:
            state.selectedTaskId === id ? null : state.selectedTaskId,
          messages: state.selectedTaskId === id ? [] : state.messages,
          error: null,
        }
      })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  loadTaskMessages: async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/messages`)
      if (!res.ok) throw new Error('Failed to load messages')
      const messages: StoredMessage[] = await res.json()
      set({ messages, error: null })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  sendMessage: async (taskId, initAgentId, message?) => {
    const { inputValue, pendingFiles, isProcessing } = get()
    const text = message ?? inputValue
    if (!text.trim() || isProcessing) return
    const seq = ++_sendSeq

    set({
      isProcessing: true,
      streamingContent: '',
      streamingTaskId: taskId,
      error: null,
    })
    const messageText = text
    if (message === undefined) set({ inputValue: '' })

    let fullContent = ''
    try {
      // Upload pending files first if any
      let fileIds: number[] = []
      if (pendingFiles.length > 0) {
        fileIds = await get().uploadFiles(pendingFiles)
        set({ pendingFiles: [] })
      }

      // Stream from backend using Chat Completions API
      const body: Record<string, any> = { taskId, message: messageText, fileIds }
      if (initAgentId) {
        body.initAgentId = initAgentId
      } else {
        // Auto-detect active agent for chat prompt
        const activeConfig = useAgentStore.getState().configs.find((c) => c.is_active)
        if (activeConfig) {
          body.chatAgentId = activeConfig.id
        }
      }

      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to send message')
      }

      // Read the SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Response body is not readable')

      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const dataStr = trimmed.slice(6)

          try {
            const event = JSON.parse(dataStr)

            switch (event.type) {
              case 'user_message':
                // Only reload messages if user hasn't switched to another task
                if (get().selectedTaskId === taskId) {
                  await get().loadTaskMessages(taskId)
                }
                break

              case 'init_started':
                // Initialization mode active; store the agent info
                if (event.agentId) {
                  set({ initTaskInfo: { taskId, agentId: event.agentId } })
                }
                break

              case 'chunk':
                fullContent += event.content
                // Only update streaming display if this task is still selected
                if (get().selectedTaskId === taskId) {
                  set({ streamingContent: fullContent })
                }
                break

              case 'done':
                // Final message saved; clear streaming state
                set({ streamingContent: '' })
                // Only append message and trigger page generation for the
                // currently selected task — if user switched away, the message
                // is already saved in backend and will load on next switch-back
                if (get().selectedTaskId === taskId) {
                  set((state) => ({
                    messages: [...state.messages, event.message],
                    isProcessing: false,
                  }))
                  // Auto-trigger page generation after normal (non-init) agent response
                  // Only for 'chat' type tasks — config and page tasks don't need emerge pages
                  const agentContent = event.message?.content || ''
                  if (!initAgentId && agentContent) {
                    const currentTask = get().tasks.find(t => t.id === taskId)
                    if (currentTask?.type === 'chat') {
                      const { mode } = useLayoutStore.getState()
                      if (mode === 'split' || mode === 'ui-focus') {
                        get().setGeneratingPage(true, taskId)
                        get().generatePage(messageText, agentContent).then((ok) => {
                          // Only clear on failure if user hasn't already stopped
                          if (!ok && get().generatingPage) get().setGeneratingPage(false, taskId)
                        })
                      }
                    }
                  }
                }
                // If task was renamed, update the task list (safe to do regardless)
                if (event.task_title) {
                  set((state) => {
                    const newTasks = state.tasks.map((t) =>
                      t.id === taskId ? { ...t, title: event.task_title } : t
                    )
                    return { tasks: newTasks, groupedTasks: computeGroupedTasks(newTasks) }
                  })
                }
                break

              case 'task_renamed':
                // Title auto-generated by backend; update task list
                if (event.task_title) {
                  set((state) => {
                    const newTasks = state.tasks.map((t) =>
                      t.id === taskId ? { ...t, title: event.task_title } : t
                    )
                    return { tasks: newTasks, groupedTasks: computeGroupedTasks(newTasks) }
                  })
                }
                break

              case 'error':
                throw new Error(event.error || 'Stream error')
            }
          } catch (e: any) {
            if (e.message?.includes('Stream error') || e.message?.includes('No active agent')) {
              throw e
            }
            // Ignore parse errors for malformed SSE lines
          }
        }
      }
    } catch (err) {
      // If the stream was interrupted (e.g. tsx restart from Hermes file edits)
      // but we already accumulated content, save it so the user doesn't lose it.
      if (fullContent && get().selectedTaskId === taskId) {
        const partialMsg: StoredMessage = {
          id: Date.now(),
          task_id: taskId,
          role: 'agent',
          content: fullContent + '\n\n*[回复被中断，服务器重启中]*',
          type: 'text',
          created_at: new Date().toISOString(),
        }
        set((state) => ({
          messages: [...state.messages, partialMsg],
          streamingContent: '',
          error: null,
        }))
        // Best-effort: persist the partial message to the backend
        fetch(`${API_BASE}/tasks/${taskId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'agent', content: partialMsg.content, type: 'text' }),
        }).catch(() => {})
      } else {
        set({ streamingContent: '', error: String(err) })
      }
    } finally {
      // Only clear processing if no newer sendMessage started (avoids race condition)
      set((state) => {
        if (seq === _sendSeq) return { isProcessing: false, streamingTaskId: null }
        return {}
      })
    }
  },

  generatePage: async (userMessage: string, agentMessage: string): Promise<boolean> => {
    try {
      const activeConfig = useAgentStore.getState().configs.find((c) => c.is_active)
      const res = await fetch(`${API_BASE}/chat/generate-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatAgentId: activeConfig?.id,
          userMessage,
          agentMessage,
        }),
      })
      if (!res.ok) throw new Error('Failed to trigger page generation')
      const data = await res.json()
      // Only store runId if still generating (not cancelled by user)
      if (data.runId && get().generatingPage) set({ currentRunId: data.runId })
      return true
    } catch (err) {
      set({ error: String(err) })
      return false
    }
  },

  sendInitMessage: async (taskId, agentId) => {
    // Set input value to the init instruction and immediately send
    set({
      inputValue: '请开始初始化基础设施，搭建页面服务。',
    })
    // sendMessage will read inputValue from store
    await get().sendMessage(taskId, agentId)
  },

  uploadFiles: async (files) => {
    const ids: number[] = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`Failed to upload ${file.name}`)
      const result: FileAttachment = await res.json()
      ids.push(result.id)
    }
    return ids
  },
    }),
    {
      name: 'morgana-nl',
      partialize: (state) => ({ sidebarExpanded: state.sidebarExpanded }),
    }
  )
)
