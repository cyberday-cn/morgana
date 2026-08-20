import { Sidebar } from '../nl/Sidebar'
import { UIModule } from '../ui/UIModule'
import { FloatingNLButton } from '../ui/FloatingNLButton'
import { QuickChatPopup } from '../ui/QuickChatPopup'
import { useNLStore } from '../../stores/useNLStore'

export function UIFocus() {
  const { sidebarExpanded, toggleSidebar } = useNLStore()

  return (
    <div className="layout-ui-focus">
      <Sidebar />

      {/* Toggle button */}
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

      <div className="ui-focus-main">
        <UIModule />
        <FloatingNLButton />
        <QuickChatPopup />
      </div>
    </div>
  )
}
