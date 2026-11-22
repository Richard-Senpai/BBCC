-- ============================================================
-- BBCCILEIFE — Migration 002: Enrollment Mode & Challenge Deletion
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. ADD ENROLLMENT MODE TO CHALLENGES
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS enrollment_mode text NOT NULL DEFAULT 'open'
CHECK (enrollment_mode IN ('open', 'approval'));

-- Backfill every existing challenge to 'open'
UPDATE public.challenges
SET enrollment_mode = 'open'
WHERE enrollment_mode IS NULL OR enrollment_mode = '';

-- 2. CREATE CHALLENGE ENROLLMENTS TABLE
CREATE TABLE IF NOT EXISTS public.challenge_enrollments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decided_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_enrollments_challenge_user ON public.challenge_enrollments(challenge_id, user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_enrollments_user ON public.challenge_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_enrollments_status ON public.challenge_enrollments(status);

-- 3. ENSURE CASCADE ON ALL CHALLENGE CHILD TABLES
-- challenge_days -> challenges
ALTER TABLE public.challenge_days
DROP CONSTRAINT IF EXISTS challenge_days_challenge_id_fkey,
ADD CONSTRAINT challenge_days_challenge_id_fkey
  FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;

-- activities -> challenge_days
ALTER TABLE public.activities
DROP CONSTRAINT IF EXISTS activities_challenge_day_id_fkey,
ADD CONSTRAINT activities_challenge_day_id_fkey
  FOREIGN KEY (challenge_day_id) REFERENCES public.challenge_days(id) ON DELETE CASCADE;

-- completions -> challenge_days
ALTER TABLE public.completions
DROP CONSTRAINT IF EXISTS completions_challenge_day_id_fkey,
ADD CONSTRAINT completions_challenge_day_id_fkey
  FOREIGN KEY (challenge_day_id) REFERENCES public.challenge_days(id) ON DELETE CASCADE;

-- activity_completions -> activities
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_completions'
  ) THEN
    ALTER TABLE public.activity_completions
    DROP CONSTRAINT IF EXISTS activity_completions_activity_id_fkey,
    ADD CONSTRAINT activity_completions_activity_id_fkey
      FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- journal_entries -> challenge_days
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE public.journal_entries
    DROP CONSTRAINT IF EXISTS journal_entries_challenge_day_id_fkey,
    ADD CONSTRAINT journal_entries_challenge_day_id_fkey
      FOREIGN KEY (challenge_day_id) REFERENCES public.challenge_days(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. UPDATE CHALLENGES_WITH_STATUS VIEW TO INCLUDE ENROLLMENT_MODE
CREATE OR REPLACE VIEW public.challenges_with_status AS
SELECT
  c.id,
  c.name,
  c.duration_days,
  c.start_date,
  (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date AS end_date,
  c.timezone,
  c.last_notified_challenge_day,
  c.enrollment_mode,
  c.created_at,
  CASE
    WHEN ((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date < c.start_date) THEN 'upcoming'
    WHEN ((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date > (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date) THEN 'completed'
    ELSE 'active'
  END AS status,
  CASE
    WHEN ((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date < c.start_date) THEN 0
    WHEN ((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date > (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date) THEN c.duration_days + 1
    ELSE ((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date - c.start_date) + 1
  END AS current_day
FROM public.challenges c;

GRANT SELECT ON public.challenges_with_status TO authenticated, anon;

-- 5. UNIFIED SQL ACCESS FUNCTION: can_access_challenge(challenge_id)
-- Admin = always true
-- Approved member (profiles.status = 'approved') = true if challenge is 'open',
--   or if challenge is 'approval' AND they have an enrollment row with status 'approved'.
-- Everyone else = false.
CREATE OR REPLACE FUNCTION public.can_access_challenge(target_challenge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_role text;
  v_profile_status text;
  v_mode text;
  v_enroll_status text;
BEGIN
  IF target_challenge_id IS NULL THEN
    RETURN false;
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Read profile
  SELECT role, status INTO v_profile_role, v_profile_status
  FROM public.profiles
  WHERE id = v_user_id;

  -- Admin always has access
  IF v_profile_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Account-level approval check: only approved members can enter any challenge
  IF v_profile_status != 'approved' THEN
    RETURN false;
  END IF;

  -- 2. Read challenge enrollment mode
  SELECT enrollment_mode INTO v_mode
  FROM public.challenges
  WHERE id = target_challenge_id;

  -- If challenge is open (or default): member has access
  IF v_mode IS NULL OR v_mode = 'open' THEN
    RETURN true;
  END IF;

  -- 3. If approval mode: must have status = 'approved' in challenge_enrollments
  IF v_mode = 'approval' THEN
    SELECT status INTO v_enroll_status
    FROM public.challenge_enrollments
    WHERE challenge_id = target_challenge_id AND user_id = v_user_id;

    RETURN (v_enroll_status = 'approved');
  END IF;

  RETURN false;
END;
$$;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES

-- ── 6A. CHALLENGES ──────────────────────────────────────────
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_select" ON public.challenges;
CREATE POLICY "challenges_select" ON public.challenges
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "challenges_insert" ON public.challenges;
CREATE POLICY "challenges_insert" ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenges_update" ON public.challenges;
CREATE POLICY "challenges_update" ON public.challenges
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenges_delete" ON public.challenges;
CREATE POLICY "challenges_delete" ON public.challenges
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── 6B. CHALLENGE ENROLLMENTS ───────────────────────────────
ALTER TABLE public.challenge_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_enrollments_select" ON public.challenge_enrollments;
CREATE POLICY "challenge_enrollments_select" ON public.challenge_enrollments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Members can insert ONLY their own pending request for an approval-mode non-completed challenge
DROP POLICY IF EXISTS "challenge_enrollments_insert" ON public.challenge_enrollments;
CREATE POLICY "challenge_enrollments_insert" ON public.challenge_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR (
      user_id = auth.uid()
      AND status = 'pending'
      AND EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_enrollments.challenge_id
          AND c.enrollment_mode = 'approval'
          AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
      )
    )
  );

DROP POLICY IF EXISTS "challenge_enrollments_update" ON public.challenge_enrollments;
CREATE POLICY "challenge_enrollments_update" ON public.challenge_enrollments
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenge_enrollments_delete" ON public.challenge_enrollments;
CREATE POLICY "challenge_enrollments_delete" ON public.challenge_enrollments
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── 6C. CHALLENGE DAYS ──────────────────────────────────────
ALTER TABLE public.challenge_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_days_select" ON public.challenge_days;
CREATE POLICY "challenge_days_select" ON public.challenge_days
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR (
      public.can_access_challenge(challenge_id) AND (
        EXISTS (
          SELECT 1 FROM public.challenges c
          WHERE c.id = challenge_days.challenge_id
            AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date >= c.start_date
        )
      )
    )
  );

DROP POLICY IF EXISTS "challenge_days_insert" ON public.challenge_days;
CREATE POLICY "challenge_days_insert" ON public.challenge_days
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenge_days_update" ON public.challenge_days;
CREATE POLICY "challenge_days_update" ON public.challenge_days
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenge_days_delete" ON public.challenge_days;
CREATE POLICY "challenge_days_delete" ON public.challenge_days
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── 6D. ACTIVITIES ──────────────────────────────────────────
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.challenge_days cd
      JOIN public.challenges c ON c.id = cd.challenge_id
      WHERE cd.id = activities.challenge_day_id
        AND public.can_access_challenge(cd.challenge_id)
        AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date >= c.start_date
    )
  );

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "activities_delete" ON public.activities;
CREATE POLICY "activities_delete" ON public.activities
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── 6E. COMPLETIONS ─────────────────────────────────────────
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "completions_select" ON public.completions;
CREATE POLICY "completions_select" ON public.completions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "completions_insert" ON public.completions;
CREATE POLICY "completions_insert" ON public.completions
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() OR public.is_admin()) AND
    EXISTS (
      SELECT 1 FROM public.challenge_days cd
      JOIN public.challenges c ON c.id = cd.challenge_id
      WHERE cd.id = completions.challenge_day_id
        AND (public.is_admin() OR (
          public.can_access_challenge(cd.challenge_id) AND
          (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
        ))
    )
  );

DROP POLICY IF EXISTS "completions_delete" ON public.completions;
CREATE POLICY "completions_delete" ON public.completions
  FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() OR public.is_admin()) AND
    EXISTS (
      SELECT 1 FROM public.challenge_days cd
      JOIN public.challenges c ON c.id = cd.challenge_id
      WHERE cd.id = completions.challenge_day_id
        AND (public.is_admin() OR (
          public.can_access_challenge(cd.challenge_id) AND
          (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
        ))
    )
  );

-- ── 6F. ACTIVITY_COMPLETIONS ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_completions'
  ) THEN
    ALTER TABLE public.activity_completions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "activity_completions_select" ON public.activity_completions;
    CREATE POLICY "activity_completions_select" ON public.activity_completions
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.is_admin());

    DROP POLICY IF EXISTS "activity_completions_insert" ON public.activity_completions;
    CREATE POLICY "activity_completions_insert" ON public.activity_completions
      FOR INSERT TO authenticated
      WITH CHECK (
        (user_id = auth.uid() OR public.is_admin()) AND
        EXISTS (
          SELECT 1 FROM public.activities a
          JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
          JOIN public.challenges c ON c.id = cd.challenge_id
          WHERE a.id = activity_completions.activity_id
            AND (public.is_admin() OR (
              public.can_access_challenge(cd.challenge_id) AND
              (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
            ))
        )
      );

    DROP POLICY IF EXISTS "activity_completions_delete" ON public.activity_completions;
    CREATE POLICY "activity_completions_delete" ON public.activity_completions
      FOR DELETE TO authenticated
      USING (
        (user_id = auth.uid() OR public.is_admin()) AND
        EXISTS (
          SELECT 1 FROM public.activities a
          JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
          JOIN public.challenges c ON c.id = cd.challenge_id
          WHERE a.id = activity_completions.activity_id
            AND (public.is_admin() OR (
              public.can_access_challenge(cd.challenge_id) AND
              (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
            ))
        )
      );
  END IF;
END $$;

-- ── 6G. JOURNAL_ENTRIES ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries'
  ) THEN
    ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "journal_entries_select" ON public.journal_entries;
    CREATE POLICY "journal_entries_select" ON public.journal_entries
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.challenge_days cd
          WHERE cd.id = journal_entries.challenge_day_id
            AND public.can_access_challenge(cd.challenge_id)
        )
      );

    DROP POLICY IF EXISTS "journal_entries_insert" ON public.journal_entries;
    CREATE POLICY "journal_entries_insert" ON public.journal_entries
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.challenge_days cd
          JOIN public.challenges c ON c.id = cd.challenge_id
          WHERE cd.id = journal_entries.challenge_day_id
            AND public.can_access_challenge(cd.challenge_id)
            AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
        )
      );

    DROP POLICY IF EXISTS "journal_entries_update" ON public.journal_entries;
    CREATE POLICY "journal_entries_update" ON public.journal_entries
      FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.challenge_days cd
          JOIN public.challenges c ON c.id = cd.challenge_id
          WHERE cd.id = journal_entries.challenge_day_id
            AND public.can_access_challenge(cd.challenge_id)
            AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
        )
      )
      WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.challenge_days cd
          JOIN public.challenges c ON c.id = cd.challenge_id
          WHERE cd.id = journal_entries.challenge_day_id
            AND public.can_access_challenge(cd.challenge_id)
            AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
        )
      );

    DROP POLICY IF EXISTS "journal_entries_delete" ON public.journal_entries;
    CREATE POLICY "journal_entries_delete" ON public.journal_entries
      FOR DELETE TO authenticated
      USING (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.challenge_days cd
          JOIN public.challenges c ON c.id = cd.challenge_id
          WHERE cd.id = journal_entries.challenge_day_id
            AND public.can_access_challenge(cd.challenge_id)
            AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date
        )
      );
  END IF;
