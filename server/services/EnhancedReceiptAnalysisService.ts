import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// Local type definitions for Supabase tables
interface Receipt {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  total_amount: number;
  currency: string;
  receipt_date: string;
  merchant_name?: string | null;
  merchant_address?: string | null;
  merchant_phone?: string | null;
  merchant_tax_id?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  ocr_raw_text?: string | null;
  ai_analysis_data?: any;
  ai_confidence_score?: number | null;
  analysis_status?: string | null;
  category: string;
  subcategory?: string | null;
  tags?: string[] | null;
  tax_amount?: number | null;
  tax_rate?: number | null;
  pre_tax_amount?: number | null;
  tip_amount?: number | null;
  payment_method?: string | null;
  is_business_expense?: boolean | null;
  is_reimbursable?: boolean | null;
  is_tax_deductible?: boolean | null;
  reimbursement_status?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface ReceiptDocument {
  id: string;
  receipt_id: string;
  user_id: string;
  name: string;
  description?: string | null;
  document_type?: string | null;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  original_filename?: string | null;
  expiry_date?: string | null;
  issue_date?: string | null;
  document_number?: string | null;
  issuer?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  is_primary?: boolean | null;
  ai_analysis_data?: any;
  ai_confidence_score?: number | null;
  analysis_duration_ms?: number | null;
  analysis_error_message?: string | null;
  analysis_model_used?: string | null;
  analysis_status?: string | null;
  created_at: string;
  updated_at: string;
}

// AI SDK specific types
export interface AIProviderConfig {
  provider: 'google' | 'openrouter' | 'custom';
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
}

interface AnalysisOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  progressCallback?: (stage: string, progress: number) => void;
  customPrompt?: string;
}

// Analysis result types for AI SDK operations
interface MerchantInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  tax_id?: string | null;
}

interface TransactionInfo {
  date: string;
  time?: string | null;
  total_amount: number;
  currency: string;
  tax_amount?: number | null;
  tax_rate?: number | null;
  tip_amount?: number | null;
  subtotal?: number | null;
  payment_method?: string | null;
}

interface ItemInfo {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string | null;
  sku?: string | null;
  tax_amount?: number | null;
  line_number: number;
}

interface ClassificationInfo {
  category: string;
  subcategory?: string | null;
  is_business_expense: boolean;
  is_tax_deductible: boolean;
  confidence_score: number;
}

interface MetadataInfo {
  receipt_number?: string | null;
  cashier?: string | null;
  register?: string | null;
  discounts?: number | null;
  loyalty_program?: string | null;
  special_offers: string[];
}

interface ReceiptAnalysisResult {
  merchant: MerchantInfo;
  transaction: TransactionInfo;
  items: ItemInfo[];
  classification: ClassificationInfo;
  metadata: MetadataInfo;
}

interface DocumentInfo {
  type: 'warranty' | 'manual' | 'invoice' | 'guarantee' | 'certificate' | 'other';
  title?: string | null;
  language?: string | null;
  page_count?: number | null;
  format?: string | null;
}

interface ProductInfo {
  name?: string | null;
  brand?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  category?: string | null;
  description?: string | null;
}

interface WarrantyInfo {
  duration?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  coverage_type?: string | null;
  terms: string[];
  exclusions: string[];
  claim_process?: string | null;
}

interface DatesInfo {
  purchase_date?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  registration_deadline?: string | null;
}

interface SupportInfo {
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
}

interface ReferencesInfo {
  document_number?: string | null;
  certificate_number?: string | null;
  policy_number?: string | null;
  order_number?: string | null;
}

interface KeyInformation {
  category: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
}

interface AnalysisMetadata {
  confidence_score: number;
  extracted_text_length: number;
  processing_notes: string[];
  suggested_actions: string[];
}

interface DocumentAnalysisResult {
  document_info: DocumentInfo;
  product: ProductInfo;
  warranty: WarrantyInfo;
  dates: DatesInfo;
  support: SupportInfo;
  references: ReferencesInfo;
  key_information: KeyInformation[];
  analysis_metadata: AnalysisMetadata;
}

