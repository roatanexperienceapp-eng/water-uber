-- Ride passes are now sold by group size (owner prices): week2…week12 and twoWeek2…twoWeek12.
-- Old pass names stay valid so any pass already sold keeps working.
alter table public.guest_passes drop constraint if exists guest_passes_pass_type_check;
alter table public.guest_passes add constraint guest_passes_pass_type_check check (
  pass_type ~ '^(week|twoWeek)(2|4|6|8|10|12)$' or pass_type in ('week', 'twoWeek', 'tenPack', 'family')
);
