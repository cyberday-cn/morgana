import { useCallback, useEffect, useRef, useState } from 'react'
import { NLModule } from '../nl/NLModule'
import { UIModule } from '../ui/UIModule'
import { useNLStore } from '../../stores/useNLStore'

const MIN_WIDTH = 380
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 528
const SIDEBAR_COLLAPSED = 48
const SIDEBAR_EXPANDED = 280

export function DesktopSplit() {
  const sidebarExpanded = useNLStore((s) => s.sidebarExpanded)

  // Base width is what the user drags to. actualWidth = baseWidth + sidebar offset
  // so the chat area stays the same size regardless of sidebar state.
  const [baseWidth, setBaseWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(DEFAULT_WIDTH)

  // Compute actual width = base + sidebar compensation
  const sidebarOffset = sidebarExpanded
    ? SIDEBAR_EXPANDED - SIDEBAR_COLLAPSED  // +232px
    : 0
  const actualWidth = baseWidth + sidebarOffset

  // Apply actual width to CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--nl-module-width', `${actualWidth}px`)
  }, [actualWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    startXRef.current = e.clientX
    startWidthRef.current = baseWidth
    e.preventDefault()
  }, [baseWidth])

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      // Adjust base width so the UI side boundary moves as expected
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta))
      setBaseWidth(newWidth)
    }

    const handleMouseUp = () => {
      setDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    // Disable pointer events on the UI module (which contains the iframe)
    // so the iframe doesn't capture mousemove while the user is dragging
    // the NL panel width into UI territory.
    const uiModule = document.querySelector('.ui-module') as HTMLElement | null
    if (uiModule) uiModule.style.pointerEvents = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      if (uiModule) uiModule.style.pointerEvents = ''
    }
  }, [dragging])

  return (
    <div className="layout-split">
      <NLModule />
      <div
        className={`nl-resize-handle ${dragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      />
      <UIModule />
    </div>
  )
}
