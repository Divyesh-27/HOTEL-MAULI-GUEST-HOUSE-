-- Realtime DELETE events must include the old row so subscribers can
-- identify which booking was removed.  Without REPLICA IDENTITY FULL
-- the default (index-only) identity sends only the primary key, which
-- is not enough for the phone or the desktop's realtime handler.
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
