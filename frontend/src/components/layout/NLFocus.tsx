import { NLModule } from '../nl/NLModule'
import { useUIStore } from '../../stores/useUIStore'
import { useLayoutStore } from '../../stores/useLayoutStore'

const pageEmojis: Record<string, string> = {
  home: '📋',
  customers: '👥',
  reports: '📊',
  'tmp-analysis': '📈',
}

export function NLFocus() {
  const { pages, activePageId, setActivePage } = useUIStore()
  const setMode = useLayoutStore((s) => s.setMode)

  return (
    <div className="layout-nl-focus">
      <NLModule />
      <div className="ui-strip">
        {pages.map((page) => (
          <button
            key={page.id}
            className={`strip-tab ${activePageId === page.id ? 'active' : ''}`}
            onClick={() => { setActivePage(page.id); setMode('split') }}
            title={page.name}
          >
            {pageEmojis[page.id] || '📄'}
          </button>
        ))}
      </div>
    </div>
  )
}
