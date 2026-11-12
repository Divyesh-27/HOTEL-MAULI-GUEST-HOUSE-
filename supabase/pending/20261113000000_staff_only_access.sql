-- ============================================================
-- Staff-only access for every table and storage bucket the apps sync.
--
-- !!! DO NOT APPLY YET !!!
-- Parked in supabase/pending/ so `supabase db push` cannot apply it. Move it
-- back to supabase/migrations/ only when staff sign-in has been verified.
-- Desktop sync, realtime and the mobile app currently talk to Supabase with
-- the ANON key and no signed-in user. After this migration anon has no access,
-- so sync writes would be rejected and marked permanently Failed in the local
-- queue (local SQLite data is not affected, the cloud copy just stops
-- updating). Apply this only after BOTH apps sign in a Supabase Auth user that
-- is listed in public.guest_form_staff before syncing.
--
-- Also, before applying:
--   * Identity-proof and signature URLs are currently PUBLIC links created with
--     getPublicUrl(). This migration makes both buckets private, so those links
--     stop working; readers must switch to createSignedUrl().
--   * Disable public sign-ups (Authentication > Providers > Email).
--   * Add each staff user:
--       INSERT INTO public.guest_form_staff (user_id)
--         SELECT id FROM auth.users WHERE email = '<staff email>';
--
-- Design (non-destructive, safe to re-run):
--   * Existing policies are NOT dropped. A RESTRICTIVE staff-only policy is
--     added, which Postgres ANDs with every existing permissive policy, so
--     old "allow public" policies (e.g. on room_holds) can no longer grant
--     access to anyone who is not staff.
--   * Anon loses all table privileges, so anon is denied regardless of policy.
--   * The staff allow-list and is_guest_form_staff() are defined exactly as in
--     20261112000000_create_guest_submissions.sql (feature branch), so there is
--     one staff list and either migration can run first.
-- ============================================================

-- ---------- Shared staff allow-list (same definition as guest_submissions) ----------
CREATE TABLE IF NOT EXISTS public.guest_form_staff (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.guest_form_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_form_staff FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_guest_form_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.guest_form_staff WHERE user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_guest_form_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_guest_form_staff() TO authenticated;

-- ---------- Tables used by desktop sync / realtime ----------
DO $$
DECLARE
    t TEXT;
    synced_tables TEXT[] := ARRAY[
        'bookings',          -- guest PII, ID-proof/signature URLs, amounts
        'rooms',
        'room_statuses',
        'room_categories',
        'room_bed_types',
        'room_holds',        -- created with "Allow public ..." policies in 20260918000000
        'invoice_settings',  -- GSTIN, tax config
        'staff',             -- names, salaries
        'staff_logs',        -- salary/advance amounts
        'app_users',         -- usernames + password hashes
        'app_roles'
    ];
BEGIN
    FOREACH t IN ARRAY synced_tables LOOP
        IF to_regclass(format('public.%I', t)) IS NULL THEN
            RAISE NOTICE 'Skipping public.%: table does not exist in this project', t;
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        -- Anon: no privileges at all, whatever policies exist.
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);

        -- Permissive: staff may do everything.
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Staff full access', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated '
            'USING (public.is_guest_form_staff()) WITH CHECK (public.is_guest_form_staff())',
            'Staff full access', t);

        -- Restrictive: ANDed with every other policy, so non-staff signed-in
        -- users get nothing even if an older permissive policy says USING (true).
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Staff only (restrictive)', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
            'USING (public.is_guest_form_staff()) WITH CHECK (public.is_guest_form_staff())',
            'Staff only (restrictive)', t);
    END LOOP;
END $$;

-- ---------- Storage: identity proofs & signatures ----------
-- Public buckets serve files at /object/public/... without any policy check,
-- so the buckets themselves must be private.
UPDATE storage.buckets
SET public = false
WHERE id IN ('identity-proofs', 'digital-signatures');

-- storage.objects is shared by all buckets, so access is narrowed per bucket
-- instead of revoking privileges on the whole table.
DROP POLICY IF EXISTS "Guest media: anon denied" ON storage.objects;
CREATE POLICY "Guest media: anon denied"
    ON storage.objects AS RESTRICTIVE FOR ALL TO anon
    USING (bucket_id NOT IN ('identity-proofs', 'digital-signatures'))
    WITH CHECK (bucket_id NOT IN ('identity-proofs', 'digital-signatures'));

DROP POLICY IF EXISTS "Guest media: staff only (restrictive)" ON storage.objects;
CREATE POLICY "Guest media: staff only (restrictive)"
    ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
    USING (bucket_id NOT IN ('identity-proofs', 'digital-signatures') OR public.is_guest_form_staff())
    WITH CHECK (bucket_id NOT IN ('identity-proofs', 'digital-signatures') OR public.is_guest_form_staff());

DROP POLICY IF EXISTS "Guest media: staff full access" ON storage.objects;
CREATE POLICY "Guest media: staff full access"
    ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
    USING (bucket_id IN ('identity-proofs', 'digital-signatures') AND public.is_guest_form_staff())
    WITH CHECK (bucket_id IN ('identity-proofs', 'digital-signatures') AND public.is_guest_form_staff());
