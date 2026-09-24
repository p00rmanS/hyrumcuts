-- HyrumHaircuts CMS: owner bootstrap and first-run defaults.
--
-- Registering the owner (one INSERT into public.site_owner) creates the
-- editable settings row plus STARTER content, so the website looks complete
-- from day one and Hyrum only has to replace it:
--   * the same headline copy, biography, FAQ answers and booking options the
--     original site launched with;
--   * three reviews that are plainly labelled "[Placeholder review]";
--   * FAQ answers that still need Hyrum's own wording are labelled
--     "[Owner to review: ...]".
-- Every one of these is a normal, editable row. The admin dashboard lists what
-- is still a placeholder, and the marker text disappears as soon as he edits it.
--
-- Nothing here invents facts: no phone number, email, address, prices, ratings
-- or credentials. (Starter photos and the portrait are files, so they are
-- loaded by scripts/seed-starter-content.mjs, not by SQL.)
--
-- Run only by the developer (postgres / SQL editor / service role); the
-- `private` schema is not reachable through the Data API.

create or replace function private.seed_owner_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_settings (owner_id, about_bio, profile_photo_alt)
  values (
    new.owner_id,
    'Hyrum approaches every appointment with patience, precision, and attention to how the cut fits the person—not just the trend. From clean fades to longer textured styles, the goal is a haircut that looks sharp in the chair and still works in everyday life.',
    'Placeholder portrait of Hyrum. Replace with a real photo before launch.'
  )
  on conflict (owner_id) do nothing;

  insert into public.gallery_categories (owner_id, name, slug, sort_order)
  values
    (new.owner_id, 'Fades',           'fades',           1),
    (new.owner_id, 'Tapers',          'tapers',          2),
    (new.owner_id, 'Textured',        'textured',        3),
    (new.owner_id, 'Long Hair',       'long-hair',       4),
    (new.owner_id, 'Beards',          'beards',          5),
    (new.owner_id, 'Transformations', 'transformations', 6)
  on conflict (owner_id, slug) do nothing;

  insert into public.faqs (owner_id, question, answer, is_published, sort_order)
  values
    (new.owner_id, 'How do I book?',
      'Send an appointment request through the booking page, or pick an open time directly on the calendar if one is available. Either way you will hear back to lock in the details.',
      true, 1),
    (new.owner_id, 'Is my appointment confirmed right away?',
      'Hyrum personally reviews and confirms every request by text or email, usually the same day.',
      true, 2),
    (new.owner_id, 'What should I bring for a reference?',
      '[Owner to review: what reference photos or details are most helpful before an appointment?]',
      true, 3),
    (new.owner_id, 'What if I need to reschedule or cancel?',
      '[Owner to review: reschedule/cancellation policy and how much notice is needed.]',
      true, 4),
    (new.owner_id, 'Where will I receive confirmation?',
      'By the contact method you provide on the request form (text or email).',
      true, 5);

  insert into public.reviews (owner_id, reviewer_name, quote, haircut_type, is_published, sort_order)
  values
    (new.owner_id, 'J.', '[Placeholder review] Walked in unsure what I wanted and walked out with the best fade I''ve had. Replace with a real approved quote before launch.', 'Skin Fade', true, 1),
    (new.owner_id, 'M.', '[Placeholder review] Patient, precise, and easy to talk to. Replace with a real approved quote before launch.', 'Taper Fade', true, 2),
    (new.owner_id, 'A.', '[Placeholder review] My go-to for beard lineups now. Replace with a real approved quote before launch.', 'Beard Trim & Lineup', true, 3);

  insert into public.services (owner_id, name, description, sort_order)
  values
    (new.owner_id, 'Classic Haircut',        'A timeless cut, tailored to face shape and hair type.', 1),
    (new.owner_id, 'Skin Fade',              'A close, blended fade from skin to length on top.', 2),
    (new.owner_id, 'Taper Fade',             'A gradual blend that keeps more length through the sides.', 3),
    (new.owner_id, 'Textured Crop',          'Shorter sides with a textured, low-maintenance top.', 4),
    (new.owner_id, 'Beard Trim & Lineup',    'Beard shaping and a clean lineup.', 5),
    (new.owner_id, 'Haircut + Beard Combo',  'A full haircut paired with a beard trim and lineup.', 6),
    (new.owner_id, 'Kids Haircut',           'A patient, straightforward cut for younger clients.', 7);

  return new;
end;
$$;

revoke all on function private.seed_owner_defaults() from public, anon, authenticated;

create trigger seed_owner_defaults
  after insert on public.site_owner
  for each row execute function private.seed_owner_defaults();

-- ---------------------------------------------------------------------------
-- private.bootstrap_owner(email): idempotent. Connects an existing Auth user
-- (created in Dashboard > Authentication > Users, or by the CLI script) to the
-- ownership model. Safe to run twice: the second run changes nothing.
-- If a DIFFERENT user is already the owner it fails loudly instead of
-- silently handing over the site (see README, "Owner hand-over").
-- ---------------------------------------------------------------------------
create or replace function private.bootstrap_owner(p_email text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_existing uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_user_id is null then
    raise exception 'No Auth user has the email "%". Create the user first (Supabase Dashboard > Authentication > Users > Add user).', p_email;
  end if;

  select owner_id into v_existing from public.site_owner limit 1;
  if v_existing is not null and v_existing <> v_user_id then
    raise exception 'A different user (%) is already the site owner. To hand the site over, change that account''s email and password instead of creating a new owner (see README).', v_existing;
  end if;

  insert into public.site_owner (owner_id) values (v_user_id) on conflict (owner_id) do nothing;
  return v_user_id;
end;
$$;

revoke all on function private.bootstrap_owner(text) from public, anon, authenticated;
