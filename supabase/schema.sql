-- ════════════════════════════════════════════════════════════════
-- SETU — SIH26043 Portal · Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- Takes ~10 seconds. Creates every table, policy and the seed data.
-- ════════════════════════════════════════════════════════════════

-- enable the vector extension (for dedup embeddings)
create extension if not exists vector;

-- ─── users ───
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text unique,
  phone text,
  role text not null check (role in ('citizen','university','industry','admin')),
  institution_name text,
  domain_expertise text[] default '{}',
  focus_areas text[] default '{}',
  created_at timestamptz default now()
);

-- ─── problems ───
create table if not exists problems (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references users(id) on delete cascade,
  title text not null,
  description text not null,
  category text default 'other',
  latitude double precision,
  longitude double precision,
  district text,
  photo_url text,
  status text default 'submitted' check (status in ('submitted','routed','in_review','proposal_submitted','in_progress','resolved')),
  priority_score double precision default 0,
  embedding vector(768),
  duplicate_of uuid references problems(id),
  routed_to uuid references users(id),
  created_at timestamptz default now()
);

-- ─── proposals ───
create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid references problems(id) on delete cascade,
  university_id uuid references users(id) on delete cascade,
  team_members text[] default '{}',
  proposal_text text,
  funding_sought double precision default 0,
  status text default 'draft' check (status in ('draft','submitted','approved','rejected')),
  created_at timestamptz default now()
);

-- ─── industry_interest ───
create table if not exists industry_interest (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references proposals(id) on delete cascade,
  industry_id uuid references users(id) on delete cascade,
  interest_type text check (interest_type in ('funding','mentorship','both')),
  message text,
  created_at timestamptz default now()
);

-- ─── problem_votes ───
create table if not exists problem_votes (
  problem_id uuid references problems(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (problem_id, user_id)
);

-- ─── notifications (simulated SMS/email log) ───
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  send_to text,
  channel text check (channel in ('SMS','Email','In-app')),
  text text,
  sim boolean default true,
  created_at timestamptz default now()
);

-- votes count helper
create or replace function problem_vote_count(p uuid) returns int language sql as $$
  select count(*)::int from problem_votes where problem_id = p;
$$;

-- ─── RLS policies (portal is read-heavy; writes are gated by app) ───
alter table users enable row level security;
alter table problems enable row level security;
alter table proposals enable row level security;
alter table industry_interest enable row level security;
alter table problem_votes enable row level security;
alter table notifications enable row level security;

-- public read (demo/pilot posture; tighten for production)
create policy "read users" on users for select using (true);
create policy "users update own profile" on users for update using (auth.uid() = auth_id);
create policy "users insert own profile" on users for insert with check (auth.uid() = auth_id);
create policy "read problems" on problems for select using (true);
create policy "read proposals" on proposals for select using (true);
create policy "read interest" on industry_interest for select using (true);
create policy "read votes" on problem_votes for select using (true);
create policy "read notifs" on notifications for select using (auth.role() = 'authenticated');

-- performance indexes
create index if not exists idx_problems_district on problems (district);
create index if not exists idx_problems_status on problems (status);
create index if not exists idx_problems_category on problems (category);
create index if not exists idx_problems_routed_to on problems (routed_to);
create index if not exists idx_proposals_problem_id on proposals (problem_id);
create index if not exists idx_industry_interest_proposal_id on industry_interest (proposal_id);
create index if not exists idx_problem_votes_user_id on problem_votes (user_id);

-- ════════════════════════════════════════════════════════════════
-- SEED DATA — demo accounts & 24 realistic Jharkhand problems
-- Password for every demo account: setu1234
-- (Hackathon demo only. Production uses Supabase Auth signup.)
-- ════════════════════════════════════════════════════════════════

