-- ============================================================
-- Migration 006: Profile Security and Navigation Protection
-- Enforces that non-admin members cannot alter role, status,
-- display_tag, id, or email via direct profile updates.
-- ============================================================

-- 1. Trigger function to block non-admins from altering protected profile columns
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If updater is not an admin, block modification of protected fields
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Non-admins cannot change user role';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Non-admins cannot change user status';
    END IF;
    IF NEW.display_tag IS DISTINCT FROM OLD.display_tag THEN
      RAISE EXCEPTION 'Non-admins cannot change user display_tag';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'User ID cannot be modified';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'User email cannot be modified directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach BEFORE UPDATE trigger to public.profiles
DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- 3. Update RLS policy to enforce role, status, and display_tag immutability for members
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      id = auth.uid()
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
      AND (display_tag IS NOT DISTINCT FROM (SELECT p.display_tag FROM public.profiles p WHERE p.id = auth.uid()))
    )
  );
