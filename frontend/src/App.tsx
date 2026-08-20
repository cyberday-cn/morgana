import { useEffect } from 'react'
import { LayoutEngine } from './components/layout/LayoutEngine'
import { useLayoutStore } from './stores/useLayoutStore'
import { getThemeById } from './theme'

export default function App() {
  const themeId = useLayoutStore((s) => s.themeId)
  const colorScheme = useLayoutStore((s) => s.colorScheme)

  useEffect(() => {
    const theme = getThemeById(themeId)
    const vars = colorScheme === 'dark' ? theme.dark : theme.light

    // Apply CSS variables
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value)
    }

    // Set data attributes
    document.documentElement.setAttribute('data-theme', themeId)
    document.documentElement.setAttribute('data-color-scheme', colorScheme)

    // Apply fonts
    document.documentElement.style.setProperty('--font-heading', theme.fonts.heading)
    document.documentElement.style.setProperty('--font-body', theme.fonts.body)
    document.documentElement.style.setProperty('--font-code', theme.fonts.code)
    document.documentElement.style.fontFamily = theme.fonts.body
  }, [themeId, colorScheme])

  return (
    <div className="app">
      <LayoutEngine />
    </div>
  )
}
