BEGIN;

-- Secure live_share_events: restrict to authenticated users who are room members (host or participant)
DROP POLICY IF EXISTS "live_share_events_insert_anon" ON public.live_share_events;
DROP POLICY IF EXISTS "live_share_events_select_public" ON public.live_share_events;

-- Remove anon privileges explicitly (RLS still applies, but this hardens privileges)
REVOKE ALL ON TABLE public.live_share_events FROM anon;

CREATE POLICY "lse_insert_authenticated_members"
ON public.live_share_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.live_share_rooms r
    WHERE r.id = live_share_events.room_id
      AND r.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.live_share_participants p
    WHERE p.room_id = live_share_events.room_id
      AND p.user_id = auth.uid()
      AND p.status IN ('pending','approved')
  )
);

CREATE POLICY "lse_select_room_members"
ON public.live_share_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.live_share_rooms r
    WHERE r.id = live_share_events.room_id
      AND r.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.live_share_participants p
    WHERE p.room_id = live_share_events.room_id
      AND p.user_id = auth.uid()
      AND p.status = 'approved'
  )
);

-- Secure live_share_invites: restrict reads to hosts and approved participants only
DROP POLICY IF EXISTS "lsi_select_public" ON public.live_share_invites;

-- Remove anon privileges explicitly
REVOKE ALL ON TABLE public.live_share_invites FROM anon;

CREATE POLICY "lsi_select_room_members"
ON public.live_share_invites
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.live_share_rooms r
    WHERE r.id = live_share_invites.room_id
      AND r.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.live_share_participants p
    WHERE p.room_id = live_share_invites.room_id
      AND p.user_id = auth.uid()
      AND p.status = 'approved'
  )
);

COMMIT;


