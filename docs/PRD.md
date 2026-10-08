# Product Requirements Document (PRD)

## Monalertics — Website, Domain & SSL Monitoring with Analytics

**Version:** 1.0  
**Status:** Draft  
**Date:** Juni 2026  
**Author:** Product Owner + CodeBuddy

---

## 1. Executive Summary

**Monalertics** adalah platform **SaaS multi-tenant** untuk memantau kesehatan aset digital: **website uptime**, **SSL certificate expiry**, dan **domain expiry**. Platform ini mengirimkan **alert otomatis** melalui email, Telegram, dan Discord ketika terjadi insiden atau mendekati tanggal kedaluwarsa.

Selain monitoring, Monalertics dilengkapi dengan **analytics sederhana** (histori uptime, respons time, tren insiden) dan kemampuan **screenshot halaman utama** sebagai bukti visual status website.

Nama **Monalertics** berasal dari gabungan:
- **Mon**itoring
- **Alert**
- Anal**ytics**

---

## 2. Vision

> Menyediakan solusi monitoring aset digital yang **mudah dipakai**, ** hemat biaya**, dan **cocok untuk ekosistem shared hosting**, sehingga pemilik website kecil-menengah dapat memantau ketersediaan & keamanan aset digital mereka tanpa perlu infrastruktur server sendiri.

---

## 3. Goals & Objectives

### Primary Goals
1. Memantau status **up/down** website secara berkala.
2. Memantau **tanggal kedaluwarsa SSL certificate**.
3. Memantau **tanggal kedaluwarsa domain**.
4. Mengirimkan **notifikasi alert** via email, Telegram, dan Discord.
5. Menyediakan **screenshot visual** halaman utama website saat terjadi perubahan status.
6. Menyediakan **dashboard analytics** histori uptime & performa.

### Secondary Goals (Automation)
1. Auto-remediation sederhana (misal: restart service via webhook).
2. Scheduled report mingguan/bulanan untuk pengguna.
3. Integrasi dengan channel lain (Slack, WhatsApp, PagerDuty) di masa depan.
4. Alert escalation rule (jika alert tidak diakui dalam X menit).

---

## 4. Target Users

| Segmen | Karakteristik | Kebutuhan Utama |
|--------|--------------|-----------------|
| **Pemilik Website / Blogger** | Punya 1–10 website pribadi atau bisnis kecil | Notifikasi cepat saat website down |
| **Freelancer / Agency** | Mengelola banyak website klien | Multi-monitor, dashboard, laporan |
| **Startup / SaaS kecil** | Memerlukan pemantauan uptime & SSL | Alert channel modern (Telegram/Discord) |
| **Non-teknis** | Tidak ingin konfigurasi rumit | Setup 1 klik, notifikasi jelas |

---

## 5. Core Features

### 5.1 User Management & Authentication
- Register/login via email + password.
- Verifikasi email.
- Reset password.
- Profile & notification preference.
- Multi-tenant: setiap user punya workspace sendiri.

### 5.2 Monitor Management
User dapat membuat **Monitor** dengan tipe:

#### A. Website Uptime Monitor
- **URL** yang dipantau (HTTP/HTTPS).
- **Interval pemantauan**: 1 menit, 5 menit, 15 menit, 30 menit, 1 jam, dll.
- **Expected status code**: default 200–299.
- **Expected response time threshold** (misal: > 3000 ms dianggap slow).
- **Timeout** konfigurasi.
- **Screenshot halaman utama** saat status berubah (down → up atau up → down).

#### B. SSL Certificate Monitor
- **Domain/hostname** yang dipantau.
- **Expiry warning threshold**: 30, 14, 7, 3, 1 hari sebelum expired.
- Deteksi sertifikat **self-signed**, **invalid**, atau **tidak terpercaya**.

#### C. Domain Expiry Monitor
- **Domain name** yang dipantau.
- **Expiry warning threshold**: 60, 30, 14, 7, 1 hari sebelum expired.
- WHOIS lookup terbatas (banyak registry membatasi rate; bisa pakai data publik atau integrasi WHOIS API berbayar di masa depan).

