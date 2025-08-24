BEGIN;

-- Restrict anonymous SELECTs on clips to only truly public clips
-- Public clips are defined as those without a password (password_proof IS NULL)
DROP POLICY IF EXISTS "Anonymous access through RPC for public clips" ON public.clips;

CREATE POLICY "Anonymous access through RPC for public clips"
ON public.clips
FOR SELECT
TO anon
USING (
  password_proof IS NULL
);

COMMIT;


