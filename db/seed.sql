-- =========================================================================
-- Game Time Wizard — Seed data
-- Default comm message templates for a new club.
-- Substitute :club_id with the actual club UUID after club creation.
-- =========================================================================

-- Tokens supported by the comm template renderer (frontend handles substitution):
--   {{team_name}}      e.g. "U14 Boys Black"
--   {{game_date}}      e.g. "Sat 3 May 2026"
--   {{game_time}}      e.g. "9:30 AM"
--   {{venue}}          e.g. "Auchenflower Stadium"
--   {{court}}          e.g. "Court 2"
--   {{opposition}}     e.g. "Brisbane Lightning"
--   {{duty_family}}    e.g. "The Lu Family"
--   {{rotation_chart}} multi-line rotation chart (only in game_day_notice)
--   {{available_count}} integer
--   {{unconfirmed_list}} bullet list of player names yet to confirm

insert into comm_templates (club_id, message_type, template) values
(:club_id, 'availability_request',
$tpl$🏀 {{team_name}} — Game this week

{{game_date}} vs {{opposition}}

Please confirm your child's availability by reply 👍 (available) / 👎 (unavailable) / 🤕 (injured) by tomorrow night.

Thanks!$tpl$
),

(:club_id, 'logistics_reminder',
$tpl$🏀 {{team_name}} — Game day reminder

📅 {{game_date}}
⏰ {{game_time}}
📍 {{venue}} — {{court}}
🆚 {{opposition}}

🪑 Bench duty: {{duty_family}}

Please arrive 20 min before tip-off.$tpl$
),

(:club_id, 'game_day_notice',
$tpl$🏀 {{team_name}} — Game day!

⏰ {{game_time}} @ {{venue}} {{court}}
🆚 {{opposition}}

Available: {{available_count}} players
🪑 Bench duty: {{duty_family}}

Rotation:
{{rotation_chart}}

Let's go! 🔥$tpl$
);
