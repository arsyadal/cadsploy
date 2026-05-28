# PRD — Cadsploy

## 1. Ringkasan Produk

**Cadsploy** adalah platform deployment self-hosted seperti Vercel/Railway/Render, tetapi difokuskan untuk menjalankan aplikasi dari berbagai bahasa melalui **Dockerfile** dan/atau **Nixpacks**.

Target utama MVP adalah memungkinkan user melakukan:

1. Login dengan GitHub.
2. Import repository.
3. Set environment variables.
4. Deploy aplikasi ke server sendiri.
5. Mendapatkan subdomain otomatis seperti `nama-app.domain.com`.
6. Melihat build log dan runtime log.
7. Redeploy, restart, dan delete aplikasi.

Positioning:

> Self-hosted deployment platform for any stack. Like Vercel, but for Dockerized apps, APIs, workers, and full-stack projects.

---

## 2. Nama Produk

Nama yang dipilih: **Cadsploy**

Alasan:

- Lebih dekat dengan kata **deploy**.
- Lebih mudah dikaitkan dengan produk deployment.
- Lebih unik dibanding nama generik.
- Lebih jelas daripada `Ploiy`, karena `Ploiy` rawan dianggap typo dan agak sulit diucapkan.

Alternatif branding:

- Product name: **Cadsploy**
- CLI name: `cadsploy`
- Domain contoh: `cadsploy.com`, `cadsploy.dev`, atau `cadsploy.io`

---

## 3. Masalah yang Diselesaikan

Developer sering kesulitan deploy aplikasi karena harus mengatur server, Docker, reverse proxy, HTTPS, environment variables, logs, dan restart policy secara manual.

Platform seperti Vercel sangat mudah, tetapi lebih optimal untuk frontend/Next.js. Platform seperti Railway/Render lebih fleksibel, tetapi tidak selalu cocok untuk self-hosting penuh.

Cadsploy menyelesaikan masalah ini dengan menyediakan dashboard deployment sederhana di atas VPS milik sendiri.

---

## 4. Target User

### 4.1 Primary User

- Indie hacker
- Developer freelance
- Startup kecil
- Tim internal perusahaan
- Developer yang ingin punya platform deployment pribadi

### 4.2 Secondary User

- Agency web development
- Sekolah/kampus bootcamp
- DevOps pemula yang ingin mengelola deployment tanpa Kubernetes

---

## 5. Scope MVP

MVP harus fokus ke deployment yang benar-benar jalan dari awal sampai akhir.

### 5.1 In Scope MVP

- GitHub OAuth login.
- Import repository GitHub.
- Pilih branch.
- Deploy repo dengan **Dockerfile**.
- Deploy repo Node.js sederhana dengan **Nixpacks**.
- Build image di server.
- Run container di Docker Engine.
- Generate subdomain otomatis.
- Reverse proxy via Caddy atau Traefik.
- HTTPS otomatis untuk domain/subdomain.
- Environment variables per project.
- Build log.
- Runtime log.
- Restart deployment.
- Redeploy latest commit.
- Delete project/deployment.
- Basic resource limit CPU/RAM.

### 5.2 Out of Scope MVP

- Kubernetes.
- Multi-region deployment.
- Billing/payment.
- Team/organization management.
- Database add-ons otomatis.
- Preview deployment per pull request.
- Custom domain advanced.
- Horizontal scaling.
- Marketplace template.
- Observability kompleks seperti metrics dashboard, tracing, alerting.

---

## 6. Prinsip Produk

1. **Deploy dulu, fitur belakangan.**
   Fokus utama MVP adalah repo bisa live.

2. **Docker-first.**
   Semua aplikasi dianggap valid selama bisa menjadi container.

3. **Satu VPS dulu.**
   Jangan mulai dengan Kubernetes.

4. **Transparan.**
   User harus bisa melihat build log dan error dengan jelas.

5. **Aman secara default.**
   Container user tidak boleh berjalan privileged dan harus punya batas resource.

---

## 7. User Flow Utama

### 7.1 Login

1. User membuka dashboard Cadsploy.
2. User klik Login with GitHub.
3. Sistem redirect ke GitHub OAuth.
4. GitHub mengembalikan authorization code.
5. Backend menukar code dengan access token.
6. User masuk ke dashboard.

### 7.2 Import Repository

1. User klik New Project.
2. Sistem menampilkan daftar repository GitHub milik user.
3. User memilih repository.
4. User memilih branch.
5. User mengisi nama project.
6. User mengisi port aplikasi, contoh `3000`, `8000`, atau `8080`.
7. User memilih build method:
   - Dockerfile
   - Auto-detect via Nixpacks
