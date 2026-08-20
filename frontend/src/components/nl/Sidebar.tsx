import { useState, useRef, useEffect } from 'react'
import { Logo } from '../common/Logo'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useNLStore } from '../../stores/useNLStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { useUIStore } from '../../stores/useUIStore'
import { AgentConfigDialog } from './AgentConfigDialog'
import { ThemeDialog } from './ThemeDialog'
import type { LayoutMode, Task } from '../../types'

function formatTaskDate(task: Task): string {
  const dateStr = task.last_message_at ?? task.created_at
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const taskDate = new Date(dateStr)
  const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate())
  const diffDays = Math.floor((today.getTime() - taskDay.getTime()) / 86400000)

  if (diffDays === 0) {
    return taskDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return '昨天'
  return `${taskDate.getMonth() + 1}/${taskDate.getDate()}`
}

const modes: { mode: LayoutMode; icon: JSX.Element; label: string }[] = [
  {
    mode: 'split',
    label: '混合模式',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    mode: 'ui-focus',
    label: 'UI模式',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    mode: 'nl-focus',
    label: '对话模式',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const layoutMode = useLayoutStore((s) => s.mode)
  const setLayoutMode = useLayoutStore((s) => s.setMode)
  const {
    sidebarExpanded, tasks, selectedTaskId, activeTaskType,
    selectTask, expandSidebar, setSidebarExpanded,
    fetchTasks, createTask, updateTask, deleteTask, loadTaskMessages,
    setActiveTaskType,
  } = useNLStore()
  const openNew = useAgentStore((s) => s.openNew)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Inline rename state
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Close settings menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus the rename input when it appears
  useEffect(() => {
    if (editingTaskId !== null) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editingTaskId])

  // Fetch tasks on mount (NLModule handles this in split/nl-focus modes,
  // but in ui-focus mode Sidebar is rendered directly without NLModule)
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleTaskClick = (taskId: number) => {
    selectTask(taskId)
    loadTaskMessages(taskId)
    if (!sidebarExpanded && layoutMode !== 'ui-focus') expandSidebar()

    // If the clicked task is linked to a page, activate that page tab
    const task = tasks.find((t) => t.id === taskId)
    if (task?.page_id) {
      const pageId = String(task.page_id)
      const uiStore = useUIStore.getState()
      if (uiStore.pages.find((p) => p.id === pageId)) {
        uiStore.setActivePage(pageId)
      }
    }
  }

  const handleCreateTask = async () => {
    await createTask('新对话')
    setActiveTaskType('chat')
    if (layoutMode !== 'ui-focus') expandSidebar()
  }

  const handleDoubleClick = (task: Task) => {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
  }

  const handleRenameSubmit = async (taskId: number) => {
    if (editTitle.trim() && editTitle.trim() !== tasks.find(t => t.id === taskId)?.title) {
      await updateTask(taskId, editTitle.trim())
    }
    setEditingTaskId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent, taskId: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSubmit(taskId)
    }
    if (e.key === 'Escape') {
      setEditingTaskId(null)
    }
  }

  const handleDeleteTask = async (e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    if (confirm('确定删除此任务？相关的对话记录也将被删除。')) {
      await deleteTask(taskId)
    }
  }

  const handleModeChange = (newMode: LayoutMode) => {
    setLayoutMode(newMode)
    if (newMode === 'nl-focus') expandSidebar()
    if (newMode === 'ui-focus') setSidebarExpanded(false)
  }

  const handleSettingsClick = () => {
    setSettingsOpen(!settingsOpen)
  }

  const [themeDialogOpen, setThemeDialogOpen] = useState(false)

  const handleAgentConfigClick = () => {
    setSettingsOpen(false)
    openNew()
  }

  const handleThemeClick = () => {
    setSettingsOpen(false)
    setThemeDialogOpen(true)
  }

  const renderTaskItem = (task: Task) => (
    <div
      key={task.id}
      className={`task-item ${selectedTaskId === task.id ? 'selected' : ''}`}
      onClick={() => handleTaskClick(task.id)}
      onDoubleClick={() => sidebarExpanded && handleDoubleClick(task)}
      title={task.title}
    >
      <span className="task-icon">{task.title.charAt(0)}</span>
      {sidebarExpanded && (
        editingTaskId === task.id ? (
          <input
            ref={editInputRef}
            className="task-rename-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => handleRenameSubmit(task.id)}
            onKeyDown={(e) => handleRenameKeyDown(e, task.id)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="task-title">{task.title}</span>
        )
      )}
      {sidebarExpanded && <span className="task-date">{formatTaskDate(task)}</span>}
      {sidebarExpanded && (
        <button
          className="task-action-btn task-rename-btn"
          onClick={(e) => { e.stopPropagation(); handleDoubleClick(task); }}
          title="重命名"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
      {sidebarExpanded && (
        <button
          className="task-action-btn task-delete-btn"
          onClick={(e) => handleDeleteTask(e, task.id)}
          title="删除任务"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  )

  return (
    <div className={`nl-sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
      {/* ---- Logo ---- */}
      <div className="sidebar-logo-area">
        <Logo />
        {sidebarExpanded && <span className="sidebar-title">Morgana</span>}
      </div>

      {/* ---- Separator ---- */}
      <div className="sidebar-sep" />

      {/* ---- History Section ---- */}
      <div className="sidebar-history">
        <div className="sidebar-section-header">
          {sidebarExpanded && (
            <div className="sidebar-tabs-row">
              <button className={`sidebar-tab ${activeTaskType === 'chat' ? 'active' : ''}`} onClick={() => setActiveTaskType('chat')}>
                任务
              </button>
              <button className="sidebar-add-btn" onClick={handleCreateTask} title="新建任务">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <div className="sidebar-tab-spacer" />
              <button className={`sidebar-tab sidebar-tab-icon ${activeTaskType === 'config' ? 'active' : ''}`} onClick={() => setActiveTaskType('config')} title="配置">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <button className={`sidebar-tab sidebar-tab-icon ${activeTaskType === 'page' ? 'active' : ''}`} onClick={() => setActiveTaskType('page')} title="页面">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {!sidebarExpanded ? (
          <div className="sidebar-collapsed-container">
            {/* Chat section */}
            <div className={`collapsed-section ${activeTaskType === 'chat' ? 'expanded' : ''}`}>
              <div className="collapsed-section-header" onClick={() => activeTaskType === 'chat' ? handleCreateTask() : setActiveTaskType('chat')} title="任务列表">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              {activeTaskType === 'chat' && (
                <div className="collapsed-section-body">
                  {tasks.filter((t) => t.type === 'chat').map(renderTaskItem)}
                </div>
              )}
            </div>
            {/* Config section */}
            <div className={`collapsed-section ${activeTaskType === 'config' ? 'expanded' : ''}`}>
              <div className="collapsed-section-header" onClick={() => setActiveTaskType('config')} title="配置">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              {activeTaskType === 'config' && (
                <div className="collapsed-section-body">
                  {tasks.filter((t) => t.type === 'config').map(renderTaskItem)}
                </div>
              )}
            </div>
            {/* Page section */}
            <div className={`collapsed-section ${activeTaskType === 'page' ? 'expanded' : ''}`}>
              <div className="collapsed-section-header" onClick={() => setActiveTaskType('page')} title="页面">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              {activeTaskType === 'page' && (
                <div className="collapsed-section-body">
                  {tasks.filter((t) => t.type === 'page').map(renderTaskItem)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="sidebar-task-list">
            {tasks.filter((t) => t.type === activeTaskType).map(renderTaskItem)}
          </div>
        )}
        </div>

      {/* ---- Separator ---- */}
      <div className="sidebar-sep" />

      {/* ---- Mode Toggle ---- */}
      <div className="sidebar-mode-block">
        {modes.map((m) => (
          <button
            key={m.mode}
            className={`sidebar-action-btn ${layoutMode === m.mode ? 'active' : ''}`}
            onClick={() => handleModeChange(m.mode)}
            title={m.label}
          >
            <span className="action-icon">{m.icon}</span>
            {sidebarExpanded && <span className="action-label">{m.label}</span>}
          </button>
        ))}
      </div>

      {/* ---- Separator ---- */}
      <div className="sidebar-sep" />

      {/* ---- Account + Settings ---- */}
      <div className="sidebar-bottom-block" ref={settingsRef}>
        <button className="sidebar-action-btn" title="账户">
          <span className="action-icon">👤</span>
          {sidebarExpanded && <span className="action-label">zhang</span>}
        </button>

        {/* Settings with dropdown */}
        <div className="settings-wrapper">
          <button
            className={`sidebar-action-btn ${settingsOpen ? 'active' : ''}`}
            onClick={handleSettingsClick}
            title="设置"
          >
            <span className="action-icon">⚙️</span>
            {sidebarExpanded && <span className="action-label">设置</span>}
          </button>

          {settingsOpen && (
            <div className={`settings-menu ${sidebarExpanded ? 'expand-down' : 'expand-right'}`}>
              <button
                className="settings-menu-item"
                onClick={handleThemeClick}
              >
                <span className="settings-menu-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                  </svg>
                </span>
                <span className="settings-menu-label">主题风格</span>
              </button>
              <button
                className="settings-menu-item"
                onClick={handleAgentConfigClick}
              >
                <span className="settings-menu-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                <span className="settings-menu-label">Agent 配置</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AgentConfigDialog />
      <ThemeDialog open={themeDialogOpen} onClose={() => setThemeDialogOpen(false)} />
    </div>
  )
}
