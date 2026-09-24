CREATE POLICY "business logos read own" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'logos-entreprise' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "business logos insert own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos-entreprise' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "business logos update own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'logos-entreprise' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'logos-entreprise' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "business logos delete own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'logos-entreprise' AND (storage.foldername(name))[1] = auth.uid()::text);