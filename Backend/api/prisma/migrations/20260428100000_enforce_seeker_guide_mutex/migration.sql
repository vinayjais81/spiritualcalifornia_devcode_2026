-- Enforce: SEEKER and GUIDE are mutually exclusive on the same email.
-- ADMIN/SUPER_ADMIN are exempt (platform staff). For any user that today
-- holds BOTH SEEKER and GUIDE rows, drop the SEEKER row — guides have a
-- real verified profile + identity record so they're the truer signal of
-- intent, and dropping SEEKER preserves their guide flow intact.
--
-- Idempotent: re-running is a no-op (the SEEKER rows are gone after the
-- first run, so the WHERE clause matches nothing on subsequent runs).

-- Visibility: log how many users will be affected, so operators can
-- inspect the migration output. Postgres `RAISE NOTICE` writes to the
-- migration log without changing the result.
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT "userId") INTO affected_count
  FROM "user_roles"
  WHERE "role" = 'SEEKER'
    AND "userId" IN (SELECT "userId" FROM "user_roles" WHERE "role" = 'GUIDE');
  RAISE NOTICE 'Dropping SEEKER role from % users who also have GUIDE', affected_count;
END $$;

DELETE FROM "user_roles"
WHERE "role" = 'SEEKER'
  AND "userId" IN (
    SELECT "userId" FROM "user_roles" WHERE "role" = 'GUIDE'
  );

-- Note: we deliberately leave any orphaned `seeker_profiles` rows in place.
-- They're disconnected from the user's marketplace identity now (no SEEKER
-- role) but might still hold historical bookings / orders that we don't
-- want to cascade-delete. A future cleanup pass can prune profiles that
-- have zero relations.
