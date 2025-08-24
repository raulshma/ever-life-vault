/**
 * Add API Key Dialog Component
 * 
 * Dialog for adding new API keys with provider-specific configurations
 * and rate limit settings based on OpenRouter and Gemini specifications.
 */

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Info, 
  ExternalLink, 
  Eye, 
  EyeOff,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'

interface AddAPIKeyDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onKeyAdded?: (keyId?: string) => void
}

interface ProviderPreset {
  name: string
  description: string
  icon: string
  limits: {
    free?: {
      requestsPerMinute?: number
      requestsPerDay?: number
      tokensPerMinute?: number
    }
    paid?: {
      requestsPerMinute?: number
      requestsPerDay?: number
      tokensPerMinute?: number
    }
  }
  documentation: string
}

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openrouter: {
    name: 'OpenRouter',
    description: 'Access multiple AI providers through a unified API',
    icon: '🔄',
    limits: {
      free: {
        requestsPerMinute: 20,
        requestsPerDay: 50,
        tokensPerMinute: 250000
      },
      paid: {
        requestsPerMinute: 20,
        requestsPerDay: 1000,
        tokensPerMinute: 250000
      }
    },
    documentation: 'https://openrouter.ai/docs'
  },
  google: {
    name: 'Google Gemini',
    description: 'Google\'s advanced AI models',
    icon: '🤖',
    limits: {
      free: {
        requestsPerMinute: 15, // Average for Gemini models
        requestsPerDay: 200,
        tokensPerMinute: 1000000
      }
    },
    documentation: 'https://ai.google.dev/docs'
  },
  custom: {
    name: 'Custom Provider',
    description: 'Your own AI API endpoint',
    icon: '⚙️',
    limits: {},
    documentation: ''
  }
}

interface AddAPIKeyData {
  provider: string;
  apiKey: string;
  nickname: string;
  isActive: boolean;
  priority: number;
  rateLimits: {
    daily: {
      requests?: number;
      tokens?: number;
    };
    monthly: {
      requests?: number;
      tokens?: number;
    };
  };
}

