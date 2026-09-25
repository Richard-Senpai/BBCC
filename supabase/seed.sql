-- ============================================================
-- Admin Seed Script
-- Run ONCE in the Supabase SQL Editor after applying the migration.
-- Replace the placeholder values before running.
-- ============================================================

-- Step 1: Create the auth user via Supabase Auth Admin API
--   Do this in the Supabase Dashboard → Authentication → Users → "Add user"
--   Set: email, password, and confirm email (or use the API).
--   Copy the resulting user UUID into the INSERT below.

-- Step 2: Promote that user to admin role
-- Replace '<ADMIN_USER_UUID>' with the actual UUID of the user you just created.

UPDATE public.profiles
SET role = 'admin'
WHERE id = '<ADMIN_USER_UUID>';

-- Verify
SELECT id, full_name, email, role FROM public.profiles WHERE role = 'admin';
