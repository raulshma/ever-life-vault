-- Migration: Create LLM models cache table for efficient reads on page load
-- This table stores fetched LLM model data to avoid hitting external APIs on every request

-- Create the main table for caching LLM models
CREATE TABLE IF NOT EXISTS public.llm_models_cache (
  id text PRIMARY KEY,
  provider text NOT NULL,
  company text NULL,
  is_available boolean NOT NULL DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE public.llm_models_cache IS 'Cache table for LLM models data to improve page load performance';
COMMENT ON COLUMN public.llm_models_cache.id IS 'Unique identifier for the LLM model (e.g., "anthropic/claude-3-sonnet")';
COMMENT ON COLUMN public.llm_models_cache.provider IS 'Provider name (e.g., "OpenRouter", "OpenAI")';
COMMENT ON COLUMN public.llm_models_cache.company IS 'Company that created the model (e.g., "Anthropic", "OpenAI")';
COMMENT ON COLUMN public.llm_models_cache.is_available IS 'Whether the model is currently available for use';
COMMENT ON COLUMN public.llm_models_cache.last_updated IS 'When the model data was last updated from the provider';
COMMENT ON COLUMN public.llm_models_cache.data IS 'Complete model data as JSONB for flexible schema';
COMMENT ON COLUMN public.llm_models_cache.updated_at IS 'When this cache record was last updated';

-- Create indexes to speed up common access patterns
CREATE INDEX IF NOT EXISTS llm_models_cache_provider_idx ON public.llm_models_cache (provider);
CREATE INDEX IF NOT EXISTS llm_models_cache_company_idx ON public.llm_models_cache (company);
CREATE INDEX IF NOT EXISTS llm_models_cache_updated_at_idx ON public.llm_models_cache (updated_at DESC);
CREATE INDEX IF NOT EXISTS llm_models_cache_available_idx ON public.llm_models_cache (is_available) WHERE is_available = true;

-- Create a GIN index on the JSONB data column for efficient querying
CREATE INDEX IF NOT EXISTS llm_models_cache_data_gin_idx ON public.llm_models_cache USING GIN (data);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.llm_models_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read cached models
CREATE POLICY "Allow authenticated users to read llm models cache" ON public.llm_models_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow service role to manage cache (for background jobs)
CREATE POLICY "Allow service role to manage llm models cache" ON public.llm_models_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create a function to clean up old cache entries (optional maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_llm_cache(
  days_to_keep integer DEFAULT 30
) RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.llm_models_cache 
  WHERE updated_at < now() - interval '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_llm_cache(integer) IS 'Clean up old LLM cache entries to prevent table bloat';

-- Grant necessary permissions
GRANT SELECT ON public.llm_models_cache TO authenticated;
GRANT ALL ON public.llm_models_cache TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_llm_cache(integer) TO service_role;