### 5.3 Alert & Notification
- **Channels**: Email, Telegram Bot, Discord Webhook.
- **Event yang memicu alert**:
  - Website down.
  - Website kembali up.
  - Respons time melebihi threshold.
  - SSL akan expired / sudah expired / invalid.
  - Domain akan expired.
  - Screenshot gagal diambil.
- **Alert fatigue control**:
  - Jeda antar alert untuk insiden yang sama (deduplication).
  - Resolved notification otomatis saat kondisi kembali normal.
  - Silence window / maintenance mode.

### 5.4 Screenshot Capture
- Screenshot halaman utama website saat:
  - Pertama kali monitor dibuat.
  - Status website berubah.
  - User menekan tombol "Capture Now".
- Screenshot disimpan sebagai file/image object (shared hosting friendly: simpan di disk lokal atau object storage jika tersedia).
- Opsi thumbnail/preview di dashboard.

### 5.5 Dashboard & Analytics
- **Overview**: total monitor, monitor up/down, insiden aktif.
- **Status page pribadi** (opsional): URL publik untuk melihat status monitor-mil user.
- **Histori uptime** per monitor (24 jam, 7 hari, 30 hari, 90 hari).
- **Grafik respons time**.
- **Log insiden**: waktu, durasi, penyebab, screenshot.
- **Export laporan** PDF/CSV (future).

### 5.6 SaaS / Subscription (Multi-tenant)
- **Plans/Paket**:
  - **Free**: 3 monitor, interval 30 menit, email only, retensi 7 hari.
  - **Basic**: 10 monitor, interval 5 menit, email + Telegram/Discord, retensi 30 hari.
  - **Pro**: 50 monitor, interval 1 menit, semua channel, retensi 90 hari.
  - **Enterprise**: unlimited, custom, white-label.
- **Billing**: manual / transfer bank (MVP), integrasi payment gateway (future).
- **Quota enforcement**: batasi jumlah monitor & interval sesuai paket.

---

## 6. Technology Stack

| Layer | Pilihan | Alasan |
|-------|---------|--------|
| **Framework** | Next.js 15+ (App Router) | Full-stack React, cocok untuk SaaS dashboard, API Routes, SSR/SEO untuk landing page. |
| **Language** | TypeScript | Type safety, skalabilitas. |
| **Architecture** | **Modular Monolith** | Single deployment unit, domain boundaries jelas, mudah maintain & scale nanti. |
| **Database** | **PostgreSQL** | Relational, reliable, mendukung advanced query & JSON, compatible dengan Prisma. |
| **ORM** | Prisma | Migration mudah, type-safe query, mendukung PostgreSQL. |
| **Scheduler** | cPanel Cron / scheduled task + internal job queue table | Tanpa Redis/RabbitMQ, cocok untuk shared hosting. |
| **Email** | SMTP dari shared hosting atau service eksternal (Resend, Mailgun, SendGrid) | Email alert utama. |
| **Screenshot** | Layanan screenshot eksternal free tier / PageSpeed Insights API / browserless self-hosted di VPS terpisah | Hindari menjalankan headless browser di shared hosting. |
| **Auth** | NextAuth.js atau custom JWT session | Sederhana dan shared-hosting friendly. |
| **UI** | Tailwind CSS + shadcn/ui | Cepat, konsisten, accessible. |
| **Charts** | Recharts | Visualisasi analytics. |
| **Event Bus** | In-process EventEmitter (Node.js) | Komunikasi antar module tanpa HTTP overhead. |
| **Hosting** | Shared hosting dengan Node.js support **atau** VPS jika memungkinkan | Next.js butuh Node.js runtime; pastikan shared hosting mendukung. |

### 6.1 Modular Monolith Architecture

Arsitektur modular monolith dipilih karena:
- Single deployment unit — cocok untuk shared hosting.
- Domain boundaries jelas: `monitoring`, `alert`, `screenshot`, `billing`, `auth`, `scheduler`.
- Tiap module punya service, repository, dan types sendiri.
- Komunikasi antar module pakai **in-process event bus** (bukan HTTP).
- Nanti bisa dipecah jadi microservice jika diperlukan tanpa refactor besar.

