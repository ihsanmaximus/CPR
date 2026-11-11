# Maximus CPR

Client Project Report — aplikasi modular untuk pelaporan proyek klien berbasis fase, revisi, persetujuan, kolaborasi berkas, dan ekspor PDF.

## Current version

**v1.1.2** — pemisahan role Admin/Client, pengamanan RLS, dan penonaktifan pendaftaran mandiri.

Versi kanonis proyek disimpan pada file `VERSION`. Setiap milestone yang sudah diuji dan disepakati dicatat di bagian **Version history** di bawah ini.

## Architecture

- `apps/maximus`: workspace internal Maximus (Admin).
- `apps/client`: workspace klien (Client).
- `packages/cpr-core`: aturan domain dan tipe data bersama.
- `supabase/migrations`: skema database dan kebijakan Row Level Security (RLS) berversi.
- `supabase/functions`: alur kerja server-side dengan hak istimewa.

Admin dan Client merupakan dua aplikasi/deployment yang terpisah, tetapi menggunakan satu proyek Supabase untuk autentikasi dan data CPR. Pemisahan URL deployment **tidak menggantikan** pemeriksaan role dan kebijakan RLS; setiap aplikasi wajib menolak role yang tidak sesuai.

## Deployment

| Aplikasi | Netlify URL | Folder aplikasi |
|---|---|---|
| Admin / Maximus | https://cpr-admin.netlify.app | `apps/maximus` |
| Client | https://cpr-alt.netlify.app | `apps/client` |

Kedua deployment menggunakan backend Supabase CPR yang sama. Pastikan Base Directory, build configuration, dan environment variables masing-masing site mengarah ke aplikasi yang sesuai.

## Version history

### v1.1.0 — 2026-11-11
**Milestone: pemisahan link deployment Admin dan Client.**

- Menyediakan link deployment Netlify terpisah untuk Workspace Maximus (Admin) dan Ruang Klien (Client).
- Mempertahankan satu repository CPR dan satu backend Supabase bersama.
- Deployment Admin berhasil dibuka dan diuji menggunakan akun admin.
- Deployment Client tetap dipisahkan dari deployment Admin.

**Validasi:** pemisahan role Admin dan Client telah diuji pada browser mobile; akun Admin ditolak di aplikasi Client dan akun Client ditolak di aplikasi Admin. Pemeriksaan role server-side dan simulasi kebijakan RLS juga lulus.

## Agreed milestone roadmap

Milestone berikut sudah disepakati sebagai urutan pekerjaan. Statusnya **direncanakan**, bukan rilis yang sudah selesai. Nomor versi baru akan dipatenkan sebagai versi aktif setelah implementasi, deployment, dan pengujian berhasil.

| Target versi | Milestone | Kriteria selesai |
|---|---|---|
| **v1.1.2** | Pemisahan role Admin dan Client + penghapusan pendaftaran mandiri | **SELESAI.** Admin diterima di aplikasi Admin dan ditolak di Client; Client diterima di Client dan ditolak di Admin. Pemeriksaan server-side dan RLS aktif. Tombol dan alur Daftar akun dihapus dari kedua aplikasi agar pembuatan akun dilakukan secara terkontrol oleh pengelola. Kedua deployment Netlify berhasil. |
| **v1.1.3** | Perbaikan struktur layout dan tampilan | Struktur halaman, urutan panel, tata letak responsif, dan tampilan Workspace Maximus/Client diperbaiki serta diuji pada perangkat mobile dan desktop tanpa merusak fungsi yang sudah berjalan. |

**Catatan urutan:** v1.1.1 belum ditetapkan dalam roadmap ini. Jangan menganggapnya sudah dirilis atau mengubah nomor versi aktif hanya untuk mengisi urutan.

## Aturan pencatatan versi

- Naikkan versi hanya setelah perubahan selesai, deployment berhasil, dan skenario pengujian terkait lulus.
- Catat setiap versi sebagai entri baru di atas versi sebelumnya; jangan menghapus riwayat versi lama.
- Gunakan patch version untuk perbaikan yang sudah tervalidasi (contoh: `1.1.1`, `1.1.2`).
- Gunakan minor version untuk milestone fitur atau perubahan kemampuan yang lebih besar (contoh: `1.2.0`).
- Setiap entri mencantumkan tanggal, ringkasan perubahan, deployment yang diuji, dan hasil validasi.
- Jika build atau pengujian gagal, milestone tetap berstatus direncanakan/dalam pengerjaan dan tidak ditetapkan sebagai rilis.
- File `VERSION` hanya menunjukkan versi aktif yang sudah dirilis dan tervalidasi.

### v1.1.2 release notes — 2026-11-11

- Admin deployment: Netlify build `6af3f34838e416ec3269db91` — READY.
- Client deployment: Netlify build `6af3f3481ae8947bd2b7931f` — READY.
- Supabase role matrix checked under the `authenticated` database role: Ihsan and Abu pass the Admin predicate and do not have Client membership; Diris fails the Admin predicate and has Client membership.
- RLS update-policy simulation: Ihsan and Abu are authorized for the six project phases; Diris is authorized for zero phase updates. Test updates were rolled back.
- Uji browser yang dikirim pengguna memperlihatkan akun Admin ditolak di aplikasi Client dan akun Client ditolak di aplikasi Admin.
- Tombol Daftar akun serta pemanggilan `supabase.auth.signUp` dihapus dari kedua aplikasi. Pembuatan akun sekarang harus melalui proses admin yang terkontrol.
- Deployment terbaru Client dengan penghapusan daftar: `6af3fef4fb9dbde85e9839ec` — READY.
- Deployment Admin dengan penghapusan daftar: `6af3fef0b620470d820e72c7` — READY.

## Repository structure

```
apps/
  maximus/       # Admin workspace
  client/        # Client workspace
packages/
  cpr-core/      # Shared domain rules and types
supabase/
  migrations/    # Versioned schema and RLS
  functions/     # Privileged server-side workflows
README.md
VERSION
```
