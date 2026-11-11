-- CPR role isolation hardening.
-- The Admin app requires explicit workspace provisioning AND a Maximus
-- membership for the project. Client memberships alone never grant Admin.
create or replace function private.is_cpr_workspace_maximus(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cpr_workspace_admins a
    join public.cpr_project_members m on m.user_id = a.user_id
    where a.user_id = (select auth.uid())
      and m.project_id = target_project
      and m.role = 'maximus'
  );
$$;

revoke all on function private.is_cpr_workspace_maximus(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_cpr_workspace_maximus(uuid) to authenticated;

-- Only explicitly provisioned workspace admins with a Maximus project role
-- can manage project configuration and membership.
drop policy if exists cpr_projects_maximus_update on public.cpr_projects;
create policy cpr_projects_maximus_update on public.cpr_projects
for update to authenticated
using (private.is_cpr_workspace_maximus(id))
with check (private.is_cpr_workspace_maximus(id));

drop policy if exists cpr_members_maximus_manage on public.cpr_project_members;
create policy cpr_members_maximus_manage on public.cpr_project_members
for all to authenticated
using (private.is_cpr_workspace_maximus(project_id))
with check (private.is_cpr_workspace_maximus(project_id));

drop policy if exists cpr_phases_maximus_manage on public.cpr_phases;
create policy cpr_phases_maximus_manage on public.cpr_phases
for all to authenticated
using (private.is_cpr_workspace_maximus(project_id))
with check (private.is_cpr_workspace_maximus(project_id));

drop policy if exists cpr_reports_maximus_insert on public.cpr_reports;
create policy cpr_reports_maximus_insert on public.cpr_reports
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_cpr_workspace_maximus(private.phase_project(phase_id))
);

drop policy if exists cpr_reports_maximus_update_before_client_response on public.cpr_reports;
create policy cpr_reports_maximus_update_before_client_response on public.cpr_reports
for update to authenticated
using (
  private.is_cpr_workspace_maximus(private.phase_project(phase_id))
  and not exists (select 1 from public.cpr_revision_requests rr where rr.report_id = cpr_reports.id)
  and not exists (select 1 from public.cpr_approvals a where a.report_id = cpr_reports.id)
)
with check (
  private.is_cpr_workspace_maximus(private.phase_project(phase_id))
);

drop policy if exists cpr_internal_notes_maximus_read on public.cpr_internal_notes;
create policy cpr_internal_notes_maximus_read on public.cpr_internal_notes
for select to authenticated
using (private.is_cpr_workspace_maximus(project_id));

drop policy if exists cpr_internal_notes_maximus_insert on public.cpr_internal_notes;
create policy cpr_internal_notes_maximus_insert on public.cpr_internal_notes
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.is_cpr_workspace_maximus(project_id)
);