#### Struktur Project

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Route group: login, register
│   ├── (dashboard)/            # Route group: main app
│   │   ├── monitors/
│   │   ├── alerts/
│   │   └── analytics/
│   └── api/                    # API Routes (cron, webhook)
│       └── cron/
├── modules/
│   ├── auth/                   # Authentication module
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.types.ts
│   │   └── auth.middleware.ts
│   ├── monitor/                # Monitoring module
│   │   ├── monitor.service.ts
│   │   ├── monitor.repository.ts
│   │   ├── monitor.types.ts
│   │   ├── uptime-checker.service.ts
│   │   ├── ssl-checker.service.ts
│   │   └── domain-checker.service.ts
│   ├── alert/                  # Alert & notification module
│   │   ├── alert.service.ts
│   │   ├── channels/
│   │   │   ├── email.channel.ts
│   │   │   ├── telegram.channel.ts
│   │   │   └── discord.channel.ts
│   │   └── alert.types.ts
│   ├── screenshot/             # Screenshot module
│   │   ├── screenshot.service.ts
│   │   ├── providers/
│   │   │   ├── provider.interface.ts
│   │   │   ├── pagespeed.provider.ts
│   │   │   └── external-api.provider.ts
│   │   └── screenshot.types.ts
│   ├── billing/                # Billing/subscription module (future)
│   │   ├── billing.service.ts
│   │   ├── billing.repository.ts
│   │   └── billing.types.ts
│   └── scheduler/              # Job scheduler module
│       ├── scheduler.service.ts
│       ├── job-queue.service.ts   # database-backed
│       └── scheduler.types.ts
├── shared/
│   ├── kernel/                 # cross-cutting concerns
│   │   ├── event-bus.ts        # in-process event emitter
│   │   ├── middleware.ts
│   │   └── error-handler.ts
│   ├── db/
│   │   ├── prisma.ts           # prisma client singleton
│   │   └── migrations/
│   ├── config/
│   │   └── env.ts              # env validation (zod)
│   └── utils/
│       ├── logger.ts
│       └── http-client.ts
└── prisma/
    └── schema.prisma
```

#### Aturan Modular Monolith

| Aturan | Detail |
|--------|--------|
| Module hanya boleh import dari `shared/` | Bukan dari module lain secara langsung. |
| Inter-module communication pakai **event bus** | In-process `EventEmitter`, berbasis `emit()` / `on()`. |
| Setiap module punya **types, service, repository** sendiri | Clear separation of concerns. |
| Prisma client hanya diakses lewat repository | Service tidak langsung query DB. |
| Frontend di `app/` hanya panggil service dari module | Clean boundary, tidak import internal module. |

#### Contoh Event Flow

```
monitor/uptime-checker → detect DOWN
  → emit("monitor.status_changed", { monitorId, newStatus: "DOWN" })
    → alert/ listener → kirim notifikasi ke Telegram & Email
    → screenshot/ listener → ambil screenshot sebagai bukti
```

> **Catatan shared hosting:** Next.js umumnya lebih nyaman di VPS, tetapi beberapa shared hosting sudah mendukung Node.js. Jika shared hosting sangat terbatas, pertimbangkan **Next.js sebagai standalone app** yang dijalankan melalui cron/Node.js process manager. Alternatif: deploy frontend ke Vercel, backend/API di shared hosting.

---

## 7. Architecture Overview

### 7.1 High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   User      │────▶│  Next.js App │────▶│   PostgreSQL/MySQL  │
│  (Browser)  │     │  (Dashboard) │     │   (Data & Job Queue)│
└─────────────┘     └──────────────┘     └─────────────────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │  Cron / Scheduler │
                   │  (cPanel Cron)    │
                   └────────┬─────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ HTTP Check  │  │   SSL Check │  │  Domain Check │
    └─────────────┘  └─────────────┘  └─────────────┘
            │               │               │
            ▼               ▼               ▼
    ┌─────────────────────────────────────────────┐
    │         Screenshot Service (external)      │
    └─────────────────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │   Alert Dispatcher              │
            │  (Email / Telegram / Discord)  │
            └───────────────────────────────┘
```

