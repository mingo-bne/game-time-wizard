-- =========================================================================
-- Game Time Wizard — Migration for Step 3 (Settings + Teams + Assignments)
-- Run this in Supabase SQL Editor AFTER you've already run schema.sql + rls.sql.
-- =========================================================================
--
-- What this does:
--   1. Lets admins pre-add staff records BEFORE the person signs up
--      (staff.user_id becomes nullable, called a "pending" staff record)
--   2. Adds an automatic trigger that links pending staff to the real
--      auth user once they magic-link in for the first time
--   3. Adds invited_at / attached_at timestamps for tracking
--
-- =========================================================================

-- 1. Make staff.user_id nullable so we can create "pending" staff rows
alter table staff alter column user_id drop not null;

-- 2. Add tracking timestamps
alter table staff add column if not exists invited_at  timestamptz;
alter table staff add column if not exists attached_at timestamptz;

-- 3. Trigger function: when a new auth user signs up, attach them to any
--    pending staff record where the email matches (case-insensitive)
create or replace function auto_attach_staff_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update staff
     set user_id = new.id,
         attached_at = now()
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end $$;

-- 4. Drop the trigger if it already exists (safe re-run), then create
drop trigger if exists trg_attach_staff on auth.users;

create trigger trg_attach_staff
  after insert on auth.users
  for each row
  execute function auto_attach_staff_on_signup();

-- =========================================================================
-- Done. Verify with:
--   select column_name, is_nullable from information_schema.columns
--    where table_name = 'staff' and column_name in ('user_id','invited_at','attached_at');
--   -- should show user_id NULLABLE, invited_at NULLABLE, attached_at NULLABLE
-- =========================================================================
