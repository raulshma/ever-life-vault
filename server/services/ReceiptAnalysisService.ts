import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// Schema for receipt analysis results
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

// Schema for document analysis results
const DocumentAnalysisSchema = z.object({
  // Document identification
  document_info: z.object({
    type: z.enum(['warranty', 'manual', 'invoice', 'guarantee', 'certificate', 'other']).describe('Type of document detected'),
    title: z.string().nullable().describe('Document title or heading'),
    language: z.string().nullable().describe('Document language (e.g., en, es, fr)'),
    page_count: z.number().nullable().describe('Number of pages if detectable'),
    format: z.string().nullable().describe('Document format (PDF, image, etc.)')
  }),
  
  // Product information
  product: z.object({
    name: z.string().nullable().describe('Product name or model'),
    brand: z.string().nullable().describe('Brand or manufacturer'),
    model_number: z.string().nullable().describe('Model number or SKU'),
    serial_number: z.string().nullable().describe('Serial number if present'),
    category: z.string().nullable().describe('Product category'),
    description: z.string().nullable().describe('Product description')
  }),
  
  // Warranty and coverage details
  warranty: z.object({
    duration: z.string().nullable().describe('Warranty duration (e.g., "2 years", "90 days")'),
    start_date: z.string().nullable().describe('Warranty start date in YYYY-MM-DD format'),
    end_date: z.string().nullable().describe('Warranty end date in YYYY-MM-DD format'),
    coverage_type: z.string().nullable().describe('Type of coverage (limited, full, parts only, etc.)'),
    terms: z.array(z.string()).describe('Key warranty terms and conditions'),
    exclusions: z.array(z.string()).describe('What is not covered'),
    claim_process: z.string().nullable().describe('How to make a warranty claim')
  }),
  
  // Important dates
  dates: z.object({
    purchase_date: z.string().nullable().describe('Purchase date in YYYY-MM-DD format'),
    issue_date: z.string().nullable().describe('Document issue date in YYYY-MM-DD format'),
    expiry_date: z.string().nullable().describe('Document expiry date in YYYY-MM-DD format'),
    registration_deadline: z.string().nullable().describe('Product registration deadline if applicable')
  }),
  
  // Contact and support information
  support: z.object({
    company_name: z.string().nullable().describe('Company or manufacturer name'),
    phone: z.string().nullable().describe('Support phone number'),
    email: z.string().nullable().describe('Support email address'),
    website: z.string().nullable().describe('Support website URL'),
    address: z.string().nullable().describe('Company address')
  }),
  
  // Document numbers and references
  references: z.object({
    document_number: z.string().nullable().describe('Document reference number'),
    certificate_number: z.string().nullable().describe('Certificate number if applicable'),
    policy_number: z.string().nullable().describe('Policy or agreement number'),
    order_number: z.string().nullable().describe('Related order number')
  }),
  
  // Key extracted information
  key_information: z.array(z.object({
    category: z.string().describe('Information category (e.g., "Important Note", "Requirement")'),
    content: z.string().describe('The important information extracted'),
    priority: z.enum(['high', 'medium', 'low']).describe('Priority level of this information')
  })).describe('Important information extracted from the document'),
  
  // Analysis metadata
  analysis_metadata: z.object({
    confidence_score: z.number().min(0).max(1).describe('Overall confidence in the analysis'),
    extracted_text_length: z.number().describe('Length of text extracted from document'),
    processing_notes: z.array(z.string()).describe('Notes about the analysis process'),
    suggested_actions: z.array(z.string()).describe('Suggested actions based on document content')
  })
})

export type ReceiptAnalysisResult = z.infer<typeof ReceiptAnalysisSchema>
export type DocumentAnalysisResult = z.infer<typeof DocumentAnalysisSchema>

// Schema for form auto-fill data
export interface ReceiptFormData {
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

export class ReceiptAnalysisService {
  private supabase: SupabaseClient
  private googleApiKey: string
  private googleProvider: any

