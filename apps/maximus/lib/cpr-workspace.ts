import { supabase } from "./supabase";

export const CPR_PROJECT_CODE = "RLC";

export async function loadMaximusWorkspace(userId: string) {
  const { data: project, error: projectError } = await supabase
    .from("cpr_projects")
    .select("*")
    .eq("code", CPR_PROJECT_CODE)
    .single();
  if (projectError) throw projectError;

  const { data: membership, error: memberError } = await supabase
    .from("cpr_project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (membership?.role !== "maximus") {
    throw new Error("Akun ini belum memiliki akses Workspace Maximus untuk proyek RLC.");
  }

  const { data: phases, error: phaseError } = await supabase
    .from("cpr_phases")
    .select("*")
    .eq("project_id", project.id)
    .order("phase_number");
  if (phaseError) throw phaseError;

  return { project, phases: phases || [] };
}

export async function loadMaximusPhase(phaseId: string) {
  const [reportsResult, revisionsResult, notesResult, approvalsResult] = await Promise.all([
    supabase.from("cpr_reports").select("*").eq("phase_id", phaseId).order("version_number"),
    supabase.from("cpr_revision_requests").select("*").eq("phase_id", phaseId).order("revision_number"),
    supabase.from("cpr_internal_notes").select("*").eq("phase_id", phaseId).order("created_at", { ascending: false }).limit(1),
    supabase.from("cpr_approvals").select("id, approved_at").eq("phase_id", phaseId).limit(1),
  ]);

  if (reportsResult.error) throw reportsResult.error;
  if (revisionsResult.error) throw revisionsResult.error;
  if (notesResult.error) throw notesResult.error;
  if (approvalsResult.error) throw approvalsResult.error;

  const reports = reportsResult.data || [];
  const revisions = revisionsResult.data || [];
  const latestReport = reports[reports.length - 1] || null;
  const attachmentsResult = latestReport
    ? await supabase.from("cpr_attachments").select("*").eq("report_id", latestReport.id).order("created_at")
    : { data: [], error: null };
  if (attachmentsResult.error) throw attachmentsResult.error;

  const attachments = await Promise.all((attachmentsResult.data || []).map(async (attachment: any) => {
    const { data } = await supabase.storage.from("cpr-files").createSignedUrl(attachment.object_path, 3600);
    return { ...attachment, signedUrl: data?.signedUrl || "" };
  }));

  const report1 = reports.find((report: any) => report.version_number === 1);
  const report2 = reports.find((report: any) => report.version_number === 2);
  const report3 = reports.find((report: any) => report.version_number === 3);
  const revision1 = revisions.find((revision: any) => revision.revision_number === 1);
  const revision2 = revisions.find((revision: any) => revision.revision_number === 2);

  const timeline = [
    { id: "report-1", title: "Report (Versi Awal)", actor: "Maximus", createdAt: report1?.created_at, summary: report1?.stressing_point || "", status: report1 ? "completed" : "upcoming", marker: report1 ? "✓" : "1", placeholder: "Menunggu laporan awal dari Maximus..." },
    { id: "revision-1", title: "Revisi 1 – Masukan Client", actor: "Client", createdAt: revision1?.created_at, summary: revision1?.message || "", status: revision1 ? "completed" : report1 ? "pending" : "upcoming", marker: "1", placeholder: "Menunggu masukan dari client..." },
    { id: "report-2", title: "Hasil Revisi 1", actor: "Maximus", createdAt: report2?.created_at, summary: report2?.stressing_point || "", status: report2 ? "completed" : "upcoming", marker: report2 ? "✓" : "2", placeholder: "Menunggu input dari Maximus..." },
    { id: "revision-2", title: "Revisi 2 – Masukan Client", actor: "Client", createdAt: revision2?.created_at, summary: revision2?.message || "", status: revision2 ? "completed" : "upcoming", marker: "3", placeholder: "—" },
    { id: "report-3", title: "Hasil Revisi 2 (Final)", actor: "Maximus", createdAt: report3?.created_at, summary: report3?.stressing_point || "", status: report3 ? "completed" : "upcoming", marker: report3 ? "✓" : "4", placeholder: "—" },
  ];

  return {
    reports,
    latestReport,
    revisions,
    timeline,
    internalNote: notesResult.data?.[0]?.body || "",
    attachments,
    clientReplied: revisions.length > 0 || (approvalsResult.data || []).length > 0,
  };
}

type SaveMaximusReportArgs = {
  projectId: string;
  phaseId: string;
  userId: string;
  reportId: string | null;
  title: string;
  stressingPoint: string;
  body: string;
  internalNote: string;
  files: File[];
};

export async function saveMaximusReport(args: SaveMaximusReportArgs) {
  const reportPayload = {
    title: args.title.trim(),
    stressing_point: args.stressingPoint.trim(),
    body: args.body,
  };

  const reportResult = args.reportId
    ? await supabase.from("cpr_reports").update(reportPayload).eq("id", args.reportId).select("*").single()
    : await supabase.from("cpr_reports").insert({
        ...reportPayload,
        phase_id: args.phaseId,
        version_number: 1,
        kind: "initial",
        created_by: args.userId,
      }).select("*").single();

  if (reportResult.error) throw reportResult.error;
  const report = reportResult.data;
  const warnings: string[] = [];

  if (args.internalNote.trim()) {
    const { error } = await supabase.from("cpr_internal_notes").insert({
      project_id: args.projectId,
      phase_id: args.phaseId,
      author_id: args.userId,
      body: args.internalNote.trim(),
    });
    if (error) warnings.push("Catatan internal belum tersimpan: " + error.message);
  }

  for (const file of args.files) {
    if (file.size > 10 * 1024 * 1024) {
      warnings.push(file.name + " melebihi batas 10 MB.");
      continue;
    }
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const objectPath = args.projectId + "/" + args.phaseId + "/" + report.id + "/" + crypto.randomUUID() + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from("cpr-files").upload(objectPath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      warnings.push("Lampiran " + file.name + " gagal diunggah: " + uploadError.message);
      continue;
    }
    const { error: attachmentError } = await supabase.from("cpr_attachments").insert({
      project_id: args.projectId,
      phase_id: args.phaseId,
      report_id: report.id,
      uploaded_by: args.userId,
      bucket_id: "cpr-files",
      object_path: objectPath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size: file.size,
    });
    if (attachmentError) warnings.push("Metadata lampiran " + file.name + " gagal disimpan: " + attachmentError.message);
  }

  const { error: activityError } = await supabase.from("cpr_activity_logs").insert({
    project_id: args.projectId,
    phase_id: args.phaseId,
    actor_id: args.userId,
    event_type: args.reportId ? "report_updated" : "report_created",
    details: {
      report_id: report.id,
      version_number: report.version_number,
      title: report.title,
      stressing_point: report.stressing_point,
    },
  });
  if (activityError) warnings.push("Log aktivitas belum tersimpan: " + activityError.message);

  return { report, warnings };
}
