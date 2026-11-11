# Maximus CPR

Client Project Report — aplikasi modular untuk pelaporan proyek klien berbasis fase, revisi, persetujuan, kolaborasi berkas, dan ekspor PDF.

## Current version

**v1.1.0** — pemisahan deployment Admin dan Client.

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

**Catatan validasi:** milestone ini mencatat pemisahan jalur deployment. Pengujian penolakan silang role (akun Client ditolak di Admin dan akun Admin ditolak di Client), termasuk verifikasi server-side dan RLS, masih menjadi pekerjaan berikutnya. Jangan menganggap isolasi role sudah lulus hanya karena kedua URL berbeda.

### Aturan pencatatan versi berikutnya

- Naikkan versi hanya setelah perubahan selesai, deployment berhasil, dan skenario pengujian terkait lulus.
- Catat setiap versi sebagai entri baru di atas versi sebelumnya; jangan menghapus riwayat versi lama.
- Gunakan patch version untuk perbaikan kecil yang sudah tervalidasi (contoh: `1.1.1`).
- Gunakan minor version untuk milestone fitur atau perubahan kemampuan yang lebih besar (contoh: `1.2.0`).
- Setiap entri mencantumkan tanggal, ringkasan perubahan, deployment yang diuji, dan hasil validasi.
- Jika build atau pengujian gagal, jangan tetapkan versi tersebut sebagai milestone rilis.

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
