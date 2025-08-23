import { LLMModel } from '../types'

export function getUniqueProviders(models: LLMModel[]): string[] {
  const providers = new Set<string>()
  models.forEach(m => providers.add(m.provider))
  return Array.from(providers).sort()
}

export function getUniqueCompanies(models: LLMModel[]): string[] {
  const companies = new Set<string>()
  models.forEach(m => {
    if (m.company) companies.add(m.company)
  })
  return Array.from(companies).sort()
}

export function getUniqueCapabilities(models: LLMModel[]): string[] {
  const capabilities = new Set<string>()
  models.forEach(m => {
    m.capabilities?.forEach(cap => capabilities.add(cap))
  })
  return Array.from(capabilities).sort()
}

export function filterModelsBySearch(models: LLMModel[], query: string): LLMModel[] {
  if (!query) return models
  const lowercaseQuery = query.toLowerCase()
  return models.filter(model =>
    model.name.toLowerCase().includes(lowercaseQuery) ||
    model.provider.toLowerCase().includes(lowercaseQuery) ||
    model.description?.toLowerCase().includes(lowercaseQuery) ||
    model.capabilities?.some(cap => cap.toLowerCase().includes(lowercaseQuery))
  )
}

export function filterModelsByProvider(models: LLMModel[], provider: string): LLMModel[] {
  if (provider === 'all') return models
  return models.filter(model => model.provider === provider)
}

export function filterModelsByCompany(models: LLMModel[], company: string): LLMModel[] {
  if (company === 'all') return models
  return models.filter(model => model.company === company)
}

export function filterModelsByCapability(models: LLMModel[], capability: string): LLMModel[] {
  if (capability === 'all') return models
  return models.filter(model =>
    model.capabilities?.includes(capability)
  )
}
