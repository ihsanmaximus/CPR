-- Internal Maximus-only project notes. Never exposed to client members.
create table public.cpr_internal_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cpr_projects(id) on delete cascade,
  phase_id uuid references public.cpr_phases(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index cpr_internal_notes_project_created_idx on public.cpr_internal_notes(project_id,created_at desc);
alter table public.cpr_internal_notes enable row level security;
create policy cpr_internal_notes_maximus_read on public.cpr_internal_notes
for select to authenticated using (private.is_cpr_member(project_id,array['maximus']::public.cpr_member_role[]));
create policy cpr_internal_notes_maximus_insert on public.cpr_internal_notes
for insert to authenticated with check (
  author_id=(select auth.uid()) and
  private.is_cpr_member(project_id,array['maximus']::public.cpr_member_role[])
);
