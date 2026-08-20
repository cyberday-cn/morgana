import { useNLStore, _skipNextPageRefresh, clearSkipNextPageRefresh } from '../../stores/useNLStore'
import { ChatMessage } from '../nl/ChatMessage'
import { MarkdownRenderer } from '../nl/MarkdownRenderer'
import { useRef, useEffect, useCallback } from 'react'

export function QuickChatPopup() {
  const quickChatOpen = useNLStore((s) => s.quickChatOpen)
  const closeQuickChat = useNLStore((s) => s.closeQuickChat)
  const popupRef = useRef<HTMLDivElement>(null)
  const quickChatOpenRef = useRef(quickChatOpen)
  quickChatOpenRef.current = quickChatOpen

  // Close on outside click (always-active listener, checks state via ref)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!quickChatOpenRef.current) return
      const target = e.target as Node
      if (popupRef.current?.contains(target)) return
      // Don't close when clicking the sidebar or the floating toggle button
      const el = e.target as Element
      if (el.closest?.('.nl-sidebar') || el.closest?.('.floating-nl-button')) return
      closeQuickChat()
    }
    function handleWindowBlur() {
      // Window loses focus (e.g., clicking into an iframe) → close popup
      if (quickChatOpenRef.current) closeQuickChat()
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [closeQuickChat])
  const messages = useNLStore((s) => s.messages)
  const isProcessing = useNLStore((s) => s.isProcessing)
  const streamingContent = useNLStore((s) => s.streamingContent)
  const streamingTaskId = useNLStore((s) => s.streamingTaskId)
  const inputValue = useNLStore((s) => s.inputValue)
  const selectedTaskId = useNLStore((s) => s.selectedTaskId)
  const isProcessingCurrentTask = isProcessing && streamingTaskId === selectedTaskId
  const pendingFiles = useNLStore((s) => s.pendingFiles)
  const setInputValue = useNLStore((s) => s.setInputValue)
  const sendMessage = useNLStore((s) => s.sendMessage)
  const createTask = useNLStore((s) => s.createTask)
  const loadTaskMessages = useNLStore((s) => s.loadTaskMessages)
  const addPendingFile = useNLStore((s) => s.addPendingFile)
  const removePendingFile = useNLStore((s) => s.removePendingFile)

  const generatePage = useNLStore((s) => s.generatePage)
  const setGeneratingPage = useNLStore((s) => s.setGeneratingPage)
  const selectedTask = useNLStore((s) => s.tasks.find(t => t.id === s.selectedTaskId))
  const isChatTypeTask = selectedTask?.type === 'chat'
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Scroll to bottom immediately when popup opens (layout needs to settle first)
  useEffect(() => {
    if (quickChatOpen) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      })
    }
  }, [quickChatOpen])

  // Subscribe to SSE page_refresh events to clear the generating state
  useEffect(() => {
    const es = new EventSource('http://localhost:3001/api/infrastructure/events')
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'page_refresh') {
          if (_skipNextPageRefresh) {
            clearSkipNextPageRefresh()
            return
          }
          setGeneratingPage(false)
        }
      } catch { /* ignore parse errors */ }
    }
    return () => es.close()
  }, [setGeneratingPage])

  // Find the latest agent message index for the "generate page" button
  const lastAgentIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'agent') return i
    }
    return -1
  })()

  // Find the user message that preceded the latest agent message
  const lastUserMsg = (() => {
    if (lastAgentIdx < 0) return ''
    for (let i = lastAgentIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content
    }
    return ''
  })()

  const handleGeneratePage = useCallback(async () => {
    if (lastAgentIdx < 0) return false
    setGeneratingPage(true)
    const agentContent = messages[lastAgentIdx].content
    const result = await generatePage(lastUserMsg, agentContent)
    if (!result) setGeneratingPage(false)
    return result
  }, [lastAgentIdx, messages, lastUserMsg, generatePage, setGeneratingPage])

  // Load messages when task is selected
  useEffect(() => {
    if (selectedTaskId !== null) {
      loadTaskMessages(selectedTaskId)
    }
  }, [selectedTaskId, loadTaskMessages])

  const handleSend = async () => {
    if (!inputValue.trim() || isProcessing) return

    let taskId = selectedTaskId
    if (taskId === null) {
      const task = await createTask(inputValue.trim().slice(0, 200))
      if (!task) return
      taskId = task.id
    }

    await sendMessage(taskId)
    // Focus input and reset height after sending
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach((f) => addPendingFile(f))
    }
    e.target.value = ''
  }

  if (!quickChatOpen) return null

  return (
    <div className="quick-chat-popup" ref={popupRef}>
      <div className="quick-chat-header">
        <span className="quick-chat-title">快捷对话</span>
        <button className="quick-chat-close" onClick={closeQuickChat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="quick-chat-body">
        {messages.length === 0 && !isProcessing ? (
          <div className="quick-chat-placeholder">
            <p>在 UI 模式下快速对话</p>
            <p className="sub">在此处输入指令，Morgana 会立即响应</p>
          </div>
        ) : (
          <div className="quick-chat-messages">
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isLatest={idx === lastAgentIdx && msg.role === 'agent'}
                onGeneratePage={idx === lastAgentIdx && msg.role === 'agent' && isChatTypeTask ? handleGeneratePage : undefined}
              />
            ))}

            {/* Processing content */}
            {isProcessing && streamingContent ? (
              <div className="chat-message agent">
                <div className="avatar">M</div>
                <div className="bubble">
                  <div className="bubble-content streaming"><MarkdownRenderer content={streamingContent} /></div>
                </div>
              </div>
            ) : isProcessing ? (
              <div className="chat-message agent">
                <div className="avatar">M</div>
                <div className="bubble typing-bubble">
                  <div className="typing-indicator">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="quick-chat-footer">
        {/* Pending file chips */}
        {pendingFiles.length > 0 && (
          <div className="pending-files">
            {pendingFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="pending-file-chip">
                <span className="pending-file-name" title={file.name}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  {file.name}
                </span>
                <button className="pending-file-remove" onClick={() => removePendingFile(i)} title="移除">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="quick-chat-input-wrapper">
          <button className="attach-btn" onClick={handleAttachClick} title="上传附件" disabled={isProcessing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              // Auto-resize: reset height to shrink, then grow to scrollHeight
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            placeholder={isProcessing ? '正在等待回复...' : '输入指令...'}
            className="quick-chat-input"
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            rows={1}
          />
          <button
            className="quick-chat-send"
            disabled={!inputValue.trim() || isProcessing}
            onClick={handleSend}
          >
            {isProcessing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                </path>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
