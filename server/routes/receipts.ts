import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z, ZodError } from 'zod'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseClient } from '../auth/supabase.js'
import { ReceiptAnalysisService } from '../services/ReceiptAnalysisService.js'

// Helper function to handle Zod errors
function handleZodError(error: unknown, reply: FastifyReply, errorMessage: string) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: errorMessage, details: error.errors })
  }
  throw error
}

// Validation schemas
const createReceiptSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  total_amount: z.number().positive(),
  currency: z.string().default('USD'),
  receipt_date: z.string().datetime(),
  merchant_name: z.string().optional(),
  merchant_address: z.string().optional(),
  category: z.string().default('other'),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
  tax_amount: z.number().optional(),
  payment_method: z.string().optional(),
  is_business_expense: z.boolean().default(false),
  is_reimbursable: z.boolean().default(false),
  is_tax_deductible: z.boolean().default(false),
  notes: z.string().optional(),
})

const updateReceiptSchema = createReceiptSchema.partial()

const receiptItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit_price: z.number().positive(),
  total_price: z.number().positive(),
  sku: z.string().optional(),
  product_category: z.string().optional(),
  tax_amount: z.number().optional(),
  is_taxable: z.boolean().default(true),
  line_number: z.number().optional(),
})

const analysisJobSchema = z.object({
  receipt_id: z.string().uuid(),
  job_type: z.enum(['ocr_only', 'structure_analysis', 'full_analysis']).default('full_analysis'),
})

const receiptDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  document_type: z.enum(['warranty', 'manual', 'invoice', 'guarantee', 'certificate', 'other']).default('warranty'),
  file_path: z.string().min(1),
  file_size: z.number().optional(),
  mime_type: z.string().optional(),
  original_filename: z.string().optional(),
  expiry_date: z.string().optional(),
  issue_date: z.string().optional(),
  document_number: z.string().optional(),
  issuer: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  is_primary: z.boolean().default(false),
})

const updateReceiptDocumentSchema = receiptDocumentSchema.partial()

const quickAnalysisSchema = z.object({
  image_url: z.string().url(),
  model: z.string().optional().default('gemini-2.5-flash'),
})

// Bulk operations schemas
const bulkCreateReceiptsSchema = z.object({
  receipts: z.array(createReceiptSchema).min(1).max(50),
})

const bulkUpdateReceiptsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    data: updateReceiptSchema,
  })).min(1).max(50),
})

const bulkDeleteReceiptsSchema = z.object({
  receipt_ids: z.array(z.string().uuid()).min(1).max(50),
})

const bulkCategorizeSchema = z.object({
  categorizations: z.array(z.object({
    receipt_id: z.string().uuid(),
    category: z.string().min(1),
    subcategory: z.string().optional(),
    confidence_score: z.number().min(0).max(1).optional(),
  })).min(1).max(100),
})

const bulkAnalyzeSchema = z.object({
  receipt_ids: z.array(z.string().uuid()).min(1).max(20),
  job_type: z.enum(['ocr_only', 'structure_analysis', 'full_analysis']).default('full_analysis'),
  model: z.string().optional().default('gemini-2.5-flash'),
})

const bulkExportSchema = z.object({
  receipt_ids: z.array(z.string().uuid()).optional(),
  filters: z.object({
    category: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    merchant_name: z.string().optional(),
    min_amount: z.number().optional(),
    max_amount: z.number().optional(),
  }).optional(),
  format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
  include_items: z.boolean().default(false),
  include_documents: z.boolean().default(false),
})

