import { google } from '@ai-sdk/google'
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

export type ReceiptAnalysisResult = z.infer<typeof ReceiptAnalysisSchema>

export class ReceiptAnalysisService {
  private supabase: SupabaseClient
  private googleApiKey: string

  constructor(supabase: SupabaseClient, googleApiKey: string) {
    this.supabase = supabase
    this.googleApiKey = googleApiKey
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
        model: google(model, {
          apiKey: this.googleApiKey,
        }),
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