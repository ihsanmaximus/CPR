import type { PhaseStatus, ReportKind } from "./types";

export const MAX_REVISION_REQUESTS = 2;

export function canClientRequestRevision(count: number, status: PhaseStatus): boolean {
  return count < MAX_REVISION_REQUESTS && status !== "approved" && status !== "locked";
}

export function canClientApprove(status: PhaseStatus): boolean {
  return status === "waiting_client" || status === "revision_requested";
}

export function nextReportKind(revisionCount: number): ReportKind {
  if (revisionCount === 0) return "initial";
  if (revisionCount === 1) return "revision_1_result";
  return "revision_2_result";
}

export function clientActions(revisionCount: number) {
  return {
    canRequestRevision: revisionCount < MAX_REVISION_REQUESTS,
    canApprove: true,
    label: revisionCount >= MAX_REVISION_REQUESTS ? "Hasil akhir — hanya Approved" : "Pilih Revisi atau Approved",
  };
}