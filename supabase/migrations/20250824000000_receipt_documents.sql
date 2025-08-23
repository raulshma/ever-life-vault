-- Migration: Receipt Documents - Link warranty and other documents to receipts
-- This migration creates a table for linking documents (warranties, manuals, etc.) to receipts

-- Create receipt_documents table for linking documents to receipts
CREATE TABLE IF NOT EXISTS public.receipt_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Document information
  name text NOT NULL,
  description text,
  document_type text DEFAULT 'warranty' CHECK (document_type IN ('warranty', 'manual', 'invoice', 'guarantee', 'certificate', 'other')),
  
  -- File storage
  file_path text NOT NULL, -- Path in Supabase storage
  file_size bigint,
  mime_type text,
  original_filename text,
  
  -- Document metadata
  expiry_date date, -- For warranties and guarantees
  issue_date date, -- When the document was issued
  document_number text, -- Warranty number, certificate number, etc.
  issuer text, -- Who issued the document (manufacturer, store, etc.)
  
  -- Additional metadata
  tags text[] DEFAULT '{}',
  notes text,
  is_primary boolean DEFAULT false, -- Primary document for this receipt
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE public.receipt_documents IS 'Documents linked to receipts (warranties, manuals, guarantees, etc.)';
COMMENT ON COLUMN public.receipt_documents.document_type IS 'Type of document: warranty, manual, invoice, guarantee, certificate, other';
COMMENT ON COLUMN public.receipt_documents.expiry_date IS 'Expiration date for warranties and guarantees';
COMMENT ON COLUMN public.receipt_documents.is_primary IS 'Indicates if this is the primary document for the receipt';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipt_documents_receipt_id ON public.receipt_documents (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_user_id ON public.receipt_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_type ON public.receipt_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_expiry ON public.receipt_documents (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipt_documents_primary ON public.receipt_documents (receipt_id, is_primary) WHERE is_primary = true;

-- Create GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_receipt_documents_tags_gin ON public.receipt_documents USING GIN (tags);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.receipt_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receipt_documents
CREATE POLICY "Users can view their own receipt documents" ON public.receipt_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create receipt documents for their receipts" ON public.receipt_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = receipt_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own receipt documents" ON public.receipt_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = receipt_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own receipt documents" ON public.receipt_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to ensure only one primary document per receipt
CREATE OR REPLACE FUNCTION public.ensure_single_primary_document()
RETURNS trigger AS $$
BEGIN
  -- If setting this document as primary, unset all other primary documents for this receipt
  IF NEW.is_primary = true THEN
    UPDATE public.receipt_documents
    SET is_primary = false
    WHERE receipt_id = NEW.receipt_id 
      AND id != NEW.id 
      AND is_primary = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure only one primary document per receipt
CREATE TRIGGER ensure_single_primary_document_trigger
  BEFORE INSERT OR UPDATE ON public.receipt_documents
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.ensure_single_primary_document();

-- Create trigger for updated_at timestamps
CREATE TRIGGER receipt_documents_updated_at
  BEFORE UPDATE ON public.receipt_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_documents TO authenticated;
GRANT ALL ON public.receipt_documents TO service_role;

-- Create storage bucket for receipt documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipt-documents', 
  'receipt-documents', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for receipt-documents bucket
CREATE POLICY "Users can upload receipt documents" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipt-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own receipt documents" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipt-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own receipt documents" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipt-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own receipt documents" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipt-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );