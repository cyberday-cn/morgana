import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001/api'

interface SharePopoverProps {
  pageId: string
  pageName: string
  pageUrl: string
  isFixed: boolean
  shareToken?: string | null
  onClose: () => void
}

export function SharePopover({ pageId, pageName, isFixed, shareToken, onClose }: SharePopoverProps) {
  const [copyOk, setCopyOk] = useState(false)
  const [externalIp, setExternalIp] = useState<string>('localhost')

  // Fetch external IP on mount
  useEffect(() => {
    fetch(`${API_BASE}/share/external-ip`)
      .then(r => r.json())
      .then(d => { if (d.ip) setExternalIp(d.ip) })
      .catch(() => {})
  }, [])

  const shareUrl = isFixed && shareToken
    ? `http://${externalIp}:3001/api/share/page/${shareToken}`
    : `http://${externalIp}:3002/?t=${Date.now()}`

  const loading = isFixed && !shareToken

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    } catch {
      // Fallback: select text
    }
  }

  return (
    <>
      {/* Backdrop overlay that catches clicks (including on iframe) to close the popover */}
      <div className="share-backdrop" onClick={onClose} />
      <div className="share-popover">
        <div className="share-popover-title">分享页面</div>
        <div className="share-popover-name">{pageName}</div>
        {loading ? (
          <div className="share-loading">正在生成分享链接...</div>
        ) : (
          <>
            <div className="share-url-row">
              <input className="share-url-input" value={shareUrl} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
              <button className="share-copy-btn" onClick={handleCopyLink}>
                {copyOk ? '已复制' : '复制'}
              </button>
            </div>
            <div className="share-note">其他人在浏览器中可直接打开此链接查看页面内容</div>
          </>
        )}
      </div>
    </>
  )
}
