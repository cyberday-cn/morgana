import { useRef, useEffect, useCallback } from 'react'
import { ChatMessage } from './ChatMessage'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useNLStore, _skipNextPageRefresh, clearSkipNextPageRefresh } from '../../stores/useNLStore'
import { useLayoutStore } from '../../stores/useLayoutStore'

export function ChatHistory() {
  const messages = useNLStore((s) => s.messages)
  const isProcessing = useNLStore((s) => s.isProcessing)
  const streamingContent = useNLStore((s) => s.streamingContent)
  const streamingTaskId = useNLStore((s) => s.streamingTaskId)
  const selectedTaskId = useNLStore((s) => s.selectedTaskId)
  const generatePage = useNLStore((s) => s.generatePage)
  const setGeneratingPage = useNLStore((s) => s.setGeneratingPage)
  const layoutMode = useLayoutStore((s) => s.mode)
  const selectedTask = useNLStore((s) => s.tasks.find(t => t.id === s.selectedTaskId))
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages or streaming content change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Subscribe to SSE page_refresh events to clear the generating state
  useEffect(() => {
    const es = new EventSource('http://localhost:3001/api/infrastructure/events')
    es.onopen = () => console.log('[SSE ChatHistory] Connected')
    es.onerror = (e) => console.warn('[SSE ChatHistory] Error:', e)
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'page_refresh') {
          // If user cancelled generation, ignore this refresh entirely
          if (_skipNextPageRefresh) {
            clearSkipNextPageRefresh()
            return
          }
          setGeneratingPage(false)
        }
      } catch { /* ignore parse errors */ }
    }
    return () => {
      console.log('[SSE ChatHistory] Closing')
      es.close()
    }
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

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="chat-history">
        <div className="welcome-message">
          <div className="greeting">你好，我是 Morgana</div>
          <div className="sub">
            我是你的 AI 伙伴，可以通过自然语言与你协作。<br />
            在左侧与我对话，在右侧查看和管理你的业务数据。<br />
            告诉我你想做什么，我们一起开始。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-history">
      {messages.map((msg, idx) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          isLatest={idx === lastAgentIdx && msg.role === 'agent'}
          onGeneratePage={idx === lastAgentIdx && msg.role === 'agent' && layoutMode !== 'nl-focus' && selectedTask?.type === 'chat' ? handleGeneratePage : undefined}
        />
      ))}

      {/* Processing content — only show if this task is the one being streamed */}
      {isProcessing && streamingContent && streamingTaskId === selectedTaskId ? (
        <div className="chat-message agent">
          <div className="avatar">M</div>
          <div className="bubble">
            <div className="bubble-content streaming"><MarkdownRenderer content={streamingContent} /></div>
          </div>
        </div>
      ) : isProcessing && streamingTaskId === selectedTaskId ? (
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
  )
}
