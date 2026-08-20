import { useRef } from 'react'
import { useNLStore } from '../../stores/useNLStore'

export function ChatInput() {
  const {
    inputValue, setInputValue,
    selectedTaskId, isProcessing, streamingTaskId,
    pendingFiles, addPendingFile, removePendingFile,
    sendMessage, createTask,
  } = useNLStore()
  const isProcessingCurrentTask = isProcessing && streamingTaskId === selectedTaskId
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    if (!inputValue.trim() || isProcessingCurrentTask) return

    // Auto-create task if none selected
    let taskId = selectedTaskId
    if (taskId === null) {
      const task = await createTask(inputValue.trim().slice(0, 200))
      if (!task) return
      taskId = task.id
    }

    await sendMessage(taskId)
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
    e.target.value = '' // reset so same file can be re-selected
  }

  return (
    <div className="chat-input-area">
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
              <button
                className="pending-file-remove"
                onClick={() => removePendingFile(i)}
                title="移除"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-wrapper">
        <button className="attach-btn" onClick={handleAttachClick} title="上传附件" disabled={isProcessingCurrentTask}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFileChange}
        />
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            isProcessingCurrentTask
              ? '正在等待回复...'
              : selectedTaskId === null
                ? '输入消息开始新对话...'
                : '输入指令、提问或描述你的需求...'
          }
          rows={1}
          onKeyDown={handleKeyDown}
          disabled={isProcessingCurrentTask}
        />
        <button
          className="send-btn"
          disabled={!inputValue.trim() || isProcessingCurrentTask}
          onClick={handleSend}
        >
          {isProcessingCurrentTask ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
              </path>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