-- demo user profiles (auth.users are created by the app signup or SQL below)
insert into users (id, name, email, role, institution_name, domain_expertise) values
  ('00000000-0000-4000-a000-000000000001','Priya Kumari','priya@demo.setu','citizen',null,null),
  ('00000000-0000-4000-a000-000000000002','Mohan Hansda','mohan@demo.setu','citizen',null,null),
  ('00000000-0000-4000-a000-000000000003','Answari Devi','answari@demo.setu','citizen',null,null),
  ('00000000-0000-4000-a000-000000000004','Ranchi University','dean.ranchi@demo.setu','university','Ranchi University','{education,health,environment}'),
  ('00000000-0000-4000-a000-000000000005','BIT Mesra','hod.civil@demo.setu','university','BIT Mesra','{infrastructure,water,environment}'),
  ('00000000-0000-4000-a000-000000000006','IIT (ISM) Dhanbad','hod.mining@demo.setu','university','IIT (ISM) Dhanbad','{infrastructure,environment,other}'),
  ('00000000-0000-4000-a000-000000000007','NIT Jamshedpur','hod.ee@demo.setu','university','NIT Jamshedpur','{infrastructure,education}'),
  ('00000000-0000-4000-a000-000000000008','Central Univ. of Jharkhand','hod.che@demo.setu','university','Central Univ. of Jharkhand','{water,agriculture,health}'),
  ('00000000-0000-4000-a000-000000000009','Sidho-Kanho Murmu Univ.','registrar@demo.setu','university','Sidho-Kanho Murmu University','{education,agriculture}'),
  ('00000000-0000-4000-a000-000000000010','Tata Steel Foundation','csr@tatasf.setu','industry','Tata Steel Foundation',null),
  ('00000000-0000-4000-a000-000000000011','Central Coalfields Ltd.','csr.ccl@demo.setu','industry','Central Coalfields Ltd.',null),
  ('00000000-0000-4000-a000-000000000012','Hindalco CSR Trust','csr.hindalco@demo.setu','industry','Hindalco CSR Trust',null),
  ('00000000-0000-4000-a000-000000000013','Dept. of IT, GoJ','admin@demo.setu','admin','Department of IT, Govt. of Jharkhand',null)
on conflict (id) do nothing;

-- focus areas for industry
update users set focus_areas='{water,education,health}' where id='00000000-0000-4000-a000-000000000010';
update users set focus_areas='{environment,infrastructure}' where id='00000000-0000-4000-a000-000000000011';
update users set focus_areas='{agriculture,environment}' where id='00000000-0000-4000-a000-000000000012';

