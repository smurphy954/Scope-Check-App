-- Phase 2 prep: jobs queue used by the background worker on Render.
-- Producer: server actions / API routes (web service) using the service role.
-- Consumer: scope-check-worker process (calls claim_next_job).

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  result jsonb,
  project_id uuid references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists jobs_claim_idx
  on public.jobs (run_after) where status = 'queued';
create index if not exists jobs_kind_idx on public.jobs (kind);
create index if not exists jobs_project_idx on public.jobs (project_id);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Lock down: jobs are server-managed. RLS on with no policies = service role only.
alter table public.jobs enable row level security;

------------------------------------------------------------------------
-- claim_next_job: atomically grab one queued job using FOR UPDATE SKIP
-- LOCKED so multiple workers never claim the same row. Optional kind
-- filter lets specialised workers subscribe to specific job kinds.
------------------------------------------------------------------------
create or replace function public.claim_next_job(
  worker_id text,
  job_kinds text[] default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.jobs;
begin
  with next_job as (
    select id from public.jobs
     where status = 'queued'
       and run_after <= now()
       and (job_kinds is null or kind = any(job_kinds))
     order by run_after asc, created_at asc
     for update skip locked
     limit 1
  )
  update public.jobs j
     set status = 'running',
         locked_at = now(),
         locked_by = worker_id,
         attempts = j.attempts + 1
    from next_job
   where j.id = next_job.id
  returning j.* into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_next_job(text, text[]) from public;
revoke all on function public.claim_next_job(text, text[]) from anon;
revoke all on function public.claim_next_job(text, text[]) from authenticated;
grant execute on function public.claim_next_job(text, text[]) to service_role;

------------------------------------------------------------------------
-- release_stuck_jobs: return jobs that have been "running" longer than
-- the threshold back to "queued" so a healthy worker can pick them up.
-- Call this on a schedule (Supabase pg_cron or a periodic job in the
-- worker itself) once we have real job kinds in Phase 2.
------------------------------------------------------------------------
create or replace function public.release_stuck_jobs(stuck_after_seconds int default 600)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  released int;
begin
  update public.jobs
     set status = 'queued',
         locked_at = null,
         locked_by = null,
         last_error = coalesce(last_error || ' | ', '')
                     || 'auto-released after ' || stuck_after_seconds || 's stuck'
   where status = 'running'
     and locked_at < now() - (stuck_after_seconds || ' seconds')::interval;
  get diagnostics released = row_count;
  return released;
end;
$$;

revoke all on function public.release_stuck_jobs(int) from public;
revoke all on function public.release_stuck_jobs(int) from anon;
revoke all on function public.release_stuck_jobs(int) from authenticated;
grant execute on function public.release_stuck_jobs(int) to service_role;
