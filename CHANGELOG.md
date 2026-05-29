# Changelog - Cadsploy

Semua perubahan signifikan dan penambahan fitur pada platform Cadsploy akan dicatat dalam berkas ini berdasarkan format **Keep a Changelog** dan mengikuti prinsip **Semantic Versioning**.

---

## [0.3.0] - 2026-05-29

### Added (Fitur Baru)
- **Persistent Volumes / File Storage**:
  - Dukungan penyimpanan file persisten (bind mount) agar file (seperti SQLite atau folder uploads) survive saat container dideploy ulang.
  - Integrasi visual manajemen volume (tambah dan hapus) langsung pada dashboard proyek.
  - Penanganan konversi path Windows ke WSL (`/mnt/c/...`) otomatis oleh worker sebelum diikat ke container.
- **Live Container Resource Monitoring**:
  - Panel visual monitoring CPU % dan Memory Usage (real-time) yang terhubung langsung dengan perintah `docker stats` WSL.
  - Interval polling stats otomatis setiap 5 detik di dashboard proyek Next.js.
- **Log Auto-Refresh Toggle**:
  - Checkbox toggle auto-refresh logs di panel runtime logs (memuat ulang log otomatis setiap 4 detik).

### Changed (Perubahan)
- Update skema Prisma dengan model `PersistentVolume` berelasi many-to-one ke `Project` dan menerapkan migrasi database.
- Penambahan endpoint API stats `/api/projects/:id/stats` dan endpoints manajemen volume di backend Fastify.

---

## [0.2.1] - 2026-05-29

### Added (Fitur Baru)
- **Database Backup & Restore Manager**:
  - Dukungan full backup dan restore database PostgreSQL (`pg_dump` & `pg_restore`) dan Redis (`save` & dump replacement) secara asinkron lewat BullMQ.
  - Manajemen backup terpadu pada UI dashboard proyek: status, ukuran dump dinamis, download secure via Fastify stream, pemulihan (restore) satu-klik, dan penghapusan bersih.
  - Fungsi penanganan konversi path drive-letter Windows (`C:`) ke path WSL (`/mnt/c/...`) guna mengatasi error bentrok separator pada perintah `docker cp`.
  - Mengabaikan direktori `/backups` pada berkas `.gitignore` untuk melindungi data pribadi agar tidak terunggah ke repositori.

### Changed (Perubahan)
- Penerapan migrasi tabel `DatabaseBackup` dan `BackupStatus` enums ke PostgreSQL lokal.

---

## [0.2.0] - 2026-05-28

### Added (Fitur Baru)
- **Managed Database Services**:
  - Penambahan modul deploy database PostgreSQL 16 (Alpine) dan Redis 7 (Alpine) langsung dari dashboard.
  - Alokasi Windows host port dinamis (mulai dari 5440 untuk PG dan 6380 untuk Redis) untuk akses dari database manager eksternal.
  - Enkripsi password database secara secure menggunakan AES-256-GCM sebelum disimpan ke database utama.
  - Toggle reveal password dan string koneksi database terformat pada dashboard.

---

## [0.1.0] - 2026-05-28

### Added (Fitur Baru)
- **Custom Domains Management**:
  - Manajemen custom domain interaktif di dashboard Next.js.
  - Pengerjaan penataan ulang Caddyfile (`infra/Caddyfile.generated`) secara otomatis oleh background worker setiap kali custom domain ditambah/dihapus, dilanjutkan dengan perintah `caddy reload` bersih di WSL.
- **Core Platform**:
  - Integrasi login GitHub (OAuth), klon repositori, build container otomatis via Dockerfile atau Nixpacks, dan proxy routing HTTP via Caddy.
