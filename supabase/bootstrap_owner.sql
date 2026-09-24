-- Register the site owner (run ONCE, in the Supabase SQL Editor, as the project admin).
--
-- 1. Create the owner in  Dashboard > Authentication > Users > Add user
--    (tick "Auto Confirm User"). Use a strong password, or invite by email.
-- 2. Replace the address below with that user's email and run this file.
--
-- It is idempotent: running it again changes nothing. It refuses to replace an
-- existing, different owner (see README, "Owner hand-over").
--
-- Never put a password or key in this file.

select private.bootstrap_owner('owner@example.com');   -- <-- change this email

-- Check:
select o.owner_id, u.email, o.created_at
from public.site_owner o
join auth.users u on u.id = o.owner_id;