// Helper function to create authenticated Supabase client
function makeSupabaseForRequest(options: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }, request: FastifyRequest): SupabaseClient | null {
  if (!options.SUPABASE_URL || !options.SUPABASE_ANON_KEY) return null
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  
  return createClient(options.SUPABASE_URL, options.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
}

interface RequireUserFunction {
  (request: FastifyRequest, reply: FastifyReply): Promise<{ id: string } | null>
}

export function registerReceiptRoutes(
  server: FastifyInstance,
  options: {
    requireSupabaseUser: RequireUserFunction
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    GOOGLE_API_KEY?: string
  }
): void {
  const { requireSupabaseUser, SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_API_KEY } = options

  // GET /api/receipts - List all user receipts
  server.get('/api/receipts', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { limit = 50, offset = 0, category, date_from, date_to } = request.query as any

      let query = authenticatedSupabase
        .from('receipts')
        .select(`
          *,
          receipt_items(*),
          receipt_documents(*)
        `)
        .eq('user_id', user.id)
        .order('receipt_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (category) {
        query = query.eq('category', category)
      }

      if (date_from) {
        query = query.gte('receipt_date', date_from)
      }

      if (date_to) {
        query = query.lte('receipt_date', date_to)
      }

      const { data, error } = await query

      if (error) {
        return reply.code(500).send({ error: 'Failed to fetch receipts', details: error.message })
      }

      return reply.send({ receipts: data || [] })
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/receipts/:id - Get specific receipt
  server.get('/api/receipts/:id', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { data, error } = await authenticatedSupabase
        .from('receipts')
        .select(`
          *,
          receipt_items(*),
          receipt_documents(*)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Receipt not found' })
        }
        return reply.code(500).send({ error: 'Failed to fetch receipt', details: error.message })
      }

      return reply.send({ receipt: data })
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts - Create new receipt
  server.post('/api/receipts', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = createReceiptSchema.parse(request.body)
      
      const { data, error } = await authenticatedSupabase
        .from('receipts')
        .insert({
          ...body,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        return reply.code(500).send({ error: 'Failed to create receipt', details: error.message })
      }

      return reply.code(201).send({ receipt: data })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid receipt data')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // PUT /api/receipts/:id - Update receipt
  server.put('/api/receipts/:id', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = updateReceiptSchema.parse(request.body)
      
      const { data, error } = await authenticatedSupabase
        .from('receipts')
        .update(body)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Receipt not found' })
        }
        return reply.code(500).send({ error: 'Failed to update receipt', details: error.message })
      }

      return reply.send({ receipt: data })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid receipt data')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // DELETE /api/receipts/:id - Delete receipt
  server.delete('/api/receipts/:id', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { error } = await authenticatedSupabase
        .from('receipts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        return reply.code(500).send({ error: 'Failed to delete receipt', details: error.message })
      }

      return reply.code(204).send()
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/:id/analyze - Trigger AI analysis
  server.post('/api/receipts/:id/analyze', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    if (!GOOGLE_API_KEY) {
      return reply.code(503).send({ error: 'AI analysis service not configured' })
    }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = analysisJobSchema.parse({ receipt_id: id, ...(request.body as object || {}) })

      // Check if receipt exists and belongs to user
      const { data: receipt, error: receiptError } = await authenticatedSupabase
        .from('receipts')
        .select('id, image_url, analysis_status')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (receiptError) {
        if (receiptError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Receipt not found' })
        }
        return reply.code(500).send({ error: 'Failed to fetch receipt', details: receiptError.message })
      }

      if (!receipt.image_url) {
        return reply.code(400).send({ error: 'Receipt has no image to analyze' })
      }

      if (receipt.analysis_status === 'processing') {
        return reply.code(409).send({ error: 'Analysis already in progress' })
      }

      // Create analysis job
      const { data: job, error: jobError } = await authenticatedSupabase
        .from('receipt_analysis_jobs')
        .insert({
          receipt_id: id,
          user_id: user.id,
          job_type: body.job_type,
          status: 'queued'
        })
        .select()
        .single()

      if (jobError) {
        return reply.code(500).send({ error: 'Failed to create analysis job', details: jobError.message })
      }

      // Update receipt status
      await authenticatedSupabase
        .from('receipts')
        .update({ analysis_status: 'processing' })
        .eq('id', id)

      // TODO: Trigger actual AI analysis in background
      // For now, we'll just return the job
      return reply.code(202).send({ 
        message: 'Analysis job created', 
        job_id: job.id,
        status: 'queued'
      })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid analysis request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/receipts/:id/analysis - Get analysis status/results
  server.get('/api/receipts/:id/analysis', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { data, error } = await authenticatedSupabase
        .from('receipt_analysis_jobs')
        .select('*')
        .eq('receipt_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        return reply.code(500).send({ error: 'Failed to fetch analysis status', details: error.message })
      }

      if (!data || data.length === 0) {
        return reply.code(404).send({ error: 'No analysis found for this receipt' })
      }

      return reply.send({ analysis: data[0] })
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/expense-categories - List expense categories
  server.get('/api/expense-categories', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { data, error } = await authenticatedSupabase
        .from('expense_categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order')
        .order('name')

      if (error) {
        return reply.code(500).send({ error: 'Failed to fetch categories', details: error.message })
      }

      return reply.send({ categories: data || [] })
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/merchants - List merchants
  server.get('/api/merchants', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { data, error } = await authenticatedSupabase
        .from('merchants')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (error) {
        return reply.code(500).send({ error: 'Failed to fetch merchants', details: error.message })
      }

      return reply.send({ merchants: data || [] })
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/quick-analyze - Quick analysis for form auto-fill
  server.post('/api/receipts/quick-analyze', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    if (!GOOGLE_API_KEY) {
      return reply.code(503).send({ error: 'AI analysis service not configured' })
    }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = quickAnalysisSchema.parse(request.body)
      
      // Initialize analysis service
      const analysisService = new ReceiptAnalysisService(authenticatedSupabase, GOOGLE_API_KEY)
      
      // Perform quick analysis for form filling
      const formData = await analysisService.quickAnalyzeForForm(body.image_url, {
        model: body.model
      })

      return reply.send({ formData })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid quick analysis request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'AI analysis failed', details: error instanceof Error ? error.message : 'Unknown error' })
    }
  })

  // GET /api/receipts/:id/documents - List receipt documents
  server.get('/api/receipts/:id/documents', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      // Verify receipt ownership
      const { data: receipt, error: receiptError } = await authenticatedSupabase
        .from('receipts')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (receiptError) {
        if (receiptError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Receipt not found' })
        }
        return reply.code(500).send({ error: 'Failed to verify receipt', details: receiptError.message })
      }

      // Get receipt documents
      const { data, error } = await authenticatedSupabase
        .from('receipt_documents')
        .select('*')
        .eq('receipt_id', id)
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        return reply.code(500).send({ error: 'Failed to fetch receipt documents', details: error.message })
      }

      return reply.send({ documents: data || [] })
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/:id/documents - Add receipt document
  server.post('/api/receipts/:id/documents', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      // Verify receipt ownership
      const { data: receipt, error: receiptError } = await authenticatedSupabase
        .from('receipts')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (receiptError) {
        if (receiptError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Receipt not found' })
        }
        return reply.code(500).send({ error: 'Failed to verify receipt', details: receiptError.message })
      }

      const body = receiptDocumentSchema.parse(request.body)
      
      const { data, error } = await authenticatedSupabase
        .from('receipt_documents')
        .insert({
          ...body,
          receipt_id: id,
          user_id: user.id,
          analysis_status: 'pending'
        })
        .select()
        .single()

      if (error) {
        return reply.code(500).send({ error: 'Failed to create receipt document', details: error.message })
      }

      // Trigger AI analysis if enabled and document is an image or PDF
      if (GOOGLE_API_KEY && data && (data.mime_type?.startsWith('image/') || data.mime_type === 'application/pdf')) {
        try {
          // Get public URL for analysis
          const { data: urlData } = authenticatedSupabase.storage
            .from('receipt-documents')
            .getPublicUrl(data.file_path)
          
          if (urlData.publicUrl) {
            // Initialize analysis service and analyze document
            const analysisService = new ReceiptAnalysisService(authenticatedSupabase, GOOGLE_API_KEY)
            
            // Start analysis in background (don't wait for completion)
            analysisService.analyzeDocument(
              urlData.publicUrl,
              data.document_type as any
            ).then(async (analysisResult) => {
              // Update document with analysis results
              await analysisService.updateDocumentWithAnalysis(data.id, analysisResult)
              
              // Update status to completed
              await authenticatedSupabase
                .from('receipt_documents')
                .update({ analysis_status: 'completed' })
                .eq('id', data.id)
            }).catch(async (error) => {
              console.error('Document analysis failed:', error)
              
              // Update status to failed
              await authenticatedSupabase
                .from('receipt_documents')
                .update({ analysis_status: 'failed' })
                .eq('id', data.id)
            })
            
            // Update status to processing
            await authenticatedSupabase
              .from('receipt_documents')
              .update({ analysis_status: 'processing' })
              .eq('id', data.id)
          }
        } catch (analysisError) {
          console.error('Failed to initiate document analysis:', analysisError)
          // Don't fail the document creation if analysis fails
        }
      }

      return reply.code(201).send({ document: data })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid receipt document data')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // PUT /api/receipts/:id/documents/:docId - Update receipt document
  server.put('/api/receipts/:id/documents/:docId', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id, docId } = request.params as { id: string; docId: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = updateReceiptDocumentSchema.parse(request.body)
      
      const { data, error } = await authenticatedSupabase
        .from('receipt_documents')
        .update(body)
        .eq('id', docId)
        .eq('receipt_id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Receipt document not found' })
        }
        return reply.code(500).send({ error: 'Failed to update receipt document', details: error.message })
      }

      return reply.send({ document: data })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid receipt document data')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // DELETE /api/receipts/:id/documents/:docId - Delete receipt document
  server.delete('/api/receipts/:id/documents/:docId', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id, docId } = request.params as { id: string; docId: string }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { error } = await authenticatedSupabase
        .from('receipt_documents')
        .delete()
        .eq('id', docId)
        .eq('receipt_id', id)
        .eq('user_id', user.id)

      if (error) {
        return reply.code(500).send({ error: 'Failed to delete receipt document', details: error.message })
      }

      return reply.code(204).send()
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/:id/documents/:docId/analyze - Analyze specific document
  server.post('/api/receipts/:id/documents/:docId/analyze', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id, docId } = request.params as { id: string; docId: string }

    if (!GOOGLE_API_KEY) {
      return reply.code(503).send({ error: 'AI analysis service not configured' })
    }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      // Get document and verify ownership
      const { data: document, error: docError } = await authenticatedSupabase
        .from('receipt_documents')
        .select('*')
        .eq('id', docId)
        .eq('receipt_id', id)
        .eq('user_id', user.id)
        .single()

      if (docError) {
        if (docError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Document not found' })
        }
        return reply.code(500).send({ error: 'Failed to fetch document', details: docError.message })
      }

      if (document.analysis_status === 'processing') {
        return reply.code(409).send({ error: 'Analysis already in progress' })
      }

      // Get public URL for the document
      const { data: urlData } = authenticatedSupabase.storage
        .from('receipt-documents')
        .getPublicUrl(document.file_path)

      if (!urlData.publicUrl) {
        return reply.code(500).send({ error: 'Failed to get document URL' })
      }

      // Update status to processing
      await authenticatedSupabase
        .from('receipt_documents')
        .update({ analysis_status: 'processing' })
        .eq('id', docId)

      // Initialize analysis service
      const analysisService = new ReceiptAnalysisService(authenticatedSupabase, GOOGLE_API_KEY)
      
      // Perform analysis
      try {
        const analysisResult = await analysisService.analyzeDocument(
          urlData.publicUrl,
          document.document_type as any
        )
        
        // Update document with analysis results
        await analysisService.updateDocumentWithAnalysis(docId, analysisResult)
        
        // Update status to completed
        await authenticatedSupabase
          .from('receipt_documents')
          .update({ analysis_status: 'completed' })
          .eq('id', docId)
        
        return reply.send({ 
          message: 'Document analysis completed',
          analysis: analysisResult
        })
      } catch (analysisError) {
        console.error('Document analysis failed:', analysisError)
        
        // Update status to failed
        await authenticatedSupabase
          .from('receipt_documents')
          .update({ analysis_status: 'failed' })
          .eq('id', docId)
        
        return reply.code(500).send({ 
          error: 'Document analysis failed',
          details: analysisError instanceof Error ? analysisError.message : 'Unknown error'
        })
      }
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/:id/analyze-documents - Analyze all documents for a receipt
  server.post('/api/receipts/:id/analyze-documents', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const { id } = request.params as { id: string }

    if (!GOOGLE_API_KEY) {
      return reply.code(503).send({ error: 'AI analysis service not configured' })
    }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      // Verify receipt ownership
      const { data: receipt, error: receiptError } = await authenticatedSupabase
        .from('receipts')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (receiptError) {
        if (receiptError.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Receipt not found' })
        }
        return reply.code(500).send({ error: 'Failed to verify receipt', details: receiptError.message })
      }

      // Initialize analysis service
      const analysisService = new ReceiptAnalysisService(authenticatedSupabase, GOOGLE_API_KEY)
      
      // Analyze all documents for this receipt
      const results = await analysisService.analyzeReceiptDocuments(id)
      
      return reply.send({ 
        message: `Analysis completed for ${results.length} documents`,
        results: results
      })
    } catch (error: unknown) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ===== BULK OPERATIONS =====

  // POST /api/receipts/bulk - Bulk create receipts
  server.post('/api/receipts/bulk', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = bulkCreateReceiptsSchema.parse(request.body)
      
      // Add user_id to all receipts
      const receiptsWithUserId = body.receipts.map(receipt => ({
        ...receipt,
        user_id: user.id,
      }))
      
      const { data, error } = await authenticatedSupabase
        .from('receipts')
        .insert(receiptsWithUserId)
        .select()

      if (error) {
        return reply.code(500).send({ error: 'Failed to create receipts', details: error.message })
      }

      return reply.code(201).send({ 
        message: `Successfully created ${data.length} receipts`,
        receipts: data,
        count: data.length
      })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid bulk create request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // PUT /api/receipts/bulk - Bulk update receipts
  server.put('/api/receipts/bulk', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = bulkUpdateReceiptsSchema.parse(request.body)
      
      const results = []
      const errors = []
      
      // Process updates sequentially to maintain data integrity
      for (const update of body.updates) {
        try {
          const { data, error } = await authenticatedSupabase
            .from('receipts')
            .update(update.data)
            .eq('id', update.id)
            .eq('user_id', user.id)
            .select()
            .single()

          if (error) {
            if (error.code === 'PGRST116') {
              errors.push({ id: update.id, error: 'Receipt not found' })
            } else {
              errors.push({ id: update.id, error: error.message })
            }
          } else {
            results.push(data)
          }
        } catch (updateError) {
          errors.push({ 
            id: update.id, 
            error: updateError instanceof Error ? updateError.message : 'Unknown error' 
          })
        }
      }

      return reply.send({ 
        message: `Updated ${results.length} receipts${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        updated: results,
        errors: errors,
        success_count: results.length,
        error_count: errors.length
      })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid bulk update request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // DELETE /api/receipts/bulk - Bulk delete receipts
  server.delete('/api/receipts/bulk', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = bulkDeleteReceiptsSchema.parse(request.body)
      
      const { data, error } = await authenticatedSupabase
        .from('receipts')
        .delete()
        .in('id', body.receipt_ids)
        .eq('user_id', user.id)
        .select('id')

      if (error) {
        return reply.code(500).send({ error: 'Failed to delete receipts', details: error.message })
      }

      const deletedCount = data?.length || 0
      const notFoundCount = body.receipt_ids.length - deletedCount

      return reply.send({ 
        message: `Successfully deleted ${deletedCount} receipts${notFoundCount > 0 ? ` (${notFoundCount} not found)` : ''}`,
        deleted_count: deletedCount,
        not_found_count: notFoundCount,
        deleted_ids: data?.map(r => r.id) || []
      })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid bulk delete request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/bulk/categorize - Bulk categorize receipts
  server.post('/api/receipts/bulk/categorize', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = bulkCategorizeSchema.parse(request.body)
      
      const results = []
      const errors = []
      
      // Process categorizations in batches for better performance
      const batchSize = 10
      for (let i = 0; i < body.categorizations.length; i += batchSize) {
        const batch = body.categorizations.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async (categorization) => {
          try {
            const updateData: any = {
              category: categorization.category,
              updated_at: new Date().toISOString()
            }
            
            if (categorization.subcategory) {
              updateData.subcategory = categorization.subcategory
            }
            
            // Add confidence score to notes if provided
            if (categorization.confidence_score !== undefined) {
              updateData.notes = `AI Confidence: ${Math.round(categorization.confidence_score * 100)}%`
            }

            const { data, error } = await authenticatedSupabase
              .from('receipts')
              .update(updateData)
              .eq('id', categorization.receipt_id)
              .eq('user_id', user.id)
              .select('id, name, category')
              .single()

            if (error) {
              if (error.code === 'PGRST116') {
                return { error: { id: categorization.receipt_id, error: 'Receipt not found' } }
              } else {
                return { error: { id: categorization.receipt_id, error: error.message } }
              }
            }
            
            return { success: data }
          } catch (err) {
            return { 
              error: { 
                id: categorization.receipt_id, 
                error: err instanceof Error ? err.message : 'Unknown error' 
              } 
            }
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        
        batchResults.forEach(result => {
          if (result.success) {
            results.push(result.success)
          } else if (result.error) {
            errors.push(result.error)
          }
        })
      }

      return reply.send({ 
        message: `Categorized ${results.length} receipts${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        categorized: results,
        errors: errors,
        success_count: results.length,
        error_count: errors.length
      })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid bulk categorize request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/bulk/analyze - Bulk analyze receipts
  server.post('/api/receipts/bulk/analyze', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    if (!GOOGLE_API_KEY) {
      return reply.code(503).send({ error: 'AI analysis service not configured' })
    }

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = bulkAnalyzeSchema.parse(request.body)
      
      // Verify all receipts exist and belong to user
      const { data: receipts, error: receiptsError } = await authenticatedSupabase
        .from('receipts')
        .select('id, image_url, analysis_status, name')
        .in('id', body.receipt_ids)
        .eq('user_id', user.id)

      if (receiptsError) {
        return reply.code(500).send({ error: 'Failed to fetch receipts', details: receiptsError.message })
      }

      if (!receipts || receipts.length === 0) {
        return reply.code(404).send({ error: 'No receipts found' })
      }

      // Filter receipts that can be analyzed
      const analyzableReceipts = receipts.filter(receipt => 
        receipt.image_url && receipt.analysis_status !== 'processing'
      )

      if (analyzableReceipts.length === 0) {
        return reply.code(400).send({ error: 'No receipts available for analysis (missing images or already processing)' })
      }

      // Create analysis jobs for each receipt
      const jobPromises = analyzableReceipts.map(async (receipt) => {
        try {
          const { data: job, error: jobError } = await authenticatedSupabase
            .from('receipt_analysis_jobs')
            .insert({
              receipt_id: receipt.id,
              user_id: user.id,
              job_type: body.job_type,
              status: 'queued'
            })
            .select()
            .single()

          if (jobError) {
            return { error: { receipt_id: receipt.id, error: jobError.message } }
          }

          // Update receipt status
          await authenticatedSupabase
            .from('receipts')
            .update({ analysis_status: 'processing' })
            .eq('id', receipt.id)

          return { success: { receipt_id: receipt.id, job_id: job.id, receipt_name: receipt.name } }
        } catch (err) {
          return { 
            error: { 
              receipt_id: receipt.id, 
              error: err instanceof Error ? err.message : 'Unknown error' 
            } 
          }
        }
      })

      const jobResults = await Promise.all(jobPromises)
      
      const successfulJobs = jobResults.filter(r => r.success).map(r => r.success!)
      const failedJobs = jobResults.filter(r => r.error).map(r => r.error!)

      return reply.code(202).send({ 
        message: `Started analysis for ${successfulJobs.length} receipts${failedJobs.length > 0 ? ` with ${failedJobs.length} failures` : ''}`,
        started: successfulJobs,
        errors: failedJobs,
        success_count: successfulJobs.length,
        error_count: failedJobs.length,
        skipped_count: receipts.length - analyzableReceipts.length
      })
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid bulk analyze request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/receipts/bulk/export - Bulk export receipts
  server.post('/api/receipts/bulk/export', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = bulkExportSchema.parse(request.body)
      
      // Build query based on filters or receipt IDs
      let query = authenticatedSupabase
        .from('receipts')
        .select(`
          *,
          ${body.include_items ? 'receipt_items(*),' : ''}
          ${body.include_documents ? 'receipt_documents(*)' : ''}
        `)
        .eq('user_id', user.id)

      if (body.receipt_ids && body.receipt_ids.length > 0) {
        query = query.in('id', body.receipt_ids)
      } else if (body.filters) {
        const filters = body.filters
        
        if (filters.category) {
          query = query.eq('category', filters.category)
        }
        if (filters.date_from) {
          query = query.gte('receipt_date', filters.date_from)
        }
        if (filters.date_to) {
          query = query.lte('receipt_date', filters.date_to)
        }
        if (filters.merchant_name) {
          query = query.ilike('merchant_name', `%${filters.merchant_name}%`)
        }
        if (filters.min_amount) {
          query = query.gte('total_amount', filters.min_amount)
        }
        if (filters.max_amount) {
          query = query.lte('total_amount', filters.max_amount)
        }
      }

      query = query.order('receipt_date', { ascending: false })

      const { data: receipts, error } = await query

      if (error) {
        return reply.code(500).send({ error: 'Failed to fetch receipts for export', details: error.message })
      }

      if (!receipts || receipts.length === 0) {
        return reply.code(404).send({ error: 'No receipts found for export' })
      }

      // Generate export data based on format
      let exportData: any
      let contentType: string
      let filename: string

      const timestamp = new Date().toISOString().split('T')[0]
      
      switch (body.format) {
        case 'json':
          exportData = JSON.stringify({ receipts, exported_at: new Date().toISOString(), count: receipts.length }, null, 2)
          contentType = 'application/json'
          filename = `receipts-export-${timestamp}.json`
          break

        case 'csv':
          // Create CSV with flattened data
          const csvHeaders = [
            'id', 'name', 'description', 'total_amount', 'currency', 'receipt_date',
            'merchant_name', 'merchant_address', 'category', 'subcategory',
            'tax_amount', 'payment_method', 'is_business_expense', 'is_reimbursable',
            'is_tax_deductible', 'notes', 'created_at', 'updated_at'
          ]
          
          const csvRows = receipts.map(receipt => {
            return csvHeaders.map(header => {
              const value = receipt[header]
              if (value === null || value === undefined) return ''
              if (typeof value === 'string' && value.includes(',')) {
                return `"${value.replace(/"/g, '""')}"`
              }
              return String(value)
            }).join(',')
          })
          
          exportData = [csvHeaders.join(','), ...csvRows].join('\n')
          contentType = 'text/csv'
          filename = `receipts-export-${timestamp}.csv`
          break

        case 'xlsx':
          // For XLSX, we'll return JSON and let the frontend handle Excel generation
          exportData = JSON.stringify({ 
            receipts: receipts.map(receipt => {
              // Flatten the receipt data for Excel
              const flattened: any = { ...receipt }
              delete flattened.receipt_items
              delete flattened.receipt_documents
              return flattened
            }),
            metadata: {
              exported_at: new Date().toISOString(),
              count: receipts.length,
              format: 'xlsx_data'
            }
          }, null, 2)
          contentType = 'application/json'
          filename = `receipts-export-${timestamp}.json`
          break

        default:
          return reply.code(400).send({ error: 'Unsupported export format' })
      }

      reply.header('Content-Type', contentType)
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      
      return reply.send(exportData)
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return handleZodError(error, reply, 'Invalid bulk export request')
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}