-- ─── 24 seed problems ───
insert into problems (id, submitted_by, title, description, category, latitude, longitude, district, status, priority_score, routed_to, created_at) values
  ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000001','Hand pump broken near Angara block school for 3 weeks','The only hand pump serving Angara village primary school and 40 households has been dry and broken for three weeks. Children carry water from 1.5km away. Urgent repair needed.','water',23.43,85.33,'Ranchi','in_progress',7.8,'00000000-0000-4000-a000-000000000008',now() - interval '26 days'),
  ('00000000-0000-4000-b000-000000000002','00000000-0000-4000-a000-000000000002','No science teacher at Govt middle school, Kathikund','Kathikund block middle school has had no science or mathematics teacher for two academic terms. 180 students affected.','education',24.35,87.33,'Dumka','proposal_submitted',6.9,'00000000-0000-4000-a000-000000000009',now() - interval '41 days'),
  ('00000000-0000-4000-b000-000000000003','00000000-0000-4000-a000-000000000003','Mine-spoiled land blocking irrigation channel in Giridih','Overburden from abandoned mine has blocked the seasonal channel irrigating 120 acres. Farmers request land-remediation plan.','agriculture',24.18,86.30,'Giridih','routed',6.4,'00000000-0000-4000-a000-000000000008',now() - interval '12 days'),
  ('00000000-0000-4000-b000-000000000004','00000000-0000-4000-a000-000000000001','Village road washed out at Chandwa stretch, potholes everywhere','The 4km village road connecting Chandwa to the state highway has deep potholes and one culvert is washed out. Ambulance could not reach a delivery case last month.','infrastructure',23.63,85.06,'Ranchi','in_review',8.9,'00000000-0000-4000-a000-000000000005',now() - interval '19 days'),
  ('00000000-0000-4000-b000-000000000005','00000000-0000-4000-a000-000000000002','PHC at Gopikandar has no doctor, only pharmacist','Primary Health Centre serving 22 villages has no MBBS doctor for 7 months. Pregnant women travel 38km to Dumka for checkups.','health',24.28,87.20,'Dumka','proposal_submitted',9.2,'00000000-0000-4000-a000-000000000004',now() - interval '48 days'),
  ('00000000-0000-4000-b000-000000000006','00000000-0000-4000-a000-000000000003','Arsenic in tube well water, Bengabad block','Water from three tube wells tastes metallic and several families report stomach illness. Suspected arsenic contamination.','water',24.31,86.15,'Giridih','in_progress',8.4,'00000000-0000-4000-a000-000000000008',now() - interval '33 days'),
  ('00000000-0000-4000-b000-000000000007','00000000-0000-4000-a000-000000000001','No street lights on Hatia station approach road','The 800m approach to Hatia railway station is pitch dark after 7pm. Women commuters report harassment.','infrastructure',23.30,85.31,'Ranchi','routed',5.9,'00000000-0000-4000-a000-000000000005',now() - interval '9 days'),
  ('00000000-0000-4000-b000-000000000008','00000000-0000-4000-a000-000000000002','Mica mine dust causing breathing illness in children','Abandoned mica processing sites leave dust clouds over two villages. Children report chronic cough.','environment',24.05,86.55,'Koderma','routed',7.1,'00000000-0000-4000-a000-000000000006',now() - interval '15 days'),
  ('00000000-0000-4000-b000-000000000009','00000000-0000-4000-a000-000000000003','Anganwadi building roof collapsed, kids shifted to veranda','The anganwadi centre roof partially collapsed in monsoon. 30 children under 6 now sit in the open veranda.','education',23.98,85.60,'Bokaro','in_review',8.1,'00000000-0000-4000-a000-000000000007',now() - interval '11 days'),
  ('00000000-0000-4000-b000-000000000010','00000000-0000-4000-a000-000000000001','Damodar flood embankment breach near Chas','Embankment breach flooded 300 homes last season. Temporary mud repair will not survive next monsoon.','infrastructure',23.66,86.18,'Bokaro','resolved',8.6,'00000000-0000-4000-a000-000000000005',now() - interval '64 days'),
  ('00000000-0000-4000-b000-000000000011','00000000-0000-4000-a000-000000000002','Mobile network dead zone across 6 villages, Masalia','No mobile connectivity across six villages. Students cannot attend online classes and emergencies cannot call 108.','other',24.15,87.05,'Dumka','proposal_submitted',7.6,'00000000-0000-4000-a000-000000000007',now() - interval '37 days'),
  ('00000000-0000-4000-b000-000000000012','00000000-0000-4000-a000-000000000003','Sagardih lake weed bloom killing fish catch','Water hyacinth covers 70% of Sagardih lake. Fisher families catch down 80%.','environment',24.50,86.98,'Deoghar','in_review',6.2,'00000000-0000-4000-a000-000000000004',now() - interval '14 days'),
  ('00000000-0000-4000-b000-000000000013','00000000-0000-4000-a000-000000000001','Savitri Bai girls school has no functioning toilets','Girls school toilets non-functional for 5 months. Attendance of adolescent girls dropped 40%.','education',22.80,86.20,'East Singhbhum','resolved',8.2,'00000000-0000-4000-a000-000000000004',now() - interval '52 days'),
  ('00000000-0000-4000-b000-000000000014','00000000-0000-4000-a000-000000000002','Paddy seed distribution delayed, sowing window closing','Distribution of drought-tolerant paddy seed was delayed 3 weeks; sowing window closes in 10 days.','agriculture',23.90,84.50,'Palamu','routed',7.4,'00000000-0000-4000-a000-000000000008',now() - interval '8 days'),
  ('00000000-0000-4000-b000-000000000015','00000000-0000-4000-a000-000000000003','Chronic kidney disease cluster in Bermo villages','Eleven cases of kidney disease in 2 years near industrial belt, suspected water contamination.','health',23.78,86.30,'Bokaro','in_review',9.0,'00000000-0000-4000-a000-000000000004',now() - interval '21 days'),
  ('00000000-0000-4000-b000-000000000016','00000000-0000-4000-a000-000000000001','Community pond in Khunti drying, no desilting for years','The only community pond has shrunk 40% due to silt. Livestock and households compete for water.','water',23.07,85.28,'Khunti','resolved',6.7,'00000000-0000-4000-a000-000000000008',now() - interval '58 days'),
  ('00000000-0000-4000-b000-000000000017','00000000-0000-4000-a000-000000000002','Elephant corridor conflict, crops destroyed in Sarjambad','Herds cross fields nightly during harvest; 60% of standing paddy lost in two villages.','environment',22.85,85.90,'Seraikela-Kharsawan','proposal_submitted',7.2,'00000000-0000-4000-a000-000000000004',now() - interval '29 days'),
  ('00000000-0000-4000-b000-000000000018','00000000-0000-4000-a000-000000000003','ITI Dhanbad has obsolete equipment, no placements','ITI workshops have 15-year-old machines; local employers skip campus drives.','education',23.80,86.43,'Dhanbad','routed',5.8,'00000000-0000-4000-a000-000000000006',now() - interval '10 days'),
  ('00000000-0000-4000-b000-000000000019','00000000-0000-4000-a000-000000000001','Sewage drain overflowing into Tolly line, Jamshedpur','Open drain overflows into the street and storm drain every monsoon.','infrastructure',22.79,86.19,'East Singhbhum','in_progress',7.9,'00000000-0000-4000-a000-000000000007',now() - interval '31 days'),
  ('00000000-0000-4000-b000-000000000020','00000000-0000-4000-a000-000000000002','Tribal language kids fail in Hindi-medium classrooms','Santali-speaking children in 9 primary schools struggle in Hindi-medium classes.','education',24.68,87.97,'Sahibganj','in_review',7.0,'00000000-0000-4000-a000-000000000009',now() - interval '17 days'),
  ('00000000-0000-4000-b000-000000000021','00000000-0000-4000-a000-000000000003','Check dam cracked at Tori, irrigation at risk','Main check dam wall shows structural crack; if it fails 400 acres lose irrigation.','agriculture',23.75,84.40,'Latehar','resolved',7.5,'00000000-0000-4000-a000-000000000008',now() - interval '46 days'),
  ('00000000-0000-4000-b000-000000000022','00000000-0000-4000-a000-000000000001','Anganwadi midday meal supply irregular, Godda','Ration supply to 14 anganwadis has been irregular for 2 months; children get meals 3 days a week.','health',24.83,87.20,'Godda','proposal_submitted',7.7,'00000000-0000-4000-a000-000000000004',now() - interval '27 days'),
  ('00000000-0000-4000-b000-000000000023','00000000-0000-4000-a000-000000000002','No waste collection in Pakur town wards','No door-to-door waste collection in 4 wards; open dumping near the drain.','environment',25.04,87.85,'Pakur','routed',5.4,'00000000-0000-4000-a000-000000000006',now() - interval '6 days'),
  ('00000000-0000-4000-b000-000000000024','00000000-0000-4000-a000-000000000003','High dropout after class 8, girls in Simdega','42 girls dropped out post class-8 in one block — distance to high school plus safety concerns.','education',22.62,84.51,'Simdega','in_review',6.6,'00000000-0000-4000-a000-000000000009',now() - interval '13 days')
