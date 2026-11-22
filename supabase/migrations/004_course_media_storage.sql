-- ============================================================
-- BBCCILEIFE — Migration 004: Course Media Storage Bucket
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create course-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-media',
  'course-media',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Storage Policies

-- Public Read: anyone can view course media images
DROP POLICY IF EXISTS "course_media_public_read" ON storage.objects;
CREATE POLICY "course_media_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-media');

-- Admin Insert / Upload: only authenticated admins can upload
DROP POLICY IF EXISTS "course_media_admin_insert" ON storage.objects;
CREATE POLICY "course_media_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Admin Update: only authenticated admins can update
DROP POLICY IF EXISTS "course_media_admin_update" ON storage.objects;
CREATE POLICY "course_media_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Admin Delete: only authenticated admins can delete
DROP POLICY IF EXISTS "course_media_admin_delete" ON storage.objects;
CREATE POLICY "course_media_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Helper RPC function to ensure bucket exists programmatically
CREATE OR REPLACE FUNCTION public.create_course_media_bucket_if_needed()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'course-media',
    'course-media',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  RETURN true;
END;
$$;