### 7.2 Shared Hosting Adaptation

Karena tidak ada Redis/Queue worker, gunakan pendekatan **database-backed job queue**:
- Tabel `jobs` menyimpan daftar tugas yang akan dijalankan.
- Cron dari cPanel memanggil endpoint `/api/cron/run` setiap menit.
- Endpoint tersebut mengambil job yang `scheduled_at <= NOW()` dan mengeksekusinya.
- Job bisa berupa: check uptime, check SSL, check domain, send alert, capture screenshot.

Keuntungan:
- Tidak perlu Redis/RabbitMQ.
- Cron cPanel hanya perlu trigger HTTP request.
- Mudah di-debug karena semua job tersimpan di database.

---

## 8. Data Model (ERD)

### Entitas Utama

- `users` — akun pengguna.
- `workspaces` — tenant/workspace, satu user bisa punya beberapa workspace (future).
- `subscriptions` / `plans` — paket langganan.
- `monitors` — konfigurasi monitoring.
- `monitor_checks` — hasil pengecekan individu.
- `incidents` — kejadian insiden.
- `alerts` — log notifikasi yang dikirim.
- `notification_channels` — integrasi Email/Telegram/Discord per monitor.
- `screenshots` — metadata file screenshot.
- `jobs` — database-backed job queue.

### Skema Ringkasan

```prisma
model User {
  id            String     @id @default(uuid())
  email         String     @unique
  passwordHash  String
  name          String?
  emailVerified DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  workspaces    WorkspaceMember[]
}

model Workspace {
  id            String         @id @default(uuid())
  name          String
  planId        String
  plan          Plan           @relation(fields: [planId], references: [id])
  members       WorkspaceMember[]
  monitors      Monitor[]
  createdAt     DateTime       @default(now())
}

model Plan {
  id                  String      @id @default(cuid())
  name                String      // Free, Basic, Pro
  maxMonitors         Int
  minIntervalSeconds  Int         // 60, 300, 1800
  retentionDays       Int
  supportsTelegram    Boolean
  supportsDiscord     Boolean
}

model Monitor {
  id                  String       @id @default(uuid())
  workspaceId         String
  workspace           Workspace    @relation(fields: [workspaceId], references: [id])
  name                String
  type                MonitorType  // UPTIME, SSL, DOMAIN
  target              String       // URL / hostname / domain
  intervalSeconds     Int          // 60, 300, 900, dll
  isActive            Boolean      @default(true)
  settings            Json         // threshold, expectedStatus, timeout, dll
  lastCheckedAt       DateTime?
  lastStatus          MonitorStatus @default(UNKNOWN)
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  checks              MonitorCheck[]
  incidents           Incident[]
  notificationConfigs NotificationConfig[]
}

enum MonitorType { UPTIME SSL DOMAIN }
enum MonitorStatus { UP DOWN WARNING UNKNOWN }

model MonitorCheck {
  id            String        @id @default(uuid())
  monitorId     String
  monitor       Monitor       @relation(fields: [monitorId], references: [id])
  status        MonitorStatus
  responseTimeMs Int?
  statusCode    Int?
  errorMessage  String?
  checkedAt     DateTime      @default(now())
  screenshotId  String?
  screenshot    Screenshot?   @relation(fields: [screenshotId], references: [id])
}

model Incident {
  id            String    @id @default(uuid())
  monitorId     String
  monitor       Monitor   @relation(fields: [monitorId], references: [id])
  startedAt     DateTime  @default(now())
  resolvedAt    DateTime?
  durationSeconds Int?
  cause         String?
  severity      String    // CRITICAL, WARNING
  alertsSent    Alert[]
}

model Alert {
  id              String   @id @default(uuid())
  incidentId      String?
  incident        Incident? @relation(fields: [incidentId], references: [id])
  channelType     String   // EMAIL, TELEGRAM, DISCORD
  recipient       String
  status          String   // PENDING, SENT, FAILED
  sentAt          DateTime?
  content         String   // rendered message
}

model NotificationConfig {
  id          String    @id @default(uuid())
  monitorId   String
  monitor     Monitor   @relation(fields: [monitorId], references: [id])
  channelType String    // EMAIL, TELEGRAM, DISCORD
  target      String    // email address / chat_id / webhook URL
  isActive    Boolean   @default(true)
}

model Screenshot {
  id          String   @id @default(uuid())
  monitorId   String
  url         String   // URL asli yang di-screenshot
  imagePath   String   // path ke file / object storage URL
  capturedAt  DateTime @default(now())
  checks      MonitorCheck[]
}

model Job {
  id          String    @id @default(uuid())
  type        String    // UPTIME_CHECK, SSL_CHECK, DOMAIN_CHECK, SCREENSHOT, ALERT
  payload     Json
  status      JobStatus @default(PENDING)
  scheduledAt DateTime
  startedAt   DateTime?
  completedAt DateTime?
  error       String?
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  createdAt   DateTime  @default(now())
}

enum JobStatus { PENDING PROCESSING COMPLETED FAILED }
```