export function AddAPIKeyDialog({ open: controlledOpen, onOpenChange: setControlledOpen, onKeyAdded }: AddAPIKeyDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [provider, setProvider] = useState('')
  const [nickname, setNickname] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [priority, setPriority] = useState(1)
  const [dailyRequestLimit, setDailyRequestLimit] = useState('')
  const [dailyTokenLimit, setDailyTokenLimit] = useState('')
  const [monthlyRequestLimit, setMonthlyRequestLimit] = useState('')
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState('')
  const { toast } = useToast()
  const { session } = useAuth()

  // Use controlled or uncontrolled state
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : open
  const setIsOpen = isControlled ? setControlledOpen : setOpen

  const authHeaders = {
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'Content-Type': 'application/json'
  }

  const resetForm = () => {
    setProvider('')
    setNickname('')
    setApiKey('')
    setIsActive(true)
    setPriority(1)
    setDailyRequestLimit('')
    setDailyTokenLimit('')
    setMonthlyRequestLimit('')
    setMonthlyTokenLimit('')
  }

  const handleProviderChange = (provider: string) => {
    setProvider(provider)

    // Auto-populate limits based on provider
    const preset = PROVIDER_PRESETS[provider]
    if (preset?.limits.free) {
      const limits = preset.limits.free
      setDailyRequestLimit(limits.requestsPerDay ? Math.floor(limits.requestsPerDay / 30).toString() : '')
      setDailyTokenLimit(limits.tokensPerMinute ? Math.floor(limits.tokensPerMinute * 60 * 24).toString() : '')
      setMonthlyRequestLimit(limits.requestsPerDay ? limits.requestsPerDay.toString() : '')
      setMonthlyTokenLimit(limits.tokensPerMinute ? Math.floor(limits.tokensPerMinute * 60 * 24 * 30).toString() : '')
    }
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to add API keys',
        variant: 'destructive'
      })
      return
    }

    if (!provider) {
      toast({
        title: 'Provider required',
        description: 'Please select a provider',
        variant: 'destructive'
      })
      return
    }

    if (!apiKey) {
      toast({
        title: 'API Key required',
        description: 'Please enter your API key',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)

      // Prepare key data
      const keyData: AddAPIKeyData = {
        provider,
        apiKey,
        nickname: nickname || `${provider} Key`,
        isActive,
        priority,
        rateLimits: {
          daily: {
            requests: dailyRequestLimit ? parseInt(dailyRequestLimit) : undefined,
            tokens: dailyTokenLimit ? parseInt(dailyTokenLimit) : undefined
          },
          monthly: {
            requests: monthlyRequestLimit ? parseInt(monthlyRequestLimit) : undefined,
            tokens: monthlyTokenLimit ? parseInt(monthlyTokenLimit) : undefined
          }
        }
      }

      // Submit to API
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(keyData)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'API Key Added',
          description: 'Your API key has been securely stored',
        })
        onKeyAdded && onKeyAdded(data.data.keyId)
        setIsOpen(false)
        resetForm()
      } else {
        throw new Error(data.error || 'Failed to add API key')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add API key',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedProvider = provider ? PROVIDER_PRESETS[provider] : null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add API Key
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Add New API Key</DialogTitle>
          <DialogDescription>
            Add an API key for OpenRouter, Google Gemini, or a custom provider with automatic usage tracking and rate limiting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
          <form id="add-api-key-form" onSubmit={handleSubmit} className="space-y-6 h-full">
            <Tabs defaultValue="basic" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="limits">Rate Limits</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 overflow-y-auto max-h-full px-1 flex-grow">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider *</Label>
                  <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span>{preset.icon}</span>
                            <span>{preset.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Provider Info Card */}
                {selectedProvider && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{selectedProvider.icon}</span>
                          <div>
                            <CardTitle className="text-lg">{selectedProvider.name}</CardTitle>
                            <CardDescription>{selectedProvider.description}</CardDescription>
                          </div>
                        </div>
                        {selectedProvider.documentation && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={selectedProvider.documentation} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    {Object.keys(selectedProvider.limits).length > 0 && (
                      <CardContent className="pt-0">
                        <div className="flex gap-2 mb-3">
                          <Label>Account Tier:</Label>
                          <div className="flex gap-2">
                            {Object.keys(selectedProvider.limits).map((tier) => (
                              <Badge
                                key={tier}
                                variant={tier === 'free' ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => {}}
                              >
                                {tier.charAt(0).toUpperCase() + tier.slice(1)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Key Name */}
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name *</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., Primary OpenRouter Key"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key *</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={
                        provider === 'openrouter' ? 'sk-or-...' :
                        provider === 'google' ? 'Your Gemini API key' :
                        'Your API key'
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {provider === 'openrouter' && (
                    <p className="text-xs text-muted-foreground">
                      Get your OpenRouter API key from <a href="https://openrouter.ai/keys" target="_blank" className="underline">openrouter.ai/keys</a>
                    </p>
                  )}
                  {provider === 'google' && (
                    <p className="text-xs text-muted-foreground">
                      Get your Gemini API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" className="underline">Google AI Studio</a>
                    </p>
                  )}
                </div>

                {/* Rotation Priority */}
                <div className="space-y-2">
                  <Label htmlFor="rotationPriority">Rotation Priority</Label>
                  <Select value={priority.toString()} onValueChange={(value) => setPriority(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (Lowest)</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5 (Highest)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Higher priority keys will be used first when multiple keys are available
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="limits" className="space-y-4 overflow-y-auto max-h-full px-1 flex-grow">
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    Rate limits help prevent exceeding provider quotas and manage costs. Leave empty for no limits.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dailyRequestLimit">Daily Request Limit</Label>
                    <Input
                      id="dailyRequestLimit"
                      type="number"
                      placeholder="e.g., 1000"
                      value={dailyRequestLimit}
                      onChange={(e) => setDailyRequestLimit(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dailyTokenLimit">Daily Token Limit</Label>
                    <Input
                      id="dailyTokenLimit"
                      type="number"
                      placeholder="e.g., 250000"
                      value={dailyTokenLimit}
                      onChange={(e) => setDailyTokenLimit(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyRequestLimit">Monthly Request Limit</Label>
                    <Input
                      id="monthlyRequestLimit"
                      type="number"
                      placeholder="e.g., 30000"
                      value={monthlyRequestLimit}
                      onChange={(e) => setMonthlyRequestLimit(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyTokenLimit">Monthly Token Limit</Label>
                    <Input
                      id="monthlyTokenLimit"
                      type="number"
                      placeholder="e.g., 7500000"
                      value={monthlyTokenLimit}
                      onChange={(e) => setMonthlyTokenLimit(e.target.value)}
                    />
                  </div>
                </div>

                {selectedProvider && Object.keys(selectedProvider.limits).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Recommended Limits</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedProvider.limits.free && (
                        <div className="text-sm space-y-1">
                          {selectedProvider.limits.free.requestsPerMinute && (
                            <p>• Requests per minute: {selectedProvider.limits.free.requestsPerMinute}</p>
                          )}
                          {selectedProvider.limits.free.requestsPerDay && (
                            <p>• Requests per day: {selectedProvider.limits.free.requestsPerDay}</p>
                          )}
                          {selectedProvider.limits.free.tokensPerMinute && (
                            <p>• Tokens per minute: {selectedProvider.limits.free.tokensPerMinute?.toLocaleString()}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </form>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="add-api-key-form" disabled={loading}>
            {loading ? 'Adding...' : 'Add API Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
