/**
 * API Key Management Dashboard
 * 
 * Main dashboard component for managing API keys, viewing usage statistics,
 * and configuring rate limits for OpenRouter and Gemini providers.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  Key, 
  TrendingUp, 
  Settings, 
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreHorizontal
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { AddAPIKeyDialog } from '@/components/AddAPIKeyDialog'

interface APIKeyInfo {
  id: string
  keyName: string
  provider: string
  isActive: boolean
  isSystemKey: boolean
  systemKeyName?: string
  systemKeySource?: string
  createdAt: string
  lastUsedAt?: string
  dailyRequestLimit?: number
  dailyTokenLimit?: number
  monthlyRequestLimit?: number
  monthlyTokenLimit?: number
  dailyRequestsUsed: number
  dailyTokensUsed: number
  monthlyRequestsUsed: number
  monthlyTokensUsed: number
  dailyRequestUsagePercent: number
  dailyTokenUsagePercent: number
  monthlyRequestUsagePercent: number
  monthlyTokenUsagePercent: number
  rotationPriority: number
}

interface UsageStats {
  totalRequests: number
  totalTokens: number
  totalCost: number
  dailyUsage: Array<{ date: string; requests: number; tokens: number; cost: number }>
  topModels: Array<{ model: string; requests: number; tokens: number }>
}

export function APIKeyManagementDashboard() {
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { toast } = useToast()
  const { session } = useAuth()

  const authHeaders = {
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'Content-Type': 'application/json'
  }

  useEffect(() => {
    loadData()
  }, [selectedProvider, session])

  const loadData = async () => {
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to view your API keys and usage statistics',
        variant: 'destructive'
      })
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Load API keys
      const keysResponse = await fetch(`/api/keys${selectedProvider !== 'all' ? `?provider=${selectedProvider}` : ''}`, {
        headers: authHeaders
      })
      const keysData = await keysResponse.json()
      
      if (keysData.success) {
        setApiKeys(keysData.data)
      }

      // Load usage stats
      const statsResponse = await fetch(`/api/usage/stats${selectedProvider !== 'all' ? `?provider=${selectedProvider}` : ''}`, {
        headers: authHeaders
      })
      const statsData = await statsResponse.json()
      
      if (statsData.success) {
        setUsageStats(statsData.data)
      }
    } catch (error) {
      toast({
        title: 'Error loading data',
        description: 'Failed to load API keys and usage statistics',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleKeyStatus = async (keyId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ isActive: !isActive })
      })

      const data = await response.json()
      
      if (data.success) {
        await loadData()
        toast({
          title: 'API Key Updated',
          description: `Key has been ${!isActive ? 'activated' : 'deactivated'}`
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update API key status',
        variant: 'destructive'
      })
    }
  }

  const deleteKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      })

      const data = await response.json()
      
      if (data.success) {
        await loadData()
        toast({
          title: 'API Key Deleted',
          description: 'Key has been permanently removed'
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive'
      })
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openrouter': return '🔄'
      case 'google': return '🤖'
      case 'custom': return '⚙️'
      default: return '🔑'
    }
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-orange-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Key Management</h1>
          <p className="text-muted-foreground">
            Manage your OpenRouter and Gemini API keys with usage tracking and rate limiting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add API Key
          </Button>
        </div>
      </div>

      {/* Add API Key Dialog */}
      <AddAPIKeyDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen} 
        onKeyAdded={loadData} 
      />

      {/* Provider Filter */}
      <div className="flex gap-2">
        {['all', 'openrouter', 'google', 'custom'].map((provider) => (
          <Button
            key={provider}
            variant={selectedProvider === provider ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedProvider(provider)}
          >
            {provider === 'all' ? 'All Providers' : provider.charAt(0).toUpperCase() + provider.slice(1)}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      {usageStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{apiKeys.length}</div>
              <p className="text-xs text-muted-foreground">
                {apiKeys.filter(k => k.isActive).length} active
                {apiKeys.filter(k => k.isSystemKey).length > 0 && (
                  <span className="block text-blue-600">
                    {apiKeys.filter(k => k.isSystemKey).length} system keys
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.totalRequests.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(usageStats.totalTokens / 1000000).toFixed(2)}M</div>
              <p className="text-xs text-muted-foreground">
                Tokens processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${usageStats.totalCost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="logs">Usage Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          {apiKeys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No API Keys Found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first API key to start using AI providers with usage tracking and rate limiting.
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add API Key
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {apiKeys.map((key) => (
                <Card key={key.id} className={key.isSystemKey ? 'border-blue-200 bg-blue-50/50' : ''}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getProviderIcon(key.provider)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{key.keyName}</h3>
                            {key.isSystemKey && (
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                System Key
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {key.provider}
                            {key.isSystemKey && key.systemKeySource && ` • Source: ${key.systemKeySource}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={key.isActive ? 'default' : 'secondary'}>
                          {key.isActive ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                          ) : (
                            <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                          )}
                        </Badge>
                        {!key.isSystemKey && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => toggleKeyStatus(key.id, key.isActive)}>
                                {key.isActive ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteKey(key.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {/* Usage Progress Bars */}
                    <div className="space-y-3">
                      {key.dailyRequestLimit && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Daily Requests</span>
                            <span>{key.dailyRequestsUsed} / {key.dailyRequestLimit}</span>
                          </div>
                          <Progress 
                            value={key.dailyRequestUsagePercent} 
                            className={`h-2 ${getUsageColor(key.dailyRequestUsagePercent)}`}
                          />
                        </div>
                      )}

                      {key.dailyTokenLimit && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Daily Tokens</span>
                            <span>{(key.dailyTokensUsed / 1000).toFixed(1)}K / {(key.dailyTokenLimit / 1000).toFixed(1)}K</span>
                          </div>
                          <Progress 
                            value={key.dailyTokenUsagePercent} 
                            className={`h-2 ${getUsageColor(key.dailyTokenUsagePercent)}`}
                          />
                        </div>
                      )}

                      {key.monthlyRequestLimit && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Monthly Requests</span>
                            <span>{key.monthlyRequestsUsed} / {key.monthlyRequestLimit}</span>
                          </div>
                          <Progress 
                            value={key.monthlyRequestUsagePercent} 
                            className={`h-2 ${getUsageColor(key.monthlyRequestUsagePercent)}`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Alerts for high usage */}
                    {(key.dailyRequestUsagePercent >= 90 || key.dailyTokenUsagePercent >= 90) && (
                      <Alert className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This API key is approaching its daily limits. Consider adding additional keys or increasing limits.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-between text-xs text-muted-foreground mt-4">
                      <span>Priority: {key.rotationPriority}</span>
                      <span>Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="usage">
          {/* Usage Analytics Component will go here */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>
                Detailed usage statistics and trends for your API keys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Usage analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits">
          {/* Rate Limits Configuration Component will go here */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Configuration</CardTitle>
              <CardDescription>
                Configure rate limits and throttling settings for each provider
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Rate limit configuration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          {/* Usage Logs Component will go here */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Logs</CardTitle>
              <CardDescription>
                Detailed logs of all API requests and responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Usage logs viewer coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}