---

## 9. Monitoring Logic

### 9.1 Uptime Check
1. Ambil monitor bertipe `UPTIME` yang `isActive = true` dan `lastCheckedAt` + `intervalSeconds` <= sekarang.
2. Lakukan HTTP/HTTPS request ke `target`.
3. Catat status code, response time, error (jika ada).
4. Simpan ke `MonitorCheck`.
5. Jika status berubah (UP → DOWN atau DOWN → UP):
   - Buat/update `Incident`.
   - Trigger alert ke semua channel aktif.
   - Trigger screenshot capture.

### 9.2 SSL Check
1. Ambil monitor bertipe `SSL`.
2. Lakukan TLS handshake ke `target` (hostname:port 443).
3. Ambil certificate info (issuer, valid from, valid until, subject).
4. Jika `validUntil` <= threshold warning/expired, buat incident & alert.

### 9.3 Domain Check
1. Ambil monitor bertipe `DOMAIN`.
2. Lakukan WHOIS lookup (menggunakan library WHOIS atau API eksternal).
3. Parse `Registry Expiry Date`.
4. Jika <= threshold, buat incident & alert.

> **Catatan:** WHOIS publik sering di-rate-limit. Untuk MVP, bisa menggunakan library Node.js `whois` dengan caching. Jika tidak reliable, tandai sebagai fitur "best effort".

---

## 10. Screenshot Strategy

### Kendala Shared Hosting
Menjalankan **Puppeteer/Playwright** di shared hosting sangat tidak direkomendasikan karena:
- Membutuhkan Chromium/Chrome (~100MB+).
- RAM dan CPU terbatas.
- Proses background tidak stabil.
- Banyak shared hosting tidak mengizinkan long-running binary.

### Rekomendasi Solusi

#### Opsi 1: External Screenshot API (Recommended untuk MVP)
Menggunakan layanan screenshot pihak ketiga yang menyediakan **free tier**:
- **PageSpeed Insights API** (Google) — gratis, tetapi screenshot hanya versi mobile dan kualitas terbatas.
- **ScreenshotOne / Urlbox / ScreenshotAPI** — biasanya punya free tier bulanan.
- Keuntungan: tidak perlu resource server, cepat, reliable.
- Kekurangan: ketergantungan pihak ketiga, limit kuota free tier.

#### Opsi 2: Browserless / Headless Service di VPS Terpisah
- Deploy microservice screenshot ke VPS murah/free tier (misal: Oracle Cloud Free Tier, Railway, Fly.io).
- Aplikasi shared hosting memanggil service tersebut via HTTP.
- Keuntungan: lebih fleksibel, bisa self-hosted.
- Kekurangan: butuh maintenance VPS tambahan.

#### Opsi 3: Hybrid (MVP)
- Untuk awal, gunakan **external free API**.
- Sediakan abstraksi (`ScreenshotProvider`) sehingga mudah ganti provider di masa depan.
- Jika aplikasi tumbuh, migrasi ke self-hosted browserless service.

