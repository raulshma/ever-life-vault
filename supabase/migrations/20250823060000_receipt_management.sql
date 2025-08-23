-- Migration: Receipt Management System with AI-powered analysis and expense tracking
-- This migration creates tables for comprehensive receipt management with OCR analysis

-- Create main receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic receipt info
  name text NOT NULL,
  description text,
  total_amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD' NOT NULL,
  receipt_date date NOT NULL,
  
  -- Merchant information
  merchant_name text,
  merchant_address text,
  merchant_phone text,
  merchant_tax_id text,
  
  -- File and image handling
  image_url text,
  image_path text,
  file_size bigint,
  mime_type text,
  
  -- AI Analysis results
  ocr_raw_text text, -- Raw text extracted from OCR
  ai_analysis_data jsonb, -- Structured data from AI analysis
  ai_confidence_score numeric(3,2), -- 0.00 to 1.00
  analysis_status text DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Categorization and tagging
  category text DEFAULT 'other' NOT NULL,
  subcategory text,
  tags text[] DEFAULT '{}',
  
  -- Tax and business information
  tax_amount numeric(10,2),
  tax_rate numeric(5,4), -- Store as decimal (e.g., 0.0825 for 8.25%)
  pre_tax_amount numeric(10,2),
  tip_amount numeric(10,2),
  
  -- Payment method
  payment_method text, -- cash, credit_card, debit_card, digital, etc.
  
  -- Status and flags
  is_business_expense boolean DEFAULT false,
  is_reimbursable boolean DEFAULT false,
  is_tax_deductible boolean DEFAULT false,
  reimbursement_status text DEFAULT 'not_applicable' CHECK (reimbursement_status IN ('not_applicable', 'pending', 'submitted', 'approved', 'paid', 'rejected')),
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create receipt items table for itemized receipts
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  
  -- Item details
  name text NOT NULL,
  description text,
  quantity numeric(10,3) DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  
  -- Product information
  sku text,
  barcode text,
  product_category text,
  
  -- Tax information
  tax_amount numeric(10,2),
  is_taxable boolean DEFAULT true,
  
  -- Metadata
  line_number integer, -- Order in the receipt
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create merchants table for standardized merchant data
CREATE TABLE IF NOT EXISTS public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Merchant information
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'US',
  phone text,
  email text,
  website text,
  tax_id text,
  
  -- Business details
  business_type text,
  category text,
  
  -- Metadata
  logo_url text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Unique constraint per user
  UNIQUE(user_id, name)
);

-- Create expense categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Category information
  name text NOT NULL,
  description text,
  parent_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  
  -- Category settings
  is_tax_deductible boolean DEFAULT false,
  is_business_category boolean DEFAULT false,
  default_payment_method text,
  
  -- Budget and limits
  monthly_budget_limit numeric(10,2),
  yearly_budget_limit numeric(10,2),
  
  -- Display and organization
  color text, -- Hex color for UI display
  icon text, -- Icon name for UI display
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  
  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Unique constraint per user
  UNIQUE(user_id, name)
);

-- Create receipt analysis jobs table for tracking AI processing
CREATE TABLE IF NOT EXISTS public.receipt_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job information
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  job_type text DEFAULT 'full_analysis' CHECK (job_type IN ('ocr_only', 'structure_analysis', 'full_analysis')),
  
  -- Processing details
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  
  -- Results
  ocr_result jsonb,
  analysis_result jsonb,
  confidence_scores jsonb,
  
  -- Metadata
  ai_model_used text, -- e.g., 'gemini-2.5-flash'
  processing_duration_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE public.receipts IS 'Main receipts table with AI-powered analysis and expense tracking';
COMMENT ON TABLE public.receipt_items IS 'Itemized line items from receipts';
COMMENT ON TABLE public.merchants IS 'Standardized merchant information for receipt attribution';
COMMENT ON TABLE public.expense_categories IS 'User-defined expense categories for receipt organization';
COMMENT ON TABLE public.receipt_analysis_jobs IS 'Tracks AI analysis jobs for receipt processing';

