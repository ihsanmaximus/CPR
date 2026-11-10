-- Restrict project creation to explicitly provisioned Maximus workspace administrators.
create table public.cpr_workspace_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.cpr_workspace_admins enable row level security;
create policy cpr_workspace_admin_self_read on public.cpr_workspace_admins
for select to authenticated using (user_id=(select auth.uid()));
grant select on public.cpr_workspace_admins to authenticated;

drop policy if exists cpr_projects_maximus_insert on public.cpr_projects;
create policy cpr_projects_maximus_insert on public.cpr_projects
for insert to authenticated
with check (
  created_by=(select auth.uid()) and
  exists(select 1 from public.cpr_workspace_admins a where a.user_id=(select auth.uid()))
);
