-- ============================================================
-- Sync tables for the desktop app (fresh project).
--
-- Columns match exactly what the sync engine sends:
--   * every row also gets id, updated_at, version, device, source
--     (added by executeSupabaseOperation in src/lib/syncEngine.ts)
--   * ids are TEXT because several tables use a name or room number as id
--   * bookings/invoice_settings match the explicit (whitelisted) payloads;
--     base64 images and invoice HTML are never stored in the cloud
--
-- ACCESS: TEMPORARY. Until desktop and mobile sign in as a staff user, anon
-- and authenticated get full access through the "TEMP sync access" policies.
-- 20261113000000_staff_only_access.sql later revokes anon completely and
-- restricts signed-in access to staff, without needing to drop these.
--
-- Run AFTER 20260918000000_create_room_holds.sql. Safe to re-run.
-- ============================================================

-- ---------- Shared helper: row bookkeeping columns ----------
-- (written out per table below so each CREATE TABLE stands alone)

-- ---------- bookings (active bookings + checked-out history) ----------
CREATE TABLE IF NOT EXISTS public.bookings (
    id                        TEXT PRIMARY KEY,
    status                    TEXT,             -- CHECKED_IN | RESERVED | COMPLETED
    bill_no                   INTEGER,
    bill_date                 TEXT,
    guest_name                TEXT,
    mobile                    TEXT,
    address                   TEXT,
    persons                   TEXT,
    other_persons             TEXT,
    age                       TEXT,
    occupation                TEXT,
    identity_proof_type       TEXT,
    coming_from               TEXT,
    going_to                  TEXT,
    car_no                    TEXT,
    car_model                 TEXT,
    check_in                  TEXT,             -- local "YYYY-MM-DDTHH:mm" or ISO
    check_out                 TEXT,
    checkout_date             TIMESTAMPTZ,      -- derived from check_out (trigger), used by retention
    days                      NUMERIC,
    room_nos                  TEXT[] NOT NULL DEFAULT '{}',
    room_rates                JSONB,            -- per-night rates locked at booking (season modes)
    rate_mode                 TEXT,
    advance_total             NUMERIC DEFAULT 0,
    advance_payments          JSONB NOT NULL DEFAULT '[]'::jsonb,
    pay_mode                  TEXT,
    extras                    JSONB NOT NULL DEFAULT '[]'::jsonb,
    discount                  NUMERIC DEFAULT 0,
    discount_note             TEXT,
    discount_reason           TEXT,
    show_discount_on_invoice  BOOLEAN,
    enable_gst_invoice        BOOLEAN,
    customer_gstin            TEXT,
    gst_rate                  NUMERIC,
    cgst_amount               NUMERIC,
    sgst_amount               NUMERIC,
    total_gst                 NUMERIC,
    grand_total_with_gst      NUMERIC,
    final_amount              NUMERIC,
    total_paid                NUMERIC,
    identity_proof_url        TEXT,             -- storage path in private bucket (signed URLs)
    digital_signature_url     TEXT,
    guest_submission_id       TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ,
    version                   INTEGER,
    device                    TEXT,
    source                    TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookings_checkout_date ON public.bookings (checkout_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);

-- Keep checkout_date in step with check_out. A value that isn't a date is
-- stored as NULL instead of failing the whole sync write.
CREATE OR REPLACE FUNCTION public.bookings_set_checkout_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    BEGIN
        NEW.checkout_date := CASE
            WHEN NEW.check_out ~ '^\d{4}-\d{2}-\d{2}' THEN NEW.check_out::timestamptz
            ELSE NULL
        END;
    EXCEPTION WHEN others THEN
        NEW.checkout_date := NULL;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_checkout_date ON public.bookings;
CREATE TRIGGER trg_bookings_checkout_date
    BEFORE INSERT OR UPDATE OF check_out ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.bookings_set_checkout_date();

-- ---------- rooms (id = room number) ----------
CREATE TABLE IF NOT EXISTS public.rooms (
    id           TEXT PRIMARY KEY,
    room_no      TEXT NOT NULL,
    category     TEXT,
    bed_type     TEXT,
    rent         NUMERIC,
    room_name    TEXT,
    room_type    TEXT,
    floor        TEXT,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ,
    version      INTEGER,
    device       TEXT,
    source       TEXT
);

-- ---------- room_statuses (id = room number) ----------
CREATE TABLE IF NOT EXISTS public.room_statuses (
    id          TEXT PRIMARY KEY,
    room_no     TEXT NOT NULL,
    status      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    version     INTEGER,
    device      TEXT,
    source      TEXT
);

-- ---------- room_categories / room_bed_types (id = name) ----------
CREATE TABLE IF NOT EXISTS public.room_categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    version     INTEGER,
    device      TEXT,
    source      TEXT
);

