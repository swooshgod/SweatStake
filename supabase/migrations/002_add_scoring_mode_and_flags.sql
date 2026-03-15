-- Add scoring_mode, is_private, and requires_watch columns
-- These were added in the UX overhaul but missing from the DB schema.

alter table competitions
  add column if not exists scoring_mode text default 'relative_improvement'
    check (scoring_mode in (
      'relative_improvement', 'raw_steps', 'raw_miles',
      'raw_calories', 'raw_workouts', 'weight_loss'
    )),
  add column if not exists is_private boolean default false,
  add column if not exists requires_watch boolean default false;

-- Update RLS: private competitions visible to creator and participants
drop policy if exists "Public competitions are viewable by everyone" on competitions;

create policy "Competitions are viewable by public or participants"
  on competitions for select using (
    is_public = true
    or creator_id = auth.uid()
    or id in (select competition_id from participants where user_id = auth.uid())
  );
