-- Runtime helpers for the patient chat. Called only by server code with the
-- secret (service_role) key; anon and authenticated cannot execute them.

-- Fixed-window rate limit counters. Keys are opaque strings built by the
-- server (e.g. a salted hash of the client IP); no raw identifiers stored.
create table private.rate_limit_buckets (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table private.rate_limit_buckets enable row level security;
create index rate_limit_buckets_window_idx on private.rate_limit_buckets (window_start);

-- Counts one hit and returns true while the caller is within the limit.
create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_window_seconds < 1 or p_limit < 1 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limit_buckets (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
    do update set hits = private.rate_limit_buckets.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup keeps the table small without a scheduled job.
  if random() < 0.01 then
    delete from private.rate_limit_buckets where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- Adds to the clinic's usage for the current month (Tashkent time).
create function public.record_usage(
  p_clinic_id uuid,
  p_conversations integer,
  p_messages integer,
  p_input_tokens bigint,
  p_output_tokens bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.usage_monthly (clinic_id, month, conversations, messages, input_tokens, output_tokens)
  values (
    p_clinic_id,
    date_trunc('month', now() at time zone 'Asia/Tashkent')::date,
    greatest(p_conversations, 0),
    greatest(p_messages, 0),
    greatest(p_input_tokens, 0),
    greatest(p_output_tokens, 0)
  )
  on conflict (clinic_id, month) do update set
    conversations = public.usage_monthly.conversations + excluded.conversations,
    messages = public.usage_monthly.messages + excluded.messages,
    input_tokens = public.usage_monthly.input_tokens + excluded.input_tokens,
    output_tokens = public.usage_monthly.output_tokens + excluded.output_tokens;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.record_usage(uuid, integer, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.record_usage(uuid, integer, integer, bigint, bigint) to service_role;
