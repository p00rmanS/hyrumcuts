-- pgTAP security tests. Run with:  npm run db:test   (supabase test db)
--
-- Proves, inside PostgreSQL itself, that Row Level Security and the Storage
-- policies do what the README says:
--   1. anonymous visitors can read published content
--   2. anonymous visitors cannot read drafts
--   3. anonymous visitors cannot mutate anything
--   4. the owner can manage their own content
--   5. a different authenticated user cannot manage the owner's rows
--   6. private data (audit log, owner row, cleanup queue) stays private
--
-- Everything runs in a transaction that is rolled back at the end.

begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

-- Fixtures: two Auth users; the first one becomes the site owner.
insert into auth.users (id, email, instance_id, aud, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner@example.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'other@example.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

select lives_ok($$ select private.bootstrap_owner('owner@example.test') $$, 'bootstrap registers the owner');
select lives_ok($$ select private.bootstrap_owner('owner@example.test') $$, 'bootstrap is idempotent');
select throws_ok($$ select private.bootstrap_owner('other@example.test') $$, 'P0001', null, 'bootstrap refuses to add a second owner');

-- Helpers to act as a given role.
create or replace function pg_temp.act_as(p_role text, p_uid text default null) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid, ''), true);
  perform set_config('request.jwt.claims', case when p_uid is null then '{}' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  if p_role <> 'postgres' then execute format('set local role %I', p_role); end if;
end $$;
grant execute on function pg_temp.act_as(text, text) to public;

-- Some content (created as the owner).
select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok($$ insert into public.gallery_items (id, title, alt_text, is_published) values ('11111111-1111-4111-8111-111111111111', 'Live', 'A live cut', true) $$, 'owner can create a published item');
select lives_ok($$ insert into public.gallery_items (id, title, alt_text) values ('22222222-2222-4222-8222-222222222222', 'Draft', '') $$, 'owner can create a draft');
select throws_ok($$ update public.gallery_items set is_published = true where id = '22222222-2222-4222-8222-222222222222' $$, '23514', null, 'cannot publish without alt text');
select lives_ok($$ insert into public.reviews (reviewer_name, quote, is_published) values ('A.', 'Approved', true), ('B.', 'Pending', false) $$, 'owner can add reviews');
-- A draft FAQ next to the five published starter ones (not an assertion, just a fixture).
insert into public.faqs (question, answer, is_published) values ('Draft question', 'Draft answer', false);

-- 1 + 2. Anonymous reads
select pg_temp.act_as('anon');
select is((select count(*)::int from public.site_settings), 1, 'anon can read the public settings');
select is((select count(*)::int from public.gallery_items), 1, 'anon sees the published item only');
select is((select count(*)::int from public.gallery_items where title = 'Draft'), 0, 'anon cannot read the draft');
select is((select count(*)::int from public.reviews), 4, 'anon sees approved reviews only (3 starter placeholders + 1 approved, not the pending one)');
select is((select count(*)::int from public.faqs), 5, 'anon sees the 5 published FAQs and not the draft');

-- 3. Anonymous writes
select throws_ok($$ insert into public.reviews (reviewer_name, quote) values ('x', 'y') $$, '42501', null, 'anon cannot insert');
select throws_ok($$ update public.site_settings set brand_name = 'HACKED' $$, '42501', null, 'anon cannot update settings');
select throws_ok($$ delete from public.gallery_items $$, '42501', null, 'anon cannot delete');
select throws_ok($$ select public.reorder_content('faqs', '{}') $$, '42501', null, 'anon cannot call the reorder function');
select throws_ok($$ select private.bootstrap_owner('owner@example.test') $$, '42501', null, 'anon cannot reach private functions');

-- 6. Private data stays private
select throws_ok($$ select * from public.admin_audit_log $$, '42501', null, 'anon cannot read the audit log');
select throws_ok($$ select * from public.site_owner $$, '42501', null, 'anon cannot read the owner row');
select throws_ok($$ select * from public.storage_cleanup_queue $$, '42501', null, 'anon cannot read the cleanup queue');

-- 5. A different authenticated user
select pg_temp.act_as('authenticated', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select throws_ok($$ insert into public.gallery_items (title, alt_text) values ('evil', 'evil') $$, '23503', null, 'a non-owner cannot create content');
select is((select count(*)::int from public.gallery_items), 1, 'a non-owner sees published items only');
select is((select count(*)::int from public.gallery_items where title = 'Draft'), 0, 'a non-owner cannot see the owner''s draft');
with u as (update public.gallery_items set title = 'HACKED' returning id) select is((select count(*)::int from u), 0, 'a non-owner cannot edit the owner''s items');
with d as (delete from public.gallery_items returning id) select is((select count(*)::int from d), 0, 'a non-owner cannot delete the owner''s items');
with s as (update public.site_settings set brand_name = 'HACKED' returning owner_id) select is((select count(*)::int from s), 0, 'a non-owner cannot edit the owner''s settings');
select is((select count(*)::int from public.site_owner), 0, 'a non-owner cannot see the owner row');
select is((select count(*)::int from public.admin_audit_log), 0, 'a non-owner sees no audit entries');
select throws_ok($$ insert into public.admin_audit_log (action, entity_type) values ('create', 'x') $$, '42501', null, 'nobody can forge audit entries');

-- Storage policies
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('site-media', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/hero/x.png') $$, '42501', null, 'a non-owner cannot store files even in a folder named after themselves');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('site-media', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/hero/x.png') $$, '42501', null, 'a non-owner cannot store files in the owner''s folder');

-- 4. The owner
select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select is((select count(*)::int from public.gallery_items), 2, 'the owner sees published items and drafts');
select lives_ok($$ update public.site_settings set instagram_url = 'https://www.instagram.com/hyrum' $$, 'the owner can update settings');
select throws_ok($$ update public.site_settings set instagram_url = 'http://insecure.example' $$, '23514', null, 'the database rejects an invalid social link');
select lives_ok($$ select public.reorder_content('gallery_items', array['22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111']::uuid[]) $$, 'the owner can reorder');
select throws_ok($$ insert into public.admin_audit_log (action, entity_type) values ('create', 'x') $$, '42501', null, 'the owner cannot forge audit entries either');
select throws_ok($$ delete from public.admin_audit_log $$, '42501', null, 'the owner cannot erase the audit log');
select cmp_ok((select count(*)::int from public.admin_audit_log), '>', 0, 'the owner can read their audit history');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('site-media', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/hero/ok.png') $$, 'the owner can store a file in their own folder');

select * from finish();
rollback;
