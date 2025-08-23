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
        })
        .select()
        .single()

      if (error) {
        return reply.code(500).send({ error: 'Failed to create receipt document', details: error.message })
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
}