8. User klik Create Project.

### 7.3 Set Environment Variables

1. User masuk ke project settings.
2. User menambah env variable:
   - `KEY`
   - `VALUE`
3. Sistem menyimpan value dalam bentuk terenkripsi.
4. Env akan digunakan saat build dan runtime sesuai konfigurasi.

### 7.4 Deploy

1. User klik Deploy.
2. Backend membuat deployment record.
3. Job deploy masuk ke queue Redis/BullMQ.
4. Worker mengambil job.
5. Worker clone repository.
6. Worker checkout branch/commit.
7. Worker build Docker image.
8. Worker stop container lama jika ada.
9. Worker run container baru.
10. Worker update reverse proxy.
11. Sistem menampilkan status deployment:
    - queued
    - building
    - running
    - failed
12. User mendapat URL live.

### 7.5 Logs

1. User membuka tab Logs.
2. Sistem menampilkan build logs dari proses deployment.
3. Sistem menampilkan runtime logs dari container.
4. Logs dapat di-refresh atau stream realtime.

### 7.6 Delete Project

1. User klik Delete Project.
2. Sistem meminta konfirmasi.
3. Backend stop dan remove container.
4. Backend remove image jika aman dilakukan.
5. Backend remove reverse proxy route.
6. Backend soft-delete/hard-delete data project.

---

## 8. Fitur MVP Detail

### 8.1 Authentication

Requirement:

- Login hanya via GitHub OAuth untuk MVP.
- Simpan user profile minimal:
  - GitHub ID
  - username
  - avatar URL
  - email jika tersedia
- Access token GitHub harus dienkripsi di database.

Acceptance Criteria:

- User bisa login via GitHub.
- User yang belum login tidak bisa akses dashboard.
- Session tetap aktif setelah browser refresh.
- User bisa logout.

---

### 8.2 Repository Import

Requirement:

- Sistem bisa mengambil daftar repository user dari GitHub API.
- User bisa pilih repo dan branch.
- Sistem menyimpan metadata repo:
  - owner
  - repo name
  - clone URL
  - default branch
  - selected branch

Acceptance Criteria:

- Repository GitHub user muncul di dashboard.
- User bisa membuat project dari repository.
- Jika token GitHub invalid, user diminta reconnect.

---

### 8.3 Build Method

MVP mendukung dua mode:

#### Dockerfile Mode

Sistem mencari `Dockerfile` di root repository.

Command contoh:

```bash
docker build -t cadsploy/project-id:deployment-id .
```

#### Nixpacks Mode

Sistem menggunakan Nixpacks untuk auto-detect project.

Command contoh:

```bash
nixpacks build . -n cadsploy/project-id:deployment-id
```

Prioritas MVP:

1. Dockerfile mode wajib.
2. Nixpacks untuk Node.js wajib minimal.
3. Bahasa lain via Nixpacks boleh masuk phase berikutnya.

Acceptance Criteria:

- Repo dengan Dockerfile valid bisa build.
- Repo Node.js sederhana tanpa Dockerfile bisa build via Nixpacks.
- Jika build gagal, log error tampil di dashboard.

---

### 8.4 Runtime Container

Requirement:

- Container dijalankan di Docker Engine.
- Container diberi nama unik.
- Container masuk ke network khusus Cadsploy.
- Container diberi restart policy.
- Container diberi resource limit.

Command contoh:

```bash
docker run -d \
  --name cadsploy-project-id \
  --network cadsploy-net \
  --restart unless-stopped \
  --memory 512m \
  --cpus 0.5 \
  -e PORT=3000 \
  cadsploy/project-id:deployment-id
```

Acceptance Criteria:

- Setelah build sukses, container berjalan.
- Jika container crash, status berubah menjadi failed/unhealthy.
- User bisa restart container dari dashboard.

---

### 8.5 Domain & Reverse Proxy

Requirement:

- Sistem membuat subdomain otomatis:

```text
project-slug.base-domain.com
```

Contoh:

```text
api-demo.cadsploy.dev
```

- Wildcard DNS harus diarahkan ke IP VPS:

```text
*.cadsploy.dev -> VPS_IP
```

- Reverse proxy menggunakan Caddy atau Traefik.
- HTTPS otomatis via Let's Encrypt.

Rekomendasi MVP: **Caddy** karena konfigurasi HTTPS lebih sederhana.