END $$;

-- 7. GET_LEADERBOARD FUNCTION UPDATED WITH ENROLLMENT MODE CHECK
-- Rules:
-- 1. Caller must have access via public.can_access_challenge(target_challenge_id).
-- 2. If challenge is 'open': all approved members are eligible.
-- 3. If challenge is 'approval': only enrolled (status='approved') members are ranked,
--    counted in total_ranked_members, and shown.
-- 4. Returns top 6 entries, my_rank, total_ranked_members, my_total_activities.
CREATE OR REPLACE FUNCTION public.get_leaderboard(target_challenge_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_challenge_id uuid;
  v_mode text;
  v_result jsonb;
  v_total_ranked int;
  v_my_rank int := NULL;
  v_my_total_activities int := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Must be authenticated';
  END IF;

  -- Resolve challenge ID: passed parameter or active challenge or latest challenge
  IF target_challenge_id IS NOT NULL THEN
    v_challenge_id := target_challenge_id;
  ELSE
    SELECT id INTO v_challenge_id
    FROM public.challenges_with_status
    WHERE status = 'active'
    ORDER BY start_date DESC
    LIMIT 1;

    IF v_challenge_id IS NULL THEN
      SELECT id INTO v_challenge_id
      FROM public.challenges
      ORDER BY start_date DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_challenge_id IS NULL THEN
    RETURN jsonb_build_object(
      'members', '[]'::jsonb,
      'total_ranked_members', 0,
      'my_rank', NULL,
      'my_total_activities', 0
    );
  END IF;

  -- Access verification: caller must be allowed into this challenge
  IF NOT public.can_access_challenge(v_challenge_id) THEN
    RAISE EXCEPTION 'Access denied: You do not have access to this challenge';
  END IF;

  SELECT enrollment_mode INTO v_mode
  FROM public.challenges
  WHERE id = v_challenge_id;

  -- CTE to compute ranking
  WITH eligible_members AS (
    SELECT p.id AS user_id, p.full_name, p.avatar_url, p.display_tag, p.fellowship_unit
    FROM public.profiles p
    WHERE p.role = 'member'
      AND p.status = 'approved'
      AND (
        (COALESCE(v_mode, 'open') = 'open') OR
        EXISTS (
          SELECT 1 FROM public.challenge_enrollments ce
          WHERE ce.challenge_id = v_challenge_id
            AND ce.user_id = p.id
            AND ce.status = 'approved'
        )
      )
  ),
  member_metrics AS (
    SELECT
      em.user_id,
      em.full_name,
      em.avatar_url,
      em.display_tag,
      em.fellowship_unit,
      COALESCE(act.total_completed, 0) AS total_activities_completed,
      COALESCE(strk.current_streak, 0) AS current_streak,
      act.last_completed_at
    FROM eligible_members em
    LEFT JOIN LATERAL (
      SELECT
        COUNT(ac.id) AS total_completed,
        MAX(ac.completed_at) AS last_completed_at
      FROM public.activity_completions ac
      JOIN public.activities a ON a.id = ac.activity_id
      JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
      WHERE ac.user_id = em.user_id AND cd.challenge_id = v_challenge_id
    ) act ON true
    LEFT JOIN LATERAL (
      SELECT public.get_member_streak(em.user_id, v_challenge_id) AS current_streak
    ) strk ON true
  ),
  ranked_members AS (
    SELECT
      mm.*,
      ROW_NUMBER() OVER (
        ORDER BY
          mm.total_activities_completed DESC,
          mm.current_streak DESC,
          mm.last_completed_at ASC NULLS LAST,
          mm.user_id ASC
      ) AS rank
    FROM member_metrics mm
  )
  SELECT
    COUNT(*)::int,
    MAX(CASE WHEN user_id = v_caller_id THEN rank ELSE NULL END)::int,
    COALESCE(MAX(CASE WHEN user_id = v_caller_id THEN total_activities_completed ELSE 0 END), 0)::int,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id', rm.user_id,
          'id', rm.user_id,
          'full_name', rm.full_name,
          'avatar_url', rm.avatar_url,
          'display_tag', rm.display_tag,
          'fellowship_unit', rm.fellowship_unit,
          'total_activities_completed', rm.total_activities_completed,
          'total_completed', rm.total_activities_completed,
          'current_streak', rm.current_streak,
          'rank', rm.rank
        ) ORDER BY rm.rank
      ) FILTER (WHERE rm.rank <= 6),
      '[]'::jsonb
    )
  INTO v_total_ranked, v_my_rank, v_my_total_activities, v_result
  FROM ranked_members rm;

  RETURN jsonb_build_object(
    'members', v_result,
    'total_ranked_members', COALESCE(v_total_ranked, 0),
    'my_rank', v_my_rank,
    'my_total_activities', v_my_total_activities
  );
