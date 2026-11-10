# Maximus CPR — Architecture

## Deployment model
Two independently deployable Next.js frontends share one Supabase backend:
- `apps/maximus`: internal project-manager workspace; authors reports and revision results.
- `apps/client`: client workspace; reads reports, submits revision requests/files, and approves phases.
- `packages/cpr-core`: shared domain types and workflow rules.
- Supabase: PostgreSQL, Auth, private Storage, RLS, and narrowly scoped database triggers/Edge Functions.

## Data boundaries
Each project has members. Every phase owns immutable report versions, revision requests, attachments, comments, approvals, and activity events. Files are private and delivered through authenticated storage access or short-lived signed URLs.

## Approval security
Approval is a client-only action enforced twice: client UI has the control; database RLS/trigger rejects approval attempts by Maximus members. Approval records are append-only. A successful approval marks the current phase approved and unlocks only the next phase. Frontend hiding is not a security boundary.

## Revision rule
Maximum two client revision requests per phase. Flow: initial report → client revision 1 or approval → Maximus result 1 → client revision 2 or approval → Maximus result 2 → approval only. The second request is the final revision request; the final Maximus result has approval only.

## Layout contract
Client and Maximus screens use a fixed sidebar. The work/report column scrolls independently. The right 30% rail remains fixed and contains project progress at the top and attachments below. Phase report/revision content scrolls in the main work area.

## PDF export
Export is generated from immutable database records, not the current UI state. Per-phase PDF includes project/phase metadata, each report version, client revision text and files, Maximus responses, revision timeline, and approval actor/time. Project-wide export concatenates approved phase reports.

## Environment
Use a dedicated Supabase project for CPR. Do not reuse the existing general-purpose “ihsan workspace” database without explicit approval; it already contains unrelated workspace tables and migrations.