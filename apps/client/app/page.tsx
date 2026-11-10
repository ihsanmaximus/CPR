"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import {AuthPanel,useSession} from "../lib/auth";
import {canClientApprove,canClientRequestRevision} from "@cpr/core/workflow";

const phaseNames=["Discovery & Brief","Riset & Analisis","Strategi & Solusi","Desain & Prototype","Pengembangan","Final Review & Launch"];
const statusLabels:any={locked:"Terkunci",in_progress:"In Progress",waiting_client:"Menunggu Klien",revision_requested:"Revisi Diminta",approved:"Approved"};
const allowedTypes=["image/jpeg","image/png","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const maxFileSize=10*1024*1024;

export default function ClientHome(){
 const {session,ready}=useSession();
 const [project,setProject]=useState<any>(null),[phases,setPhases]=useState<any[]>([]),[selected,setSelected]=useState<any>(null);
 const [reports,setReports]=useState<any[]>([]),[revisions,setRevisions]=useState<any[]>([]),[attachments,setAttachments]=useState<any[]>([]);
 const [message,setMessage]=useState(""),[files,setFiles]=useState<File[]>([]),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 async function load(){
  if(!session)return;
  const m=await supabase.from("cpr_project_members").select("project_id,role").eq("user_id",session.user.id).eq("role","client");
  if(m.error){setNotice(m.error.message);return}
  if(!m.data?.length){setNotice("Akun ini belum ditautkan ke proyek oleh Maximus. Kirim User ID akun kepada pengelola proyek.");return}
  const p=await supabase.from("cpr_projects").select("*").eq("id",m.data[0].project_id).single();
  if(p.error){setNotice(p.error.message);return}
  setProject(p.data);
  const ph=await supabase.from("cpr_phases").select("*").eq("project_id",p.data.id).neq("status","locked").order("phase_number");
  if(ph.error){setNotice(ph.error.message);return}
  setPhases(ph.data||[]);
  const active=(ph.data||[]).find(x=>x.status!=="approved")||(ph.data||[]).at(-1);
  if(active)await openPhase(active,p.data.id);
 }
 async function openPhase(phase:any,projectId=project?.id){
  setSelected(phase);setReports([]);setRevisions([]);setAttachments([]);
  const [r,v,a]=await Promise.all([
   supabase.from("cpr_reports").select("*").eq("phase_id",phase.id).order("version_number"),
   supabase.from("cpr_revision_requests").select("*").eq("phase_id",phase.id).order("revision_number"),
   supabase.from("cpr_attachments").select("*").eq("phase_id",phase.id).order("created_at")
  ]);
  if(r.error||v.error||a.error){setNotice(r.error?.message||v.error?.message||a.error?.message||"Gagal memuat laporan.");return}
  const all=a.data||[];
  const signed=await Promise.all(all.map(async (f:any)=>{const {data}=await supabase.storage.from(f.bucket_id||"cpr-files").createSignedUrl(f.object_path,3600);return {...f,signedUrl:data?.signedUrl||""}}));
  setReports(r.data||[]);setRevisions(v.data||[]);setAttachments(signed);
 }
 useEffect(()=>{if(session)load()},[session?.user.id]);
 async function sendRevision(){
  if(!selected||!reports.length||!message.trim())return;
  const invalid=files.find(f=>f.size>maxFileSize||!allowedTypes.includes(f.type));
  if(invalid){setNotice("File "+invalid.name+" tidak didukung atau melebihi batas 10 MB.");return}
  setBusy(true);setNotice("");
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sesi login berakhir.");
   const current=reports[reports.length-1];
   const {data:revision,error}=await supabase.from("cpr_revision_requests").insert({phase_id:selected.id,report_id:current.id,message:message.trim(),created_by:user.id}).select("*").single();
   if(error)throw error;
   const warnings:string[]=[];
   for(const file of files){
    const safe=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-");
    const path=project.id+"/"+selected.id+"/revision-"+revision.id+"/"+crypto.randomUUID()+"-"+safe;
    const {error:uploadError}=await supabase.storage.from("cpr-files").upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError){warnings.push(file.name+": "+uploadError.message);continue}
    const {error:metaError}=await supabase.from("cpr_attachments").insert({project_id:project.id,phase_id:selected.id,revision_request_id:revision.id,uploaded_by:user.id,bucket_id:"cpr-files",object_path:path,file_name:file.name,mime_type:file.type,file_size:file.size});
    if(metaError)warnings.push("Metadata "+file.name+": "+metaError.message);
   }
   setMessage("");setFiles([]);
   setNotice(warnings.length?"Revisi terkirim, tetapi ada lampiran yang gagal: "+warnings.join(" | "):"Permintaan revisi berhasil dikirim kepada Maximus.");
   await loadPhaseRefresh();
  }catch(error){setNotice(error instanceof Error?error.message:"Gagal mengirim revisi.");}
  finally{setBusy(false)}
 }
 async function loadPhaseRefresh(){if(selected)await openPhase(selected,project?.id);const {data}=await supabase.from("cpr_phases").select("*").eq("project_id",project.id).neq("status","locked").order("phase_number");setPhases(data||[]);const updated=(data||[]).find((x:any)=>x.id===selected?.id);if(updated)setSelected(updated)}
 async function approve(){
  if(!selected||!reports.length)return;
  const latest=reports[reports.length-1];
  if(!confirm("Setujui laporan ini? Persetujuan akan membuka fase berikutnya dan tidak dapat dibatalkan."))return;
  setBusy(true);
  try{const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("cpr_approvals").insert({phase_id:selected.id,report_id:latest.id,approved_by:user!.id});if(error)throw error;setNotice("Laporan disetujui. Fase berikutnya terbuka.");await load()}
  catch(error){setNotice(error instanceof Error?error.message:"Gagal menyetujui laporan.");}
  finally{setBusy(false)}
 }
 async function signOut(){await supabase.auth.signOut()}
 if(!ready)return <div className="authpage">Memuat sesi…</div>;
 if(!session)return <div className="authpage"><AuthPanel/></div>;
 if(!project)return <div className="authpage"><div className="authbox"><h2>Ruang Klien CPR</h2><p>{notice||"Memeriksa akses proyek…"}</p><p><b>User ID:</b><br/><code>{session.user.id}</code></p><button onClick={load}>Periksa kembali</button><button className="secondary" onClick={signOut}>Keluar</button></div></div>;
 const count=revisions.length,latest=reports[reports.length-1],canRev=selected?canClientRequestRevision(count,selected.status):false,canApprove=selected?canClientApprove(selected.status):false;
 const reportAttachments=(reportId:string)=>attachments.filter(f=>f.report_id===reportId);
 const revisionAttachments=(revisionId:string)=>attachments.filter(f=>f.revision_request_id===revisionId);
 function fileList(items:any[]){return items.map(f=><a className="attachment-row" key={f.id} href={f.signedUrl||"#"} target="_blank" rel="noreferrer"><span className="attachment-icon">{f.mime_type?.startsWith("image/")?"IMG":f.mime_type==="application/pdf"?"PDF":"FILE"}</span><span><b>{f.file_name}</b><small>{(Number(f.file_size)/1024).toFixed(0)} KB</small></span></a>)}
 const chronology:any[]=[];
 if(reports[0])chronology.push({type:"report",item:reports[0],label:"Laporan Awal · Versi 1"});
 if(revisions[0])chronology.push({type:"revision",item:revisions[0],label:"Masukan Klien · Revisi 1"});
 if(reports[1])chronology.push({type:"report",item:reports[1],label:"Hasil Revisi 1 · Versi 2"});
 if(revisions[1])chronology.push({type:"revision",item:revisions[1],label:"Masukan Klien · Revisi 2"});
 if(reports[2])chronology.push({type:"report",item:reports[2],label:"Laporan Final · Versi 3"});
 return <main className="layout"><aside className="sidebar"><div className="brand">M <span>Maximus CPR</span></div><div className="project">{project.name}<br/><small>Ruang kerja klien</small></div><nav>{[1,2,3,4,5,6].map(n=>{const p=phases.find(x=>x.phase_number===n);return <a key={n} className={selected?.id===p?.id?"active":""} onClick={()=>p&&openPhase(p)}>{String(n).padStart(2,"0")} · {phaseNames[n-1]} {p?.status==="approved"?"✓":""}</a>})}</nav><button className="signout" onClick={signOut}>Keluar</button></aside>
 <section className="workspace"><header><strong>Client Project Report</strong><span className="role">CLIENT · {session.user.email}</span></header><div className="columns"><main className="work">
  {notice&&<div className="notice">{notice}</div>}
  <article className="card phase-card"><div className="phase"><span>FASE {String(selected?.phase_number||1).padStart(2,"0")}</span><div><h1>{selected?.title}</h1><p>Hasil pekerjaan dan keputusan proyek Anda.</p></div></div></article>
  {!chronology.length?<article className="card"><h2>Laporan belum tersedia</h2><p>Maximus belum mengirim laporan untuk fase ini.</p></article>:chronology.map((entry,index)=>entry.type==="report"?<article className="card report-card" key={entry.item.id}><div className="tag">LAPORAN DARI MAXIMUS · {entry.label.toUpperCase()}</div><h2>{entry.item.title}</h2><small>{new Date(entry.item.created_at).toLocaleString("id-ID")}</small><section className="stress-point"><strong>STRESSING POINT</strong><p>{entry.item.stressing_point||"Tidak ada stressing point."}</p></section><h3>Laporan Lengkap</h3><div className="reportbody" dangerouslySetInnerHTML={{__html:entry.item.body}}/><div className="report-files"><strong>Lampiran Maximus</strong>{fileList(reportAttachments(entry.item.id))}{!reportAttachments(entry.item.id).length&&<p className="hint">Tidak ada lampiran untuk versi ini.</p>}</div>{index===chronology.length-1&&<div className="actions">{canRev&&<button className="outline" onClick={()=>document.getElementById("revision")?.scrollIntoView({behavior:"smooth"})}>Ajukan Revisi</button>}{canApprove&&<button className="approve" disabled={busy} onClick={approve}>Setujui Laporan</button>}</div>}</article>:<article className="card revision-card" key={entry.item.id}><div className="tag client">TANGGAPAN KLIEN · REVISI {entry.item.revision_number}</div><h2>Evaluasi dan Permintaan Revisi</h2><small>{new Date(entry.item.created_at).toLocaleString("id-ID")}</small><div className="reportbody">{entry.item.message}</div><div className="report-files"><strong>Lampiran Klien</strong>{fileList(revisionAttachments(entry.item.id))}{!revisionAttachments(entry.item.id).length&&<p className="hint">Tidak ada lampiran dari klien.</p>}</div></article>)}
  {canRev&&<article className="card" id="revision"><div className="tag client">TANGGAPAN KLIEN</div><h2>Evaluasi dan Permintaan Revisi</h2><p>Kesempatan revisi digunakan: {count} dari 2. {2-count} kesempatan revisi tersisa.</p><textarea rows={6} placeholder="Tuliskan bagian yang perlu diperbaiki atau dilengkapi…" value={message} onChange={e=>setMessage(e.target.value)}/><label className="upload-label">Lampiran pendukung (opsional)<input type="file" multiple accept="image/jpeg,image/png,application/pdf,.doc,.docx,.xls,.xlsx" onChange={e=>setFiles(old=>[...old,...Array.from(e.target.files||[])])}/></label>{files.length>0&&<ul className="selected-files">{files.map((f,i)=><li key={i}>{f.name} <button type="button" onClick={()=>setFiles(old=>old.filter((_,n)=>n!==i))}>Hapus</button></li>)}</ul>}<button className="submit" disabled={busy||!message.trim()} onClick={sendRevision}>{busy?"Mengirim…":"Kirim Permintaan Revisi"}</button></article>}
 </main><aside className="rail"><article className="card"><h2>Progres Revisi</h2><div className="cycle-row"><span>Laporan awal</span><small>{reports[0]?"Tersedia":"Menunggu"}</small></div><div className="cycle-row"><span>Revisi 1</span><small>{revisions[0]?"Dikirim":"Belum digunakan"}</small></div><div className="cycle-row"><span>Hasil revisi 1</span><small>{reports[1]?"Tersedia":"Menunggu Maximus"}</small></div><div className="cycle-row"><span>Revisi 2</span><small>{revisions[1]?"Dikirim":"Belum digunakan"}</small></div><div className="cycle-row"><span>Laporan final</span><small>{reports[2]?"Tersedia":"Menunggu Maximus"}</small></div><p className="hint">Status fase: <b>{statusLabels[selected?.status]||"Belum tersedia"}</b></p></article>
 <article className="card"><h2>Dokumen & Lampiran</h2>{chronology.map(entry=><div className="document-group" key={entry.item.id}><strong>{entry.label}</strong>{fileList(entry.type==="report"?reportAttachments(entry.item.id):revisionAttachments(entry.item.id))}{!(entry.type==="report"?reportAttachments(entry.item.id):revisionAttachments(entry.item.id)).length&&<p className="hint">Belum ada lampiran.</p>}</div>)}</article>
 <article className="card"><h2>Progres Proyek</h2>{[1,2,3,4,5,6].map(n=>{const p=phases.find(x=>x.phase_number===n);return <div className="phaseitem" key={n}><span>{phaseNames[n-1]}</span><small>{statusLabels[p?.status]||"Terkunci"}</small></div>})}<p className="hint">Fase berikutnya hanya terbuka setelah fase aktif disetujui.</p></article>
 </aside></div></section></main>
}
