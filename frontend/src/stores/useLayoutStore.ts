import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayoutMode } from '../types'
import { DEFAULT_THEME_ID } from '../theme'

export type ColorScheme = 'light' | 'dark'

interface LayoutStore {
  mode: LayoutMode
  themeId: string
  colorScheme: ColorScheme
  setMode: (mode: LayoutMode) => void
  setTheme: (themeId: string) => void
  setColorScheme: (scheme: ColorScheme) => void
  toggleColorScheme: () => void
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      mode: 'split' as LayoutMode,
      themeId: DEFAULT_THEME_ID,
      colorScheme: 'light' as ColorScheme,
      setMode: (mode) => set({ mode }),
      setTheme: (themeId) => set({ themeId }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      toggleColorScheme: () =>
        set((s) => ({ colorScheme: s.colorScheme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'morgana-layout',
    }
  )
)
