-- ============================================================
-- BBCCILEIFE 40-Day Challenge -- Initial Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- =============================================
-- 1. PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  email       text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'member'
                   CHECK (role IN ('member', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- HELPER FUNCTION (after profiles table exists)
-- is_admin() is SECURITY DEFINER so it reads profiles
-- as the function owner, bypassing RLS entirely.
-- =============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Trigger: auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 2. CHALLENGE SETTINGS (single config row)
-- =============================================
CREATE TABLE IF NOT EXISTS public.challenge_settings (
  id         int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  start_date date,
  timezone   text NOT NULL DEFAULT 'Africa/Lagos',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.challenge_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 3. CHALLENGE DAYS
-- =============================================
CREATE TABLE IF NOT EXISTS public.challenge_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number  int UNIQUE NOT NULL CHECK (day_number BETWEEN 1 AND 40),
  title       text NOT NULL DEFAULT '',
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_challenge_days_updated_at ON public.challenge_days;
CREATE TRIGGER set_challenge_days_updated_at
  BEFORE UPDATE ON public.challenge_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 4. ACTIVITIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.activities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_day_id uuid NOT NULL REFERENCES public.challenge_days(id) ON DELETE CASCADE,
  description      text NOT NULL DEFAULT '',
  sort_order       int NOT NULL DEFAULT 0
);

-- =============================================
-- 5. COMPLETIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.completions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_day_id uuid NOT NULL REFERENCES public.challenge_days(id) ON DELETE CASCADE,
  completed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_day_id)
);

-- =============================================
-- 6. ROW LEVEL SECURITY
-- =============================================

-- profiles -----------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- challenge_settings -------------------------------------
ALTER TABLE public.challenge_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_settings_select" ON public.challenge_settings;
CREATE POLICY "challenge_settings_select"
  ON public.challenge_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "challenge_settings_update" ON public.challenge_settings;
CREATE POLICY "challenge_settings_update"
  ON public.challenge_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- challenge_days -----------------------------------------
ALTER TABLE public.challenge_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_days_select" ON public.challenge_days;
CREATE POLICY "challenge_days_select"
  ON public.challenge_days
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "challenge_days_insert" ON public.challenge_days;
CREATE POLICY "challenge_days_insert"
  ON public.challenge_days
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenge_days_update" ON public.challenge_days;
CREATE POLICY "challenge_days_update"
  ON public.challenge_days
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenge_days_delete" ON public.challenge_days;
CREATE POLICY "challenge_days_delete"
  ON public.challenge_days
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- activities ---------------------------------------------
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert"
  ON public.activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update"
  ON public.activities
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "activities_delete" ON public.activities;
CREATE POLICY "activities_delete"
  ON public.activities
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- completions --------------------------------------------
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "completions_select" ON public.completions;
CREATE POLICY "completions_select"
  ON public.completions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "completions_insert" ON public.completions;
CREATE POLICY "completions_insert"
  ON public.completions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "completions_delete" ON public.completions;
CREATE POLICY "completions_delete"
  ON public.completions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