Acceptance Criteria:

- Setelah deploy sukses, URL project bisa dibuka.
- HTTPS aktif otomatis.
- Jika project dihapus, route proxy ikut hilang.

---

### 8.6 Logs

Requirement:

- Build log disimpan per deployment.
- Runtime log diambil dari Docker logs.
- Dashboard bisa menampilkan logs.

Sumber log:

```bash
docker logs container-name
```

Acceptance Criteria:

- User bisa melihat progress build.
- User bisa melihat error build.
- User bisa melihat log runtime setelah aplikasi berjalan.

---

### 8.7 Environment Variables

Requirement:

- User bisa membuat, mengedit, dan menghapus env variable.
- Value env disimpan terenkripsi.
- Env dikirim saat build dan/atau runtime.
- Secret tidak boleh tampil penuh setelah disimpan.

Acceptance Criteria:

- Env tersedia di container runtime.
- Secret tidak bocor di UI.
- Secret tidak tertulis polos di log aplikasi Cadsploy.

---

## 9. Arsitektur Sistem MVP

```text
Browser
  ↓
Next.js Dashboard
  ↓
Backend API
  ↓
PostgreSQL
Redis Queue
  ↓
Deploy Worker
  ↓
GitHub Repo → Build Image → Docker Container
  ↓
Caddy Reverse Proxy
  ↓
project.domain.com
```

### 9.1 Komponen

#### Frontend Dashboard

Fungsi:

- Login page
- Project list
- New project/import repo
- Deployment detail
- Logs viewer
- Env settings
- Project settings

Rekomendasi stack:

- Next.js
- Tailwind CSS
- shadcn/ui opsional

#### Backend API

Fungsi:

- Auth GitHub OAuth
- Manage user/project/deployment
- Manage env variables
- Create deploy job
- Stream/read logs
- Manage proxy route

Rekomendasi stack:

- NestJS atau Express/Fastify
- Prisma ORM
- PostgreSQL

#### Worker

Fungsi:

- Clone repo
- Build image
- Run/stop container
- Capture logs
- Update deployment status

Rekomendasi:

- Node.js worker dengan BullMQ
- Docker CLI untuk MVP

#### Database

Rekomendasi:

- PostgreSQL

#### Queue

Rekomendasi:

- Redis + BullMQ

#### Runtime

Rekomendasi:

- Docker Engine
- Docker network khusus `cadsploy-net`

#### Reverse Proxy

Rekomendasi:

- Caddy untuk MVP

---

## 10. Database Schema Awal

### users

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| github_id | string | unique |
| username | string | GitHub username |
| email | string nullable | email user |
| avatar_url | string nullable | avatar |
| github_access_token_encrypted | text | encrypted |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### projects

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| user_id | uuid | relation users |
| name | string | display name |
| slug | string | subdomain slug |
| repo_owner | string | GitHub owner |
| repo_name | string | GitHub repo |
| repo_url | string | clone URL |
| branch | string | selected branch |
| build_method | enum | dockerfile/nixpacks |
| app_port | integer | internal app port |
| status | enum | active/inactive/deleted |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### deployments

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | relation projects |
| commit_sha | string nullable | deployed commit |
| image_tag | string | Docker image tag |
| container_name | string nullable | running container |
| status | enum | queued/building/running/failed/canceled |
| started_at | timestamp nullable |  |
| finished_at | timestamp nullable |  |
| error_message | text nullable | failure reason |
| created_at | timestamp |  |

### env_vars

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | relation projects |
| key | string | env key |
| value_encrypted | text | encrypted value |
| scope | enum | build/runtime/both |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### build_logs

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| deployment_id | uuid | relation deployments |
| line | text | log line |
| stream | enum | stdout/stderr |
| created_at | timestamp |  |

### domains

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | relation projects |
| hostname | string | generated subdomain |
| type | enum | generated/custom |
| status | enum | active/inactive |
| created_at | timestamp |  |

---

## 11. API Endpoint MVP

### Auth

```text
GET  /auth/github
GET  /auth/github/callback
POST /auth/logout
GET  /auth/me
```

### Repositories

```text
GET /api/repos
GET /api/repos/:owner/:repo/branches
```

### Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
```

### Deployments

```text
POST /api/projects/:id/deployments
GET  /api/projects/:id/deployments
GET  /api/deployments/:id
GET  /api/deployments/:id/logs
POST /api/deployments/:id/restart
```

### Environment Variables

```text
GET    /api/projects/:id/env
POST   /api/projects/:id/env
PATCH  /api/projects/:id/env/:envId
DELETE /api/projects/:id/env/:envId
```

### Runtime Logs

```text
GET /api/projects/:id/runtime-logs
```

---

## 12. Deployment Job Lifecycle

Status deployment:

```text
queued -> building -> running
queued -> building -> failed
running -> failed
running -> canceled
```

Step worker:

1. Mark deployment as `building`.
2. Create temporary workdir.
3. Clone GitHub repo.
4. Checkout branch/commit.
5. Detect build method.
6. Build image.
7. Stop old container.
8. Run new container.
9. Health check HTTP.
10. Update Caddy route.
11. Mark deployment as `running`.
12. Cleanup temporary workdir.

Rollback MVP:

- Belum perlu full rollback otomatis.
- Jika deploy baru gagal, container lama tetap dibiarkan running selama memungkinkan.

---

## 13. Security Requirement

### 13.1 Token & Secret

- GitHub token harus dienkripsi sebelum disimpan.
- Env value harus dienkripsi.
- Secret tidak boleh muncul di frontend setelah disimpan.
- Secret tidak boleh dicetak ke application log.

### 13.2 Container Isolation

Container user tidak boleh:

- Berjalan dengan `--privileged`.
- Mount Docker socket.
- Mount root filesystem host.
- Mengakses network internal Cadsploy selain yang dibutuhkan.

Minimum runtime safety:

```bash
--memory 512m
--cpus 0.5
--restart unless-stopped
--security-opt no-new-privileges
```

### 13.3 Input Validation

Validasi wajib:

- Project slug hanya boleh lowercase, angka, dan dash.
- Env key hanya boleh format env valid.
- Repo owner/name harus dari GitHub API, bukan input bebas.
- Port harus angka valid.

### 13.4 Rate Limit

Untuk MVP minimal:

- Limit deploy per user per menit.
- Limit jumlah project per user.
- Limit ukuran log yang disimpan.

---

## 14. Non-Functional Requirement

### Performance

- Dashboard load < 3 detik pada koneksi normal.
- API response umum < 500ms kecuali proses deploy.
- Build berjalan async di worker.

### Reliability

- Deploy job tidak hilang jika API restart.
- Status deployment tetap tersimpan di database.
- Container lama tidak langsung dihapus sebelum container baru sukses.

### Scalability

MVP cukup 1 VPS.

Target awal:

- 10-30 project aktif.
- 1-3 build concurrent.
- Resource limit per container.

### Observability

MVP minimal:

- Application logs backend.
- Build logs per deployment.
- Runtime logs per project.

---

## 15. Infrastruktur MVP

Minimum VPS rekomendasi:

```text
4 vCPU
8 GB RAM
80 GB SSD
Ubuntu 22.04/24.04
Docker Engine
```

Service yang berjalan di VPS:

```text
Cadsploy Dashboard
Cadsploy API
Cadsploy Worker
PostgreSQL
Redis
Docker Engine
Caddy
User Containers
```

DNS requirement:

```text
A record: cadsploy.dev -> VPS_IP
A record: *.cadsploy.dev -> VPS_IP
```

---

## 16. Roadmap

### Phase 1 — Core MVP

- GitHub OAuth.
- Import repo.
- Dockerfile deployment.
- Basic dashboard.
- Build logs.
- Runtime logs.
- Subdomain otomatis.
- HTTPS otomatis.
- Restart/redeploy/delete.

### Phase 2 — Auto Detect

- Nixpacks support lebih stabil.
- Node.js, Python, Go basic support.
- Framework detection.
- Build command override.
- Start command override.

### Phase 3 — Custom Domain

- Add custom domain.
- DNS verification.
- HTTPS custom domain.

### Phase 4 — Webhook Auto Deploy

- GitHub webhook.
- Auto deploy on push.
- Deploy history.
- Manual rollback.

### Phase 5 — Add-ons

- Managed PostgreSQL per project.
- Managed Redis per project.
- Backup/restore.

### Phase 6 — Scale

- Multi-server worker/runtime.
- Container registry.
- Metrics dashboard.
- Team/project collaboration.
- Billing.

---

## 17. MVP Acceptance Criteria Global

MVP dianggap selesai jika:

1. User bisa login dengan GitHub.
2. User bisa import repository GitHub.
3. User bisa deploy repository yang memiliki Dockerfile.
4. User bisa deploy Node.js sederhana tanpa Dockerfile via Nixpacks.
5. Aplikasi live di subdomain otomatis.
6. HTTPS aktif.
7. User bisa melihat build logs.
8. User bisa melihat runtime logs.
9. User bisa set environment variables.
10. User bisa redeploy.
11. User bisa restart container.
12. User bisa delete project.
13. Container user punya CPU/RAM limit.
14. Jika deploy gagal, error terlihat jelas di dashboard.

---

## 18. Risiko Teknis

### Risiko 1: Build arbitrary code berbahaya

Mitigasi:

- Jangan mount Docker socket ke container user.
- Jalankan build dengan limit resource.
- Batasi user awal/private beta.

### Risiko 2: Server penuh karena image/log

Mitigasi:

- Cleanup temporary folder setelah build.
- Batasi jumlah deployment history.
- Batasi ukuran log.
- Tambahkan scheduled cleanup Docker image lama.

### Risiko 3: Port aplikasi salah

Mitigasi:

- User wajib mengisi app port.
- Tambahkan health check.
- Tampilkan error jika app tidak listen di port tersebut.

### Risiko 4: HTTPS gagal

Mitigasi:

- Validasi DNS wildcard sebelum deploy.
- Tampilkan status domain.
- Simpan error dari Caddy/Traefik.

---

## 19. Task Breakdown Eksekusi

### Milestone 1 — Project Foundation

- Setup monorepo atau repo app.
- Setup frontend dashboard.
- Setup backend API.
- Setup PostgreSQL.
- Setup Prisma/schema.
- Setup Redis.
- Setup BullMQ worker.

### Milestone 2 — Auth GitHub

- Implement GitHub OAuth.
- Implement session/cookie auth.
- Store user profile.
- Encrypt GitHub token.
- Add logout.

### Milestone 3 — Project Import

- Fetch GitHub repositories.
- Fetch branches.
- Create project form.
- Save project metadata.
- Validate slug and port.

### Milestone 4 — Deploy Worker

- Create deployment record.
- Push job to queue.
- Clone repository.
- Build Docker image.
- Capture build logs.
- Run container.
- Save deployment status.

### Milestone 5 — Proxy & Domain

- Setup Caddy.
- Create Docker network.
- Generate subdomain.
- Add/update proxy route.
- Verify HTTPS.

### Milestone 6 — Logs & Runtime Actions

- Show build logs.
- Show runtime logs.
- Implement restart.
- Implement redeploy.
- Implement delete project.

### Milestone 7 — Env Variables & Security

- CRUD env variables.
- Encrypt env values.
- Inject env into container.
- Add CPU/RAM limits.
- Add basic rate limit.

### Milestone 8 — MVP Polish

- Improve dashboard UX.
- Add empty states.
- Add error messages.
- Add deployment status badges.
- Test with sample apps.

---

## 20. Test Scenarios MVP

### Test 1: Deploy Dockerfile Node App

Given repo memiliki Dockerfile valid, when user deploy, then app live di subdomain HTTPS.

### Test 2: Build Failure

Given repo memiliki Dockerfile error, when user deploy, then status menjadi failed dan log error tampil.

### Test 3: Runtime Failure

Given app crash setelah start, when container berhenti, then status project berubah failed/unhealthy.

### Test 4: Env Variable

Given user menambahkan env `APP_NAME=Cadsploy`, when app membaca env, then value tersedia di runtime.

### Test 5: Delete Project

Given project aktif, when user delete project, then container stop, route proxy hilang, dan URL tidak lagi aktif.

---

## 21. Definisi Done MVP

Cadsploy MVP selesai jika sudah bisa dipakai untuk deploy minimal:

1. Aplikasi Node.js Express dengan Dockerfile.
2. Aplikasi Next.js standalone dengan Dockerfile.
3. Aplikasi Node.js sederhana via Nixpacks.

Dan semua aplikasi tersebut bisa:

- Live di subdomain HTTPS.
- Menampilkan logs.
- Diredeploy.
- Direstart.
- Dihapus.

---

## 22. Catatan Implementasi Awal

Untuk mempercepat development, gunakan satu VPS/local server dulu.

Urutan implementasi paling aman:

1. Buat dashboard dan API basic.
2. Buat deploy manual dari repo public.
3. Tambahkan GitHub OAuth.
4. Tambahkan repo private via token.
5. Tambahkan Caddy route otomatis.
6. Tambahkan env encryption.
7. Tambahkan logs dan polish UI.

Jangan mulai dari Kubernetes, billing, atau multi-server sebelum MVP deploy dasar benar-benar stabil.