CREATE TABLE IF NOT EXISTS public.room_bed_types (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    version     INTEGER,
    device      TEXT,
    source      TEXT
);

-- ---------- invoice_settings (single row, id = 'default-settings') ----------
CREATE TABLE IF NOT EXISTS public.invoice_settings (
    id                           TEXT PRIMARY KEY,
    gst_enabled                  BOOLEAN,
    gst_number                   TEXT,
    slab1_limit                  NUMERIC,
    slab1_gst                    NUMERIC,
    slab1_cgst                   NUMERIC,
    slab1_sgst                   NUMERIC,
    slab2_from                   NUMERIC,
    slab2_to                     NUMERIC,
    slab2_gst                    NUMERIC,
    slab2_cgst                   NUMERIC,
    slab2_sgst                   NUMERIC,
    slab3_from                   NUMERIC,
    slab3_gst                    NUMERIC,
    slab3_cgst                   NUMERIC,
    slab3_sgst                   NUMERIC,
    show_gstin_advance           BOOLEAN,
    show_gstin_final             BOOLEAN,
    show_breakup_advance         BOOLEAN,
    show_breakup_final           BOOLEAN,
    hotel_name                   TEXT,
    hotel_address                TEXT,
    hotel_phone                  TEXT,
    custom_bed_types             JSONB,
    custom_categories            JSONB,
    ac_to_non_ac_discount_rates  JSONB,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ,
    version                      INTEGER,
    device                       TEXT,
    source                       TEXT
);

-- ---------- staff (legacy staff list, id = name) / staff_logs ----------
CREATE TABLE IF NOT EXISTS public.staff (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    role        TEXT,
    salary      NUMERIC,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    version     INTEGER,
    device      TEXT,
    source      TEXT
);

CREATE TABLE IF NOT EXISTS public.staff_logs (
    id          TEXT PRIMARY KEY,
    local_id    TEXT,
    date        TEXT,
    staff       TEXT,
    type        TEXT,
    amount      NUMERIC,
    msg         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    version     INTEGER,
    device      TEXT,
    source      TEXT
);

-- ---------- app_roles / app_users ----------
CREATE TABLE IF NOT EXISTS public.app_roles (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    permissions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ,
    version      INTEGER,
    device       TEXT,
    source       TEXT
);

CREATE TABLE IF NOT EXISTS public.app_users (
    id             TEXT PRIMARY KEY,
    full_name      TEXT,
    username       TEXT NOT NULL,
    password_hash  TEXT,                -- salted PBKDF2; staff-only once locked down
    role_id        TEXT,
    status         TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ,
    version        INTEGER,
    device         TEXT,
    source         TEXT
);

-- ---------- Temporary access (until staff sign-in ships everywhere) ----------
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'bookings', 'rooms', 'room_statuses', 'room_categories', 'room_bed_types',
        'invoice_settings', 'staff', 'staff_logs', 'app_roles', 'app_users'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'TEMP sync access', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
            'TEMP sync access', t);
    END LOOP;

    -- room_holds (own migration, which has policies but no explicit grants)
    IF to_regclass('public.room_holds') IS NOT NULL THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_holds TO anon, authenticated;
    END IF;
END $$;

-- ---------- Realtime (tables the desktop subscribes to) ----------
-- room_holds is added by its own migration.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'bookings', 'rooms', 'room_statuses', 'room_categories', 'room_bed_types',
        'invoice_settings', 'staff', 'staff_logs'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

-- ---------- Storage buckets (PRIVATE from day one; app uses signed URLs) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-proofs', 'identity-proofs', false),
       ('digital-signatures', 'digital-signatures', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Temporary: uploads (upsert needs select+insert+update) and removal for the
-- sync client until staff sign-in ships. Locked down by the staff-only migration.
DROP POLICY IF EXISTS "TEMP guest media sync access" ON storage.objects;
CREATE POLICY "TEMP guest media sync access"
    ON storage.objects FOR ALL TO anon, authenticated
    USING (bucket_id IN ('identity-proofs', 'digital-signatures'))
    WITH CHECK (bucket_id IN ('identity-proofs', 'digital-signatures'));
