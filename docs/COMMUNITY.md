# Travel talk, Marine life and Reviews (Trips tab)

## What guests can do
- **Travel talk** (`/community`): ask other visitors, post a photo, a video (≤ 30 s, ≤ 30 MB) or an https link; reply one level deep.
- **Marine life** (`/marine`): scan a photo (AI best guess + our own safety notes), and the **Sightings** wall
  (photo + where: Blue Channel, Spooky Channel… + what).
- **Your review** (`/feedback`): stars + love / idea / confusing / bug. **Private**: only the team reads it.

## Moderation (Apple App Review 1.2 requires all of this — it's built in)
- Guests must pick a name and **agree to the rules** before posting. Names like "Water Uber", "admin", "staff" are refused.
- **Word filter**: `community_blocklist` table (English + Spanish to start). Add words in the Supabase dashboard.
- **Report**: ⋯ on any post. **3 reports hide the post** until you look (`community_settings.hide_after_reports`).
- **Block**: hides that person's posts for the guest who blocked them.
- **Limit**: 20 posts per person per day (`community_settings.max_posts_per_day`).
- Account deletion removes the guest's posts, photos and feedback.

### Daily check (5 minutes)
```sql
-- reported posts waiting for you
select p.id, p.author_name, p.body, p.hidden, count(r.*) reports
from community_posts p join community_reports r on r.post_id = p.id
group by p.id order by reports desc;
-- keep a post that was wrongly reported
update community_posts set hidden = false, hidden_reason = null where id = '<id>';
-- remove a post for good
delete from community_posts where id = '<id>';
-- new feedback
select created_at, rating, kind, body, screen from app_feedback order by created_at desc limit 50;
```
Apple expects you to act on reports **within 24 hours**.

## Fish scanner
- Edge function `identify-marine-life` (uses `ANTHROPIC_API_KEY`, same daily limit as Isla: `ASSISTANT_DAILY_LIMIT`).
  Model: `VISION_MODEL` (defaults to `ASSISTANT_MODEL`). Photos are shrunk on the phone and **not stored**.
- Safety notes (venomous spines, don't touch coral/turtles, don't feed…) come from our own table in
  `supabase/functions/_shared/marine.ts`, never from the AI.
- Cost: one scan ≈ one Isla message with an image [Guessing: about $0.002–0.01 per scan on a small model].

## Storage
Bucket `community` (public read, 30 MB max, images + mp4/mov). Guests can only upload into their own folder.
