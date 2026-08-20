import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../stores/useUIStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { useNLStore, _skipNextPageRefresh, clearSkipNextPageRefresh, _expectEmergeRefresh, clearExpectEmergeRefresh } from '../../stores/useNLStore'
import { SharePopover } from './SharePopover'

const API_BASE = 'http://localhost:3001/api'

export function PageContent() {
  const activePageId = useUIStore((s) => s.activePageId)
  const page = useUIStore((s) => s.pages.find((p) => p.id === activePageId))
  const infrastructure = useAgentStore((s) => s.infrastructure)
  const fetchInfrastructureConfig = useAgentStore((s) => s.fetchInfrastructureConfig)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [refreshKey, setRefreshKey] = useState(() => Date.now())
  const [loaded, setLoaded] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // Fetch infrastructure config on mount if not yet loaded
  useEffect(() => {
    if (!infrastructure) {
      fetchInfrastructureConfig()
    }
  }, [])

  // Subscribe to SSE for page refresh notifications.
  // When the agent calls PUT /api/infrastructure/config after updating
  // index.html, the backend broadcasts a 'page_refresh' event and we
  // reload the iframe once — no polling needed.
  // If the user cancelled page generation, skip the refresh entirely.
  useEffect(() => {
    const es = new EventSource('http://localhost:3001/api/infrastructure/events')
    es.onopen = () => console.log('[SSE PageContent] Connected')
    es.onerror = (e) => console.warn('[SSE PageContent] Error:', e)
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'page_refresh') {
          if (_skipNextPageRefresh) {
            clearSkipNextPageRefresh()
            return
          }
          // 涌现页面刷新时自动切换到涌现页签
          if (_expectEmergeRefresh) {
            clearExpectEmergeRefresh()
            const uiStore = useUIStore.getState()
            if (uiStore.activePageId !== 'interact') {
              uiStore.setActivePage('interact')
            }
          }
          setRefreshKey((k) => k + 1)
          setLoaded(false)
          useNLStore.getState().setGeneratingPage(false)
        }
      } catch { /* ignore parse errors */ }
    }
    return () => {
      console.log('[SSE PageContent] Closing')
      es.close()
    }
  }, [])

  // Listen for form submissions from the iframe via postMessage.
  // Agent-generated pages call Morgana.submit() which posts a user_input event.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'user_input') return
      const store = useNLStore.getState()
      if (!store.selectedTaskId || store.isProcessing) return

      // Format form data into readable text for the chat
      const data = event.data.data
      let formatted = '[表单提交]'
      if (typeof data === 'object' && data !== null) {
        for (const [key, value] of Object.entries(data)) {
          formatted += `\n${key}：${value}`
        }
      } else {
        formatted += `\n${String(data)}`
      }

      store.sendMessage(store.selectedTaskId, undefined, formatted)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const pagesPort = infrastructure?.pages.port ?? 3002
  // Use refreshKey as cache buster — browser caches http://localhost:3002/
  // aggressively (Python http.server sends Cache-Control), so changing
  // only the iframe key prop isn't enough; the URL itself must differ.
  const pageUrl = `http://localhost:${pagesPort}/?t=${refreshKey}`

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
    setLoaded(false)
  }

  // Emerge page: share button directly captures screenshot and downloads
  const [emergeSharing, setEmergeSharing] = useState(false)
  const handleEmergeShare = async () => {
    if (emergeSharing) return
    setEmergeSharing(true)
    try {
      const res = await fetch(`${API_BASE}/share/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl }),
      })
      if (!res.ok) throw new Error('Screenshot failed')
      const data = await res.json()
      // Download via Blob URL
      const blobResp = await fetch(`data:image/png;base64,${data.base64}`)
      const blob = await blobResp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.title ? `${data.title}.png` : `页面截图.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('截图生成失败，请重试')
    } finally {
      setEmergeSharing(false)
    }
  }

  return (
    <div className="page-content">
      {!page && (
        <div className="page-empty">
          <p>选择一个页面开始</p>
        </div>
      )}

      {page?.id === 'interact' && (
        <div className="emerge-page emerge-page-iframe">
          <div className="page-toolbar-left">
            <button className="page-refresh-btn" onClick={handleRefresh} title="刷新页面">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
          <div className="page-toolbar-right">
            <button className="page-share-btn" onClick={handleEmergeShare} disabled={emergeSharing} title="分享页面">
              {emergeSharing ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spinning">
                  <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              )}
            </button>
          </div>
          {!loaded && <div className="emerge-loading">加载页面中...</div>}
          <iframe
            ref={iframeRef}
            key={refreshKey}
            src={pageUrl}
            className="emerge-iframe"
            onLoad={() => setLoaded(true)}
            title="涌现页面"
          />
        </div>
      )}

      {page && page.id !== 'interact' && page.type === 'fixed' && (
        <div className="fixed-page">
          <div className="page-toolbar-left">
            <button className="page-refresh-btn" onClick={handleRefresh} title="刷新页面">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
          <div className="page-toolbar-right">
            <button className="page-share-btn" onClick={() => setShareOpen(v => !v)} title="分享页面">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
            {shareOpen && (
              <SharePopover
                pageId={page.id}
                pageName={page.name}
                pageUrl={pageUrl}
                isFixed={true}
                shareToken={page.shareToken}
                onClose={() => setShareOpen(false)}
              />
            )}
          </div>
          {!loaded && (
            <div className="fixed-page-fallback">
              <div className="placeholder-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h2>{page.name}</h2>
              <p className="placeholder-hint">页面内容由 Agent 动态生成</p>
              <p className="placeholder-sub">在任务对话中输入指令，Agent 会创建页面内容</p>
            </div>
          )}
          <iframe
            key={refreshKey}
            src={`http://localhost:${pagesPort}/page_${page.id}.html?t=${refreshKey}`}
            className="fixed-page-iframe"
            onLoad={() => setLoaded(true)}
            title={page.name}
          />
        </div>
      )}

      {page && page.type === 'temporary' && (
        <div className="page-placeholder temp">
          <div className="placeholder-icon">
            <span style={{ fontSize: 32 }}>⏳</span>
          </div>
          <h2>{page.name}</h2>
          <p className="placeholder-hint">Agent 生成的临时交互页面</p>
          <p className="placeholder-sub">约 30 分钟后过期 · 可在编辑模式下保存为固定页面</p>
        </div>
      )}
    </div>
  )
}
