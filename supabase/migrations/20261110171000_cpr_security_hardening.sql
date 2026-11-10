-- CPR security hardening and automatic workflow transitions.
-- Apply after 20261110170000_cpr_foundation.sql.

create or replace function private.is_cpr_member(target_project uuid, allowed_roles public.cpr_member_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cpr_project_members m
    where m.project_id = target_project and m.user_id = (select auth.uid())
      and (allowed_roles is null or m.role = any(allowed_roles)));
$$;

create or replace function private.phase_project(target_phase uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.project_id from public.cpr_phases p where p.id = target_phase;
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_cpr_member(uuid, public.cpr_member_role[]) to authenticated;
grant execute on function private.phase_project(uuid) to authenticated;
revoke all on function private.is_cpr_member(uuid, public.cpr_member_role[]) from anon;
revoke all on function private.phase_project(uuid) from anon;

create or replace function private.add_cpr_project_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cpr_project_members(project_id,user_id,role) values(new.id,new.created_by,'maximus');
  return new;
end; $$;
revoke all on function private.add_cpr_project_creator() from public,anon,authenticated;
create trigger cpr_project_creator_membership after insert on public.cpr_projects
for each row execute function private.add_cpr_project_creator();

create or replace function private.initialize_cpr_phase()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.phase_number = 1 then
    new.status := 'in_progress'; new.unlocked_at := coalesce(new.unlocked_at,now());
  else
    new.status := 'locked'; new.unlocked_at := null;
  end if;
  return new;
end; $$;
revoke all on function private.initialize_cpr_phase() from public,anon,authenticated;
create trigger cpr_phase_initialize before insert on public.cpr_phases
for each row execute function private.initialize_cpr_phase();

-- Workflow state is never directly editable by either frontend.
revoke update on public.cpr_phases from authenticated;
grant update(title,description,phase_number) on public.cpr_phases to authenticated;

create or replace function private.mark_cpr_report_waiting()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.cpr_phases set status='waiting_client' where id=new.phase_id and status<>'approved';
  return new;
end; $$;
revoke all on function private.mark_cpr_report_waiting() from public,anon,authenticated;
create trigger cpr_report_waiting after insert on public.cpr_reports
for each row execute function private.mark_cpr_report_waiting();

create or replace function private.mark_cpr_revision_requested()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.cpr_phases set status='revision_requested' where id=new.phase_id;
  insert into public.cpr_activity_logs(project_id,phase_id,actor_id,event_type,details)
  select p.project_id,p.id,new.created_by,'revision_requested',
    jsonb_build_object('revision_number',new.revision_number,'request_id',new.id)
  from public.cpr_phases p where p.id=new.phase_id;
  return new;
end; $$;
revoke all on function private.mark_cpr_revision_requested() from public,anon,authenticated;
create trigger cpr_revision_status after insert on public.cpr_revision_requests
for each row execute function private.mark_cpr_revision_requested();

create or replace function private.apply_cpr_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_uuid uuid; phase_no smallint; client_member boolean;
  current_status public.cpr_phase_status; latest_report uuid;
begin
  select p.project_id,p.phase_number,p.status into project_uuid,phase_no,current_status
  from public.cpr_phases p where p.id=new.phase_id for update;
  select exists(select 1 from public.cpr_project_members m
    where m.project_id=project_uuid and m.user_id=new.approved_by and m.role='client') into client_member;
  if new.approved_by is distinct from (select auth.uid()) or not coalesce(client_member,false) then
    raise exception 'Approval can only be submitted by the authenticated client';
  end if;
  if current_status<>'waiting_client' then raise exception 'Phase is not awaiting client approval'; end if;
  select r.id into latest_report from public.cpr_reports r
    where r.phase_id=new.phase_id order by r.version_number desc limit 1;
  if latest_report is null or new.report_id<>latest_report then
    raise exception 'Only the latest report version can be approved';
  end if;
  update public.cpr_phases set status='approved',approved_at=new.approved_at where id=new.phase_id;
  update public.cpr_phases set status='in_progress',unlocked_at=coalesce(unlocked_at,now())
    where project_id=project_uuid and phase_number=phase_no+1 and status='locked';
  insert into public.cpr_activity_logs(project_id,phase_id,actor_id,event_type,details)
    values(project_uuid,new.phase_id,new.approved_by,'phase_approved',
      jsonb_build_object('report_id',new.report_id,'approved_at',new.approved_at));
  return new;
end; $$;