### Alur Screenshot
1. Scheduler membuat job `SCREENSHOT` dengan payload `{ monitorId, url }`.
2. Worker mengeksekusi job.
3. Panggil screenshot provider.
4. Simpan gambar ke disk lokal (`/public/screenshots/{monitorId}/{uuid}.png`) atau object storage.
5. Simpan metadata ke tabel `screenshots`.
6. Asosiasikan screenshot dengan `MonitorCheck` terkait.

---

## 11. Notification System

### 11.1 Channels

| Channel | Mekanisme | Detail |
|---------|-----------|--------|
| **Email** | SMTP atau API (Resend/Mailgun/SendGrid) | Shared hosting biasanya punya SMTP. Bisa juga pakai email service eksternal. |
| **Telegram** | Bot API via HTTP POST | User membuat bot, mengisi `chat_id`. Kirim pesan teks/gambar. |
| **Discord** | Incoming Webhook URL | Kirim embed message dengan status monitor. |

### 11.2 Message Template
- Alert Website Down:
  ```
  🚨 [Monalertics] Website DOWN
  Monitor: nama-monitor
  URL: https://example.com
  Status: DOWN
  Error: Timeout / 500 / DNS failure
  Waktu: 2026-06-10 14:30 WIB
  Screenshot: [jika tersedia]
  ```
- Alert Website Up (resolved):
  ```
  ✅ [Monalertics] Website UP
  Monitor: nama-monitor
  URL: https://example.com
  Downtime: 5 menit 12 detik
  Waktu: 2026-06-10 14:35 WIB
  ```
- SSL Expiry Warning:
  ```
  ⚠️ [Monalertics] SSL Expiring Soon
  Domain: example.com
  Expired pada: 2026-07-01
  Sisa: 14 hari
  ```

### 11.3 Deduplication
- Simpan status alert terakhir per monitor & channel.
- Jangan kirim alert yang sama berulang kali dalam interval tertentu (misal: 15 menit).
- Tetap kirim "resolved notification" saat status kembali normal.

---

## 12. SaaS / Multi-tenant Design

### 12.1 Plans (Contoh)

| Fitur | Free | Basic | Pro |
|-------|------|-------|-----|
| Max Monitors | 3 | 10 | 50 |
| Min Interval | 30 menit | 5 menit | 1 menit |
| Email | ✅ | ✅ | ✅ |
| Telegram | ❌ | ✅ | ✅ |
| Discord | ❌ | ✅ | ✅ |
| Screenshot | ✅ (5/bulan) | ✅ (50/bulan) | ✅ (200/bulan) |
| Retention | 7 hari | 30 hari | 90 hari |
| Status Page | ❌ | ❌ | ✅ |
| Harga | Rp 0 | Rp 49.000/bulan | Rp 149.000/bulan |

### 12.2 Enforcement
- Middleware cek `plan.maxMonitors` saat create monitor.
- Scheduler skip monitor jika interval lebih kecil dari yang diizinkan paket.
- Cron job cleanup data lebih lama dari `plan.retentionDays`.

### 12.3 Billing (Future)
- MVP: subscription status diatur manual oleh admin.
- Next phase: integrasi Xendit/Midtrans/Stripe untuk pembayaran otomatis.

---

## 13. Automation Roadmap

| Fase | Fitur Otomatisasi |
|------|-------------------|
| **MVP** | Alert otomatis, resolved notification, screenshot otomatis saat status berubah. |
| **Fase 2** | Scheduled report (mingguan/bulanan) via email. |
| **Fase 3** | Auto-remediation webhook: panggil URL tertentu saat down (restart service, flush cache, dll). |
| **Fase 4** | Escalation: jika alert tidak diakui dalam X menit, kirim ke channel/email cadangan. |
| **Fase 5** | Dynamic threshold / anomaly detection sederhana (respons time naik signifikan). |

---

## 14. Non-Functional Requirements