interface ReceiptFormData {
  name: string;
  description: string;
  total_amount: number;
  currency: string;
  receipt_date: string;
  merchant_name: string;
  category: string;
  tax_amount?: number;
  payment_method?: string;
  is_business_expense: boolean;
  is_tax_deductible: boolean;
  notes: string;
}

// Define analysis schemas locally (copied from ReceiptAnalysisService for independence)
const DocumentInfoSchema = z.object({
  type: z.enum(['warranty', 'manual', 'invoice', 'guarantee', 'certificate', 'other']).describe('Type of document detected'),
  title: z.string().nullable().describe('Document title or heading'),
  language: z.string().nullable().describe('Document language (e.g., en, es, fr)'),
  page_count: z.number().nullable().describe('Number of pages if detectable'),
  format: z.string().nullable().describe('Document format (PDF, image, etc.)')
})

const DocumentAnalysisSchema = z.object({
  document_info: DocumentInfoSchema,
  product: z.object({
    name: z.string().nullable().describe('Product name or model'),
    brand: z.string().nullable().describe('Brand or manufacturer'),
    model_number: z.string().nullable().describe('Model number or SKU'),
    serial_number: z.string().nullable().describe('Serial number if present'),
    category: z.string().nullable().describe('Product category'),
    description: z.string().nullable().describe('Product description')
  }),
  warranty: z.object({
    duration: z.string().nullable().describe('Warranty duration (e.g., "2 years", "90 days")'),
    start_date: z.string().nullable().describe('Warranty start date in YYYY-MM-DD format'),
    end_date: z.string().nullable().describe('Warranty end date in YYYY-MM-DD format'),
    coverage_type: z.string().nullable().describe('Type of coverage (limited, full, parts only, etc.)'),
    terms: z.array(z.string()).describe('Key warranty terms and conditions'),
    exclusions: z.array(z.string()).describe('What is not covered'),
    claim_process: z.string().nullable().describe('How to make a warranty claim')
  }),
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
const ReceiptAnalysisSchema = z.object({
  // Basic receipt information
  merchant: z.object({
    name: z.string().describe('Name of the merchant/business'),
    address: z.string().nullable().describe('Full address of the merchant'),
    phone: z.string().nullable().describe('Phone number if visible'),
    website: z.string().nullable().describe('Website URL if visible'),
    tax_id: z.string().nullable().describe('Tax ID or business registration number')
  }),
  
  // Transaction details
  transaction: z.object({
    date: z.string().describe('Transaction date in YYYY-MM-DD format'),
    time: z.string().nullable().describe('Transaction time in HH:MM format'),
    total_amount: z.number().describe('Total amount paid'),
    currency: z.string().default('USD').describe('Currency code (e.g., USD, EUR)'),
    tax_amount: z.number().nullable().describe('Total tax amount'),
    tax_rate: z.number().nullable().describe('Tax rate as decimal (e.g., 0.0825 for 8.25%)'),
    tip_amount: z.number().nullable().describe('Tip amount if applicable'),
    subtotal: z.number().nullable().describe('Pre-tax subtotal'),
    payment_method: z.string().nullable().describe('Payment method (cash, card, etc.)')
  }),
  
  // Itemized details
  items: z.array(z.object({
    name: z.string().describe('Item name/description'),
    quantity: z.number().default(1).describe('Quantity purchased'),
    unit_price: z.number().describe('Price per unit'),
    total_price: z.number().describe('Total price for this item'),
    category: z.string().nullable().describe('Product category if identifiable'),
    sku: z.string().nullable().describe('SKU or product code if visible'),
    tax_amount: z.number().nullable().describe('Tax amount for this item'),
    line_number: z.number().describe('Line number on receipt')
  })).describe('Individual items purchased'),
  
  // Classification and categorization
  classification: z.object({
    category: z.enum([
      'food_dining', 'transportation', 'shopping', 'healthcare', 
      'entertainment', 'business', 'travel', 'utilities', 
      'home_garden', 'education', 'other'
    ]).describe('Primary expense category'),
    subcategory: z.string().nullable().describe('More specific subcategory'),
    is_business_expense: z.boolean().describe('Whether this appears to be a business expense'),
    is_tax_deductible: z.boolean().describe('Whether this might be tax deductible'),
    confidence_score: z.number().min(0).max(1).describe('Confidence in the analysis (0.0 to 1.0)')
  }),
  
  // Additional extracted data
  metadata: z.object({
    receipt_number: z.string().nullable().describe('Receipt/transaction number'),
    cashier: z.string().nullable().describe('Cashier name if visible'),
    register: z.string().nullable().describe('Register/terminal number'),
    discounts: z.number().nullable().describe('Total discounts applied'),
    loyalty_program: z.string().nullable().describe('Loyalty program details if mentioned'),
    special_offers: z.array(z.string()).describe('Any special offers or promotions mentioned')
  })
})

// AI Provider configuration interfaces are now imported from centralized types

export class EnhancedReceiptAnalysisService {
  private supabase: SupabaseClient
  private config: AIProviderConfig
  private provider: any
  private readonly defaultMaxRetries: number = 3
  private readonly defaultRetryDelay: number = 1000 // Base delay in ms
  private readonly defaultTimeoutMs: number = 60000 // 60 second timeout

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

  /**
   * Test provider connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now()
    
    try {
      // Create a simple test prompt
      const testPrompt = 'Respond with exactly: "Connection test successful"'
      
      const result = await generateObject({
        model: this.provider(this.config.model),
        messages: [{ role: 'user', content: testPrompt }],
        schema: z.object({
          response: z.string().describe('Simple response text')
        }),
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(10000) // 10 second timeout for test
      })

      const latency = Date.now() - startTime
      
      if (result.object.response.toLowerCase().includes('connection test successful')) {
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
        const timeoutMs = this.config.timeout || this.defaultTimeoutMs
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
   * Enhanced image/file validation
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
   * Generate provider-specific prompt
   */
  private generatePrompt(type: 'quick' | 'full' | 'document', documentType?: string, customPrompt?: string): string {
    if (customPrompt) {
      return customPrompt
    }

    const baseInstructions = `
You are an expert AI assistant specialized in analyzing receipt and document images.
Extract information with high accuracy and provide structured data.
If information is unclear or not visible, mark it as null rather than guessing.
Be precise with numbers, dates, and text extraction.
`

    switch (type) {
      case 'quick':
        return baseInstructions + `
Analyze this receipt image quickly and extract key information for form filling:
- Receipt name (descriptive title)
- Merchant name and details
- Total amount and currency
- Receipt date
- Tax amount if visible
- Payment method if identifiable
- Appropriate expense category
- Whether this appears to be a business expense
- Whether this might be tax deductible

Focus on accuracy and provide the most relevant data for expense tracking.
`

      case 'full':
        return baseInstructions + `
Perform comprehensive analysis of this receipt image:
- Extract all merchant information (name, address, contact details)
- Identify all transaction details (amounts, dates, payment methods)
- List all individual items with quantities and prices
- Categorize the expense and assess business/tax implications
- Extract any additional metadata (receipt numbers, cashier info, etc.)
- Provide confidence scores for your analysis

Be thorough and extract all visible information from the receipt.
`

      case 'document':
        return baseInstructions + `
Analyze this ${documentType || 'document'} and extract relevant information:
- Document type and identification
- Product information (name, model, serial numbers)
- Important dates (warranty periods, expiration dates)
- Contact information for support or claims
- Key terms, conditions, and important notices
- Reference numbers and document identifiers

Focus on extracting actionable information that the user might need later.
`

      default:
        return baseInstructions
    }
  }

  /**
   * Quick analysis for immediate form population
   */
  async quickAnalyzeForForm(
    imageUrl: string,
    options: AnalysisOptions = {}
  ): Promise<ReceiptFormData> {
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

      const prompt = this.generatePrompt('quick', undefined, customPrompt)

      progressCallback?.('Analyzing with AI', 80)

      // Use Vercel AI SDK to analyze the receipt
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

      const analysisResult = result.object
      
      progressCallback?.('Converting to form data', 95)

      // Convert to form data using the existing method from original service
      const formData = this.convertAnalysisToFormData(analysisResult)
      
      progressCallback?.('Complete', 100)
      
      return formData

    }, 'Quick Receipt Analysis')
  }

  /**
   * Full receipt analysis
   */
  async analyzeReceiptImage(
    imageUrl: string,
    jobId: string,
    options: AnalysisOptions & { jobType?: 'ocr_only' | 'structure_analysis' | 'full_analysis' } = {}
  ): Promise<ReceiptAnalysisResult> {
    const { 
      jobType = 'full_analysis',
      model = this.config.model,
      temperature = this.config.temperature,
      maxTokens = this.config.maxTokens,
      progressCallback,
      customPrompt
    } = options
    
    const startTime = Date.now()
    
    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', { 
        started_at: new Date().toISOString(),
        ai_model_used: model,
        ai_provider: this.config.provider
      })
      
      const result = await this.executeWithRetry(async () => {
        progressCallback?.('Validating image', 10)
        
        // Validate image first
        const validation = await this.validateFileForAnalysis(imageUrl)
        if (!validation.isValid) {
          throw new Error(validation.error || 'Image validation failed')
        }
        
        progressCallback?.('Downloading image', 30)
        
        // Fetch the image
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
        }
        
        const imageBuffer = await imageResponse.arrayBuffer()
        const imageData = new Uint8Array(imageBuffer)

        progressCallback?.('Preparing analysis', 50)
        
        // Create the analysis prompt based on job type
        const prompt = this.generatePrompt('full', undefined, customPrompt)

        progressCallback?.('Analyzing with AI', 80)

        // Use Vercel AI SDK to analyze the receipt
        const aiResult = await generateObject({
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

        return aiResult.object
      }, 'Receipt Image Analysis')
      
      progressCallback?.('Saving results', 95)
      
      const processingDuration = Date.now() - startTime

      // Update job with results
      await this.updateJobStatus(jobId, 'completed', {
        completed_at: new Date().toISOString(),
        analysis_result: result,
        confidence_scores: {
          overall: result.classification.confidence_score,
          merchant: this.calculateMerchantConfidence(result.merchant),
          transaction: this.calculateTransactionConfidence(result.transaction),
          items: this.calculateItemsConfidence(result.items)
        },
        ai_model_used: model,
        ai_provider: this.config.provider,
        processing_duration_ms: processingDuration
      })
      
      progressCallback?.('Complete', 100)

      return result

    } catch (error) {
      console.error('Receipt analysis failed:', error)
      
      const processingDuration = Date.now() - startTime
      
      // Update job with error
      await this.updateJobStatus(jobId, 'failed', {
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        processing_duration_ms: processingDuration,
        ai_provider: this.config.provider
      })

      throw error
    }
  }

  /**
   * Document analysis with configurable provider
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
      const prompt = this.generatePrompt('document', documentType, customPrompt)
      
      progressCallback?.('Analyzing with AI', 80)
      
      // Use Vercel AI SDK to analyze the document
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
      
      return result.object
      
    }, `Document Analysis (${documentType})`)
  }

  // Re-implement essential utility methods from original service
  private convertAnalysisToFormData(analysis: ReceiptAnalysisResult): ReceiptFormData {
    const receiptName = this.generateReceiptName(analysis)
    const description = this.generateReceiptDescription(analysis)
    const category = this.mapCategoryToForm(analysis.classification.category)
    const notes = this.generateNotesFromMetadata(analysis)

    return {
      name: receiptName,
      description: description,
      total_amount: analysis.transaction.total_amount,
      currency: analysis.transaction.currency,
      receipt_date: analysis.transaction.date,
      merchant_name: analysis.merchant.name,
      category: category,
      tax_amount: analysis.transaction.tax_amount || undefined,
      payment_method: analysis.transaction.payment_method || undefined,
      is_business_expense: analysis.classification.is_business_expense,
      is_tax_deductible: analysis.classification.is_tax_deductible,
      notes: notes
    }
  }

  private generateReceiptName(analysis: ReceiptAnalysisResult): string {
    const merchant = analysis.merchant.name
    const date = new Date(analysis.transaction.date).toLocaleDateString()
    const amount = `$${analysis.transaction.total_amount.toFixed(2)}`
    
    if (merchant) {
      return `${merchant} - ${date}`
    }
    
    return `Receipt ${date} - ${amount}`
  }

  private generateReceiptDescription(analysis: ReceiptAnalysisResult): string {
    if (analysis.items && analysis.items.length > 0) {
      if (analysis.items.length === 1) {
        return analysis.items[0].name
      } else if (analysis.items.length <= 3) {
        return analysis.items.map(item => item.name).join(', ')
      } else {
        return `${analysis.items.slice(0, 2).map(item => item.name).join(', ')} and ${analysis.items.length - 2} more items`
      }
    }
    
    if (analysis.classification.subcategory) {
      return analysis.classification.subcategory
    }
    
    return `Purchase from ${analysis.merchant.name || 'merchant'}`
  }

  private mapCategoryToForm(aiCategory: string): string {
    const categoryMap: Record<string, string> = {
      'food_dining': 'food_dining',
      'transportation': 'transportation',
      'shopping': 'shopping',
      'healthcare': 'healthcare',
      'entertainment': 'entertainment',
      'business': 'business',
      'travel': 'travel',
      'utilities': 'utilities',
      'home_garden': 'home_garden',
      'education': 'education',
      'other': 'other'
    }
    
    return categoryMap[aiCategory] || 'other'
  }

  private generateNotesFromMetadata(analysis: ReceiptAnalysisResult): string {
    const notes: string[] = []
    
    if (analysis.metadata.receipt_number) {
      notes.push(`Receipt #: ${analysis.metadata.receipt_number}`)
    }
    
    if (analysis.metadata.cashier) {
      notes.push(`Cashier: ${analysis.metadata.cashier}`)
    }
    
    if (analysis.metadata.loyalty_program) {
      notes.push(`Loyalty: ${analysis.metadata.loyalty_program}`)
    }
    
    if (analysis.metadata.special_offers && analysis.metadata.special_offers.length > 0) {
      notes.push(`Offers: ${analysis.metadata.special_offers.join(', ')}`)
    }
    
    if (analysis.classification.confidence_score < 0.8) {
      notes.push(`AI Confidence: ${Math.round(analysis.classification.confidence_score * 100)}%`)
    }
    
    // Add provider info
    notes.push(`Analyzed by: ${this.config.provider}/${this.config.model}`)
    
    return notes.join(' | ')
  }

  private calculateMerchantConfidence(merchant: ReceiptAnalysisResult['merchant']): number {
    let score = 0
    let factors = 0

    if (merchant.name) { score += 0.4; factors++ }
    if (merchant.address) { score += 0.3; factors++ }
    if (merchant.phone) { score += 0.2; factors++ }
    if (merchant.tax_id) { score += 0.1; factors++ }

    return factors > 0 ? score : 0
  }

  private calculateTransactionConfidence(transaction: ReceiptAnalysisResult['transaction']): number {
    let score = 0

    if (transaction.total_amount > 0) score += 0.5
    if (transaction.date) score += 0.3
    if (transaction.tax_amount !== null) score += 0.1
    if (transaction.payment_method) score += 0.1

    return score
  }

  private calculateItemsConfidence(items: ReceiptAnalysisResult['items']): number {
    if (items.length === 0) return 0

    const itemScores = items.map(item => {
      let score = 0
      if (item.name) score += 0.4
      if (item.total_price > 0) score += 0.4
      if (item.quantity > 0) score += 0.2
      return score
    })

    return itemScores.reduce((sum, score) => sum + score, 0) / items.length
  }

  private async updateJobStatus(
    jobId: string, 
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled',
    updates: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('receipt_analysis_jobs')
        .update({
          status,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (error) {
        console.error('Failed to update job status:', error)
        throw new Error(`Failed to update job status: ${error.message}`)
      }
      
      console.log(`Job ${jobId} status updated to: ${status}`)
    } catch (error) {
      console.error('Job status update failed:', error)
    }
  }
}