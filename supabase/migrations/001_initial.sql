-- SweatStake Initial Schema
-- Creates all core tables for the fitness competition platform

-- Enable necessary extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users with app-specific fields
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  display_name text,
  avatar_url text,
  stripe_customer_id text,
  wallet_address text,
  total_winnings numeric default 0,
  competitions_entered int default 0,
  competitions_won int default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'User'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- COMPETITIONS
-- Core competition/challenge entity
-- ============================================================
create table competitions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references profiles(id) on delete set null,
  name text not null,
  description text,
  type text check (type in ('fitness', 'running', 'cycling', 'lifting', 'custom')),
  scoring_template jsonb default '{"categories": []}'::jsonb,
  start_date date,
  end_date date,
  max_participants int default 50,
  entry_fee_cents int default 0,
  payment_type text default 'stripe' check (payment_type in ('stripe', 'usdc')),
  prize_pool_cents int default 0,
  service_fee_pct numeric default 10,
  is_public boolean default true,
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  status text default 'open' check (status in ('open', 'active', 'completed', 'cancelled')),
  winner_id uuid references profiles(id),
  created_at timestamptz default now()
);

alter table competitions enable row level security;

create policy "Public competitions are viewable by everyone"
  on competitions for select using (is_public = true or creator_id = auth.uid());

create policy "Authenticated users can create competitions"
  on competitions for insert with check (auth.uid() = creator_id);

create policy "Creators can update their own competitions"
  on competitions for update using (auth.uid() = creator_id);

-- Index for fast lookups
create index idx_competitions_status on competitions(status);
create index idx_competitions_invite_code on competitions(invite_code);
create index idx_competitions_creator on competitions(creator_id);

-- ============================================================
-- PARTICIPANTS
-- Junction table: users <-> competitions
-- ============================================================
create table participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  payment_intent_id text,
  paid boolean default false,
  total_points int default 0,
  current_streak int default 0,
  best_streak int default 0,
  rank int,
  unique(competition_id, user_id)
);

alter table participants enable row level security;

create policy "Participants viewable by competition members"
  on participants for select using (true);

create policy "Authenticated users can join competitions"
  on participants for insert with check (auth.uid() = user_id);

create policy "Users can update their own participation"
  on participants for update using (auth.uid() = user_id);

create index idx_participants_competition on participants(competition_id);
create index idx_participants_user on participants(user_id);

-- ============================================================
-- DAILY LOGS
-- One row per participant per day
-- ============================================================
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  log_date date not null,
  entries jsonb default '{}'::jsonb,
  points_earned int default 0,
  auto_synced boolean default false,
  created_at timestamptz default now(),
  unique(participant_id, log_date)
);

alter table daily_logs enable row level security;

create policy "Logs viewable by competition members"
  on daily_logs for select using (true);

create policy "Users can insert their own logs"
  on daily_logs for insert with check (
    auth.uid() = (select user_id from participants where id = participant_id)
  );

create policy "Users can update their own logs"
  on daily_logs for update using (
    auth.uid() = (select user_id from participants where id = participant_id)
  );

create index idx_daily_logs_participant on daily_logs(participant_id);
create index idx_daily_logs_date on daily_logs(log_date);

-- ============================================================
-- EXTRA CREDIT LOGS
-- Bonus points for progress photos, check-ins, etc.
-- ============================================================
create table extra_credit_logs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  credit_type text check (credit_type in ('progress_photo', 'check_in', 'community_vote')),
  metadata jsonb default '{}'::jsonb,
  awarded_at timestamptz default now()
);

alter table extra_credit_logs enable row level security;

create policy "Extra credit viewable by everyone"
  on extra_credit_logs for select using (true);

create policy "Users can insert their own extra credit"
  on extra_credit_logs for insert with check (
    auth.uid() = (select user_id from participants where id = participant_id)
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Recalculate rankings for a competition
create or replace function recalculate_rankings(comp_id uuid)
returns void as $$
begin
  with ranked as (
    select id, row_number() over (order by total_points desc, best_streak desc) as new_rank
    from participants
    where competition_id = comp_id
  )
  update participants p
  set rank = r.new_rank
  from ranked r
  where p.id = r.id;
end;
$$ language plpgsql security definer;

-- Update participant total points from daily logs
create or replace function update_participant_points()
returns trigger as $$
begin
  update participants
  set total_points = (
    select coalesce(sum(points_earned), 0)
    from daily_logs
    where participant_id = new.participant_id
  )
  where id = new.participant_id;

  -- Recalculate rankings for the competition
  perform recalculate_rankings(
    (select competition_id from participants where id = new.participant_id)
  );

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_daily_log_upsert
  after insert or update on daily_logs
  for each row execute function update_participant_points();

-- Update prize pool when participant joins
create or replace function update_prize_pool()
returns trigger as $$
begin
  if new.paid = true then
    update competitions
    set prize_pool_cents = (
      select count(*) * entry_fee_cents
      from participants
      where competition_id = new.competition_id and paid = true
    )
    where id = new.competition_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_participant_paid
  after insert or update of paid on participants
  for each row execute function update_prize_pool();
