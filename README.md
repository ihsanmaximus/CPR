# Maximus CPR

Client Project Report — independent modular application for phase-based client reporting, revision, approval, file collaboration, and PDF export.

## Initial architecture
- `apps/maximus`: internal Maximus workspace
- `apps/client`: client workspace
- `packages/cpr-core`: shared domain rules and types
- `supabase/migrations`: versioned database schema and RLS
- `supabase/functions`: server-side privileged workflows

This repository is being scaffolded as a standalone modular monolith. Live Supabase provisioning is intentionally separate from repository scaffolding so an existing unrelated workspace database is not modified accidentally.
