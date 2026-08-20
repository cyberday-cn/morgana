import { useLayoutStore } from '../../stores/useLayoutStore'
import { useNLStore } from '../../stores/useNLStore'

export function FloatingNLButton() {
  const quickChatOpen = useNLStore((s) => s.quickChatOpen)
  const toggleQuickChat = useNLStore((s) => s.toggleQuickChat)

  return (
    <button
      className={`floating-nl-btn ${quickChatOpen ? 'active' : ''}`}
      onClick={toggleQuickChat}
      title="快捷对话"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
