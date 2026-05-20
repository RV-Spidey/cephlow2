import { useState, useEffect } from "react"

export type Theme = 'light' | 'dark' | 'system'

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

function resolveIsDark(t: Theme): boolean {
  if (t === 'dark') return true
  if (t === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', resolveIsDark(t))
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function useThemePreference() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  function changeTheme(t: Theme) {
    localStorage.setItem('theme', t)
    setThemeState(t)
  }

  return { theme, changeTheme, isDark: resolveIsDark(theme) }
}
