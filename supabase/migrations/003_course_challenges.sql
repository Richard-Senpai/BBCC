-- ============================================================
-- BBCCILEIFE — Migration 003: Self-Paced Courses Data Model,
-- Access Rules, and Admin Shell
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 0. PREREQUISITE: ENSURE ENROLLMENT MODE EXISTS ON CHALLENGES
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS enrollment_mode text NOT NULL DEFAULT 'open'
CHECK (enrollment_mode IN ('open', 'approval'));

UPDATE public.challenges
SET enrollment_mode = 'open'
WHERE enrollment_mode IS NULL OR enrollment_mode = '';

-- 1. ADD TYPE AND COURSE CONFIGURATION COLUMNS TO CHALLENGES
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'daily'
CHECK (type IN ('daily', 'course'));

-- Backfill all existing rows to 'daily'
UPDATE public.challenges
SET type = 'daily'
WHERE type IS NULL;

-- Course configuration fields
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS access_mode text
  CHECK (access_mode IS NULL OR access_mode IN ('unlimited', 'fixed_end', 'per_member_days')),
ADD COLUMN IF NOT EXISTS access_end_date date,
ADD COLUMN IF NOT EXISTS access_days int
  CHECK (access_days IS NULL OR access_days > 0);

-- Make start_date and duration_days nullable for courses
ALTER TABLE public.challenges
ALTER COLUMN start_date DROP NOT NULL;

ALTER TABLE public.challenges
ALTER COLUMN duration_days DROP NOT NULL;

-- Add check constraint enforcing daily challenges require start_date and duration_days
ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS check_challenge_type_fields;

ALTER TABLE public.challenges
ADD CONSTRAINT check_challenge_type_fields
CHECK (
  (type = 'daily' AND start_date IS NOT NULL AND duration_days IS NOT NULL AND duration_days > 0)
  OR
  (type = 'course')
);

-- 2. UPDATE CHALLENGES_WITH_STATUS VIEW
-- Restrict to daily challenges so date math is never run on courses
DROP VIEW IF EXISTS public.challenges_with_status CASCADE;