-- Add column comments for important fields
COMMENT ON COLUMN public.receipts.ai_analysis_data IS 'Structured JSON data extracted by AI from receipt image';
COMMENT ON COLUMN public.receipts.ai_confidence_score IS 'Overall confidence score (0.00-1.00) of AI analysis accuracy';
COMMENT ON COLUMN public.receipts.ocr_raw_text IS 'Raw text extracted from receipt image via OCR';
COMMENT ON COLUMN public.receipts.analysis_status IS 'Current status of AI analysis processing';
COMMENT ON COLUMN public.receipt_items.line_number IS 'Order of item in the original receipt';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts (user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.receipts (receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON public.receipts (merchant_name);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON public.receipts (category);
CREATE INDEX IF NOT EXISTS idx_receipts_analysis_status ON public.receipts (analysis_status);
CREATE INDEX IF NOT EXISTS idx_receipts_amount ON public.receipts (total_amount);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON public.receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON public.receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_line_number ON public.receipt_items (receipt_id, line_number);

CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON public.merchants (user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_name ON public.merchants (user_id, name);

CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id ON public.expense_categories (user_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON public.expense_categories (parent_category_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON public.expense_categories (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_receipt_analysis_jobs_receipt_id ON public.receipt_analysis_jobs (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_analysis_jobs_user_id ON public.receipt_analysis_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_analysis_jobs_status ON public.receipt_analysis_jobs (status);

-- Create GIN index for JSONB fields
CREATE INDEX IF NOT EXISTS idx_receipts_ai_analysis_gin ON public.receipts USING GIN (ai_analysis_data);
CREATE INDEX IF NOT EXISTS idx_receipt_analysis_jobs_result_gin ON public.receipt_analysis_jobs USING GIN (analysis_result);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_analysis_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receipts
CREATE POLICY "Users can view their own receipts" ON public.receipts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own receipts" ON public.receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts" ON public.receipts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts" ON public.receipts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for receipt_items
CREATE POLICY "Users can view their own receipt items" ON public.receipt_items
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.receipts r
    WHERE r.id = receipt_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can create receipt items for their receipts" ON public.receipt_items
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.receipts r
    WHERE r.id = receipt_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own receipt items" ON public.receipt_items
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.receipts r
    WHERE r.id = receipt_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.receipts r
    WHERE r.id = receipt_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own receipt items" ON public.receipt_items
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.receipts r
    WHERE r.id = receipt_id AND r.user_id = auth.uid()
  ));

-- RLS Policies for merchants
CREATE POLICY "Users can view their own merchants" ON public.merchants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own merchants" ON public.merchants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own merchants" ON public.merchants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own merchants" ON public.merchants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for expense_categories
CREATE POLICY "Users can view their own expense categories" ON public.expense_categories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expense categories" ON public.expense_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expense categories" ON public.expense_categories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expense categories" ON public.expense_categories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for receipt_analysis_jobs
CREATE POLICY "Users can view their own analysis jobs" ON public.receipt_analysis_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analysis jobs" ON public.receipt_analysis_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analysis jobs" ON public.receipt_analysis_jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role policies for backend processing
CREATE POLICY "Service role can manage analysis jobs" ON public.receipt_analysis_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can update receipt analysis results" ON public.receipts
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create functions for automatic timestamping
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at timestamps
CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER receipt_items_updated_at
  BEFORE UPDATE ON public.receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER receipt_analysis_jobs_updated_at
  BEFORE UPDATE ON public.receipt_analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert default expense categories
INSERT INTO public.expense_categories (id, user_id, name, description, is_tax_deductible, is_business_category, color, icon)
SELECT 
  gen_random_uuid(),
  auth.uid(),
  name,
  description,
  is_tax_deductible,
  is_business_category,
  color,
  icon
FROM (
  VALUES 
    ('Food & Dining', 'Restaurants, groceries, and food purchases', false, false, '#FF6B6B', 'utensils'),
    ('Transportation', 'Gas, public transport, parking, vehicle maintenance', false, false, '#4ECDC4', 'car'),
    ('Shopping', 'Retail purchases, clothing, household items', false, false, '#45B7D1', 'shopping-bag'),
    ('Healthcare', 'Medical expenses, pharmacy, insurance', true, false, '#96CEB4', 'heart'),
    ('Entertainment', 'Movies, concerts, hobbies, subscriptions', false, false, '#FFEAA7', 'film'),
    ('Business', 'Office supplies, software, professional services', true, true, '#6C5CE7', 'briefcase'),
    ('Travel', 'Hotels, flights, travel expenses', true, true, '#A29BFE', 'plane'),
    ('Utilities', 'Electric, water, internet, phone bills', false, false, '#FD79A8', 'zap'),
    ('Home & Garden', 'Home improvement, furniture, gardening', false, false, '#00B894', 'home'),
    ('Education', 'Books, courses, training, conferences', true, false, '#E17055', 'book'),
    ('Other', 'Miscellaneous expenses', false, false, '#636E72', 'more-horizontal')
  ) AS default_categories(name, description, is_tax_deductible, is_business_category, color, icon)
WHERE auth.uid() IS NOT NULL;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_analysis_jobs TO authenticated;

-- Grant service role permissions for AI processing
GRANT ALL ON public.receipts TO service_role;
GRANT ALL ON public.receipt_items TO service_role;
GRANT ALL ON public.merchants TO service_role;
GRANT ALL ON public.expense_categories TO service_role;
GRANT ALL ON public.receipt_analysis_jobs TO service_role;