on conflict (id) do nothing;

-- ─── seed proposals ───
insert into proposals (id, problem_id, university_id, team_members, proposal_text, funding_sought, status, created_at) values
  ('00000000-0000-4000-c000-000000000001','00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000008',array['Dr. S. Verma','A. Kisku (PhD)','R. Ojha (MTech)','S. Lakra (BSc-4)'],'Water audit + community repair cooperative: student-led pump-repair cell with spare-parts micro-warehouse; 3-week sprint to restore 12 pumps, train 8 local youth as jal mitras.',185000,'approved',now() - interval '23 days'),
  ('00000000-0000-4000-c000-000000000002','00000000-0000-4000-b000-000000000002','00000000-0000-4000-a000-000000000009',array['Prof. D. Murmu','T. Soren (MA-2)','B. Hembram (BEd)'],'Bridge-teaching fellowship: 12 BEd fellows teach science/math 3 days a week with bilingual Santali-Hindi aids; community classroom in panchayat bhavan.',96000,'submitted',now() - interval '33 days'),
  ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-b000-000000000005','00000000-0000-4000-a000-000000000004',array['Dr. N. Bhushan','P. Aind (MBBS intern)','K. Toppo (MSW)'],'Mobile health unit rotation + teleconsult hub: weekly MHU staffed by RU medical cell; teleconsult kiosk at PHC; ASHA referral protocol.',640000,'submitted',now() - interval '41 days'),
  ('00000000-0000-4000-c000-000000000004','00000000-0000-4000-b000-000000000006','00000000-0000-4000-a000-000000000008',array['Dr. R. Chowdhury','M. Mahto (MSc-2)'],'Arsenic mapping + household filters: test 240 tube wells, GIS heatmap, install 120 biosand filters, train 20 women as water-quality monitors.',390000,'approved',now() - interval '29 days'),
  ('00000000-0000-4000-c000-000000000005','00000000-0000-4000-b000-000000000010','00000000-0000-4000-a000-000000000005',array['Prof. A. Iqbal','S. Ranjan (BTech-3)','V. Prasad (BTech-3)'],'Engineered embankment redesign: geotextile-reinforced earthen bund with gabion toe, community flood-drill, real-time gauge sensor linked to panchayat siren.',1250000,'approved',now() - interval '57 days'),
  ('00000000-0000-4000-c000-000000000006','00000000-0000-4000-b000-000000000013','00000000-0000-4000-a000-000000000004',array['Prof. S. Lakra','G. Hansda (BArch-4)'],'Sanitation block rebuild + menstrual health program: low-cost pour-flush design, WASH curriculum, girls health committee.',310000,'approved',now() - interval '47 days'),
  ('00000000-0000-4000-c000-000000000007','00000000-0000-4000-b000-000000000017','00000000-0000-4000-a000-000000000004',array['Dr. F. Baiga','J. Munda (MSc Env-2)','A. Purty (BSc-3)'],'Solar fencing cooperative + early warning: 3.2km demo fencing, SMS/whistle alert volunteer network calibrated with forest dept data.',540000,'submitted',now() - interval '25 days'),
  ('00000000-0000-4000-c000-000000000008','00000000-0000-4000-b000-000000000022','00000000-0000-4000-a000-000000000004',array['Dr. U. Khatri','S. Devi (MSW-2)'],'SHG kitchen + ration cooperatives: local women SHGs supply hot meals with district menu norms; delivery rota via anganwadi helpers.',220000,'approved',now() - interval '24 days'),
  ('00000000-0000-4000-c000-000000000009','00000000-0000-4000-b000-000000000011','00000000-0000-4000-a000-000000000007',array['Prof. B. Singh','H. Kumar (BTech-4)','L. Mahato (BTech-4)'],'Solar mesh community wifi: 6 villages covered by 4 pole-mounted mesh nodes + offline content server for classes.',480000,'submitted',now() - interval '35 days'),
  ('00000000-0000-4000-c000-000000000010','00000000-0000-4000-b000-000000000016','00000000-0000-4000-a000-000000000008',array['Dr. P. Tirkey','N. Kachhap (MSc-2)'],'MGNREGA-linked desilting plan: hydro-survey, work-order packaging for monsoon window, silt-to-compost micro-enterprise.',150000,'approved',now() - interval '50 days')