CREATE VIEW public.challenges_with_status AS
SELECT
  c.id,
  c.name,
  c.duration_days,
  c.start_date,
  (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date AS end_date,
  c.timezone,
  c.last_notified_challenge_day,
  c.enrollment_mode,
  c.type,
  c.is_published,
  c.description,
  c.access_mode,
  c.access_end_date,
  c.access_days,
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
FROM public.challenges c
WHERE c.type = 'daily';

GRANT SELECT ON public.challenges_with_status TO authenticated, anon;

-- 3. CREATE COURSE TABLES
-- 3A. course_lessons
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  position     int NOT NULL,
  title        text NOT NULL,
  summary      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_course_lessons_challenge_position UNIQUE (challenge_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_challenge ON public.course_lessons(challenge_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_position ON public.course_lessons(challenge_id, position);

-- 3B. course_blocks
CREATE TABLE IF NOT EXISTS public.course_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  position   int NOT NULL,
  type       text NOT NULL CHECK (type IN ('rich_text', 'image_text', 'image', 'video', 'link')),
  content    jsonb NOT NULL DEFAULT '{}'::jsonb,
  required   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_course_blocks_lesson_position UNIQUE (lesson_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_course_blocks_lesson ON public.course_blocks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_blocks_position ON public.course_blocks(lesson_id, position);

-- 3C. course_member_state
CREATE TABLE IF NOT EXISTS public.course_member_state (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id          uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at            timestamptz NOT NULL DEFAULT now(),
  access_override_until timestamptz,
  completed_at          timestamptz,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_member_state_lookup ON public.course_member_state(challenge_id, user_id);

-- 3D. course_lesson_completions
CREATE TABLE IF NOT EXISTS public.course_lesson_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id    uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_course_lesson_completions_user ON public.course_lesson_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_completions_lesson ON public.course_lesson_completions(lesson_id);

-- 3E. course_block_confirmations
CREATE TABLE IF NOT EXISTS public.course_block_confirmations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_id     uuid NOT NULL REFERENCES public.course_blocks(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_course_block_confirmations_user ON public.course_block_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_course_block_confirmations_block ON public.course_block_confirmations(block_id);

-- 4. ACCESS RULES AND SECURITY DEFINER FUNCTIONS

-- 4A. can_access_course(challenge_id)
-- Evaluates enrollment + expiry.
-- Admin: always true (never expires).
-- Approved member: true if open or approved enrollment, AND not expired.
CREATE OR REPLACE FUNCTION public.can_access_course(target_challenge_id uuid)
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
  v_type text;
  v_enroll_mode text;
  v_access_mode text;
  v_access_end_date date;
  v_access_days int;
  v_tz text;
  v_enroll_status text;
  v_started_at timestamptz;
  v_override_until timestamptz;
  v_now timestamptz := now();
  v_expiry_ts timestamptz;
BEGIN
  IF target_challenge_id IS NULL THEN
    RETURN false;
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Check profile
  SELECT role, status INTO v_profile_role, v_profile_status
  FROM public.profiles
  WHERE id = v_user_id;

  -- Admin is never expired and always has access
  IF v_profile_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Member account must be approved
  IF v_profile_status != 'approved' THEN
    RETURN false;
  END IF;

  -- 2. Read course settings
  SELECT type, enrollment_mode, access_mode, access_end_date, access_days, COALESCE(timezone, 'Africa/Lagos')
  INTO v_type, v_enroll_mode, v_access_mode, v_access_end_date, v_access_days, v_tz
  FROM public.challenges
  WHERE id = target_challenge_id;

  IF v_type != 'course' THEN
    RETURN false;
  END IF;

  -- 3. Check enrollment mode
  IF v_enroll_mode = 'approval' THEN
    SELECT status INTO v_enroll_status
    FROM public.challenge_enrollments
    WHERE challenge_id = target_challenge_id AND user_id = v_user_id;

    IF v_enroll_status != 'approved' THEN
      RETURN false;
    END IF;
  END IF;

  -- 4. Check member state for overrides and start time
  SELECT started_at, access_override_until
  INTO v_started_at, v_override_until
  FROM public.course_member_state
  WHERE challenge_id = target_challenge_id AND user_id = v_user_id;

  -- If admin explicitly extended access, override replaces calculated expiry
  IF v_override_until IS NOT NULL THEN
    RETURN (v_now <= v_override_until);
  END IF;

  -- 5. Standard expiry check
  IF v_access_mode IS NULL OR v_access_mode = 'unlimited' THEN
    RETURN true;
  ELSIF v_access_mode = 'fixed_end' THEN
    IF v_access_end_date IS NULL THEN
      RETURN true;
    END IF;
    -- End of access_end_date in course timezone (23:59:59.999...)
    -- i.e., strictly before (access_end_date + 1 day) at timezone
    v_expiry_ts := (v_access_end_date + INTERVAL '1 day')::timestamp AT TIME ZONE v_tz;
    RETURN (v_now < v_expiry_ts);
  ELSIF v_access_mode = 'per_member_days' THEN
    IF v_started_at IS NULL THEN
      -- Not yet started: access is valid to preview and start
      RETURN true;
    END IF;
    IF v_access_days IS NULL OR v_access_days <= 0 THEN
      RETURN true;
    END IF;
    v_expiry_ts := v_started_at + (v_access_days * INTERVAL '1 day');
    RETURN (v_now < v_expiry_ts);
  END IF;

  RETURN true;
END;
$$;

-- 4B. is_lesson_unlocked(target_lesson_id, target_user_id)
-- Evaluates whether a member has unlocked a specific lesson:
-- 1. Must pass can_access_course.
-- 2. Course must be published (for members).
-- 3. Unlocked if:
--    a. It is the first lesson in the course (lowest position), OR
--    b. The lesson directly preceding it in position order is completed, OR
--    c. The lesson itself is already completed.
CREATE OR REPLACE FUNCTION public.is_lesson_unlocked(target_lesson_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_challenge_id uuid;
  v_pos int;
  v_prev_lesson_id uuid;
  v_is_admin boolean;
  v_is_published boolean;
BEGIN
  IF target_lesson_id IS NULL OR target_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Admin always unlocked
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = target_user_id;
  IF v_is_admin IS TRUE THEN
    RETURN true;
  END IF;

  -- Lookup lesson
  SELECT challenge_id, position INTO v_challenge_id, v_pos
  FROM public.course_lessons
  WHERE id = target_lesson_id;

  IF v_challenge_id IS NULL THEN
    RETURN false;
  END IF;

  -- Lookup course published status
  SELECT is_published INTO v_is_published
  FROM public.challenges
  WHERE id = v_challenge_id;

  IF v_is_published IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- Must have course access
  IF NOT public.can_access_course(v_challenge_id) THEN
    RETURN false;
  END IF;

  -- Rule C: If this lesson is already completed, it is unlocked
  IF EXISTS (
    SELECT 1 FROM public.course_lesson_completions
    WHERE user_id = target_user_id AND lesson_id = target_lesson_id
  ) THEN
    RETURN true;
  END IF;

  -- Rule A: If it is the first lesson (lowest position), it is unlocked
  IF NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE challenge_id = v_challenge_id AND position < v_pos
  ) THEN
    RETURN true;
  END IF;

  -- Rule B: If previous lesson is completed, it is unlocked
  SELECT id INTO v_prev_lesson_id
  FROM public.course_lessons
  WHERE challenge_id = v_challenge_id AND position < v_pos
  ORDER BY position DESC
  LIMIT 1;

  IF v_prev_lesson_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.course_lesson_completions
    WHERE user_id = target_user_id AND lesson_id = v_prev_lesson_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 4C. start_course(target_challenge_id)
CREATE OR REPLACE FUNCTION public.start_course(target_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF NOT public.can_access_course(target_challenge_id) THEN
    RAISE EXCEPTION 'Access denied: Cannot access course or enrollment expired';
  END IF;

  INSERT INTO public.course_member_state (challenge_id, user_id, started_at)
  VALUES (target_challenge_id, v_user_id, now())
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4D. confirm_block(target_block_id)
CREATE OR REPLACE FUNCTION public.confirm_block(target_block_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_lesson_id uuid;
  v_challenge_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT cb.lesson_id, cl.challenge_id
  INTO v_lesson_id, v_challenge_id
  FROM public.course_blocks cb
  JOIN public.course_lessons cl ON cl.id = cb.lesson_id
  WHERE cb.id = target_block_id;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Block not found';
  END IF;

  IF NOT public.can_access_course(v_challenge_id) THEN
    RAISE EXCEPTION 'Access denied: Cannot access course or access expired';
  END IF;

  IF NOT public.is_lesson_unlocked(v_lesson_id, v_user_id) THEN
    RAISE EXCEPTION 'Lesson is locked';
  END IF;

  INSERT INTO public.course_block_confirmations (user_id, block_id, confirmed_at)
  VALUES (v_user_id, target_block_id, now())
  ON CONFLICT (user_id, block_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4E. complete_lesson(target_lesson_id)
-- Idempotent lesson completion function with strict prerequisite validation.
CREATE OR REPLACE FUNCTION public.complete_lesson(target_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_challenge_id uuid;
  v_pos int;
  v_prev_lesson_id uuid;
  v_unconfirmed_required_count int;
  v_is_last_lesson boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  -- 1. Lookup lesson position and challenge
  SELECT challenge_id, position INTO v_challenge_id, v_pos
  FROM public.course_lessons
  WHERE id = target_lesson_id;

  IF v_challenge_id IS NULL THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  -- 2. Verify course access and non-expired status
  IF NOT public.can_access_course(v_challenge_id) THEN
    RAISE EXCEPTION 'Access denied: Course access expired or not enrolled';
  END IF;

  -- 3. Verify previous lesson is completed (if position > 1)
  SELECT id INTO v_prev_lesson_id
  FROM public.course_lessons
  WHERE challenge_id = v_challenge_id AND position < v_pos
  ORDER BY position DESC
  LIMIT 1;

  IF v_prev_lesson_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.course_lesson_completions
      WHERE user_id = v_user_id AND lesson_id = v_prev_lesson_id
    ) THEN
      RAISE EXCEPTION 'Prerequisite incomplete: Previous lesson must be completed first';
    END IF;
  END IF;

  -- 4. Verify all required blocks in this lesson are confirmed
  SELECT COUNT(*) INTO v_unconfirmed_required_count
  FROM public.course_blocks cb
  WHERE cb.lesson_id = target_lesson_id
    AND cb.required = true
    AND NOT EXISTS (
      SELECT 1 FROM public.course_block_confirmations cbc
      WHERE cbc.block_id = cb.id AND cbc.user_id = v_user_id
    );

  IF v_unconfirmed_required_count > 0 THEN
    RAISE EXCEPTION 'Incomplete: All required action blocks in this lesson must be confirmed';
  END IF;

  -- 5. Record lesson completion (idempotent)
  INSERT INTO public.course_lesson_completions (user_id, lesson_id, completed_at)
  VALUES (v_user_id, target_lesson_id, now())
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  -- Ensure member state exists
  INSERT INTO public.course_member_state (challenge_id, user_id, started_at)
  VALUES (v_challenge_id, v_user_id, now())
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  -- 6. Check if this was the last lesson in the course
  SELECT NOT EXISTS (
    SELECT 1 FROM public.course_lessons
    WHERE challenge_id = v_challenge_id AND position > v_pos
  ) INTO v_is_last_lesson;

  IF v_is_last_lesson THEN
    UPDATE public.course_member_state
    SET completed_at = now()
    WHERE challenge_id = v_challenge_id
      AND user_id = v_user_id
      AND completed_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lesson_id', target_lesson_id,
    'completed_course', v_is_last_lesson
  );
END;
$$;

-- 5. ROW LEVEL SECURITY POLICIES FOR NEW TABLES

-- 5A. course_lessons RLS
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_lessons_select" ON public.course_lessons;
CREATE POLICY "course_lessons_select" ON public.course_lessons
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR (
      EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = course_lessons.challenge_id
          AND c.is_published = true
          AND public.can_access_course(c.id)
      )
    )
  );

DROP POLICY IF EXISTS "course_lessons_insert" ON public.course_lessons;
CREATE POLICY "course_lessons_insert" ON public.course_lessons
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_lessons_update" ON public.course_lessons;
CREATE POLICY "course_lessons_update" ON public.course_lessons
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_lessons_delete" ON public.course_lessons;
CREATE POLICY "course_lessons_delete" ON public.course_lessons
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5B. course_blocks RLS
ALTER TABLE public.course_blocks ENABLE ROW LEVEL SECURITY;

-- Blocks are ONLY readable for unlocked lessons!
DROP POLICY IF EXISTS "course_blocks_select" ON public.course_blocks;
CREATE POLICY "course_blocks_select" ON public.course_blocks
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR public.is_lesson_unlocked(course_blocks.lesson_id, auth.uid())
  );

DROP POLICY IF EXISTS "course_blocks_insert" ON public.course_blocks;
CREATE POLICY "course_blocks_insert" ON public.course_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_blocks_update" ON public.course_blocks;
CREATE POLICY "course_blocks_update" ON public.course_blocks
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_blocks_delete" ON public.course_blocks;
CREATE POLICY "course_blocks_delete" ON public.course_blocks
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5C. course_member_state RLS
ALTER TABLE public.course_member_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_member_state_select" ON public.course_member_state;
CREATE POLICY "course_member_state_select" ON public.course_member_state
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "course_member_state_insert" ON public.course_member_state;
CREATE POLICY "course_member_state_insert" ON public.course_member_state
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_member_state_update" ON public.course_member_state;
CREATE POLICY "course_member_state_update" ON public.course_member_state
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_member_state_delete" ON public.course_member_state;
CREATE POLICY "course_member_state_delete" ON public.course_member_state
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5D. course_lesson_completions RLS
ALTER TABLE public.course_lesson_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_lesson_completions_select" ON public.course_lesson_completions;
CREATE POLICY "course_lesson_completions_select" ON public.course_lesson_completions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Members CANNOT directly insert into course_lesson_completions; must go through complete_lesson()
DROP POLICY IF EXISTS "course_lesson_completions_insert" ON public.course_lesson_completions;
CREATE POLICY "course_lesson_completions_insert" ON public.course_lesson_completions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_lesson_completions_update" ON public.course_lesson_completions;
CREATE POLICY "course_lesson_completions_update" ON public.course_lesson_completions
  FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "course_lesson_completions_delete" ON public.course_lesson_completions;
CREATE POLICY "course_lesson_completions_delete" ON public.course_lesson_completions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5E. course_block_confirmations RLS
ALTER TABLE public.course_block_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_block_confirmations_select" ON public.course_block_confirmations;
CREATE POLICY "course_block_confirmations_select" ON public.course_block_confirmations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Members cannot directly insert; must go through confirm_block()
DROP POLICY IF EXISTS "course_block_confirmations_insert" ON public.course_block_confirmations;
CREATE POLICY "course_block_confirmations_insert" ON public.course_block_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_block_confirmations_update" ON public.course_block_confirmations;
CREATE POLICY "course_block_confirmations_update" ON public.course_block_confirmations
  FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "course_block_confirmations_delete" ON public.course_block_confirmations;
CREATE POLICY "course_block_confirmations_delete" ON public.course_block_confirmations
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6. UPDATE CHALLENGE DELETE SUMMARY TO HANDLE BOTH DAILY AND COURSE CHALLENGES
CREATE OR REPLACE FUNCTION public.get_challenge_delete_summary(target_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_type text;
  v_status text;
  v_days_count int := 0;
  v_activities_count int := 0;
  v_participants_count int := 0;
  v_completions_count int := 0;
  v_act_comp_count int := 0;
  v_journal_count int := 0;
  v_enrollments_count int := 0;
  -- Course stats
  v_lessons_count int := 0;
  v_blocks_count int := 0;
  v_members_started int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Administrator privileges required';
  END IF;

  SELECT name, type INTO v_name, v_type FROM public.challenges WHERE id = target_challenge_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  -- Enrollments count
  SELECT COUNT(*) INTO v_enrollments_count
  FROM public.challenge_enrollments
  WHERE challenge_id = target_challenge_id;

  IF v_type = 'course' THEN
    SELECT COUNT(*) INTO v_lessons_count
    FROM public.course_lessons
    WHERE challenge_id = target_challenge_id;

    SELECT COUNT(cb.id) INTO v_blocks_count
    FROM public.course_blocks cb
    JOIN public.course_lessons cl ON cl.id = cb.lesson_id
    WHERE cl.challenge_id = target_challenge_id;

    SELECT COUNT(*) INTO v_members_started
    FROM public.course_member_state
    WHERE challenge_id = target_challenge_id;

    SELECT COUNT(clc.id) INTO v_completions_count
    FROM public.course_lesson_completions clc
    JOIN public.course_lessons cl ON cl.id = clc.lesson_id
    WHERE cl.challenge_id = target_challenge_id;

    RETURN jsonb_build_object(
      'id', target_challenge_id,
      'name', v_name,
      'type', 'course',
      'status', 'course',
      'days_count', 0,
      'activities_count', 0,
      'participants_count', v_members_started,
      'completions_count', v_completions_count,
      'activity_completions_count', 0,
      'journal_entries_count', 0,
      'enrollments_count', v_enrollments_count,
      'lessons_count', v_lessons_count,
      'blocks_count', v_blocks_count,
      'members_started', v_members_started
    );
  ELSE
    SELECT status INTO v_status FROM public.challenges_with_status WHERE id = target_challenge_id;

    SELECT COUNT(*) INTO v_days_count FROM public.challenge_days WHERE challenge_id = target_challenge_id;

    SELECT COUNT(a.id) INTO v_activities_count
    FROM public.activities a
    JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
    WHERE cd.challenge_id = target_challenge_id;

    SELECT COUNT(DISTINCT ac.user_id) INTO v_participants_count
    FROM public.activity_completions ac
    JOIN public.activities a ON a.id = ac.activity_id
    JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
    WHERE cd.challenge_id = target_challenge_id;

    SELECT COUNT(c.id) INTO v_completions_count
    FROM public.completions c
    JOIN public.challenge_days cd ON cd.id = c.challenge_day_id
    WHERE cd.challenge_id = target_challenge_id;

    SELECT COUNT(ac.id) INTO v_act_comp_count
    FROM public.activity_completions ac
    JOIN public.activities a ON a.id = ac.activity_id
    JOIN public.challenge_days cd ON cd.id = a.challenge_day_id
    WHERE cd.challenge_id = target_challenge_id;

    SELECT COUNT(j.id) INTO v_journal_count
    FROM public.journal_entries j
    JOIN public.challenge_days cd ON cd.id = j.challenge_day_id
    WHERE cd.challenge_id = target_challenge_id;

    RETURN jsonb_build_object(
      'id', target_challenge_id,
      'name', v_name,
      'type', 'daily',
      'status', COALESCE(v_status, 'completed'),
      'days_count', v_days_count,
      'activities_count', v_activities_count,
      'participants_count', v_participants_count,
      'completions_count', (v_completions_count + v_act_comp_count),
      'activity_completions_count', v_act_comp_count,
      'journal_entries_count', v_journal_count,
      'enrollments_count', v_enrollments_count
    );
  END IF;
END;
$$;

-- 7. AUTO-RESET COURSE COMPLETION ON LESSON ADDITION
CREATE OR REPLACE FUNCTION public.handle_course_lesson_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When new lessons are added, any member who previously marked the course completed
  -- now has more lessons to take; clear completed_at so progress continues.
  UPDATE public.course_member_state
  SET completed_at = NULL
  WHERE challenge_id = NEW.challenge_id
    AND completed_at IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_lesson_added ON public.course_lessons;
CREATE TRIGGER trg_course_lesson_added
  AFTER INSERT ON public.course_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_course_lesson_added();

-- 8. UPDATE EXISTING CHALLENGES AND ENROLLMENT RLS POLICIES FOR COURSES
-- Unpublished courses are readable by admins only!
DROP POLICY IF EXISTS "challenges_select" ON public.challenges;
CREATE POLICY "challenges_select" ON public.challenges
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR (type = 'daily') OR (type = 'course' AND is_published = true)
  );

-- Update enrollment insert policy so members can request approval for active daily challenges OR published courses
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
          AND (
            (c.type = 'daily' AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= (c.start_date + (c.duration_days - 1) * INTERVAL '1 day')::date)
            OR
            (c.type = 'course' AND c.is_published = true AND (c.access_mode != 'fixed_end' OR c.access_end_date IS NULL OR (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(c.timezone, 'Africa/Lagos'))::date <= c.access_end_date))
          )
      )
    )
  );

-- 9. UPDATE GET_CURRENT_CHALLENGE_DAY TO FILTER DAILY CHALLENGES ONLY
CREATE OR REPLACE FUNCTION public.get_current_challenge_day(target_challenge_id uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_day int;
BEGIN
  IF target_challenge_id IS NOT NULL THEN
    SELECT current_day INTO v_day
    FROM public.challenges_with_status
    WHERE id = target_challenge_id;
  ELSE
    SELECT current_day INTO v_day
    FROM public.challenges_with_status
    WHERE status = 'active'
    ORDER BY start_date DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_day, 0);
END;
$$;

-- 10. UPDATE GET_LEADERBOARD TO IGNORE COURSES AND ENSURE TYPE = DAILY
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
  v_type text;
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

  -- Resolve challenge ID: passed parameter or active daily challenge or latest daily challenge
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
      WHERE type = 'daily'
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

  -- Ensure target is a daily challenge (courses have no leaderboard)
  SELECT type INTO v_type FROM public.challenges WHERE id = v_challenge_id;
  IF v_type = 'course' THEN
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

  -- Aggregate rankings
  WITH eligible_members AS (
    SELECT p.id, p.full_name, p.avatar_url, p.display_tag, p.role
    FROM public.profiles p
    WHERE p.status = 'approved'
      AND (
        COALESCE(v_mode, 'open') = 'open'
        OR EXISTS (
          SELECT 1 FROM public.challenge_enrollments ce
          WHERE ce.challenge_id = v_challenge_id
            AND ce.user_id = p.id
            AND ce.status = 'approved'
        )
      )
  ),
  member_counts AS (
    SELECT
      em.id AS user_id,
      em.full_name,
      em.avatar_url,
      em.display_tag,
      em.role,
      COUNT(ac.id)::int AS total_activities
    FROM eligible_members em
    LEFT JOIN public.activity_completions ac ON ac.user_id = em.id
    LEFT JOIN public.activities a ON a.id = ac.activity_id
    LEFT JOIN public.challenge_days cd ON cd.id = a.challenge_day_id AND cd.challenge_id = v_challenge_id
    GROUP BY em.id, em.full_name, em.avatar_url, em.display_tag, em.role
  ),
  ranked AS (
    SELECT
      mc.*,
      DENSE_RANK() OVER (ORDER BY mc.total_activities DESC, mc.full_name ASC) AS rank
    FROM member_counts mc
  )
  SELECT
    COUNT(*)::int,
    MAX(CASE WHEN user_id = v_caller_id THEN rank END),
    COALESCE(MAX(CASE WHEN user_id = v_caller_id THEN total_activities END), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', r.user_id,
          'user_id', r.user_id,
          'rank', r.rank,
          'total_activities', r.total_activities,
          'full_name', r.full_name,
          'avatar_url', r.avatar_url,
          'display_tag', r.display_tag,
          'role', r.role
        ) ORDER BY r.rank ASC, r.full_name ASC
      ) FILTER (WHERE r.rank <= 6),
      '[]'::jsonb
    )
  INTO v_total_ranked, v_my_rank, v_my_total_activities, v_result
  FROM ranked r;

  RETURN jsonb_build_object(
    'members', v_result,
    'total_ranked_members', COALESCE(v_total_ranked, 0),
    'my_rank', v_my_rank,
    'my_total_activities', v_my_total_activities
  );
END;
$$;

-- 11. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lesson_unlocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_block(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lesson(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_challenge_day(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(uuid) TO authenticated;

