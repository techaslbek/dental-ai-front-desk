-- consume_rate_limit / record_usage: server-only helpers. Rolled back.

begin;

insert into public.clinics (id, slug, name) values
  ('dddddddd-1111-4000-8000-000000000000', 'test-runtime-clinic', 'Runtime Test');

-- 1-2. Patients (anon) and staff (authenticated) cannot call either function.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform public.consume_rate_limit('test:anon', 5, 60);
    raise exception 'FAIL 1: anon called consume_rate_limit';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_usage('dddddddd-1111-4000-8000-000000000000', 1, 1, 1, 1);
    raise exception 'FAIL 1: anon called record_usage';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.consume_rate_limit('test:staff', 5, 60);
    raise exception 'FAIL 2: authenticated called consume_rate_limit';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_usage('dddddddd-1111-4000-8000-000000000000', 1, 1, 1, 1);
    raise exception 'FAIL 2: authenticated called record_usage';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 3-4. The server (service_role) is limited after N hits and usage adds up.
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  ok boolean;
  i integer;
  u record;
begin
  for i in 1..3 loop
    ok := public.consume_rate_limit('test:key', 3, 3600);
    if not ok then raise exception 'FAIL 3: hit % refused under the limit', i; end if;
  end loop;
  if public.consume_rate_limit('test:key', 3, 3600) then
    raise exception 'FAIL 3: 4th hit allowed over a limit of 3';
  end if;
  if not public.consume_rate_limit('test:other-key', 3, 3600) then
    raise exception 'FAIL 3: keys are not independent';
  end if;

  perform public.record_usage('dddddddd-1111-4000-8000-000000000000', 1, 2, 300, 40);
  perform public.record_usage('dddddddd-1111-4000-8000-000000000000', 0, 2, 500, 60);
  select * into u from public.usage_monthly where clinic_id = 'dddddddd-1111-4000-8000-000000000000';
  if u.conversations <> 1 or u.messages <> 4 or u.input_tokens <> 800 or u.output_tokens <> 100 then
    raise exception 'FAIL 4: usage not accumulated: %', row_to_json(u);
  end if;
end $$;

select 'chat_runtime: all 4 checks passed' as result;

rollback;
