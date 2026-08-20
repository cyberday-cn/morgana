import type { StoredMessage, FileAttachment } from '../../types'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useNLStore } from '../../stores/useNLStore'

const API_BASE = 'http://localhost:3001'

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function FileAttachmentBlock({ file }: { file: FileAttachment }) {
  const isImage = file.mime_type.startsWith('image/')
  const fileUrl = `${API_BASE}/api/files/${file.id}`
  const thumbUrl = `${API_BASE}/uploads/${file.stored_name}`
  const size = formatFileSize(file.file_size)

  if (isImage) {
    return (
      <a key={file.id} href={fileUrl} target="_blank" rel="noopener noreferrer" className="file-image-preview" title={file.original_name}>
        <img src={thumbUrl} alt={file.original_name} loading="lazy" />
        <span className="file-image-name">{file.original_name}</span>
      </a>
    )
  }

  return (
    <a key={file.id} href={`${fileUrl}/download`} className="file-chip">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      <span className="file-chip-name">{file.original_name}</span>
      <span className="file-chip-size">{size}</span>
    </a>
  )
}

interface ChatMessageProps {
  message: StoredMessage
  isLatest?: boolean
  onGeneratePage?: () => Promise<boolean>
}

export function ChatMessage({ message, isLatest, onGeneratePage }: ChatMessageProps) {
  const isAgent = message.role === 'agent'
  const generatingPage = useNLStore((s) => s.generatingPage)
  const generatingPageTaskId = useNLStore((s) => s.generatingPageTaskId)
  const selectedTaskId = useNLStore((s) => s.selectedTaskId)
  const stopPageGeneration = useNLStore((s) => s.stopPageGeneration)

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const handleClick = async () => {
    // Only react to the page generation button if this task owns the generation
    if (generatingPage && generatingPageTaskId === selectedTaskId) {
      await stopPageGeneration()
    } else if (onGeneratePage) {
      await onGeneratePage()
    }
  }

  return (
    <div className={`chat-message ${isAgent ? 'agent' : 'user'}`}>
      <div className="avatar">
        {isAgent ? 'M' : '我'}
      </div>
      <div className="bubble">
        <div className="bubble-content">
          {isAgent ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            // User messages: keep plain text with paragraph breaks
            message.content.split('\n\n').filter(Boolean).map((para, i) => {
              const lines = para.split('\n')
              return (
                <div key={i} className="para">
                  {lines.map((line, j) => (
                    <span key={j}>
                      {line || ' '}
                      {j < lines.length - 1 && <br />}
                    </span>
                  ))}
                </div>
              )
            })
          )}
          {/* File attachments */}
          {message.files && message.files.length > 0 && (
            <div className="message-files">
              {message.files.map((file) => (
                <FileAttachmentBlock key={file.id} file={file} />
              ))}
            </div>
          )}
        </div>
        <div className="bubble-footer">
          <span className="timestamp">
            {formatTime(message.created_at)}
          </span>
          {isAgent && isLatest && (onGeneratePage || (generatingPage && generatingPageTaskId === selectedTaskId)) && (
            <button
              className={`generate-page-btn ${generatingPage && generatingPageTaskId === selectedTaskId ? 'generating' : ''}`}
              onClick={handleClick}
              title={generatingPage && generatingPageTaskId === selectedTaskId ? '停止生成' : '生成页面'}
            >
              {generatingPage && generatingPageTaskId === selectedTaskId ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