| Aspek | Target |
|-------|--------|
| **Availability** | 99.9% uptime untuk aplikasi dashboard. |
| **Latency** | Dashboard load < 2 detik. |
| **Accuracy** | Check dilakukan sesuai interval, toleransi ± 1 menit. |
| **Security** | Password hashing (bcrypt), JWT/secure session, validasi input, rate limiting. |
| **Scalability** | Arsitektur modular, mudah migrasi ke VPS/worker terpisah di masa depan. |
| **Backup** | Backup database harian (shared hosting backup). |
| **Auditability** | Semua check dan alert tercatat di database. |

---

## 15. Constraints & Assumptions

### Constraints
- Harus dapat berjalan di **shared hosting** (terbatasnya background process, no Redis).
- **Screenshot** harus menggunakan layanan eksternal free tier atau self-hosted di VPS terpisah.
- Database yang tersedia: **MySQL atau PostgreSQL**.
- Scheduler bergantung pada **cPanel cron / scheduled HTTP request**.

### Assumptions
- Shared hosting mendukung Node.js runtime untuk Next.js (atau user bersedia deploy Next.js di VPS/Vercel untuk frontend).
- User dapat membuat Telegram Bot dan Discord Webhook sendiri.
- WHOIS query tidak di-block untuk target domain yang umum.

---

## 16. MVP Scope

### In Scope (MVP)
- Register/login user.
- CRUD monitor (uptime, SSL, domain).
- Scheduler checks via cron + database job queue.
- Alert email (primary), Telegram, Discord (konfigurasi sederhana).
- Dashboard status monitor & histori.
- Screenshot via external free API provider.
- Plan Free dan Basic (manual activation).

### Out of Scope (MVP)
- Payment gateway otomatis.
- Status page publik.
- PDF/CSV report export.
- Auto-remediation webhook.
- Mobile app.
- Multi-region monitoring probes.

---

## 17. Risks & Mitigations

| Risks | Impact | Mitigation |
|-------|--------|------------|
| Shared hosting tidak support Next.js runtime | Tinggi | Siapkan alternatif deploy: Vercel untuk frontend, shared hosting hanya untuk database/API. |
| Free screenshot API tidak reliable/tidak gratis | Sedang | Buat abstraksi provider, siapkan fallback, dan dokumentasikan opsi self-hosted. |
| WHOIS rate limiting | Sedang | Cache hasil WHOIS, gunakan fallback provider, tandai sebagai best-effort. |
| Cron shared hosting tidak akurat | Sedang | Jalankan cron setiap menit; gunakan `scheduledAt` dan toleransi waktu. |
| Abuse / spam monitor | Sedang | Rate limit register & create monitor, validasi target URL. |

---

## 18. Success Metrics

| Metric | Target |
|--------|--------|
| Monthly Active Users (MAU) | 50+ di bulan ke-3 |
| Average Uptime Monitored | > 99% untuk semua monitor |
| Alert Delivery Rate | > 98% |
| User Sign-up Conversion | > 10% dari visitor |
| Churn Rate | < 10%/bulan |

---

## 19. Open Questions / Next Steps

1. Apakah shared hosting target sudah dikonfirmasi mendukung Node.js? Jika tidak, perlu diskusi alternatif deployment.
2. Provider screenshot eksternal mana yang akan digunakan untuk MVP? Perlu evaluasi free tier & rate limit.
3. Apakah akan menggunakan PostgreSQL atau MySQL? (Prisma mendukung keduanya.)
4. Apakah memerlukan landing page marketing terpisah atau cukup dari aplikasi Next.js yang sama?
5. Siapa yang akan menjadi early adopter / beta tester pertama?

---

## 20. Appendix

### A. Nama Produk
**Monalertics** — Monitoring + Alert + Analytics.

### B. Inspirasi Kompetitor
- UptimeRobot
- Better Stack (Uptime)
- Pingdom
- StatusCake

### C. Catatan Implementasi Teknis
- Gunakan **Next.js API Routes** untuk menerima cron trigger.
- Gunakan **Prisma** untuk ORD dan migration.
- Gunakan **nodemailer** untuk SMTP email.
- Gunakan **axios/fetch** untuk HTTP checks dan screenshot API.
- Gunakan **node-forge** atau **ssl-checker** untuk SSL checks.
- Gunakan **whois-json** untuk domain checks.

---

*End of Document — PRD Monalertics v1.0*
