import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Page } from '../types'
import { useNLStore } from './useNLStore'
import { useLayoutStore } from './useLayoutStore'

const API_BASE = 'http://localhost:3001/api'

interface UIStore {
  pages: Page[]
  activePageId: string | null
  editMode: boolean
  /** True while the "+" new-page input is visible */
  creatingNew: boolean

  setActivePage: (id: string) => void
  toggleEditMode: () => void
  /** Enter new-page mode (show inline input) */
  startCreating: () => void
  /** Commit new page with the given name — calls backend API */
  createPage: (name: string) => Promise<string>
  /** Cancel new-page mode without creating */
  cancelCreating: () => void
  /** Delete page — calls backend API and removes linked task */
  deletePage: (id: string) => Promise<void>
  renamePage: (id: string, newName: string) => void
  addTemporaryPage: (page: Omit<Page, 'type' | 'createdAt' | 'expiresAt'>) => void
  removeTemporaryPage: (id: string) => void
  /** Load pages from backend (restores tabs on restart) */
  fetchPages: () => Promise<void>
  /** Drag-and-drop reorder: move `fromId` before `toId`, or to end if `toId` is null */
  reorderPages: (fromId: string, toId: string | null) => void
}

let _pageIdCounter = 0

const DEFAULT_PAGES: Page[] = [
  { id: 'interact', name: '涌现', type: 'fixed', icon: '💡', createdAt: new Date() },
]

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
  pages: DEFAULT_PAGES,
  activePageId: 'interact',
  editMode: false,
  creatingNew: false,

  setActivePage: (id) => {
    const prevId = get().activePageId
    set({ activePageId: id })

    const page = get().pages.find((p) => p.id === id)

    if (id === 'interact') {
      // 涌现: switch to latest chat task, mixed mode, expand sidebar
      const nlStore = useNLStore.getState()
      const chatTasks = nlStore.tasks.filter((t) => t.type === 'chat')
      if (chatTasks.length > 0) {
        const latest = chatTasks[0]
        nlStore.selectTask(latest.id)
        nlStore.loadTaskMessages(latest.id)
      }
      useLayoutStore.getState().setMode('split')
      nlStore.expandSidebar()
    } else if (page?.taskId) {
      // When clicking a fixed page tab with a linked task, select it in the sidebar
      const nlStore = useNLStore.getState()
      nlStore.selectTask(page.taskId)
      nlStore.loadTaskMessages(page.taskId)

      // Auto enter UI mode when switching from 涌现 to a fixed page
      if (prevId === 'interact') {
        useLayoutStore.getState().setMode('ui-focus')
      }
    }
  },

  toggleEditMode: () => {
    const next = !get().editMode
    set({ editMode: next })
    if (!next) set({ creatingNew: false })
  },

  startCreating: () => set({ creatingNew: true }),

  createPage: async (name) => {
    try {
      // Create page and linked task via backend API
      const res = await fetch(`${API_BASE}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || '新页面' }),
      })
      if (!res.ok) throw new Error('Failed to create page')
      const data = await res.json()
      const backendPage = data.page
      const taskId = data.taskId

      const id = String(backendPage.id)
      const newPage: Page = {
        id,
        name: name.trim() || '新页面',
        type: 'fixed',
        icon: backendPage.icon || '',
        taskId,
        createdAt: new Date(),
      }

      set((state) => ({
        pages: [...state.pages, newPage],
        activePageId: id,
        creatingNew: false,
      }))

      // Refresh task list and select the linked task
      const nlStore = useNLStore.getState()
      await nlStore.fetchTasks()
      nlStore.selectTask(taskId)
      nlStore.loadTaskMessages(taskId)

      // Poll until the AI-chosen emoji arrives from the background update
      let pollCount = 0
      const pollIcon = () => {
        setTimeout(async () => {
          await get().fetchPages()
          const page = get().pages.find((p) => p.id === id)
          if (!page?.icon && pollCount < 5) {
            pollCount++
            pollIcon() // retry with same delay
          }
        }, pollCount === 0 ? 3000 : 4000)
      }
      pollIcon()

      return id
    } catch (err) {
      console.error('Failed to create page:', err)
      set({ creatingNew: false })
      return ''
    }
  },

  cancelCreating: () => set({ creatingNew: false }),

  deletePage: async (id) => {
    if (id === 'interact') return

    // Always call backend (handles both pages with and without linked tasks)
    // Retry once if the first attempt fails
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/pages/${id}`, { method: 'DELETE' })
        if (res.ok) break
        if (attempt === 0) continue // retry once
        console.error('Failed to delete page on backend (retried):', res.status)
      } catch (err) {
        if (attempt === 0) continue // retry once
        console.error('Failed to delete page on backend (retried):', err)
      }
    }

    // Update local state regardless of backend result
    set((state) => {
      const filtered = state.pages.filter((p) => p.id !== id)
      let newActive = state.activePageId
      if (newActive === id) {
        const idx = state.pages.findIndex((p) => p.id === id)
        newActive = filtered[Math.min(idx, filtered.length - 1)]?.id || null
      }
      return { pages: filtered, activePageId: newActive }
    })

    // Refresh task list from server
    useNLStore.getState().fetchTasks()
  },

  renamePage: async (id, newName) => {
    const trimmed = newName.trim()
    // Persist to backend first
    try {
      await fetch(`${API_BASE}/pages/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch (err) {
      console.error('Failed to rename page on backend:', err)
    }

    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === id ? { ...p, name: trimmed || p.name } : p
      ),
    }))
    // Also update the linked task title in NL store
    const page = get().pages.find((p) => p.id === id)
    if (page?.taskId && trimmed) {
      useNLStore.getState().updateTask(page.taskId, trimmed)
    }
  },

  addTemporaryPage: (page) => {
    const tempPage: Page = {
      ...page,
      type: 'temporary',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }
    set((state) => ({
      pages: [...state.pages, tempPage],
      activePageId: page.id,
    }))
  },

  removeTemporaryPage: (id) => {
    set((state) => {
      const filtered = state.pages.filter((p) => p.id !== id)
      return {
        pages: filtered,
        activePageId:
          state.activePageId === id
            ? filtered[0]?.id || null
            : state.activePageId,
      }
    })
  },

  fetchPages: async () => {
    try {
      const res = await fetch(`${API_BASE}/pages`)
      if (!res.ok) throw new Error('Failed to fetch pages')
      const backendPages = await res.json()
      const pages: Page[] = backendPages.map((bp: any) => ({
        id: String(bp.id),
        name: bp.name,
        type: 'fixed' as const,
        icon: bp.icon || '',
        taskId: bp.task_id,
        shareToken: bp.share_token,
        createdAt: new Date(bp.created_at),
      }))
      set((state) => ({
        pages: [...state.pages.filter((p) => p.id === 'interact' || p.type !== 'fixed'), ...pages],
      }))

      // After restoring pages from backend, if the persisted activePageId is a
      // fixed page, sync the linked task in the sidebar.
      const { activePageId } = get()
      if (activePageId && activePageId !== 'interact') {
        const restored = get().pages.find((p) => p.id === activePageId)
        if (restored?.taskId) {
          const nlStore = useNLStore.getState()
          nlStore.selectTask(restored.taskId)
          nlStore.loadTaskMessages(restored.taskId)
        } else {
          // Persisted page no longer exists — fall back to 涌现
          set({ activePageId: 'interact' })
        }
      }
    } catch (err) {
      console.error('Failed to fetch pages:', err)
    }
  },

  reorderPages: (fromId, toId) => {
    if (fromId === 'interact') return
    const { pages } = get()
    const reordered = [...pages]
    const fromIdx = reordered.findIndex((p) => p.id === fromId)
    if (fromIdx === -1) return
    const [moved] = reordered.splice(fromIdx, 1)
    if (toId === null) {
      reordered.push(moved)
    } else {
      const toIdx = reordered.findIndex((p) => p.id === toId)
      if (toIdx === -1) return
      reordered.splice(toIdx, 0, moved)
    }
    set({ pages: reordered })

    // Persist new sort_order to backend for each fixed page
    let sortOrder = 0
    for (const p of reordered) {
      if (p.id !== 'interact' && p.type === 'fixed') {
        fetch(`${API_BASE}/pages/${p.id}/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder }),
        }).catch(() => {})
        sortOrder++
      }
    }
  },
    }),
    {
      name: 'morgana-ui',
      partialize: (state) => ({ activePageId: state.activePageId }),
    }
  )
)