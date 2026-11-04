-- Crash and error reports from the guest app, the captain/driver app and the office website.
-- Anyone can send a report (crashes happen before sign-in too), but only through log_app_error, which
-- trims every field and limits each device to 30 reports an hour. Nothing personal is stored besides
-- the signed-in account id, so the office can see whether one guest keeps hitting the same problem.
-- Only the owner and managers can read reports, through office_app_errors.

create table public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  app text not null check (app in ('guest', 'captain', 'office', 'web')),
  platform text not null check (length(platform) <= 20),
  app_version text check (length(app_version) <= 40),
  route text check (length(route) <= 200),
  kind text not null check (kind in ('crash', 'render', 'handled', 'promise')),
  message text not null check (length(message) <= 500),
  stack text check (length(stack) <= 4000),
  fingerprint text not null check (length(fingerprint) <= 80),
  device_id text not null check (length(device_id) between 6 and 64),
  user_id uuid references public.profiles (id)
);
create index app_errors_recent on public.app_errors (at desc);
create index app_errors_device_hour on public.app_errors (device_id, at desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

create function public.log_app_error(
  p_app text, p_platform text, p_app_version text, p_route text, p_kind text,
  p_message text, p_stack text, p_device_id text
) returns void
language plpgsql security definer set search_path = public as $$
declare msg text := left(coalesce(nullif(trim(p_message), ''), 'Unknown error'), 500);
        dev text := left(coalesce(p_device_id, ''), 64);
        k text := case when p_kind in ('crash', 'render', 'handled', 'promise') then p_kind else 'handled' end;
        a text := case when p_app in ('guest', 'captain', 'office', 'web') then p_app else 'web' end;
begin
  if length(dev) < 6 then return; end if;
  -- Flood guard: at most 30 reports per device per hour; extra reports are dropped quietly.
  if (select count(*) from app_errors where device_id = dev and at > now() - interval '1 hour') >= 30 then return; end if;
  insert into app_errors (app, platform, app_version, route, kind, message, stack, fingerprint, device_id, user_id)
  values (a, left(coalesce(p_platform, '?'), 20), left(p_app_version, 40), left(p_route, 200), k, msg, left(p_stack, 4000),
          -- the same message on the same screen counts as one problem; numbers and ids are blurred so they group
          left(md5(a || ':' || k || ':' || regexp_replace(msg, '[0-9a-f]{8,}|\d+', '#', 'g') || ':' || coalesce(regexp_replace(left(p_route, 200), '[0-9a-f-]{8,}|\d+', '#', 'g'), '')), 80),
          dev, (select id from profiles where id = auth.uid()));
end $$;
grant execute on function public.log_app_error(text, text, text, text, text, text, text, text) to anon, authenticated;

-- Office "App health": problems grouped, newest first, with how many times and how many devices.
create function public.office_app_errors(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 90));
begin
  perform public.office_require(array['owner', 'manager']);
  return jsonb_build_object(
    'days', least(greatest(p_days, 1), 90),
    'total', (select count(*) from app_errors where at >= since),
    'devices', (select count(distinct device_id) from app_errors where at >= since),
    'crashes', (select count(*) from app_errors where at >= since and kind in ('crash', 'render')),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d) from (
        select (at at time zone 'America/Tegucigalpa')::date d, count(*) n from app_errors where at >= since group by 1) x), '[]'::jsonb),
    'problems', coalesce((select jsonb_agg(row_to_json(t)::jsonb) from (
      select e.fingerprint, min(e.message) as message, min(e.app) as app, min(e.kind) as kind,
             count(*) as times, count(distinct e.device_id) as devices,
             max(e.at) as last_seen, min(e.at) as first_seen,
             string_agg(distinct e.platform, ', ') as platforms,
             (array_agg(e.route order by e.at desc))[1] as route,
             (array_agg(e.app_version order by e.at desc))[1] as app_version,
             (array_agg(e.stack order by e.at desc))[1] as stack
        from app_errors e where e.at >= since
       group by e.fingerprint order by max(e.at) desc limit 50) t), '[]'::jsonb));
end $$;
grant execute on function public.office_app_errors(int) to authenticated;
