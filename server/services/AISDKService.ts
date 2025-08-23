/**
 * AI SDK Service for enhanced receipt and document analysis
 * This service provides comprehensive AI-powered analysis using the AI SDK
 * with proper typing and enhanced error handling.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, generateText, streamText } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// Import types from centralized location
import type { AIProviderConfig } from './EnhancedReceiptAnalysisService.js'

// Local type definitions (mirrored from EnhancedReceiptAnalysisService)
interface MerchantInfo {
  name: string
  address?: string | null
  phone?: string | null
  website?: string | null
  tax_id?: string | null
}

interface TransactionInfo {
  date: string
  time?: string | null
  total_amount: number
  currency: string
  tax_amount?: number | null
  tax_rate?: number | null
  tip_amount?: number | null
  subtotal?: number | null
  payment_method?: string | null
}

interface ItemInfo {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category?: string | null
  sku?: string | null
  tax_amount?: number | null
  line_number: number
}

interface ClassificationInfo {
  category: string
  subcategory?: string | null
  is_business_expense: boolean
  is_tax_deductible: boolean
  confidence_score: number
}

interface MetadataInfo {
  receipt_number?: string | null
  cashier?: string | null
  register?: string | null
  discounts?: number | null
  loyalty_program?: string | null
  special_offers: string[]
}

interface ReceiptAnalysisResult {
  merchant: MerchantInfo
  transaction: TransactionInfo
  items: ItemInfo[]
  classification: ClassificationInfo
  metadata: MetadataInfo
}

interface DocumentAnalysisResult {
  document_info: {
    type: 'warranty' | 'manual' | 'invoice' | 'guarantee' | 'certificate' | 'other'
    title?: string | null
    language?: string | null
    page_count?: number | null
    format?: string | null
  }
  product: {
    name?: string | null
    brand?: string | null
    model_number?: string | null
    serial_number?: string | null
    category?: string | null
    description?: string | null
  }
  warranty: {
    duration?: string | null
    start_date?: string | null
    end_date?: string | null
    coverage_type?: string | null
    terms: string[]
    exclusions: string[]
    claim_process?: string | null
  }
  dates: {
    purchase_date?: string | null
    issue_date?: string | null
    expiry_date?: string | null
    registration_deadline?: string | null
  }
  support: {
    company_name?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    address?: string | null
  }
  references: {
    document_number?: string | null
    certificate_number?: string | null
    policy_number?: string | null
    order_number?: string | null
  }
  key_information: Array<{
    category: string
    content: string
    priority: 'high' | 'medium' | 'low'
  }>
  analysis_metadata: {
    confidence_score: number
    extracted_text_length: number
    processing_notes: string[]
    suggested_actions: string[]
  }
}

interface AnalysisOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  progressCallback?: (stage: string, progress: number) => void
  customPrompt?: string
}

// Enhanced schemas with better validation and descriptions
const MerchantSchema = z.object({
  name: z.string().describe('Name of the merchant/business'),
  address: z.string().nullable().describe('Full address of the merchant'),
  phone: z.string().nullable().describe('Phone number if visible'),
  website: z.string().nullable().describe('Website URL if visible'),
  tax_id: z.string().nullable().describe('Tax ID or business registration number')
})

const TransactionSchema = z.object({
  date: z.string().describe('Transaction date in YYYY-MM-DD format'),
  time: z.string().nullable().describe('Transaction time in HH:MM format'),
  total_amount: z.number().describe('Total amount paid'),
  currency: z.string().default('USD').describe('Currency code (e.g., USD, EUR)'),
  tax_amount: z.number().nullable().describe('Total tax amount'),
  tax_rate: z.number().nullable().describe('Tax rate as decimal (e.g., 0.0825 for 8.25%)'),
  tip_amount: z.number().nullable().describe('Tip amount if applicable'),
  subtotal: z.number().nullable().describe('Pre-tax subtotal'),
  payment_method: z.string().nullable().describe('Payment method (cash, card, etc.)')
})

const ItemSchema = z.object({
  name: z.string().describe('Item name/description'),
  quantity: z.number().default(1).describe('Quantity purchased'),
  unit_price: z.number().describe('Price per unit'),
  total_price: z.number().describe('Total price for this item'),
  category: z.string().nullable().describe('Product category if identifiable'),
  sku: z.string().nullable().describe('SKU or product code if visible'),
  tax_amount: z.number().nullable().describe('Tax amount for this item'),
  line_number: z.number().describe('Line number on receipt')
})

const ClassificationSchema = z.object({
  category: z.enum([
    'food_dining', 'transportation', 'shopping', 'healthcare',
    'entertainment', 'business', 'travel', 'utilities',
    'home_garden', 'education', 'other'
  ]).describe('Primary expense category'),
  subcategory: z.string().nullable().describe('More specific subcategory'),
  is_business_expense: z.boolean().describe('Whether this appears to be a business expense'),
  is_tax_deductible: z.boolean().describe('Whether this might be tax deductible'),
  confidence_score: z.number().min(0).max(1).describe('Confidence in the analysis (0.0 to 1.0)')
})

const MetadataSchema = z.object({
  receipt_number: z.string().nullable().describe('Receipt/transaction number'),
  cashier: z.string().nullable().describe('Cashier name if visible'),
  register: z.string().nullable().describe('Register/terminal number'),
  discounts: z.number().nullable().describe('Total discounts applied'),
  loyalty_program: z.string().nullable().describe('Loyalty program details if mentioned'),
  special_offers: z.array(z.string()).describe('Any special offers or promotions mentioned')
})

const ReceiptAnalysisSchema = z.object({
  merchant: MerchantSchema,
  transaction: TransactionSchema,
  items: z.array(ItemSchema),
  classification: ClassificationSchema,
  metadata: MetadataSchema
})

// Document analysis schemas
const DocumentInfoSchema = z.object({
  type: z.enum(['warranty', 'manual', 'invoice', 'guarantee', 'certificate', 'other']).describe('Type of document detected'),
  title: z.string().nullable().describe('Document title or heading'),
  language: z.string().nullable().describe('Document language (e.g., en, es, fr)'),
  page_count: z.number().nullable().describe('Number of pages if detectable'),
  format: z.string().nullable().describe('Document format (PDF, image, etc.)')
})

const ProductSchema = z.object({
  name: z.string().nullable().describe('Product name or model'),
  brand: z.string().nullable().describe('Brand or manufacturer'),
  model_number: z.string().nullable().describe('Model number or SKU'),
  serial_number: z.string().nullable().describe('Serial number if present'),
  category: z.string().nullable().describe('Product category'),
  description: z.string().nullable().describe('Product description')
})

const WarrantySchema = z.object({
  duration: z.string().nullable().describe('Warranty duration (e.g., "2 years", "90 days")'),
  start_date: z.string().nullable().describe('Warranty start date in YYYY-MM-DD format'),
  end_date: z.string().nullable().describe('Warranty end date in YYYY-MM-DD format'),
  coverage_type: z.string().nullable().describe('Type of coverage (limited, full, parts only, etc.)'),
  terms: z.array(z.string()).describe('Key warranty terms and conditions'),
  exclusions: z.array(z.string()).describe('What is not covered'),
  claim_process: z.string().nullable().describe('How to make a warranty claim')
})

const DocumentAnalysisSchema = z.object({
  document_info: DocumentInfoSchema,
  product: ProductSchema,
  warranty: WarrantySchema,
  dates: z.object({
    purchase_date: z.string().nullable(),
    issue_date: z.string().nullable(),
    expiry_date: z.string().nullable(),
    registration_deadline: z.string().nullable()
  }),
  support: z.object({
    company_name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    website: z.string().nullable(),
    address: z.string().nullable()
  }),
  references: z.object({
    document_number: z.string().nullable(),
    certificate_number: z.string().nullable(),
    policy_number: z.string().nullable(),
    order_number: z.string().nullable()
  }),
  key_information: z.array(z.object({
    category: z.string(),
    content: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  })),
  analysis_metadata: z.object({
    confidence_score: z.number().min(0).max(1),
    extracted_text_length: z.number(),
    processing_notes: z.array(z.string()),
    suggested_actions: z.array(z.string())
  })
})

export class AISDKService {
  private supabase: SupabaseClient
  private config: AIProviderConfig
  private provider: any
  private readonly defaultMaxRetries: number = 3
  private readonly defaultRetryDelay: number = 1000

  constructor(supabase: SupabaseClient, config: AIProviderConfig) {
    this.supabase = supabase
    this.config = {
      temperature: 0.1,
      maxTokens: undefined,
      timeout: 60000,
      retryAttempts: 3,
      ...config
    }

    this.initializeProvider()
  }

  /**
   * Initialize AI provider based on configuration
   */
  private initializeProvider(): void {
    switch (this.config.provider) {
      case 'google':
        this.provider = createGoogleGenerativeAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseUrl
        })
        break

      case 'openrouter':
        this.provider = createOpenRouter({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseUrl || 'https://openrouter.ai/api/v1',
          headers: {
            'HTTP-Referer': 'https://ever-life-vault.com',
            'X-Title': 'Ever Life Vault - Receipt Analysis'
          }
        })
        break

      case 'custom':
        if (!this.config.baseUrl) {
          throw new Error('Custom provider requires baseUrl configuration')
        }
        this.provider = createOpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseUrl
        })
        break

      default:
        throw new Error(`Unsupported AI provider: ${this.config.provider}`)
    }
  }

  /**
   * Enhanced receipt analysis with AI SDK
   */
  async analyzeReceipt(
    imageUrl: string,
    options: AnalysisOptions = {}
  ): Promise<ReceiptAnalysisResult> {
    const {
      model = this.config.model,
      temperature = this.config.temperature,
      maxTokens = this.config.maxTokens,
      progressCallback,
      customPrompt
    } = options

    return this.executeWithRetry(async () => {
      progressCallback?.('Validating file', 10)

      // Validate file first
      const validation = await this.validateFileForAnalysis(imageUrl)
      if (!validation.isValid) {
        throw new Error(validation.error || 'File validation failed')
      }

      progressCallback?.('Downloading image', 30)

      // Fetch the image
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
      }

      progressCallback?.('Processing image', 50)

      const imageBuffer = await imageResponse.arrayBuffer()
      const imageData = new Uint8Array(imageBuffer)

      const prompt = this.generateReceiptPrompt(customPrompt)

      progressCallback?.('Analyzing with AI', 80)

      // Use AI SDK to analyze the receipt
      const result = await generateObject({
        model: this.provider(model),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: imageData }
            ]
          }
        ],
        schema: ReceiptAnalysisSchema,
        maxRetries: 2,
        temperature
      })

      progressCallback?.('Complete', 100)

      return result.object as ReceiptAnalysisResult
    }, 'AI SDK Receipt Analysis')
  }

  /**
   * Enhanced document analysis with AI SDK
   */
  async analyzeDocument(
    fileUrl: string,
    documentType: 'warranty' | 'manual' | 'invoice' | 'guarantee' | 'certificate' | 'other' = 'other',
    options: AnalysisOptions = {}
  ): Promise<DocumentAnalysisResult> {
    const {
      model = this.config.model,
      temperature = this.config.temperature,
      maxTokens = this.config.maxTokens,
      progressCallback,
      customPrompt
    } = options

    return this.executeWithRetry(async () => {
      progressCallback?.('Validating document', 10)

      // Validate file first
      const validation = await this.validateFileForAnalysis(fileUrl)
      if (!validation.isValid) {
        throw new Error(validation.error || 'Document validation failed')
      }

      progressCallback?.('Downloading document', 30)

      // Fetch the file
      const fileResponse = await fetch(fileUrl)
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.statusText}`)
      }

      const fileBuffer = await fileResponse.arrayBuffer()
      const fileData = new Uint8Array(fileBuffer)

      progressCallback?.('Preparing analysis', 50)

      // Create analysis prompt based on document type
      const prompt = this.generateDocumentPrompt(documentType, customPrompt)

      progressCallback?.('Analyzing with AI', 80)

      // Use AI SDK to analyze the document
      const result = await generateObject({
        model: this.provider(model),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: fileData }
            ]
          }
        ],
        schema: DocumentAnalysisSchema,
        maxRetries: 2,
        temperature
      })

      progressCallback?.('Complete', 100)

      return result.object as DocumentAnalysisResult
    }, `AI SDK Document Analysis (${documentType})`)
  }

  /**
   * Stream analysis for real-time feedback
   */
  async streamAnalysis(
    imageUrl: string,
    onChunk?: (chunk: string) => void,
    options: AnalysisOptions = {}
  ): Promise<ReceiptAnalysisResult> {
    const {
      model = this.config.model,
      temperature = this.config.temperature,
      customPrompt
    } = options

    return this.executeWithRetry(async () => {
      // Fetch the image
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const imageData = new Uint8Array(imageBuffer)

      const prompt = this.generateReceiptPrompt(customPrompt)

      // Use AI SDK streaming
      const result = await streamText({
        model: this.provider(model),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: imageData }
            ]
          }
        ],
        temperature,
        onChunk: onChunk
          ? ({ chunk }) => {
              if (typeof chunk === 'string') {
                onChunk(chunk)
                return
              }
              // Attempt to extract text-like content from known chunk shapes
              const maybeText = (chunk as any)?.text ?? (chunk as any)?.delta ?? ''
              if (typeof maybeText === 'string') {
                onChunk(maybeText)
              }
            }
          : undefined
      })

      // Parse the final result
      const text = await result.text
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed as ReceiptAnalysisResult
      }

      throw new Error('Failed to parse streaming response')
    }, 'AI SDK Stream Analysis')
  }

  /**
   * Generate receipt analysis prompt
   */
  private generateReceiptPrompt(customPrompt?: string): string {
    if (customPrompt) {
      return customPrompt
    }

    return `
You are an expert AI assistant specialized in analyzing receipt and document images.
Extract information with high accuracy and provide structured data.
If information is unclear or not visible, mark it as null rather than guessing.
Be precise with numbers, dates, and text extraction.

Analyze this receipt image and extract:
- Merchant information (name, address, contact details)
- Transaction details (amounts, dates, payment methods)
- Individual items with quantities and prices
- Tax information and calculations
- Any promotional offers or discounts
- Classification and categorization
- Confidence scores for your analysis

Focus on accuracy and provide the most relevant data for expense tracking.
`
  }

  /**
   * Generate document analysis prompt
   */
  private generateDocumentPrompt(documentType: string, customPrompt?: string): string {
    if (customPrompt) {
      return customPrompt
    }

    const basePrompt = `
You are an expert AI assistant specialized in analyzing documents.
Extract information with high accuracy and provide structured data.
If information is unclear or not visible, mark it as null rather than guessing.

Analyze this document and extract:
- Document identification and type
- Product information (name, model, serial numbers)
- Important dates (warranty periods, expiration dates)
- Contact information for support or claims
- Key terms, conditions, and important notices
- Reference numbers and document identifiers
`

    switch (documentType) {
      case 'warranty':
        return basePrompt + `
Focus on warranty-specific information:
- Warranty duration and coverage details
- What is covered and what is excluded
- How to make warranty claims
- Product registration requirements
- Important warranty terms and conditions
`

      case 'manual':
        return basePrompt + `
Focus on manual-specific information:
- Product specifications and features
- Safety warnings and important notices
- Setup and installation instructions
- Troubleshooting information
- Maintenance requirements
`

      default:
        return basePrompt + `
Provide comprehensive analysis of all visible information in the document.
`
    }
  }

  /**
   * Enhanced error handling and retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = this.config.retryAttempts || this.defaultMaxRetries
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${context}] Attempt ${attempt}/${maxRetries} with ${this.config.provider}`)

        // Create timeout promise
        const timeoutMs = this.config.timeout || 60000
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
        })

        // Race between operation and timeout
        const result = await Promise.race([
          operation(),
          timeoutPromise
        ])

        console.log(`[${context}] Success on attempt ${attempt}`)
        return result

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`[${context}] Attempt ${attempt} failed:`, lastError.message)

        // Don't retry on certain error types
        if (this.isNonRetryableError(lastError)) {
          console.log(`[${context}] Non-retryable error, aborting`)
          break
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = this.defaultRetryDelay * Math.pow(2, attempt - 1)
          console.log(`[${context}] Waiting ${delay}ms before retry`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`${context} failed after ${maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes('invalid api key') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('bad request') ||
      message.includes('unsupported file type') ||
      message.includes('file too large') ||
      message.includes('quota exceeded') ||
      message.includes('rate limit')
    )
  }

  /**
   * Enhanced file validation
   */
  private async validateFileForAnalysis(fileUrl: string): Promise<{
    isValid: boolean
    fileType: string
    fileSize?: number
    error?: string
  }> {
    try {
      const response = await fetch(fileUrl, { method: 'HEAD' })

      if (!response.ok) {
        return {
          isValid: false,
          fileType: 'unknown',
          error: `Failed to access file: ${response.statusText}`
        }
      }

      const contentType = response.headers.get('content-type') || ''
      const contentLength = response.headers.get('content-length')
      const fileSize = contentLength ? parseInt(contentLength, 10) : undefined

      // Check file size (max 50MB)
      const maxSize = 50 * 1024 * 1024
      if (fileSize && fileSize > maxSize) {
        return {
          isValid: false,
          fileType: contentType,
          fileSize,
          error: `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB (max 50MB)`
        }
      }

      // Check supported file types
      const supportedTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf'
      ]

      if (!supportedTypes.some(type => contentType.includes(type))) {
        return {
          isValid: false,
          fileType: contentType,
          fileSize,
          error: `Unsupported file type: ${contentType}`
        }
      }

      return {
        isValid: true,
        fileType: contentType,
        fileSize
      }

    } catch (error) {
      return {
        isValid: false,
        fileType: 'unknown',
        error: `File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Test provider connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now()

    try {
      // Create a simple test prompt
      const testPrompt = 'Respond with exactly: "Connection test successful"'

      const result = await generateText({
        model: this.provider(this.config.model),
        messages: [{ role: 'user', content: testPrompt }],
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(10000) // 10 second timeout for test
      })

      const latency = Date.now() - startTime

      if (result.text.toLowerCase().includes('connection test successful')) {
        return { success: true, latency }
      } else {
        return { success: false, error: 'Unexpected response from provider' }
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency
      }
    }
  }

  /**
   * Update provider configuration
   */
  updateConfig(newConfig: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.initializeProvider()
  }

  /**
   * Get current configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config }
  }
}
