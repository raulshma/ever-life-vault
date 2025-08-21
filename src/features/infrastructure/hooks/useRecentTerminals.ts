import { useState, useEffect } from 'react'
import { getConfigValue, setConfigValue } from '@/integrations/supabase/configStore'
import { RecentTerminal } from '../types'

const MAX_RECENT_TERMINALS = 10

export function useRecentTerminals() {
  const [recentTerminals, setRecentTerminals] = useState<RecentTerminal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecentTerminals()
  }, [])

  const loadRecentTerminals = async () => {
    try {
      setLoading(true)
      const stored = await getConfigValue<RecentTerminal[]>('terminal', 'recentConnections')
      if (stored) {
        // Sort by lastConnected descending (most recent first)
        const sorted = stored.sort((a, b) =>
          new Date(b.lastConnected).getTime() - new Date(a.lastConnected).getTime()
        )
        setRecentTerminals(sorted)
      }
    } catch (error) {
      console.error('Failed to load recent terminals:', error)
    } finally {
      setLoading(false)
    }
  }

  const addRecentTerminal = async (terminal: Omit<RecentTerminal, 'id' | 'lastConnected' | 'connectionCount'>) => {
    try {
      const now = new Date().toISOString()
      const newTerminal: RecentTerminal = {
        ...terminal,
        id: `${terminal.host}:${terminal.port}:${terminal.username}`,
        lastConnected: now,
        connectionCount: 1,
      }

      // Check if this terminal already exists
      const existingIndex = recentTerminals.findIndex(t => t.id === newTerminal.id)
      let updatedTerminals: RecentTerminal[]

      if (existingIndex >= 0) {
        // Update existing terminal
        updatedTerminals = recentTerminals.map((t, index) =>
          index === existingIndex
            ? { ...t, lastConnected: now, connectionCount: t.connectionCount + 1 }
            : t
        )
      } else {
        // Add new terminal and limit to MAX_RECENT_TERMINALS
        updatedTerminals = [newTerminal, ...recentTerminals].slice(0, MAX_RECENT_TERMINALS)
      }

      // Sort by lastConnected descending
      const sorted = updatedTerminals.sort((a, b) =>
        new Date(b.lastConnected).getTime() - new Date(a.lastConnected).getTime()
      )

      const success = await setConfigValue('terminal', 'recentConnections', sorted)
      if (success) {
        setRecentTerminals(sorted)
      }
      return success
    } catch (error) {
      console.error('Failed to add recent terminal:', error)
      return false
    }
  }

  const removeRecentTerminal = async (id: string) => {
    try {
      const updatedTerminals = recentTerminals.filter(t => t.id !== id)
      const success = await setConfigValue('terminal', 'recentConnections', updatedTerminals)
      if (success) {
        setRecentTerminals(updatedTerminals)
      }
      return success
    } catch (error) {
      console.error('Failed to remove recent terminal:', error)
      return false
    }
  }

  const clearRecentTerminals = async () => {
    try {
      const success = await setConfigValue('terminal', 'recentConnections', [])
      if (success) {
        setRecentTerminals([])
      }
      return success
    } catch (error) {
      console.error('Failed to clear recent terminals:', error)
      return false
    }
  }

  return {
    recentTerminals,
    loading,
    addRecentTerminal,
    removeRecentTerminal,
    clearRecentTerminals,
    refresh: loadRecentTerminals,
  }
}
