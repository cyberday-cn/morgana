export interface ThemeVars {
  '--bg-deep': string
  '--bg-surface': string
  '--bg-elevated': string
  '--bg-glass': string
  '--bg-glass-hover': string
  '--border-faint': string
  '--border-subtle': string
  '--border-medium': string
  '--text-primary': string
  '--text-secondary': string
  '--text-tertiary': string
  '--text-muted': string
  '--accent': string
  '--accent-soft': string
  '--accent-glow': string
  '--accent-gradient': string
  '--shadow-elevated': string
  '--color-scheme': string
}

export interface ThemeFonts {
  heading: string   // CSS font-family for headings
  body: string      // CSS font-family for body text
  code: string      // CSS font-family for code
}

export interface ThemeDefinition {
  id: string
  name: string
  light: ThemeVars
  dark: ThemeVars
  fonts: ThemeFonts
  description: string
}

/**
 * Convert accent color to rgba for soft variant.
 * Simple approach: light mode uses 0.10 opacity, dark uses 0.12.
 */
function soft(accent: string, opacity: number): string {
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

function glow(accent: string, opacity: number): string {
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export const THEMES: ThemeDefinition[] = [
  // ─── 1. 新极简主义 ────────────────────────────────────────────
  {
    id: 'neo-minimal',
    name: '新极简主义',
    description: '温暖中性的现代极简风格，强调留白与清晰排版',
    light: {
      '--bg-deep': '#F9FAFB',
      '--bg-surface': '#FFFFFF',
      '--bg-elevated': '#FFFFFF',
      '--bg-glass': 'rgba(255, 255, 255, 0.75)',
      '--bg-glass-hover': 'rgba(255, 255, 255, 0.90)',
      '--border-faint': 'rgba(0, 0, 0, 0.04)',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-medium': 'rgba(0, 0, 0, 0.12)',
      '--text-primary': '#111827',
      '--text-secondary': '#6B7280',
      '--text-tertiary': 'rgba(107, 114, 128, 0.50)',
      '--text-muted': 'rgba(0, 0, 0, 0.10)',
      '--accent': '#3B82F6',
      '--accent-soft': 'rgba(59, 130, 246, 0.10)',
      '--accent-glow': 'rgba(59, 130, 246, 0.20)',
      '--accent-gradient': 'linear-gradient(135deg, #3B82F6, #60A5FA)',
      '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.08)',
      '--color-scheme': 'light',
    },
    dark: {
      '--bg-deep': '#121217',
      '--bg-surface': '#1A1A23',
      '--bg-elevated': '#1A1A23',
      '--bg-glass': 'rgba(26, 26, 35, 0.75)',
      '--bg-glass-hover': 'rgba(36, 36, 46, 0.85)',
      '--border-faint': 'rgba(255, 255, 255, 0.04)',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)',
      '--border-medium': 'rgba(255, 255, 255, 0.12)',
      '--text-primary': '#F3F4F6',
      '--text-secondary': '#9CA3AF',
      '--text-tertiary': 'rgba(156, 163, 175, 0.50)',
      '--text-muted': 'rgba(255, 255, 255, 0.12)',
      '--accent': '#60A5FA',
      '--accent-soft': 'rgba(96, 165, 250, 0.12)',
      '--accent-glow': 'rgba(96, 165, 250, 0.25)',
      '--accent-gradient': 'linear-gradient(135deg, #60A5FA, #93C5FD)',
      '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.50)',
      '--color-scheme': 'dark',
    },
    fonts: {
      heading: "'Inter', system-ui, -apple-system, sans-serif",
      body: "'Inter', system-ui, -apple-system, sans-serif",
      code: "'JetBrains Mono', 'Fira Code', monospace",
    },
  },

  // ─── 2. 温暖有机 ──────────────────────────────────────────────
  {
    id: 'warm-organic',
    name: '温暖有机',
    description: '受自然启发的有机设计，大地色系营造舒适安心氛围',
    light: {
      '--bg-deep': '#F7F1E8',
      '--bg-surface': '#FEFDF9',
      '--bg-elevated': '#FEFDF9',
      '--bg-glass': 'rgba(254, 253, 249, 0.75)',
      '--bg-glass-hover': 'rgba(254, 253, 249, 0.90)',
      '--border-faint': 'rgba(0, 0, 0, 0.04)',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-medium': '#D6D3D1',
      '--text-primary': '#2F1B14',
      '--text-secondary': '#78716C',
      '--text-tertiary': 'rgba(120, 113, 108, 0.50)',
      '--text-muted': 'rgba(0, 0, 0, 0.10)',
      '--accent': '#D2691E',
      '--accent-soft': 'rgba(210, 105, 30, 0.10)',
      '--accent-glow': 'rgba(210, 105, 30, 0.20)',
      '--accent-gradient': 'linear-gradient(135deg, #D2691E, #E8B577)',
      '--shadow-elevated': '0 8px 32px rgba(47, 27, 20, 0.10)',
      '--color-scheme': 'light',
    },
    dark: {
      '--bg-deep': '#1F1B16',
      '--bg-surface': '#2A251E',
      '--bg-elevated': '#2A251E',
      '--bg-glass': 'rgba(42, 37, 30, 0.75)',
      '--bg-glass-hover': 'rgba(52, 46, 38, 0.85)',
      '--border-faint': 'rgba(255, 255, 255, 0.04)',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)',
      '--border-medium': '#44403C',
      '--text-primary': '#F5F0E6',
      '--text-secondary': '#A8A29E',
      '--text-tertiary': 'rgba(168, 162, 158, 0.50)',
      '--text-muted': 'rgba(255, 255, 255, 0.12)',
      '--accent': '#E8B577',
      '--accent-soft': 'rgba(232, 181, 119, 0.12)',
      '--accent-glow': 'rgba(232, 181, 119, 0.25)',
      '--accent-gradient': 'linear-gradient(135deg, #E8B577, #F0D3A8)',
      '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.50)',
      '--color-scheme': 'dark',
    },
    fonts: {
      heading: "'DM Sans', system-ui, sans-serif",
      body: "'Source Sans Pro', system-ui, sans-serif",
      code: "'Fira Code', 'Cascadia Code', monospace",
    },
  },

  // ─── 3. 科技未来 ──────────────────────────────────────────────
  {
    id: 'tech-future',
    name: '科技未来',
    description: '紫蓝色调融合数字科技与未来感，微妙发光效果',
    light: {
      '--bg-deep': '#F8FAFC',
      '--bg-surface': '#FFFFFF',
      '--bg-elevated': '#FFFFFF',
      '--bg-glass': 'rgba(255, 255, 255, 0.75)',
      '--bg-glass-hover': 'rgba(255, 255, 255, 0.90)',
      '--border-faint': 'rgba(0, 0, 0, 0.04)',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-medium': '#E2E8F0',
      '--text-primary': '#1E293B',
      '--text-secondary': '#64748B',
      '--text-tertiary': 'rgba(100, 116, 139, 0.50)',
      '--text-muted': 'rgba(0, 0, 0, 0.10)',
      '--accent': '#6366F1',
      '--accent-soft': 'rgba(99, 102, 241, 0.10)',
      '--accent-glow': 'rgba(99, 102, 241, 0.20)',
      '--accent-gradient': 'linear-gradient(135deg, #6366F1, #06B6D4)',
      '--shadow-elevated': '0 8px 32px rgba(30, 41, 59, 0.10)',
      '--color-scheme': 'light',
    },
    dark: {
      '--bg-deep': '#0F172A',
      '--bg-surface': '#1E293B',
      '--bg-elevated': '#1E293B',
      '--bg-glass': 'rgba(30, 41, 59, 0.75)',
      '--bg-glass-hover': 'rgba(40, 52, 72, 0.85)',
      '--border-faint': 'rgba(255, 255, 255, 0.04)',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)',
      '--border-medium': '#334155',
      '--text-primary': '#F1F5F9',
      '--text-secondary': '#94A3B8',
      '--text-tertiary': 'rgba(148, 163, 184, 0.50)',
      '--text-muted': 'rgba(255, 255, 255, 0.12)',
      '--accent': '#818CF8',
      '--accent-soft': 'rgba(129, 140, 248, 0.12)',
      '--accent-glow': 'rgba(129, 140, 248, 0.25)',
      '--accent-gradient': 'linear-gradient(135deg, #818CF8, #22D3EE)',
      '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.50)',
      '--color-scheme': 'dark',
    },
    fonts: {
      heading: "'Poppins', system-ui, sans-serif",
      body: "'Inter', system-ui, -apple-system, sans-serif",
      code: "'Cascadia Code', 'Fira Code', monospace",
    },
  },

  // ─── 4. 软粗野主义 ────────────────────────────────────────────
  {
    id: 'soft-brutalism',
    name: '软粗野主义',
    description: '大胆排版与几何结构，搭配柔和色彩与圆润边角',
    light: {
      '--bg-deep': '#FAFAFA',
      '--bg-surface': '#FFFFFF',
      '--bg-elevated': '#FFFFFF',
      '--bg-glass': 'rgba(255, 255, 255, 0.75)',
      '--bg-glass-hover': 'rgba(255, 255, 255, 0.90)',
      '--border-faint': 'rgba(0, 0, 0, 0.04)',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-medium': 'rgba(0, 0, 0, 0.15)',
      '--text-primary': '#000000',
      '--text-secondary': '#71717A',
      '--text-tertiary': 'rgba(113, 113, 122, 0.50)',
      '--text-muted': 'rgba(0, 0, 0, 0.10)',
      '--accent': '#000000',
      '--accent-soft': 'rgba(0, 0, 0, 0.05)',
      '--accent-glow': 'rgba(0, 0, 0, 0.10)',
      '--accent-gradient': 'linear-gradient(135deg, #000000, #FF3366)',
      '--shadow-elevated': '0 4px 16px rgba(0, 0, 0, 0.12)',
      '--color-scheme': 'light',
    },
    dark: {
      '--bg-deep': '#18181B',
      '--bg-surface': '#27272A',
      '--bg-elevated': '#27272A',
      '--bg-glass': 'rgba(39, 39, 42, 0.75)',
      '--bg-glass-hover': 'rgba(50, 50, 54, 0.85)',
      '--border-faint': 'rgba(255, 255, 255, 0.06)',
      '--border-subtle': 'rgba(255, 255, 255, 0.10)',
      '--border-medium': 'rgba(255, 255, 255, 0.18)',
      '--text-primary': '#FFFFFF',
      '--text-secondary': '#A1A1AA',
      '--text-tertiary': 'rgba(161, 161, 170, 0.50)',
      '--text-muted': 'rgba(255, 255, 255, 0.15)',
      '--accent': '#FFFFFF',
      '--accent-soft': 'rgba(255, 255, 255, 0.08)',
      '--accent-glow': 'rgba(255, 255, 255, 0.15)',
      '--accent-gradient': 'linear-gradient(135deg, #FFFFFF, #FF6B8A)',
      '--shadow-elevated': '0 4px 16px rgba(0, 0, 0, 0.40)',
      '--color-scheme': 'dark',
    },
    fonts: {
      heading: "'Space Grotesk', system-ui, sans-serif",
      body: "'Inter', system-ui, -apple-system, sans-serif",
      code: "'Monaco', 'Cascadia Code', monospace",
    },
  },

  // ─── 5. 多巴胺设计 ────────────────────────────────────────────
  {
    id: 'dopamine',
    name: '多巴胺设计',
    description: '明亮饱和色彩，高对比度带来愉悦积极的视觉体验',
    light: {
      '--bg-deep': '#FEFEFE',
      '--bg-surface': '#FFFFFF',
      '--bg-elevated': '#FFFFFF',
      '--bg-glass': 'rgba(255, 255, 255, 0.75)',
      '--bg-glass-hover': 'rgba(255, 255, 255, 0.90)',
      '--border-faint': 'rgba(0, 0, 0, 0.04)',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-medium': '#E5E5E5',
      '--text-primary': '#171717',
      '--text-secondary': '#525252',
      '--text-tertiary': 'rgba(82, 82, 82, 0.50)',
      '--text-muted': 'rgba(0, 0, 0, 0.10)',
      '--accent': '#8338EC',
      '--accent-soft': 'rgba(131, 56, 236, 0.10)',
      '--accent-glow': 'rgba(131, 56, 236, 0.20)',
      '--accent-gradient': 'linear-gradient(135deg, #8338EC, #3A86FF)',
      '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.08)',
      '--color-scheme': 'light',
    },
    dark: {
      '--bg-deep': '#0F0F0F',
      '--bg-surface': '#1A1A1A',
      '--bg-elevated': '#1A1A1A',
      '--bg-glass': 'rgba(26, 26, 26, 0.75)',
      '--bg-glass-hover': 'rgba(36, 36, 36, 0.85)',
      '--border-faint': 'rgba(255, 255, 255, 0.04)',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)',
      '--border-medium': '#404040',
      '--text-primary': '#F5F5F5',
      '--text-secondary': '#A3A3A3',
      '--text-tertiary': 'rgba(163, 163, 163, 0.50)',
      '--text-muted': 'rgba(255, 255, 255, 0.12)',
      '--accent': '#A855F7',
      '--accent-soft': 'rgba(168, 85, 247, 0.12)',
      '--accent-glow': 'rgba(168, 85, 247, 0.25)',
      '--accent-gradient': 'linear-gradient(135deg, #A855F7, #60A5FA)',
      '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.50)',
      '--color-scheme': 'dark',
    },
    fonts: {
      heading: "'Outfit', system-ui, sans-serif",
      body: "'Nunito', system-ui, sans-serif",
      code: "'Victor Mono', 'Fira Code', monospace",
    },
  },

  // ─── 6. 海洋静谧 ──────────────────────────────────────────────
  {
    id: 'ocean-calm',
    name: '海洋静谧',
    description: '蓝绿色调模拟水面光影，营造平静专注的氛围',
    light: {
      '--bg-deep': '#F0F9FF',
      '--bg-surface': '#FFFFFF',
      '--bg-elevated': '#FFFFFF',
      '--bg-glass': 'rgba(255, 255, 255, 0.75)',
      '--bg-glass-hover': 'rgba(255, 255, 255, 0.90)',
      '--border-faint': 'rgba(0, 0, 0, 0.04)',
      '--border-subtle': 'rgba(0, 0, 0, 0.08)',
      '--border-medium': '#BAE6FD',
      '--text-primary': '#0C4A6E',
      '--text-secondary': '#0369A1',
      '--text-tertiary': 'rgba(3, 105, 161, 0.50)',
      '--text-muted': 'rgba(0, 0, 0, 0.10)',
      '--accent': '#0284C7',
      '--accent-soft': 'rgba(2, 132, 199, 0.10)',
      '--accent-glow': 'rgba(2, 132, 199, 0.20)',
      '--accent-gradient': 'linear-gradient(135deg, #0284C7, #0D9488)',
      '--shadow-elevated': '0 8px 32px rgba(2, 132, 199, 0.10)',
      '--color-scheme': 'light',
    },
    dark: {
      '--bg-deep': '#0C1929',
      '--bg-surface': '#132F4C',
      '--bg-elevated': '#132F4C',
      '--bg-glass': 'rgba(19, 47, 76, 0.75)',
      '--bg-glass-hover': 'rgba(30, 55, 85, 0.85)',
      '--border-faint': 'rgba(255, 255, 255, 0.04)',
      '--border-subtle': 'rgba(255, 255, 255, 0.08)',
      '--border-medium': '#0369A1',
      '--text-primary': '#E0F2FE',
      '--text-secondary': '#7DD3FC',
      '--text-tertiary': 'rgba(125, 211, 252, 0.50)',
      '--text-muted': 'rgba(255, 255, 255, 0.12)',
      '--accent': '#0EA5E9',
      '--accent-soft': 'rgba(14, 165, 233, 0.12)',
      '--accent-glow': 'rgba(14, 165, 233, 0.25)',
      '--accent-gradient': 'linear-gradient(135deg, #0EA5E9, #14B8A6)',
      '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.50)',
      '--color-scheme': 'dark',
    },
    fonts: {
      heading: "'Manrope', system-ui, sans-serif",
      body: "'Open Sans', system-ui, sans-serif",
      code: "'Hack', 'Fira Code', monospace",
    },
  },
]

export const DEFAULT_THEME_ID = 'tech-future'

/**
 * Get theme by ID
 */
export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
