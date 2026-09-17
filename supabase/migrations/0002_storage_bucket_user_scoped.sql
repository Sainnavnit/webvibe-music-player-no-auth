-- Step 1: Drop ALL existing policies on the "music" storage bucket
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public download" ON storage.objects;
DROP POLICY IF EXISTS "allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "allow public download" ON storage.objects;

-- Step 2: Create user-scoped policies for the "music" storage bucket
-- Bucket name: "music". Files are stored at: {user_id}/{filename}

-- Users can read (download/SELECT) objects in their own folder inside the music bucket
CREATE POLICY "Users can select own objects in music bucket"
ON storage.objects
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can insert (upload) objects only in their own folder inside the music bucket
CREATE POLICY "Users can insert own objects in music bucket"
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update objects in their own folder (rarely used)
CREATE POLICY "Users can update own objects in music bucket"
ON storage.objects
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete objects in their own folder
CREATE POLICY "Users can delete own objects in music bucket"
ON storage.objects
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
