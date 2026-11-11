"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) {
        setMessage(result.error.message);
      } else {
        setMessage("Berhasil masuk.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Koneksi ke layanan autentikasi gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authbox">
      <h2>Masuk ke CPR</h2>
      <p>Gunakan akun yang telah terdaftar untuk mengakses ruang proyek.</p>
      <input aria-label="Email" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input aria-label="Password" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <div className="authactions">
        <button disabled={busy || !email.trim() || password.length < 6} onClick={submit}>Masuk</button>
      </div>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
