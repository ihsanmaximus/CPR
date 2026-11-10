"use client";
import {useEffect,useMemo,useState} from "react";
import dynamic from "next/dynamic";
import "jodit/es2021/jodit.min.css";
const JoditEditor=dynamic(()=>import("jodit-react"),{ssr:false,loading:()=><div className="report-body-editor">Memuat editor...</div>});
import {AuthPanel,useSession} from "../lib/auth";
const phases=["Discovery & Brief","Riset & Analisis","Strategi & Solusi","Desain & Prototype","Pengembangan","Final Review & Launch"];
export default function MaximusHome(){
 const {session,ready}=useSession();

 const [phase,setPhase]=useState(0);
 const [title,setTitle]=useState("");
 const [summary,setSummary]=useState("");
 const [body,setBody]=useState("");
 const [internal,setInternal]=useState("");
 const [files,setFiles]=useState<File[]>([]);
 const [fileUrls,setFileUrls]=useState<string[]>([]);
 const [sent,setSent]=useState(false);
 const [clientReplied]=useState(false);
 const [draftSaved,setDraftSaved]=useState(false);
 const [msg,setMsg]=useState("");
 const joditConfig=useMemo(()=>({readonly:false,placeholder:"Tulis laporan lengkap...",height:420,minHeight:300,toolbarAdaptive:true,toolbarSticky:false,showCharsCounter:false,showWordsCounter:false,showXPathInStatusbar:false}),[]);
 useEffect(()=>{if(typeof window!=="undefined"){const d=localStorage.getItem("cpr-maximus-internal-note");if(d)setInternal(d)}},[]);
 useEffect(()=>()=>fileUrls.forEach(URL.revokeObjectURL),[fileUrls]);
 function addFiles(list:FileList|null){if(!list)return;const next=Array.from(list);setFiles(old=>[...old,...next]);setFileUrls(old=>[...old,...next.map(f=>URL.createObjectURL(f))])}
 function saveDraft(){localStorage.setItem("cpr-maximus-draft",JSON.stringify({title,summary,body,internal,phase}));setDraftSaved(true);setMsg("Draft tersimpan.");}function send(){localStorage.setItem("cpr-maximus-draft",JSON.stringify({title,summary,body,internal,phase}));localStorage.setItem("cpr-maximus-internal-note",internal);setSent(true);setMsg("Laporan disimpan — Menunggu balasan klien.");window.scrollTo({top:0,behavior:"smooth"});}
 async function signOut(){await (await import("../lib/supabase")).supabase.auth.signOut()}
 if(!ready)return <div className="authpage">Memuat sesi…</div>;
 if(!session)return <div className="authpage"><AuthPanel/></div>;
 return <main className="shell"><aside className="sidebar"><div className="brand">M <span>MAXIMUS CPR</span></div><div className="project">WORKSPACE INTERNAL<br/><small>Workspace Maximus</small></div><nav>{phases.map((p,i)=><a key={p} className={i===phase?"active":""} onClick={()=>{setPhase(i);setSent(false);setTitle("");setSummary("");setBody("")}}>{String(i+1).padStart(2,"0")} · {p}</a>)}</nav><button className="signout" onClick={signOut}>Keluar</button></aside>
 <section className="main"><header><strong>Client Project Report</strong><span className="role">MAXIMUS · {session.user.email}</span></header>
 {sent?<div className="client-preview"><div className="client-top"><span>Proyek / Workspace Maximus</span><span>Ruang Klien</span></div><div className="client-content"><div className="client-heading"><div><small>FASE {String(phase+1).padStart(2,"0")}</small><h1>{phases[phase]}</h1></div><span className="waiting">Menunggu persetujuan klien</span></div><div className="client-grid"><div className="client-left"><article className="report client-report"><div className="report-origin">LAPORAN DARI MAXIMUS</div><div className="client-title-row"><h2 className="client-report-title">{title}</h2>{!clientReplied&&<button type="button" className="icon-edit" onClick={()=>setSent(false)} aria-label="Edit laporan" title="Edit laporan">✎</button>}</div><div className="summary-quote">{summary}</div><h3 className="full-report-heading">Laporan Lengkap</h3><div className="rendered-report plain-report-text" dangerouslySetInnerHTML={{__html:body}}/></article></div><aside><article className="report"><h3>Riwayat Revisi</h3><div className="revision-entry"><span className="revision-dot"></span><div><strong>Laporan 1 · Maximus</strong><small>{summary}</small></div><time>Baru</time></div></article><article className="report"><h3>Dokumen & Lampiran</h3>{files.map((f,i)=><div className="client-file" key={i}>{f.type.startsWith("image/")?<img className="client-thumb" src={fileUrls[i]} alt={f.name}/>:<span className="thumb">{f.type==="application/pdf"?"PDF":"FILE"}</span>}<span><b>{f.name}</b><small>{(f.size/1024).toFixed(0)} KB · Lampiran dari Maximus</small></span></div>)}{!files.length&&<p className="hint">Belum ada lampiran.</p>}</article></aside></div></div></div>
 :<div className="content"><div className="phase"><span>FASE {String(phase+1).padStart(2,"0")}</span><div><h1>{phases[phase]}</h1><p>Susun laporan, simpan versi, dan kirim ke ruang klien.</p></div></div>{msg&&<div className="notice">{msg}</div>}
 <div className="editorgrid"><div className="work-left"><article className="report"><div className="tag">FASE {String(phase+1).padStart(2,"0")} · WORKSPACE MAXIMUS</div><label className="field-label">Judul<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Masukkan judul laporan"/></label>
 <label className="field-label">Ringkasan Laporan<textarea className="summary-input" value={summary} onChange={e=>setSummary(e.target.value)} rows={4} placeholder="Tulis ringkasan laporan..."/></label>
 <label className="field-label">Laporan Lengkap<JoditEditor value={body} config={joditConfig} onBlur={newContent=>setBody(newContent)} onChange={()=>{}}/></label>
 <h3>Catatan Internal</h3><textarea value={internal} onChange={e=>setInternal(e.target.value)} rows={5} placeholder="Tulis catatan internal..."/>
 <div className="actions"><button onClick={saveDraft}>Draft</button><button className="primary" onClick={send}>Simpan</button></div>{draftSaved&&<small className="saved-label">Draft tersimpan di perangkat ini.</small>}</article></div>
 <aside className="work-right"><article className="report"><h3>Riwayat Revisi</h3><p className="hint">Riwayat revisi akan tampil setelah laporan disimpan.</p></article><article className="report"><h3>Dokumen & Lampiran</h3><p className="hint">Unggah dokumen atau gambar pendukung.</p><label className="uploadbox">＋ Upload Lampiran<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple onChange={e=>addFiles(e.target.files)}/></label><div className="attachmentlist">{files.map((f,i)=><div className="attachmentitem" key={i}>{f.type.startsWith("image/")?<img src={fileUrls[i]} alt={f.name}/>:<span className="thumb">{f.type==="application/pdf"?"PDF":"FILE"}</span>}<span><b>{f.name}</b><small>{(f.size/1024).toFixed(0)} KB</small></span><button type="button" className="remove-file" aria-label={"Hapus "+f.name} title="Hapus lampiran" onClick={()=>{URL.revokeObjectURL(fileUrls[i]);setFiles(old=>old.filter((_,n)=>n!==i));setFileUrls(old=>old.filter((_,n)=>n!==i));}}>×</button></div>)}</div>{!files.length&&<p className="hint">Belum ada lampiran.</p>}</article></aside></div></div>}</section></main>
}