END;
$$;

-- 8. HELPER RPCs FOR CHALLENGE DELETION AND ENROLLMENT TRANSITIONS

-- 8A. get_challenge_delete_summary: Provides exact counts for confirmation modal
CREATE OR REPLACE FUNCTION public.get_challenge_delete_summary(target_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_status text;
  v_days_count int := 0;
  v_activities_count int := 0;
  v_participants_count int := 0;
  v_completions_count int := 0;
  v_act_comp_count int := 0;
  v_journal_count int := 0;
  v_enrollments_count int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Administrator privileges required';
  END IF;

  SELECT name INTO v_name FROM public.challenges WHERE id = target_challenge_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  SELECT status INTO v_status FROM public.challenges_with_status WHERE id = target_challenge_id;

  -- Days count
  SELECT COUNT(*) INTO v_days_count FROM public.challenge_days WHERE challenge_id = target_challenge_id;

  -- Activities count
  SELECT COUNT(a.id) INTO v_activities_count
  FROM public.activities a
  JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
  WHERE cd.challenge_id = target_challenge_id;

  -- Distinct participants
  SELECT COUNT(DISTINCT ac.user_id) INTO v_participants_count
  FROM public.activity_completions ac
  JOIN public.activities a ON a.id = ac.activity_id
  JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
  WHERE cd.challenge_id = target_challenge_id;

  -- Day completions count
  SELECT COUNT(c.id) INTO v_completions_count
  FROM public.completions c
  JOIN public.challenge_days cd ON cd.id = c.challenge_day_id
  WHERE cd.challenge_id = target_challenge_id;

  -- Activity completions count
  SELECT COUNT(ac.id) INTO v_act_comp_count
  FROM public.activity_completions ac
  JOIN public.activities a ON a.id = ac.activity_id
  JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
  WHERE cd.challenge_id = target_challenge_id;

  -- Journal entries count
  SELECT COUNT(j.id) INTO v_journal_count
  FROM public.journal_entries j
  JOIN public.challenge_days cd ON cd.id = j.challenge_day_id
  WHERE cd.challenge_id = target_challenge_id;

  -- Enrollments count
  SELECT COUNT(*) INTO v_enrollments_count
  FROM public.challenge_enrollments
  WHERE challenge_id = target_challenge_id;

  RETURN jsonb_build_object(
    'id', target_challenge_id,
    'name', v_name,
    'status', COALESCE(v_status, 'completed'),
    'days_count', v_days_count,
    'activities_count', v_activities_count,
    'participants_count', v_participants_count,
    'completions_count', (v_completions_count + v_act_comp_count),
    'activity_completions_count', v_act_comp_count,
    'journal_entries_count', v_journal_count,
    'enrollments_count', v_enrollments_count
  );
END;
$$;

-- 8B. delete_challenge: Single atomic transaction deletion
CREATE OR REPLACE FUNCTION public.delete_challenge(target_challenge_id uuid, confirmed_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_real_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Administrator privileges required';
  END IF;

  SELECT name INTO v_real_name FROM public.challenges WHERE id = target_challenge_id;
  IF v_real_name IS NULL THEN
    RAISE EXCEPTION 'Challenge does not exist';
  END IF;

  IF TRIM(v_real_name) != TRIM(confirmed_name) THEN
    RAISE EXCEPTION 'Challenge name confirmation does not match exact title';
  END IF;

  -- Execute cascading deletion inside single transaction
  DELETE FROM public.challenges WHERE id = target_challenge_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_challenge_id', target_challenge_id,
    'deleted_name', v_real_name
  );
END;
$$;

-- 8C. grandfather_existing_participants: When switching Open -> Approval
CREATE OR REPLACE FUNCTION public.grandfather_existing_participants(target_challenge_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_inserted int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Administrator privileges required';
  END IF;

  v_admin_id := auth.uid();

  -- Find all distinct users who have at least one activity completion in this challenge
  INSERT INTO public.challenge_enrollments (challenge_id, user_id, status, requested_at, decided_at, decided_by)
  SELECT DISTINCT
    target_challenge_id,
    ac.user_id,
    'approved',
    now(),
    now(),
    v_admin_id
  FROM public.activity_completions ac
  JOIN public.activities a ON a.id = ac.activity_id
  JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
  WHERE cd.challenge_id = target_challenge_id
  ON CONFLICT (challenge_id, user_id)
  DO UPDATE SET status = 'approved', decided_at = now(), decided_by = v_admin_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.can_access_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_delete_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grandfather_existing_participants(uuid) TO authenticated;