on conflict (id) do nothing;

-- ─── seed industry interest ───
insert into industry_interest (id, proposal_id, industry_id, interest_type, message, created_at) values
  ('00000000-0000-4000-d000-000000000001','00000000-0000-4000-c000-000000000001','00000000-0000-4000-a000-000000000010','funding','Full funding of ₹1.85L under Jal Jeevan community program + maintenance toolkits.',now() - interval '22 days'),
  ('00000000-0000-4000-d000-000000000002','00000000-0000-4000-c000-000000000003','00000000-0000-4000-a000-000000000010','both','Mobile Health Unit funding + volunteer doctors from our plant medical centre.',now() - interval '39 days'),
  ('00000000-0000-4000-d000-000000000003','00000000-0000-4000-c000-000000000005','00000000-0000-4000-a000-000000000011','funding','CCL CSR will co-fund embankment works with DMFT; request survey visit.',now() - interval '55 days'),
  ('00000000-0000-4000-d000-000000000004','00000000-0000-4000-c000-000000000007','00000000-0000-4000-a000-000000000012','mentorship','Field safety mentors + supply of demo fencing material at cost.',now() - interval '24 days'),
  ('00000000-0000-4000-d000-000000000005','00000000-0000-4000-c000-000000000004','00000000-0000-4000-a000-000000000010','funding','Water-quality testing lab sponsorship and 120 filters via CSR.',now() - interval '28 days'),
  ('00000000-0000-4000-d000-000000000006','00000000-0000-4000-c000-000000000009','00000000-0000-4000-a000-000000000011','funding','PSU CSR broadband budget available; share BoQ for 6-village mesh.',now() - interval '34 days'),
  ('00000000-0000-4000-d000-000000000007','00000000-0000-4000-c000-000000000010','00000000-0000-4000-a000-000000000012','funding','Happy to fund compost unit as part of agri-livelihood portfolio.',now() - interval '49 days')
