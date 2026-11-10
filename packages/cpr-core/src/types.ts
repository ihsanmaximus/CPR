export type WorkspaceRole = "maximus" | "client";
export type PhaseStatus = "locked" | "in_progress" | "waiting_client" | "revision_requested" | "approved";
export type ReportKind = "initial" | "revision_1_result" | "revision_2_result";
export type RevisionNumber = 1 | 2;

export interface ProjectPhase {
  id: string;
  project_id: string;
  phase_number: number;
  title: string;
  description: string | null;
  status: PhaseStatus;
  unlocked_at: string | null;
}

export interface PhaseReport {
  id: string;
  phase_id: string;
  version_number: number;
  kind: ReportKind;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
}

export interface RevisionRequest {
  id: string;
  phase_id: string;
  revision_number: RevisionNumber;
  message: string;
  created_by: string;
  created_at: string;
}

export interface PhaseApproval {
  id: string;
  phase_id: string;
  report_id: string;
  approved_by: string;
  approved_at: string;
}