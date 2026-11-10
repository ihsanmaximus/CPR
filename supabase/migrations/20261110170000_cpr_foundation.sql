-- Maximus CPR foundation schema. Apply only to the dedicated CPR Supabase project.
create extension if not exists pgcrypto with schema extensions;

create type public.cpr_member_role as enum ('maximus', 'client');
create type public.cpr_phase_status as enum ('locked', 'in_progress', 'waiting_client', 'revision_requested', 'approved');
create type public.cpr_report_kind as enum ('initial', 'revision_1_result', 'revision_2_result');

create table public.cpr_projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  client_name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cpr_project_members (
  project_id uuid not null references public.cpr_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.cpr_member_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.cpr_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cpr_projects(id) on delete cascade,
  phase_number smallint not null check (phase_number between 1 and 99),
  title text not null,
  description text,
  status public.cpr_phase_status not null default 'locked',
  unlocked_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, phase_number)
);

create table public.cpr_reports (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.cpr_phases(id) on delete cascade,
  version_number smallint not null check (version_number between 1 and 3),
  kind public.cpr_report_kind not null,
  title text not null,
  body text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (phase_id, version_number),
  unique (id, phase_id)
);

create table public.cpr_revision_requests (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.cpr_phases(id) on delete cascade,
  revision_number smallint not null check (revision_number in (1,2)),
  report_id uuid not null,
  message text not null check (length(trim(message)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (phase_id, revision_number),
  foreign key (report_id, phase_id) references public.cpr_reports(id, phase_id)
);

create table public.cpr_comments (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.cpr_phases(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  author_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.cpr_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cpr_projects(id) on delete cascade,
  phase_id uuid references public.cpr_phases(id) on delete cascade,
  report_id uuid references public.cpr_reports(id) on delete cascade,
  revision_request_id uuid references public.cpr_revision_requests(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  bucket_id text not null default 'cpr-files',
  object_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now(),
  check (phase_id is not null or report_id is not null or revision_request_id is not null)
);

create table public.cpr_approvals (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.cpr_phases(id) on delete cascade,
  report_id uuid not null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  unique (phase_id),
  foreign key (report_id, phase_id) references public.cpr_reports(id, phase_id)
);

create table public.cpr_activity_logs (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.cpr_projects(id) on delete cascade,
  phase_id uuid references public.cpr_phases(id) on delete set null,
  actor_id uuid references auth.users(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index cpr_phases_project_order_idx on public.cpr_phases(project_id, phase_number);
create index cpr_reports_phase_version_idx on public.cpr_reports(phase_id, version_number desc);
create index cpr_revisions_phase_idx on public.cpr_revision_requests(phase_id, revision_number);
create index cpr_comments_phase_created_idx on public.cpr_comments(phase_id, created_at);
create index cpr_attachments_project_phase_idx on public.cpr_attachments(project_id, phase_id);
create index cpr_activity_project_created_idx on public.cpr_activity_logs(project_id, created_at desc);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_cpr_member(target_project uuid, allowed_roles public.cpr_member_role[] default null)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.cpr_project_members m
    where m.project_id = target_project
      and m.user_id = (select auth.uid())
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function private.phase_project(target_phase uuid)
returns uuid language sql stable security invoker set search_path = '' as $$
  select project_id from public.cpr_phases where id = target_phase;
$$;

-- Revision requests are strictly client-authored and capped at two per phase.
create or replace function private.guard_cpr_revision_request()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare current_status public.cpr_phase_status; current_count integer; client_member boolean;
begin
  select p.status into current_status from public.cpr_phases p where p.id = new.phase_id for update;
  select count(*) into current_count from public.cpr_revision_requests r where r.phase_id = new.phase_id;
  select private.is_cpr_member(p.project_id, array['client']::public.cpr_member_role[]) into client_member
    from public.cpr_phases p where p.id = new.phase_id;
  if not coalesce(client_member,false) then raise exception 'Only the client can request a revision'; end if;
  if current_status not in ('waiting_client','revision_requested') then raise exception 'Phase is not open for client review'; end if;
  if current_count >= 2 then raise exception 'Revision limit reached'; end if;
  new.revision_number := current_count + 1;
  return new;
end;
$$;
create trigger cpr_revision_request_guard before insert on public.cpr_revision_requests
for each row execute function private.guard_cpr_revision_request();

-- Approval is an immutable client-only event. The trigger advances the phase and unlocks the next one.
create or replace function private.apply_cpr_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_uuid uuid; phase_no smallint; client_member boolean;
begin
  select p.project_id, p.phase_number into project_uuid, phase_no
  from public.cpr_phases p where p.id = new.phase_id for update;
  select exists (
    select 1 from public.cpr_project_members m
    where m.project_id = project_uuid and m.user_id = new.approved_by and m.role = 'client'
  ) into client_member;
  if new.approved_by is distinct from (select auth.uid()) or not coalesce(client_member,false) then
    raise exception 'Approval can only be submitted by the authenticated client';
  end if;
  if not exists (select 1 from public.cpr_reports r where r.id = new.report_id and r.phase_id = new.phase_id) then
    raise exception 'Approved report does not belong to this phase';
  end if;
  update public.cpr_phases set status = 'approved', approved_at = new.approved_at where id = new.phase_id;
  update public.cpr_phases set status = 'in_progress', unlocked_at = coalesce(unlocked_at, now())
    where project_id = project_uuid and phase_number = phase_no + 1 and status = 'locked';
  insert into public.cpr_activity_logs(project_id, phase_id, actor_id, event_type, details)
  values (project_uuid, new.phase_id, new.approved_by, 'phase_approved', jsonb_build_object('report_id', new.report_id));
  return new;
end;
$$;
revoke all on function private.apply_cpr_approval() from public, anon, authenticated;
create trigger cpr_approval_apply after insert on public.cpr_approvals
for each row execute function private.apply_cpr_approval();

-- RLS on every exposed CPR table.
alter table public.cpr_projects enable row level security;
alter table public.cpr_project_members enable row level security;
alter table public.cpr_phases enable row level security;
alter table public.cpr_reports enable row level security;
alter table public.cpr_revision_requests enable row level security;
alter table public.cpr_comments enable row level security;
alter table public.cpr_attachments enable row level security;
alter table public.cpr_approvals enable row level security;
alter table public.cpr_activity_logs enable row level security;

create policy cpr_projects_read on public.cpr_projects for select to authenticated
using (private.is_cpr_member(id));
create policy cpr_projects_maximus_insert on public.cpr_projects for insert to authenticated
with check (created_by = (select auth.uid()));
create policy cpr_projects_maximus_update on public.cpr_projects for update to authenticated
using (private.is_cpr_member(id, array['maximus']::public.cpr_member_role[]))
with check (private.is_cpr_member(id, array['maximus']::public.cpr_member_role[]));

create policy cpr_members_read on public.cpr_project_members for select to authenticated
using (private.is_cpr_member(project_id));
create policy cpr_members_maximus_manage on public.cpr_project_members for all to authenticated
using (private.is_cpr_member(project_id, array['maximus']::public.cpr_member_role[]))
with check (private.is_cpr_member(project_id, array['maximus']::public.cpr_member_role[]));

create policy cpr_phases_read_unlocked on public.cpr_phases for select to authenticated
using (private.is_cpr_member(project_id) and status <> 'locked');
create policy cpr_phases_maximus_manage on public.cpr_phases for all to authenticated
using (private.is_cpr_member(project_id, array['maximus']::public.cpr_member_role[]))
with check (private.is_cpr_member(project_id, array['maximus']::public.cpr_member_role[]));

create policy cpr_reports_read on public.cpr_reports for select to authenticated
using (exists (select 1 from public.cpr_phases p where p.id = phase_id and p.status <> 'locked' and private.is_cpr_member(p.project_id)));
create policy cpr_reports_maximus_insert on public.cpr_reports for insert to authenticated
with check (created_by = (select auth.uid()) and private.is_cpr_member(private.phase_project(phase_id), array['maximus']::public.cpr_member_role[]));

create policy cpr_revisions_read on public.cpr_revision_requests for select to authenticated
using (private.is_cpr_member(private.phase_project(phase_id)));
create policy cpr_revisions_client_insert on public.cpr_revision_requests for insert to authenticated
with check (created_by = (select auth.uid()) and private.is_cpr_member(private.phase_project(phase_id), array['client']::public.cpr_member_role[]));

create policy cpr_comments_read on public.cpr_comments for select to authenticated
using (private.is_cpr_member(private.phase_project(phase_id)));
create policy cpr_comments_member_insert on public.cpr_comments for insert to authenticated
with check (author_id = (select auth.uid()) and private.is_cpr_member(private.phase_project(phase_id)));

create policy cpr_attachments_read on public.cpr_attachments for select to authenticated
using (private.is_cpr_member(project_id));
create policy cpr_attachments_member_insert on public.cpr_attachments for insert to authenticated
with check (uploaded_by = (select auth.uid()) and private.is_cpr_member(project_id));

create policy cpr_approvals_read on public.cpr_approvals for select to authenticated
using (private.is_cpr_member(private.phase_project(phase_id)));
create policy cpr_approvals_client_insert on public.cpr_approvals for insert to authenticated
with check (approved_by = (select auth.uid()) and private.is_cpr_member(private.phase_project(phase_id), array['client']::public.cpr_member_role[]));
-- No UPDATE/DELETE policies: approvals are immutable; Maximus cannot approve.

create policy cpr_activity_read on public.cpr_activity_logs for select to authenticated
using (private.is_cpr_member(project_id));
create policy cpr_activity_member_insert on public.cpr_activity_logs for insert to authenticated
with check (actor_id = (select auth.uid()) and private.is_cpr_member(project_id));

-- Private storage bucket; file access is tied to project membership via path: <project_uuid>/<phase_uuid>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cpr-files', 'cpr-files', false, 10485760, array['image/jpeg','image/png','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy cpr_storage_read on storage.objects for select to authenticated
using (bucket_id = 'cpr-files' and exists (
  select 1 from public.cpr_project_members m
  where m.user_id = (select auth.uid()) and m.project_id::text = (storage.foldername(name))[1]
));
create policy cpr_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'cpr-files' and exists (
  select 1 from public.cpr_project_members m
  where m.user_id = (select auth.uid()) and m.project_id::text = (storage.foldername(name))[1]
));
