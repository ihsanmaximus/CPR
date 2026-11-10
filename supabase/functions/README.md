# Supabase Edge Functions

Privileged operations belong here only when they cannot be safely expressed as RLS + database triggers. Never ship a service-role key to either browser app. Planned functions:
- `export-phase-pdf`: assemble a PDF from persisted report/revision/attachment/approval records.
- `export-project-pdf`: combine approved phase exports.

Both functions must verify the caller's project membership and phase access before reading files.