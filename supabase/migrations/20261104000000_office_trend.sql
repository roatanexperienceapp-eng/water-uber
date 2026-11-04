-- Office chart: how many bookings happen on the island, by hour, day or month, split by service.
-- Counts only (no money), so owners, managers and team members can all see it. Team members see tours only.
-- A booking counts at the time the service happens (pickup or tour time), not when it was bought.
-- Unpaid checkouts and cancellations are left out; tour requests waiting for a price are counted (they are demand).

create function public.office_trend(p_period text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text := public.office_require(array['owner', 'manager', 'team']);
        tz text := 'America/Tegucigalpa';
        today date := (now() at time zone tz)::date;
        unit text; first_ts timestamp; last_ts timestamp; step interval;
        out jsonb;
begin
  if p_period = 'today' then unit := 'hour'; first_ts := today; last_ts := today + time '23:00'; step := interval '1 hour';
  elsif p_period = 'yesterday' then unit := 'hour'; first_ts := today - 1; last_ts := (today - 1) + time '23:00'; step := interval '1 hour';
  elsif p_period = 'week' then unit := 'day'; first_ts := today - 6; last_ts := today; step := interval '1 day';
  elsif p_period = 'month' then unit := 'day'; first_ts := today - 29; last_ts := today; step := interval '1 day';
  elsif p_period = 'year' then unit := 'month'; first_ts := date_trunc('month', today - interval '11 months'); last_ts := date_trunc('month', today); step := interval '1 month';
  else raise exception 'bad_period' using errcode = '22023';
  end if;

  with events as (
    -- island local time of each service
    select 'water' as kind, (coalesce(x.scheduled_for, x.paid_at, x.created_at) at time zone tz) as at
      from rides x where r <> 'team' and x.status not in ('awaiting_payment', 'cancelled')
    union all
    select 'land', (coalesce(x.scheduled_for, x.paid_at, x.created_at) at time zone tz)
      from land_rides x where r <> 'team' and x.status not in ('awaiting_payment', 'cancelled')
    union all
    select 'tours', b.trip_date + make_time(
             case when b.trip_time ~ '^\d{1,2}:\d{2}' then least(split_part(b.trip_time, ':', 1)::int, 23) else 12 end, 0, 0)
      from bookings b where b.status not in ('awaiting_payment', 'cancelled')
  ), buckets as (
    select g as start from generate_series(first_ts, last_ts, step) g
  ), counted as (
    select k.start,
           count(e.*) filter (where e.kind = 'water') as water,
           count(e.*) filter (where e.kind = 'land') as land,
           count(e.*) filter (where e.kind = 'tours') as tours
      from buckets k
      left join events e on e.at >= k.start and e.at < k.start + step
     group by k.start
  ), year_events as (
    select * from events where at >= (today - 364) and at < today + 1
  )
  select jsonb_build_object(
    'period', p_period, 'unit', unit, 'role', r,
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('start', to_char(start, 'YYYY-MM-DD"T"HH24:MI'),
                 'water', case when r = 'team' then null else water end,
                 'land', case when r = 'team' then null else land end,
                 'tours', tours) order by start) from counted), '[]'::jsonb),
    -- Over the last 12 months: which weekday and which hour are busiest (0 = Sunday).
    'busiest_weekday', (select extract(dow from at)::int from year_events group by 1 order by count(*) desc, 1 limit 1),
    'busiest_hour', (select extract(hour from at)::int from year_events group by 1 order by count(*) desc, 1 limit 1),
    'by_weekday', coalesce((select jsonb_agg(n order by d) from (
        select d, (select count(*) from year_events where extract(dow from at)::int = d) as n from generate_series(0, 6) d) w), '[]'::jsonb)
  ) into out;
  return out;
end $$;
grant execute on function public.office_trend(text) to authenticated;
