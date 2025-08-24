/**
 * API Keys Management Page
 * 
 * Main page component for managing API keys with comprehensive
 * usage tracking, rate limiting, and analytics.
 */

import React from 'react'
import { APIKeyManagementDashboard } from '@/components/APIKeyManagementDashboard'
import { PageHeader } from '@/components/PageHeader'

export function APIKeysPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="API Key Management"
        description="Manage your OpenRouter and Gemini API keys with intelligent usage tracking, rate limiting, and cost monitoring."
      />
      <APIKeyManagementDashboard />
    </div>
  )
}

export default APIKeysPage