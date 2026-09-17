-- Step 1: Add user_id column to tracks table
ALTER TABLE "public"."tracks" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Enable RLS on the tracks table (should already be on, but force it)
ALTER TABLE "public"."tracks" ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL existing policies on tracks so we can rewrite them cleanly
DROP POLICY IF EXISTS "allow public select" ON "public"."tracks";
DROP POLICY IF EXISTS "allow public insert" ON "public"."tracks";
DROP POLICY IF EXISTS "allow public download" ON "public"."tracks";
DROP POLICY IF EXISTS "allow public upload" ON "public"."tracks";

-- Step 4: Create new user-scoped policies for tracks table

-- Users can only SELECT tracks they own
CREATE POLICY "Users can select own tracks"
ON "public"."tracks"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can only INSERT tracks assigned to themselves
CREATE POLICY "Users can insert own tracks"
ON "public"."tracks"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Optional: allow users to update/delete their own tracks
CREATE POLICY "Users can update own tracks"
ON "public"."tracks"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracks"
ON "public"."tracks"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