on conflict (id) do nothing;

-- ─── seed votes (tens of votes on popular problems) ───
insert into problem_votes (problem_id, user_id, created_at)
select p.id, '00000000-0000-4000-a000-000000000001', now() - interval '5 days'
from problems p where p.id in ('00000000-0000-4000-b000-000000000004','00000000-0000-4000-b000-000000000005','00000000-0000-4000-b000-000000000010')
on conflict do nothing;

-- votes materialised as count column for demo simplicity
alter table problems add column if not exists demo_votes int default 0;
update problems set demo_votes = case id
  when '00000000-0000-4000-b000-000000000001' then 33
  when '00000000-0000-4000-b000-000000000004' then 51
  when '00000000-0000-4000-b000-000000000005' then 60
  when '00000000-0000-4000-b000-000000000010' then 73
  when '00000000-0000-4000-b000-000000000013' then 43
  when '00000000-0000-4000-b000-000000000006' then 28
  when '00000000-0000-4000-b000-000000000019' then 40
  when '00000000-0000-4000-b000-000000000015' then 37
  when '00000000-0000-4000-b000-000000000017' then 32
  when '00000000-0000-4000-b000-000000000011' then 30
  else 10 + (abs(hashtext(id::text)) % 20)
end;

create or replace view problems_with_votes as
select p.*, (select count(*) from problem_votes v where v.problem_id = p.id) + p.demo_votes as votes
from problems p;

-- ─── photo storage (problem photos: public bucket, authed uploads) ───
-- If your Supabase project rejects these two policies (rare), create the
-- bucket + policies from Dashboard → Storage → policies instead.
insert into storage.buckets (id, name, public)
values ('problems', 'problems', true)
on conflict (id) do nothing;

create policy "problem photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'problems');

create policy "authenticated users can upload problem photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'problems');
