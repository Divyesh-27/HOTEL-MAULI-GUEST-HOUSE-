-- Create room_holds table
CREATE TABLE IF NOT EXISTS public.room_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_no TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.room_holds ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for read/write since app relies on anon key
CREATE POLICY "Allow public read on room_holds"
    ON public.room_holds FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert on room_holds"
    ON public.room_holds FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update on room_holds"
    ON public.room_holds FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete on room_holds"
    ON public.room_holds FOR DELETE
    USING (true);

-- Create an index to quickly filter by unexpired room holds
CREATE INDEX IF NOT EXISTS idx_room_holds_expires_at ON public.room_holds(expires_at);
CREATE INDEX IF NOT EXISTS idx_room_holds_room_no ON public.room_holds(room_no);

-- Set up realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_holds;
