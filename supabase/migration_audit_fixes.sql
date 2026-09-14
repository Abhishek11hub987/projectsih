-- ════════════════════════════════════════════════════════════════
-- SETU — Incremental Migration for Audit Fixes
-- Run this in Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- 1. Allow users to insert and update their own profile
drop policy if exists "users update own profile" on users;
create policy "users update own profile" on users
  for update
  using (auth.uid() = auth_id);

drop policy if exists "users insert own profile" on users;
create policy "users insert own profile" on users
  for insert
  with check (auth.uid() = auth_id);

-- 2. Restrict notification reading to authenticated users only
drop policy if exists "read notifs" on notifications;
create policy "read notifs" on notifications
  for select
  using (auth.role() = 'authenticated');

-- 3. Performance indexes for frequent queries
create index if not exists idx_problems_district on problems (district);
create index if not exists idx_problems_status on problems (status);
create index if not exists idx_problems_category on problems (category);
create index if not exists idx_problems_routed_to on problems (routed_to);
create index if not exists idx_proposals_problem_id on proposals (problem_id);
create index if not exists idx_industry_interest_proposal_id on industry_interest (proposal_id);
create index if not exists idx_problem_votes_user_id on problem_votes (user_id);
