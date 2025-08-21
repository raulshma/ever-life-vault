import { useState, useEffect } from 'react'
import { getConfigValue, setConfigValue } from '@/integrations/supabase/configStore'
import { TerminalSettings, TerminalTheme } from '../types'

const DEFAULT_SETTINGS: TerminalSettings = {
  fontSize: 14,
  theme: 'dark'
}

export function useTerminalSettings() {
  const [settings, setSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const [fontSize, theme] = await Promise.all([
        getConfigValue<number>('terminal', 'fontSize'),
        getConfigValue<TerminalTheme>('terminal', 'theme')
      ])

      setSettings({
        fontSize: fontSize ?? DEFAULT_SETTINGS.fontSize,
        theme: theme ?? DEFAULT_SETTINGS.theme
      })
    } catch (error) {
      console.error('Failed to load terminal settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateFontSize = async (fontSize: number) => {
    try {
      const success = await setConfigValue('terminal', 'fontSize', fontSize)
      if (success) {
        setSettings(prev => ({ ...prev, fontSize }))
      }
      return success
    } catch (error) {
      console.error('Failed to update font size:', error)
      return false
    }
  }

  const updateTheme = async (theme: TerminalTheme) => {
    try {
      const success = await setConfigValue('terminal', 'theme', theme)
      if (success) {
        setSettings(prev => ({ ...prev, theme }))
      }
      return success
    } catch (error) {
      console.error('Failed to update theme:', error)
      return false
    }
  }

  const updateSettings = async (newSettings: Partial<TerminalSettings>) => {
    try {
      const updates = Object.entries(newSettings)
      const results = await Promise.all(
        updates.map(([key, value]) =>
          setConfigValue('terminal', key, value)
        )
      )

      const success = results.every(result => result)
      if (success) {
        setSettings(prev => ({ ...prev, ...newSettings }))
      }
      return success
    } catch (error) {
      console.error('Failed to update terminal settings:', error)
      return false
    }
  }

  const resetToDefaults = async () => {
    try {
      const success = await updateSettings(DEFAULT_SETTINGS)
      return success
    } catch (error) {
      console.error('Failed to reset terminal settings:', error)
      return false
    }
  }

  return {
    settings,
    loading,
    updateFontSize,
    updateTheme,
    updateSettings,
    resetToDefaults,
    refresh: loadSettings
  }
}
