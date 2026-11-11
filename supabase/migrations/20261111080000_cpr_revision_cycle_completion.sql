-- CPR revision title, immutable report versions, and phase status transitions.
alter table public.cpr_revision_requests
  add column if not exists title text;

update public.cpr_revision_requests
set title = left(coalesce(nullif(trim(title), ''), nullif(trim(message), ''), 'Permintaan revisi'), 90)
where title is null or trim(title) = '';

alter table public.cpr_revision_requests
  alter column title set not null;

create or replace function private.mark_cpr_revision_requested()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if new.created_by is distinct from (select auth.uid())
     or not private.is_cpr_member(private.phase_project(new.phase_id), array['client']::public.cpr_member_role[]) then
    raise exception 'Only the authenticated client can request a revision';
  end if;
  update public.cpr_phases
  set status = 'revision_requested'
  where id = new.phase_id;
  return new;
end;
$$;

drop trigger if exists cpr_revision_request_status on public.cpr_revision_requests;
revoke all on function private.mark_cpr_revision_requested() from public, anon, authenticated;
create trigger cpr_revision_request_status
after insert on public.cpr_revision_requests
for each row execute function private.mark_cpr_revision_requested();

create or replace function private.mark_cpr_report_waiting_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if new.created_by is distinct from (select auth.uid())
     or not private.is_cpr_member(private.phase_project(new.phase_id), array['maximus']::public.cpr_member_role[]) then
    raise exception 'Only Maximus can submit a report';
  end if;
  update public.cpr_phases
  set status = 'waiting_client'
  where id = new.phase_id;
  return new;
end;
$$;

drop trigger if exists cpr_report_waiting_client on public.cpr_reports;
revoke all on function private.mark_cpr_report_waiting_client() from public, anon, authenticated;
create trigger cpr_report_waiting_client
after insert on public.cpr_reports
for each row execute function private.mark_cpr_report_waiting_client();

drop policy if exists cpr_reports_maximus_update_before_client_response on public.cpr_reports;
create policy cpr_reports_maximus_update_before_client_response
on public.cpr_reports
for update
to authenticated
using (
  private.is_cpr_member(private.phase_project(phase_id), array['maximus']::public.cpr_member_role[])
  and not exists (
    select 1 from public.cpr_revision_requests rr
    where rr.report_id = cpr_reports.id
  )
  and not exists (
    select 1 from public.cpr_approvals ap
    where ap.report_id = cpr_reports.id
  )
)
with check (
  private.is_cpr_member(private.phase_project(phase_id), array['maximus']::public.cpr_member_role[])
  and not exists (
    select 1 from public.cpr_revision_requests rr
    where rr.report_id = cpr_reports.id
  )
  and not exists (
    select 1 from public.cpr_approvals ap
    where ap.report_id = cpr_reports.id
  )
);
