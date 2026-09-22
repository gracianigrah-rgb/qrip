-- Storage policies for the private 'factures' bucket: each user only in their own folder
DROP POLICY IF EXISTS "factures read own" ON storage.objects;
DROP POLICY IF EXISTS "factures insert own" ON storage.objects;
DROP POLICY IF EXISTS "factures delete own" ON storage.objects;

CREATE POLICY "factures read own" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'factures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "factures insert own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'factures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "factures delete own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'factures' AND (storage.foldername(name))[1] = auth.uid()::text);