import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { ChatHistory } from './ChatHistory'
import { ChatInput } from './ChatInput'
import { useNLStore } from '../../stores/useNLStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { useLayoutStore } from '../../stores/useLayoutStore'

export function NLModule() {
  const { sidebarExpanded, toggleSidebar, expandSidebar, fetchTasks, tasks, selectedTaskId, selectTask, loadTaskMessages, initTaskInfo, clearInitTaskInfo } = useNLStore()
  const completeInitAgent = useAgentStore((s) => s.completeInitAgent)
  const layoutMode = useLayoutStore((s) => s.mode)
  const [completing, setCompleting] = useState(false)

  // Fetch tasks and auto-select first task on mount
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // In NL Focus mode, sidebar should be expanded by default
  useEffect(() => {
    if (layoutMode === 'nl-focus') expandSidebar()
  }, [layoutMode, expandSidebar])

  // Auto-select first task when tasks are loaded and none selected
  useEffect(() => {
    if (tasks.length > 0 && selectedTaskId === null) {
      selectTask(tasks[0].id)
      loadTaskMessages(tasks[0].id)
    }
  }, [tasks, selectedTaskId, selectTask, loadTaskMessages])

  // Check if current task is an init task (selectedTaskId matches initTaskInfo.taskId)
  const isInitTask = initTaskInfo !== null && selectedTaskId === initTaskInfo.taskId

  const handleInitComplete = async () => {
    if (!initTaskInfo || completing) return
    setCompleting(true)
    try {
      const success = await completeInitAgent(initTaskInfo.agentId)
      if (success) {
        clearInitTaskInfo()
      }
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="nl-module">
      <Sidebar />

      {/* Toggle button positioned between sidebar and chat area */}
      <button
        className={`sidebar-toggle ${sidebarExpanded ? 'expanded' : ''}`}
        onClick={toggleSidebar}
        title={sidebarExpanded ? '收起' : '展开'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: sidebarExpanded ? 'none' : 'scaleX(-1)', transition: 'transform 0.2s ease' }}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="nl-chat-area">
        {isInitTask && (
          <div className="init-banner">
            <div className="init-banner-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>初始化进行中 — Agent 正在搭建基础设施，请等待完成</span>
            </div>
            <button
              className="btn btn-init-complete"
              onClick={handleInitComplete}
              disabled={completing}
            >
              {completing ? '处理中...' : '确认初始化完成'}
            </button>
          </div>
        )}
        <ChatHistory />
        <ChatInput />
      </div>
    </div>
  )
}
