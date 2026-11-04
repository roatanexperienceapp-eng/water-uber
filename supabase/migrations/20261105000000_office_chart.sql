-- Office chart v2 (rolling windows like a price chart): 1H, 24H, 1W, 1M, 1Y, All.
-- Measures: bookings (count), people (riders / tour guests) or revenue (owner only).
-- Each service is returned as its own series so the page can show them together or split.
-- A booking counts at the time the service happens; unpaid checkouts and cancellations are left out.

create function public.office_chart(p_period text, p_metric text default 'count') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text := public.office_require(array['owner', 'manager', 'team']);
        tz text := 'America/Tegucigalpa';
        now_l timestamp := now() at time zone tz;
        first_ts timestamp; step interval; n int; unit text;
        out jsonb;
begin
  if p_metric not in ('count', 'people', 'revenue') then raise exception 'bad_metric' using errcode = '22023'; end if;
  if p_metric = 'revenue' and r <> 'owner' then raise exception 'office_forbidden' using errcode = '42501'; end if;

  if p_period = '1h' then step := interval '5 minutes'; n := 12; unit := 'minute';
    first_ts := date_trunc('hour', now_l) + floor(extract(minute from now_l) / 5) * interval '5 minutes' - (n - 1) * step;
  elsif p_period = '24h' then step := interval '1 hour'; n := 24; unit := 'hour'; first_ts := date_trunc('hour', now_l) - (n - 1) * step;
  elsif p_period = '1w' then step := interval '6 hours'; n := 28; unit := 'hour';
    first_ts := date_trunc('day', now_l) + floor(extract(hour from now_l) / 6) * interval '6 hours' - (n - 1) * step;
  elsif p_period = '1m' then step := interval '1 day'; n := 30; unit := 'day'; first_ts := date_trunc('day', now_l) - (n - 1) * step;
  elsif p_period = '1y' then step := interval '1 week'; n := 52; unit := 'week'; first_ts := date_trunc('week', now_l) - (n - 1) * step;
  elsif p_period = 'all' then step := interval '1 month'; unit := 'month';
    first_ts := least(date_trunc('month', now_l) - interval '11 months', coalesce((select date_trunc('month', min(at)) from (
      select min(coalesce(scheduled_for, paid_at, created_at) at time zone tz) at from rides
      union all select min(coalesce(scheduled_for, paid_at, created_at) at time zone tz) from land_rides
      union all select min(trip_date::timestamp) from bookings) m), now_l));
    n := (extract(year from age(date_trunc('month', now_l), first_ts)) * 12 + extract(month from age(date_trunc('month', now_l), first_ts)))::int + 1;
  else raise exception 'bad_period' using errcode = '22023';
  end if;

  with events as (
    select 'water' as kind, (coalesce(x.scheduled_for, x.paid_at, x.created_at) at time zone tz) as at, x.riders as people, x.fare_usd as amount
      from rides x where r <> 'team' and x.status not in ('awaiting_payment', 'cancelled')
    union all
    select 'land', (coalesce(x.scheduled_for, x.paid_at, x.created_at) at time zone tz), x.riders, x.fare_usd
      from land_rides x where r <> 'team' and x.status not in ('awaiting_payment', 'cancelled')
    union all
    select 'tours', b.trip_date + make_time(
             case when b.trip_time ~ '^\d{1,2}:\d{2}' then least(split_part(b.trip_time, ':', 1)::int, 23) else 12 end,
             case when b.trip_time ~ '^\d{1,2}:\d{2}' then least(split_part(b.trip_time, ':', 2)::int, 59) else 0 end, 0),
           b.quantity, coalesce(b.total_usd, 0)
      from bookings b where b.status not in ('awaiting_payment', 'cancelled')
  ), measured as (
    select kind, at, case p_metric when 'count' then 1 when 'people' then people else amount end::numeric as v from events
  ), buckets as (
    select first_ts + (i * step) as start from generate_series(0, n - 1) i
  ), counted as (
    select k.start,
           coalesce(sum(m.v) filter (where m.kind = 'water'), 0) as water,
           coalesce(sum(m.v) filter (where m.kind = 'land'), 0) as land,
           coalesce(sum(m.v) filter (where m.kind = 'tours'), 0) as tours
      from buckets k left join measured m on m.at >= k.start and m.at < k.start + step
     group by k.start
  ), prev as (
    -- the same length of time just before, for the "up / down vs before" figure
    select coalesce(sum(v), 0) as total from measured
     where at >= first_ts - n * step and at < first_ts
  )
  select jsonb_build_object(
    'period', p_period, 'metric', p_metric, 'unit', unit, 'role', r,
    'series', case when r = 'team' then '["tours"]'::jsonb else '["water","land","tours"]'::jsonb end,
    'points', coalesce((select jsonb_agg(jsonb_build_object('start', to_char(start, 'YYYY-MM-DD"T"HH24:MI'),
                 'water', case when r = 'team' then null else water end,
                 'land', case when r = 'team' then null else land end,
                 'tours', tours) order by start) from counted), '[]'::jsonb),
    'prev_total', case when p_period = 'all' then null else (select total from prev) end
  ) into out;
  return out;
end $$;
grant execute on function public.office_chart(text, text) to authenticated;
