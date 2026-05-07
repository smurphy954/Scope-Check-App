-- Phase 2a: documents + extracted findings + storage bucket.

------------------------------------------------------------------------
-- documents
------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  type text not null check (type in ('drawing', 'contract', 'submittal')),
  filename text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null,
  page_count int,
  extraction_status text not null default 'queued'
    check (extraction_status in ('queued', 'processing', 'ready', 'failed')),
  extraction_error text,
  extraction_started_at timestamptz,
  extraction_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_project_idx on public.documents (project_id, created_at desc);
create index if not exists documents_type_idx on public.documents (project_id, type);
create index if not exists documents_status_idx on public.documents (extraction_status);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists "documents_select_own_project" on public.documents;
create policy "documents_select_own_project" on public.documents
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = documents.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "documents_insert_own_project" on public.documents;
create policy "documents_insert_own_project" on public.documents
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = documents.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "documents_update_own_project" on public.documents;
create policy "documents_update_own_project" on public.documents
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = documents.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "documents_delete_own_project" on public.documents;
create policy "documents_delete_own_project" on public.documents
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = documents.project_id and p.owner_id = auth.uid()
    )
  );

------------------------------------------------------------------------
-- requirements --- pulled from drawings + contracts
------------------------------------------------------------------------
create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  source text not null check (source in ('drawing', 'contract')),
  room_alias text,
  trade text,
  requirement_text text not null,
  source_page int,
  source_sheet text,
  source_detail text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists requirements_project_idx on public.requirements (project_id);
create index if not exists requirements_document_idx on public.requirements (document_id);
create index if not exists requirements_room_idx on public.requirements (project_id, room_alias);

alter table public.requirements enable row level security;

drop policy if exists "requirements_select_own_project" on public.requirements;
create policy "requirements_select_own_project" on public.requirements
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = requirements.project_id and p.owner_id = auth.uid()
    )
  );

------------------------------------------------------------------------
-- submittal_products --- pulled from submittals
------------------------------------------------------------------------
create table if not exists public.submittal_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  product text,
  manufacturer text,
  model text,
  spec_section text,
  install_requirements text,
  room_alias text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists submittal_products_project_idx on public.submittal_products (project_id);
create index if not exists submittal_products_document_idx on public.submittal_products (document_id);

alter table public.submittal_products enable row level security;

drop policy if exists "submittal_products_select_own_project" on public.submittal_products;
create policy "submittal_products_select_own_project" on public.submittal_products
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = submittal_products.project_id and p.owner_id = auth.uid()
    )
  );

------------------------------------------------------------------------
-- Realtime: stream document status updates to the library screen
------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end$$;

------------------------------------------------------------------------
-- Storage bucket: 'documents'. Files keyed by {project_id}/{document_id}/{filename}.
-- Bucket is private; access goes through signed URLs (worker uses service role).
------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: users can only touch objects whose path starts with a project they own.
-- Service role bypasses RLS automatically, so we don't need to mention it here.
drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "documents_storage_update" on storage.objects;
create policy "documents_storage_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "documents_storage_delete" on storage.objects;
create policy "documents_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.projects p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );
