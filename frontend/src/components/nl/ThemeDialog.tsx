import { useState } from 'react'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { THEMES, getThemeById } from '../../theme'
import type { ColorScheme } from '../../stores/useLayoutStore'

interface ThemeDialogProps {
  open: boolean
  onClose: () => void
}

export function ThemeDialog({ open, onClose }: ThemeDialogProps) {
  const themeId = useLayoutStore((s) => s.themeId)
  const colorScheme = useLayoutStore((s) => s.colorScheme)
  const setTheme = useLayoutStore((s) => s.setTheme)
  const setColorScheme = useLayoutStore((s) => s.setColorScheme)

  const [previewScheme, setPreviewScheme] = useState<ColorScheme>(colorScheme)

  if (!open) return null

  const currentTheme = getThemeById(themeId)

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-panel theme-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">主题设置</span>
          <button className="dialog-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="theme-dialog-body">
          {/* Color scheme toggle */}
          <div className="theme-scheme-toggle">
            <span className="theme-scheme-label">配色模式</span>
            <div className="theme-scheme-buttons">
              <button
                className={`theme-scheme-btn ${previewScheme === 'light' ? 'active' : ''}`}
                onClick={() => setPreviewScheme('light')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                浅色
              </button>
              <button
                className={`theme-scheme-btn ${previewScheme === 'dark' ? 'active' : ''}`}
                onClick={() => setPreviewScheme('dark')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                深色
              </button>
            </div>
          </div>

          {/* Theme grid */}
          <div className="theme-grid">
            {THEMES.map((t) => {
              const vars = previewScheme === 'dark' ? t.dark : t.light
              const isActive = t.id === themeId && previewScheme === colorScheme

              return (
                <button
                  key={t.id}
                  className={`theme-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setTheme(t.id)
                    setColorScheme(previewScheme)
                  }}
                >
                  {/* Preview swatches */}
                  <div className="theme-preview" style={{ background: vars['--bg-deep'] }}>
                    <div className="theme-preview-card" style={{ background: vars['--bg-surface'], borderColor: vars['--border-subtle'] }}>
                      {/* Simulated sidebar */}
                      <div className="tp-sidebar" style={{ background: vars['--bg-elevated'], borderColor: vars['--border-subtle'] }}>
                        <div className="tp-swatch" style={{ background: vars['--accent'] }} />
                        <div className="tp-line tp-line-short" style={{ background: vars['--text-tertiary'] }} />
                        <div className="tp-line" style={{ background: vars['--text-muted'] }} />
                        <div className="tp-line tp-line-short" style={{ background: vars['--text-muted'] }} />
                      </div>
                      {/* Simulated main area */}
                      <div className="tp-main">
                        <div className="tp-line tp-line-med" style={{ background: vars['--text-secondary'] }} />
                        <div className="tp-swatch-accent" style={{ background: vars['--accent-gradient'] }} />
                        <div className="tp-line" style={{ background: vars['--border-subtle'] }} />
                        <div className="tp-line tp-line-short" style={{ background: vars['--border-subtle'] }} />
                      </div>
                    </div>
                    {/* Color dots */}
                    <div className="theme-palette">
                      <span className="palette-dot" style={{ background: vars['--bg-deep'], border: `1px solid ${vars['--border-medium']}` }} />
                      <span className="palette-dot" style={{ background: vars['--bg-surface'], border: `1px solid ${vars['--border-medium']}` }} />
                      <span className="palette-dot" style={{ background: vars['--accent'] }} />
                      <span className="palette-dot" style={{ background: vars['--text-primary'] }} />
                    </div>
                  </div>
                  <div className="theme-card-footer">
                    <span className="theme-card-name">{t.name}</span>
                    <span className="theme-card-desc">{t.description}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