  constructor(supabase: SupabaseClient, googleApiKey: string) {
    this.supabase = supabase
    this.googleApiKey = googleApiKey
    this.googleProvider = createGoogleGenerativeAI({
      apiKey: googleApiKey,
    })
  }

  /**
   * Quick analysis for immediate form population (doesn't save to database)
   */
  async quickAnalyzeForForm(
    imageUrl: string,
    options: {
      model?: string
    } = {}
  ): Promise<ReceiptFormData> {
    const { model = 'gemini-2.5-flash' } = options
    
    try {
      // Fetch the image
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
      }
      
      const imageBuffer = await imageResponse.arrayBuffer()
      const imageData = new Uint8Array(imageBuffer)

      // Create a focused prompt for form filling
      const prompt = `
Analyze this receipt image and extract the key information needed for form filling.
Focus on accuracy and provide the most relevant data for expense tracking.

Provide:
- A clear, descriptive name for this receipt
- Transaction details (amount, date, merchant)
- Appropriate expense category
- Tax information if visible
- Payment method if identifiable
- Whether this appears to be a business expense
- Whether this might be tax deductible

Be precise with amounts and dates. If information is unclear, provide reasonable defaults.
`

      // Use Vercel AI SDK with Google Gemini to analyze the receipt
      const result = await generateObject({
        model: this.googleProvider(model),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: imageData
              }
            ]
          }
        ],
        schema: ReceiptAnalysisSchema,
        maxRetries: 2,
      })

      const analysisResult = result.object

      // Convert to form data
      return this.convertAnalysisToFormData(analysisResult)

    } catch (error) {
      console.error('Quick receipt analysis failed:', error)
      throw error
    }
  }

  /**
   * Convert analysis result to form-ready data
   */
  convertAnalysisToFormData(analysis: ReceiptAnalysisResult): ReceiptFormData {
    // Generate a descriptive receipt name
    const receiptName = this.generateReceiptName(analysis)
    
    // Create description from items or merchant
    const description = this.generateReceiptDescription(analysis)
    
    // Map category to form category
    const category = this.mapCategoryToForm(analysis.classification.category)
    
    // Generate notes from metadata
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

  /**
   * Generate a descriptive receipt name
   */
  private generateReceiptName(analysis: ReceiptAnalysisResult): string {
    const merchant = analysis.merchant.name
    const date = new Date(analysis.transaction.date).toLocaleDateString()
    const amount = `$${analysis.transaction.total_amount.toFixed(2)}`
    
    if (merchant) {
      return `${merchant} - ${date}`
    }
    
    return `Receipt ${date} - ${amount}`
  }

  /**
   * Generate receipt description from items or context
   */
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

  /**
   * Map AI category to form category
   */
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

  /**
   * Generate notes from metadata
   */
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
    
    return notes.join(' | ')
  }

  /**
   * Analyze a document file to extract structured information
   */
  async analyzeDocument(
    fileUrl: string,
    documentType: 'warranty' | 'manual' | 'invoice' | 'guarantee' | 'certificate' | 'other' = 'other',
    options: {
      model?: string
    } = {}
  ): Promise<DocumentAnalysisResult> {
    const { model = 'gemini-2.5-flash' } = options
    
    try {
      // Fetch the file
      const fileResponse = await fetch(fileUrl)
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.statusText}`)
      }
      
      const fileBuffer = await fileResponse.arrayBuffer()
      const fileData = new Uint8Array(fileBuffer)
      
      // Determine the file type from the URL or content type
      const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream'
      const isImage = contentType.startsWith('image/')
      const isPDF = contentType === 'application/pdf'
      
      if (!isImage && !isPDF) {
        // For non-image, non-PDF files, we might need to convert or extract text differently
        // For now, we'll treat them as text documents
        console.warn(`Unsupported file type for AI analysis: ${contentType}. Attempting text extraction.`)
      }
      
      // Create analysis prompt based on document type
      const prompt = this.createDocumentAnalysisPrompt(documentType)
      
      // Use Vercel AI SDK with Google Gemini to analyze the document
      const result = await generateObject({
        model: this.googleProvider(model),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: fileData
              }
            ]
          }
        ],
        schema: DocumentAnalysisSchema,
        maxRetries: 2,
      })
      
      return result.object
      
    } catch (error) {
      console.error('Document analysis failed:', error)
      throw error
    }
  }
  
  /**
   * Create analysis prompt based on document type
   */
  private createDocumentAnalysisPrompt(documentType: string): string {
    const basePrompt = `
Analyze this document and extract all relevant information with high accuracy.

Pay special attention to:
- Document identification and type
- Product information (name, model, serial numbers)
- Important dates (warranty periods, expiration dates, deadlines)
- Contact information for support or claims
- Key terms, conditions, and important notices
- Reference numbers and document identifiers

Be precise with dates and numbers. If information is unclear or not visible, mark it as null rather than guessing.
`
    
    switch (documentType) {
      case 'warranty':
        return basePrompt + `
This appears to be a WARRANTY document. Focus on:
- Warranty duration and coverage details
- What is covered and what is excluded
- How to make warranty claims
- Product registration requirements
- Important warranty terms and conditions
- Manufacturer contact information`
        
      case 'manual':
        return basePrompt + `
This appears to be a MANUAL or instruction document. Focus on:
- Product specifications and features
- Safety warnings and important notices
- Setup and installation instructions
- Troubleshooting information
- Maintenance requirements
- Contact information for support`
        
      case 'invoice':
        return basePrompt + `
This appears to be an INVOICE or bill. Focus on:
- Billing information and amounts
- Product details and quantities
- Payment terms and due dates
- Seller and buyer information
- Invoice numbers and references
- Tax information and breakdowns`
        
      case 'guarantee':
        return basePrompt + `
This appears to be a GUARANTEE document. Focus on:
- Guarantee terms and duration
- What is guaranteed and conditions
- How to claim the guarantee
- Important deadlines and requirements
- Company information and contacts
- Legal terms and conditions`
        
      case 'certificate':
        return basePrompt + `
This appears to be a CERTIFICATE. Focus on:
- Certificate type and purpose
- Certification details and standards
- Validity period and expiration
- Issuing authority information
- Certificate numbers and references
- Requirements and compliance details`
        
      default:
        return basePrompt + `
Analyze this document comprehensively and identify:
- The type and purpose of the document
- All relevant information that might be important
- Any deadlines, dates, or time-sensitive information
- Contact details and reference numbers
- Key terms or conditions that should be noted`
    }
  }
  
  /**
   * Update receipt document with analysis results
   */
  async updateDocumentWithAnalysis(
    documentId: string,
    analysisResult: DocumentAnalysisResult
  ): Promise<void> {
    // Update the receipt_documents table with analysis data
    const updates = {
      // Update document metadata based on analysis
      name: analysisResult.product.name || analysisResult.document_info.title,
      description: analysisResult.product.description,
      document_type: analysisResult.document_info.type,
      expiry_date: analysisResult.dates.expiry_date || analysisResult.warranty.end_date,
      issue_date: analysisResult.dates.issue_date,
      document_number: analysisResult.references.document_number || analysisResult.references.certificate_number,
      issuer: analysisResult.support.company_name,
      
      // Store full analysis data in a JSONB field (we'll need to add this to the schema)
      ai_analysis_data: analysisResult,
      ai_confidence_score: analysisResult.analysis_metadata.confidence_score,
      
      updated_at: new Date().toISOString()
    }
    
    const { error } = await this.supabase
      .from('receipt_documents')
      .update(updates)
      .eq('id', documentId)
    
    if (error) {
      throw new Error(`Failed to update document with analysis: ${error.message}`)
    }
  }
  
  /**
   * Analyze multiple documents for a receipt
   */
  async analyzeReceiptDocuments(
    receiptId: string,
    options: {
      model?: string
    } = {}
  ): Promise<{ documentId: string; analysis: DocumentAnalysisResult }[]> {
    // Get all documents for this receipt
    const { data: documents, error } = await this.supabase
      .from('receipt_documents')
      .select('*')
      .eq('receipt_id', receiptId)
    
    if (error) {
      throw new Error(`Failed to fetch receipt documents: ${error.message}`)
    }
    
    if (!documents || documents.length === 0) {
      return []
    }
    
    const results: { documentId: string; analysis: DocumentAnalysisResult }[] = []
    
    // Analyze each document
    for (const doc of documents) {
      try {
        // Get public URL for the document
        const { data } = this.supabase.storage
          .from('receipt-documents')
          .getPublicUrl(doc.file_path)
        
        if (data.publicUrl) {
          const analysis = await this.analyzeDocument(
            data.publicUrl,
            doc.document_type as any,
            options
          )
          
          // Update document with analysis
          await this.updateDocumentWithAnalysis(doc.id, analysis)
          
          results.push({
            documentId: doc.id,
            analysis
          })
        }
      } catch (error) {
        console.error(`Failed to analyze document ${doc.id}:`, error)
        // Continue with other documents even if one fails
      }
    }
    
    return results
  }

  /**
   * Analyzes a receipt image using Google Gemini Vision
   */
  async analyzeReceiptImage(
    imageUrl: string, 
    jobId: string,
    options: {
      jobType?: 'ocr_only' | 'structure_analysis' | 'full_analysis'
      model?: string
    } = {}
  ): Promise<ReceiptAnalysisResult> {
    const { jobType = 'full_analysis', model = 'gemini-2.5-flash' } = options
    
    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', { started_at: new Date().toISOString() })

      // Fetch the image
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
      }
      
      const imageBuffer = await imageResponse.arrayBuffer()
      const imageData = new Uint8Array(imageBuffer)

      // Create the analysis prompt based on job type
      const prompt = this.createAnalysisPrompt(jobType)

      // Use Vercel AI SDK with Google Gemini to analyze the receipt
      const result = await generateObject({
        model: this.googleProvider(model),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: imageData
              }
            ]
          }
        ],
        schema: ReceiptAnalysisSchema,
        maxRetries: 2,
      })

      const analysisResult = result.object

      // Update job with results
      await this.updateJobStatus(jobId, 'completed', {
        completed_at: new Date().toISOString(),
        analysis_result: analysisResult,
        confidence_scores: {
          overall: analysisResult.classification.confidence_score,
          merchant: this.calculateMerchantConfidence(analysisResult.merchant),
          transaction: this.calculateTransactionConfidence(analysisResult.transaction),
          items: this.calculateItemsConfidence(analysisResult.items)
        },
        ai_model_used: model,
        processing_duration_ms: Date.now() - new Date().getTime()
      })

      return analysisResult

    } catch (error) {
      console.error('Receipt analysis failed:', error)
      
      // Update job with error
      await this.updateJobStatus(jobId, 'failed', {
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error occurred'
      })

      throw error
    }
  }

  /**
   * Creates analysis prompt based on job type
   */
  private createAnalysisPrompt(jobType: string): string {
    const basePrompt = `
Analyze this receipt image and extract all visible information with high accuracy. 
Pay special attention to:
- Merchant details (name, address, contact info)
- Transaction details (date, time, amounts, payment method)
- Individual items with quantities and prices
- Tax information and calculations
- Any promotional offers or discounts

Be precise with numbers and dates. If information is unclear or not visible, 
mark it as null rather than guessing.
`

    switch (jobType) {
      case 'ocr_only':
        return basePrompt + `
Focus primarily on extracting text accurately. Provide basic structure 
but prioritize text recognition over complex analysis.`

      case 'structure_analysis':
        return basePrompt + `
Focus on structuring the extracted data properly. Ensure all amounts 
add up correctly and relationships between items are clear.`

      case 'full_analysis':
      default:
        return basePrompt + `
Provide comprehensive analysis including:
- Accurate categorization of the expense type
- Assessment of whether this appears to be a business expense
- Evaluation of potential tax deductibility
- Confidence scores for your analysis
- Any special characteristics or notable features

Consider the merchant type, item categories, and transaction context 
to make informed classifications.`
    }
  }

  /**
   * Updates analysis job status in database
   */
  private async updateJobStatus(
    jobId: string, 
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled',
    updates: Record<string, any> = {}
  ): Promise<void> {
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
  }

  /**
   * Updates receipt with analysis results
   */
  async updateReceiptWithAnalysis(
    receiptId: string, 
    analysisResult: ReceiptAnalysisResult
  ): Promise<void> {
    const updates = {
      // Update basic fields from analysis
      merchant_name: analysisResult.merchant.name,
      merchant_address: analysisResult.merchant.address,
      merchant_phone: analysisResult.merchant.phone,
      merchant_tax_id: analysisResult.merchant.tax_id,
      
      total_amount: analysisResult.transaction.total_amount,
      currency: analysisResult.transaction.currency,
      receipt_date: analysisResult.transaction.date,
      
      tax_amount: analysisResult.transaction.tax_amount,
      tax_rate: analysisResult.transaction.tax_rate,
      tip_amount: analysisResult.transaction.tip_amount,
      pre_tax_amount: analysisResult.transaction.subtotal,
      payment_method: analysisResult.transaction.payment_method,
      
      category: analysisResult.classification.category,
      subcategory: analysisResult.classification.subcategory,
      is_business_expense: analysisResult.classification.is_business_expense,
      is_tax_deductible: analysisResult.classification.is_tax_deductible,
      
      // Store full analysis data
      ai_analysis_data: analysisResult,
      ai_confidence_score: analysisResult.classification.confidence_score,
      analysis_status: 'completed',
      
      updated_at: new Date().toISOString()
    }

    const { error } = await this.supabase
      .from('receipts')
      .update(updates)
      .eq('id', receiptId)

    if (error) {
      throw new Error(`Failed to update receipt: ${error.message}`)
    }

    // Update receipt items if available
    if (analysisResult.items && analysisResult.items.length > 0) {
      await this.updateReceiptItems(receiptId, analysisResult.items)
    }
  }

  /**
   * Updates receipt items from analysis
   */
  private async updateReceiptItems(
    receiptId: string, 
    items: ReceiptAnalysisResult['items']
  ): Promise<void> {
    // First, delete existing items
    await this.supabase
      .from('receipt_items')
      .delete()
      .eq('receipt_id', receiptId)

    // Insert new items
    const itemsToInsert = items.map(item => ({
      receipt_id: receiptId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      product_category: item.category,
      sku: item.sku,
      tax_amount: item.tax_amount,
      line_number: item.line_number,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error } = await this.supabase
      .from('receipt_items')
      .insert(itemsToInsert)

    if (error) {
      console.error('Failed to insert receipt items:', error)
      // Don't throw here as the main receipt update succeeded
    }
  }

  /**
   * Calculate confidence scores for different sections
   */
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

  /**
   * Process analysis job queue
   */
  async processAnalysisJob(jobId: string): Promise<void> {
    // Get job details
    const { data: job, error: jobError } = await this.supabase
      .from('receipt_analysis_jobs')
      .select(`
        *,
        receipts(id, image_url, user_id)
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobId}`)
    }

    if (job.status !== 'queued') {
      throw new Error(`Job is not in queued status: ${job.status}`)
    }

    const receipt = job.receipts as any
    if (!receipt?.image_url) {
      throw new Error('Receipt has no image to analyze')
    }

    // Perform analysis
    const analysisResult = await this.analyzeReceiptImage(
      receipt.image_url,
      jobId,
      { jobType: job.job_type }
    )

    // Update receipt with results
    await this.updateReceiptWithAnalysis(receipt.id, analysisResult)
  }
}