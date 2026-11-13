-- Run explicitly before deploying the booking_type code; never auto-run at startup.
-- Backfill exactly the legacy demo mapping once. Unknown legacy zones stay seated.
-- Re-running only fills NULLs and never overwrites later admin choices.
BEGIN;
LOCK TABLE zones IN ACCESS EXCLUSIVE MODE;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS booking_type VARCHAR(10);
UPDATE zones z SET booking_type = legacy.kind
FROM (VALUES
(1, 'Standard Tier 2', 'seated'),
(1, 'Standard Tier 1', 'seated'),
(1, 'VIP Diamond Experience', 'standing'),
(2, 'General Admission Standing', 'standing'),
(2, 'Cat 1 Seated', 'seated'),
(2, 'VIP After Hours Lounge', 'standing'),
(3, 'Floor Standing Mosh', 'standing'),
(3, 'Balcony Seating', 'seated'),
(3, 'Cactus Jack VIP Pass', 'standing'),
(4, 'General Floor Standing', 'standing'),
(4, 'Lower Bowl Seated', 'seated'),
(4, 'OA VIP Soundcheck Package', 'standing'),
(5, 'Rockstar Standing Zone', 'standing'),
(5, 'Tier 1 Center Seated', 'seated'),
(5, 'LLOUD Ultimate VIP Meet & Greet', 'standing'),
(6, 'Standard Floor GA', 'standing'),
(6, 'Lower Bowl Reserved', 'seated'),
(6, 'Karma Is My Boyfriend VIP', 'standing'),
(7, 'Silver Tribune', 'seated'),
(7, 'Gold Standing Pit', 'standing'),
(7, '24K Magic VIP Experience', 'standing'),
(8, 'General Admission', 'standing'),
(8, 'Belieber Standing Pit', 'standing'),
(8, 'Ghost VIP Lounge', 'standing'),
(9, 'CAT 3 Seating', 'seated'),
(9, 'Soundcheck Standing', 'standing'),
(9, 'ARMY Ultimate VIP Pass', 'standing'),
(10, 'Standard Tier', 'seated'),
(10, 'Coup D''Etat Pit', 'standing'),
(10, 'One of a Kind VIP', 'standing'),
(11, 'Balcony Seated', 'seated'),
(11, 'Front Row Orchestra', 'seated'),
(11, 'Midnight VIP Pass', 'standing')
) AS legacy(concert_id,name,kind)
WHERE z.concert_id=legacy.concert_id AND z.name=legacy.name AND z.booking_type IS NULL;
UPDATE zones SET booking_type='seated' WHERE booking_type IS NULL;
ALTER TABLE zones ALTER COLUMN booking_type SET DEFAULT 'seated';
ALTER TABLE zones ALTER COLUMN booking_type SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='zones'::regclass AND conname='ck_zones_booking_type') THEN
    ALTER TABLE zones ADD CONSTRAINT ck_zones_booking_type CHECK (booking_type IN ('seated','standing'));
  END IF;
END $$;
COMMIT;
