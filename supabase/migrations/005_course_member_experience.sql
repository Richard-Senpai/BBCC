-- ============================================================
-- BBCCILEIFE — Migration 005: Course Member Experience,
-- Completion Preservation, and Admin Progress Tracking
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. PRESERVE COURSE COMPLETION WHEN ADMIN ADDS NEW LESSONS
-- The previous trigger reset completed_at to NULL when lessons were added.
-- Dropping this ensures members who finished the course remain completed.
DROP TRIGGER IF EXISTS trg_course_lesson_added ON public.course_lessons;
DROP FUNCTION IF EXISTS public.handle_course_lesson_added();

-- 2. ADMIN EXTEND ACCESS RPC
CREATE OR REPLACE FUNCTION public.extend_course_member_access(
  target_course_id uuid,
  target_user_id uuid,
  override_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Administrator privileges required';
  END IF;

  IF target_course_id IS NULL OR target_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;

  UPDATE public.course_member_state
  SET access_override_until = override_until
  WHERE challenge_id = target_course_id AND user_id = target_user_id;

  IF NOT FOUND THEN
    -- If member hasn't started yet, create record with override
    INSERT INTO public.course_member_state (challenge_id, user_id, started_at, access_override_until)
    VALUES (target_course_id, target_user_id, now(), override_until);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. ADMIN COURSE PROGRESS SUMMARY RPC
CREATE OR REPLACE FUNCTION public.get_course_progress_summary(target_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_started_count int := 0;
  v_completed_count int := 0;
  v_total_lessons int := 0;
  v_lessons_json jsonb;
  v_members_json jsonb;
  v_course_name text;
  v_access_mode text;
  v_access_end_date date;
  v_access_days int;
  v_timezone text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Administrator privileges required';
  END IF;

  -- Read course info
  SELECT name, access_mode, access_end_date, access_days, COALESCE(timezone, 'Africa/Lagos')
  INTO v_course_name, v_access_mode, v_access_end_date, v_access_days, v_timezone
  FROM public.challenges
  WHERE id = target_course_id;

  IF v_course_name IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Total lessons
  SELECT COUNT(*) INTO v_total_lessons
  FROM public.course_lessons
  WHERE challenge_id = target_course_id;

  -- Members counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL)
  INTO v_started_count, v_completed_count
  FROM public.course_member_state
  WHERE challenge_id = target_course_id;

  -- Per-lesson completion breakdown
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', cl.id,
      'position', cl.position,
      'title', cl.title,
      'summary', cl.summary,
      'completed_count', (
        SELECT COUNT(*)
        FROM public.course_lesson_completions clc
        WHERE clc.lesson_id = cl.id
      )
    ) ORDER BY cl.position ASC
  ) INTO v_lessons_json
  FROM public.course_lessons cl
  WHERE cl.challenge_id = target_course_id;

  -- Per-member table
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', p.id,
      'full_name', COALESCE(p.full_name, 'Anonymous Member'),
      'email', p.email,
      'avatar_url', p.avatar_url,
      'started_at', cms.started_at,
      'completed_at', cms.completed_at,
      'access_override_until', cms.access_override_until,
      'lessons_completed_count', (
        SELECT COUNT(*)
        FROM public.course_lesson_completions clc
        JOIN public.course_lessons cl ON cl.id = clc.lesson_id
        WHERE cl.challenge_id = target_course_id AND clc.user_id = p.id
      ),
      'last_activity_at', (
        SELECT MAX(clc.completed_at)
        FROM public.course_lesson_completions clc
        JOIN public.course_lessons cl ON cl.id = clc.lesson_id
        WHERE cl.challenge_id = target_course_id AND clc.user_id = p.id
      )
    ) ORDER BY cms.completed_at DESC NULLS LAST, cms.started_at DESC
  ) INTO v_members_json
  FROM public.course_member_state cms
  JOIN public.profiles p ON p.id = cms.user_id
  WHERE cms.challenge_id = target_course_id;

  RETURN jsonb_build_object(
    'course_id', target_course_id,
    'course_name', v_course_name,
    'total_lessons', v_total_lessons,
    'started_count', v_started_count,
    'completed_count', v_completed_count,
    'access_mode', v_access_mode,
    'access_end_date', v_access_end_date,
    'access_days', v_access_days,
    'timezone', v_timezone,
    'lessons', COALESCE(v_lessons_json, '[]'::jsonb),
    'members', COALESCE(v_members_json, '[]'::jsonb)
  );
END;
$$;
