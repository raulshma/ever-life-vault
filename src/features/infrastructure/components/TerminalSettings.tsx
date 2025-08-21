import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useTerminalSettings } from '../hooks'
import { TerminalTheme } from '../types'
import { Settings, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const THEME_OPTIONS: Array<{ value: TerminalTheme; label: string; description: string }> = [
  { value: 'dark', label: 'Dark', description: 'Classic dark terminal theme' },
  { value: 'light', label: 'Light', description: 'Light terminal theme' },
  { value: 'dracula', label: 'Dracula', description: 'Popular dark theme with purple accents' },
  { value: 'solarized-dark', label: 'Solarized Dark', description: 'Precision colors for machines and people' },
  { value: 'solarized-light', label: 'Solarized Light', description: 'Precision colors for machines and people (light)' },
  { value: 'monokai', label: 'Monokai', description: 'Sublime Text inspired theme' },
  { value: 'gruvbox', label: 'Gruvbox', description: 'Retro groove color scheme' }
]

interface TerminalSettingsProps {
  onSettingsChange?: (settings: { fontSize: number; theme: TerminalTheme }) => void
}

export const TerminalSettings: React.FC<TerminalSettingsProps> = ({ onSettingsChange }) => {
  const { settings, loading, updateFontSize, updateTheme, resetToDefaults } = useTerminalSettings()
  const { toast } = useToast()

  const handleFontSizeChange = async (value: number[]) => {
    const newFontSize = value[0]
    const success = await updateFontSize(newFontSize)
    if (success) {
      onSettingsChange?.({ ...settings, fontSize: newFontSize })
      toast({
        title: 'Font size updated',
        description: `Terminal font size set to ${newFontSize}px`
      })
    } else {
      toast({
        title: 'Failed to update font size',
        description: 'Please try again',
        variant: 'destructive'
      })
    }
  }

  const handleThemeChange = async (theme: TerminalTheme) => {
    const success = await updateTheme(theme)
    if (success) {
      onSettingsChange?.({ ...settings, theme })
      toast({
        title: 'Theme updated',
        description: `Terminal theme changed to ${THEME_OPTIONS.find(t => t.value === theme)?.label}`
      })
    } else {
      toast({
        title: 'Failed to update theme',
        description: 'Please try again',
        variant: 'destructive'
      })
    }
  }

  const handleResetToDefaults = async () => {
    const success = await resetToDefaults()
    if (success) {
      onSettingsChange?.({ fontSize: 14, theme: 'dark' })
      toast({
        title: 'Settings reset',
        description: 'Terminal settings have been reset to defaults'
      })
    } else {
      toast({
        title: 'Failed to reset settings',
        description: 'Please try again',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Terminal Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading settings...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Terminal Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Font Size Setting */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="font-size">Font Size: {settings.fontSize}px</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
          <Slider
            id="font-size"
            min={8}
            max={24}
            step={1}
            value={[settings.fontSize]}
            onValueChange={handleFontSizeChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Smaller (8px)</span>
            <span>Larger (24px)</span>
          </div>
        </div>

        {/* Theme Setting */}
        <div className="space-y-3">
          <Label htmlFor="theme-select">Theme</Label>
          <Select value={settings.theme} onValueChange={handleThemeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((theme) => (
                <SelectItem key={theme.value} value={theme.value}>
                  <div>
                    <div className="font-medium">{theme.label}</div>
                    <div className="text-xs text-muted-foreground">{theme.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <Label>Preview</Label>
          <div
            className="p-3 rounded border font-mono text-sm"
            style={{
              fontSize: `${settings.fontSize}px`,
              backgroundColor: getThemeBackgroundColor(settings.theme),
              color: getThemeForegroundColor(settings.theme)
            }}
          >
            user@hostname:~$ echo "Hello, World!"
            Hello, World!
            user@hostname:~$ ls -la
            total 42
            drwxr-xr-x  5 user group  160 Oct 14 09:23 .
            drwxr-xr-x 18 user group  576 Oct 14 09:23 ..
            -rw-r--r--  1 user group 2201 Oct 14 09:23 README.md
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper functions to get theme colors for preview
function getThemeBackgroundColor(theme: TerminalTheme): string {
  switch (theme) {
    case 'light':
    case 'solarized-light':
      return '#ffffff'
    case 'dracula':
      return '#282a36'
    case 'solarized-dark':
      return '#002b36'
    case 'monokai':
      return '#272822'
    case 'gruvbox':
      return '#282828'
    case 'dark':
    default:
      return '#0b0f17'
  }
}

function getThemeForegroundColor(theme: TerminalTheme): string {
  switch (theme) {
    case 'light':
    case 'solarized-light':
      return '#000000'
    case 'dracula':
      return '#f8f8f2'
    case 'solarized-dark':
      return '#839496'
    case 'monokai':
      return '#f8f8f2'
    case 'gruvbox':
      return '#ebdbb2'
    case 'dark':
    default:
      return '#f8f8f2'
  }
}
