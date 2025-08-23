-- Migration: Add AI Analysis Fields to Receipt Documents
-- This migration adds AI analysis capabilities to existing receipt_documents table
-- Created: 2025-08-24 12:00:00

-- Add AI analysis fields to existing receipt_documents table
ALTER TABLE public.receipt_documents 
ADD COLUMN IF NOT EXISTS ai_analysis_data jsonb,
ADD COLUMN IF NOT EXISTS ai_confidence_score numeric(3,2) CHECK (ai_confidence_score >= 0.00 AND ai_confidence_score <= 1.00),
ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS analysis_error_message text,
ADD COLUMN IF NOT EXISTS analysis_model_used text,
ADD COLUMN IF NOT EXISTS analysis_duration_ms integer;

-- Add helpful comments for the new AI analysis fields
COMMENT ON COLUMN public.receipt_documents.ai_analysis_data IS 'Structured JSON data extracted by AI from document including product info, warranty details, support contacts, and key information';
COMMENT ON COLUMN public.receipt_documents.ai_confidence_score IS 'Overall confidence score (0.00-1.00) of AI analysis accuracy';
COMMENT ON COLUMN public.receipt_documents.analysis_status IS 'Current status of AI analysis processing: pending, processing, completed, failed';
COMMENT ON COLUMN public.receipt_documents.analysis_error_message IS 'Detailed error message if AI analysis fails';
COMMENT ON COLUMN public.receipt_documents.analysis_model_used IS 'AI model identifier used for document analysis (e.g., gemini-2.5-flash)';
COMMENT ON COLUMN public.receipt_documents.analysis_duration_ms IS 'Processing time for AI analysis in milliseconds';

-- Create indexes for AI analysis fields
CREATE INDEX IF NOT EXISTS idx_receipt_documents_analysis_status ON public.receipt_documents (analysis_status);
CREATE INDEX IF NOT EXISTS idx_receipt_documents_analysis_model ON public.receipt_documents (analysis_model_used) WHERE analysis_model_used IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipt_documents_user_status ON public.receipt_documents (user_id, analysis_status);

-- Create GIN index for AI analysis JSONB data to enable efficient searching
CREATE INDEX IF NOT EXISTS idx_receipt_documents_ai_analysis_gin ON public.receipt_documents USING GIN (ai_analysis_data);

-- Create function to track analysis metrics
CREATE OR REPLACE FUNCTION public.log_document_analysis_completion()
RETURNS trigger AS $$
BEGIN
  -- Log successful analysis completion for metrics
  IF NEW.analysis_status = 'completed' AND OLD.analysis_status != 'completed' THEN
    -- Could extend this to log to a separate analytics table
    RAISE NOTICE 'Document analysis completed for document % with confidence %', NEW.id, NEW.ai_confidence_score;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log analysis completions
CREATE TRIGGER log_document_analysis_completion_trigger
  AFTER UPDATE ON public.receipt_documents
  FOR EACH ROW
  WHEN (NEW.analysis_status = 'completed' AND OLD.analysis_status != 'completed')
  EXECUTE FUNCTION public.log_document_analysis_completion();

-- Create view for AI analysis analytics and reporting
CREATE OR REPLACE VIEW public.receipt_document_ai_analytics AS
SELECT 
  rd.document_type,
  rd.analysis_status,
  rd.analysis_model_used,
  COUNT(*) as document_count,
  AVG(rd.ai_confidence_score) as avg_confidence_score,
  AVG(rd.analysis_duration_ms) as avg_analysis_duration_ms,
  MIN(rd.created_at) as first_analysis_date,
  MAX(rd.updated_at) as latest_analysis_date
FROM public.receipt_documents rd
WHERE rd.ai_analysis_data IS NOT NULL
GROUP BY rd.document_type, rd.analysis_status, rd.analysis_model_used
ORDER BY document_count DESC;

-- Grant access to analytics view
GRANT SELECT ON public.receipt_document_ai_analytics TO authenticated;
GRANT ALL ON public.receipt_document_ai_analytics TO service_role;

-- Add helpful comment for the analytics view
COMMENT ON VIEW public.receipt_document_ai_analytics IS 'Analytics view for receipt document AI analysis performance and usage metrics';