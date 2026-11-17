# WPC Backend

Node.js + Express + Prisma + PostgreSQL API untuk aplikasi WPC (Welding Production Control).

## Prasyarat

- Node.js 20+
- PostgreSQL 14+
- `pg_dump` (opsional, untuk fitur backup)

## Setup

1. Copy `.env.example` ke `.env` lalu sesuaikan:

   ```
   PORT=4000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wpc?schema=public
   JWT_SECRET=change-me-in-production
   JWT_EXPIRES_IN=12h
   CORS_ORIGIN=http://localhost:5173
   ```

2. Install dependency dan siapkan database:

   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run prisma:seed
   npm run dev
   ```

Server berjalan di `http://localhost:4000` (health check: `GET /health`).

### Database lokal di dalam repo

Repo ini menyertakan cluster PostgreSQL lokal di `.pgdata` pada port `5433`:

```bash
/usr/lib/postgresql/16/bin/pg_ctl -D .pgdata -o "-p 5433 -k /tmp" -l /tmp/wpc-pg.log start
/usr/lib/postgresql/16/bin/createdb -h localhost -p 5433 -U postgres wpc
```

`DATABASE_URL` untuk cluster tersebut:

```
postgresql://postgres@localhost:5433/wpc?schema=public
```

## Seed dari Excel

`npm run prisma:seed` membaca langsung workbook `KOMPOSISI RB.G.xlsx` di root project:

- Sheet **Komposisi** → part Assy/Sub Assy, line, cycle time, model, packaging, max store,
  komponen press/bolt-nut/child, BOM, dan stock item.
- Sheet **Jam Kerja** → konfigurasi shift, jam kerja, dan batas overtime.

Data seed bersifat idempoten (upsert): aman dijalankan ulang. BOM untuk part yang dikelola
seed dihapus lalu dibuat ulang dari Excel. Untuk memperbarui hanya data yang berasal dari workbook,
gunakan:

```bash
npm run prisma:sync-workbook
```

Sinkronisasi khusus ini berjalan dalam transaksi dan hanya memperbarui part produksi, kebijakan
stock master (kategori, packaging, dan max store), BOM, model, serta shift. Stok aktual, buffer,
safety stock, lokasi, user, dan konfigurasi lain yang sudah ada tidak ditimpa. `prisma:seed` tetap
menjalankan seluruh proses seed termasuk data pendukung dan akun demo.

Data pendukung yang ikut di-seed: model produksi, mesin, lokasi inventory, kanban config,
device, app settings, work area, user demo, dan 5 contoh material request.

### Akun demo

Semua akun memakai password `wpc123`.

| Employee ID | Username          | Role             | Work area            |
| ----------- | ----------------- | ---------------- | -------------------- |
| AD001       | `admin`           | admin            | Semua                |
| LD001       | `leader`          | leader           | Assy                 |
| OA001       | `operator.assy`   | operator_assy    | Assy                 |
| OS001       | `operator.subassy`| operator_sub_assy| Sub Assy             |
| OB001       | `operator.both`   | operator_both    | Assy + Sub Assy      |
| MG001       | `management`      | management       | Plant management     |

Login memakai `identifier` yang dapat berupa username atau employee ID:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"AD001","password":"wpc123"}'
```

Semua endpoint selain `/health` dan `/api/auth/login` memerlukan header:

```
Authorization: Bearer <token>
```

## API

### Auth

| Method | Path                          | Keterangan                     |
| ------ | ----------------------------- | ------------------------------ |
| POST   | `/api/auth/login`             | Login, mengembalikan JWT + user |
| GET    | `/api/auth/me`                | Profil user beserta work area  |
| PATCH  | `/api/auth/profile`           | Update profil sendiri          |
| POST   | `/api/auth/change-password`   | Ganti password sendiri         |

### Dashboard

| Method | Path             | Keterangan                                                        |
| ------ | ---------------- | ----------------------------------------------------------------- |
| GET    | `/api/dashboard` | KPI, tren 7 hari, NG pareto, queue, mesin, alert, aktivitas terbaru |

Query opsional: `line`.

### Production

| Method | Path                                  | Keterangan                                      |
| ------ | ------------------------------------- | ----------------------------------------------- |
| POST   | `/api/production/requests/scan`       | Scan kanban menjadi production request          |
| GET    | `/api/production/requests`            | Daftar request (`status`, `line`, `type`)       |
| POST   | `/api/production/requests/:id/allocate` | Alokasikan ke shift + auto queue Sub Assy     |
| DELETE | `/api/production/requests/:id`        | Hapus request yang masih pending                |
| GET    | `/api/production/queue`               | Antrean produksi (`type`, `line`, `status`, `targetShift`) |
| PUT    | `/api/production/queue/order`         | Simpan urutan antrean (`ids[]`, operator/leader/admin) |
| PATCH  | `/api/production/queue/:id`           | Ubah prioritas (operator) atau shift/status (leader/admin) |
| DELETE | `/api/production/queue/:id`           | Hapus antrean yang belum dicetak                |
| POST   | `/api/production/queue/:id/print`     | Cetak kanban → completed box + buffer + audit   |
| GET    | `/api/production/results`             | Hasil produksi per shift                        |
| POST   | `/api/production/results`             | Upsert hasil OK/NG per part, shift, line        |
| GET    | `/api/production/audit`               | Riwayat aktivitas produksi terbaru              |
| GET    | `/api/production/ng`                  | Data NG per shift                               |
| POST   | `/api/production/ng`                  | Upsert data NG                                  |
| GET    | `/api/production/schedules`           | Daftar schedule (`shift`, `line`)               |
| POST   | `/api/production/schedules`           | Tambah schedule                                 |
| PATCH  | `/api/production/schedules/:id`       | Ubah schedule                                   |
| DELETE | `/api/production/schedules/:id`       | Hapus schedule                                  |

Tipe produksi menerima `Assy`, `Sub_Assy`, maupun `Sub Assy` (dinormalisasi ke `Sub_Assy`).

### Material

| Method | Path                                  | Keterangan                                          |
| ------ | ------------------------------------- | --------------------------------------------------- |
| GET    | `/api/material/requests`              | Daftar request material (`kind`, `status`, `partNumber`) |
| POST   | `/api/material/requests`              | Buat request (kode otomatis bila kosong)           |
| PATCH  | `/api/material/requests/:id/status`   | Ubah status; status selesai memindahkan stok        |
| DELETE | `/api/material/requests/:id`          | Hapus request yang belum selesai                    |
| GET    | `/api/material/stock`                 | Daftar stock item                                   |
| GET    | `/api/material/buffer`                | Daftar buffer item                                  |

`kind`: `request`, `pickup`, `return`, `receiving`, `external`.
Status `completed`/`received` pada `request`/`pickup` mengurangi store, sedangkan
`return`/`receiving`/`external` menambah store dan menulis ledger.

### Inventory

| Method | Path                                  | Keterangan                                      |
| ------ | ------------------------------------- | ----------------------------------------------- |
| GET    | `/api/inventory/stock`                | Stock item (`category`, `status`, `location`)   |
| GET    | `/api/inventory/stock/:partNumber`    | Detail satu stock item                          |
| GET    | `/api/inventory/overview`             | Ringkasan per kategori, low/empty, buffer       |
| GET    | `/api/inventory/ledger`               | Riwayat ledger (`partNumber`, `type`, `from`, `to`, `take`) |
| POST   | `/api/inventory/adjustment`           | Stock adjustment (admin/leader)                 |
| GET    | `/api/inventory/buffer`               | Daftar buffer                                   |
| POST   | `/api/inventory/buffer`               | Tambah buffer item                              |
| PATCH  | `/api/inventory/buffer/:id/status`    | Ubah status buffer; `stored` menambah store     |
| GET    | `/api/inventory/status/:partNumber`   | Status stok hasil hitung ulang                  |

### Master data

| Method | Path                                        | Keterangan                          |
| ------ | ------------------------------------------- | ----------------------------------- |
| GET/POST | `/api/master/parts`                       | Daftar / buat (upsert) part         |
| GET/PATCH/DELETE | `/api/master/parts/:partNumber`    | Detail / ubah / hapus part          |
| GET/POST | `/api/master/models`                      | Daftar / buat model produksi        |
| PATCH/DELETE | `/api/master/models/:id`             | Ubah / hapus model                  |
| GET/POST | `/api/master/machines`                    | Daftar / buat mesin                 |
| PATCH/DELETE | `/api/master/machines/:id`           | Ubah / hapus mesin                  |
| GET    | `/api/master/bom`                           | Semua BOM (`parentPartNumber`)      |
| GET    | `/api/master/bom/:parentPartNumber`         | BOM satu part                       |
| PUT    | `/api/master/bom/:parentPartNumber`         | Ganti seluruh komponen BOM          |
| DELETE | `/api/master/bom/:parentPartNumber`         | Hapus BOM satu part                 |
| GET/POST | `/api/master/routings`                    | Daftar / buat (upsert) routing      |
| PATCH/DELETE | `/api/master/routings/:id`           | Ubah / hapus routing                |
| GET    | `/api/master/stock-policy`                  | Stock policy per part               |
| PATCH  | `/api/master/stock-policy/:partNumber`      | Ubah packaging/max/safety/lokasi    |
| GET/POST | `/api/master/locations`                   | Daftar / buat lokasi inventory      |
| PATCH/DELETE | `/api/master/locations/:id`          | Ubah / hapus lokasi                 |
| GET/POST | `/api/master/shifts`                      | Daftar / buat shift                 |
| PATCH/DELETE | `/api/master/shifts/:id`             | Ubah / hapus shift                  |
| GET/POST | `/api/master/kanban`                      | Daftar / buat konfigurasi kanban    |
| PATCH/DELETE | `/api/master/kanban/:id`             | Ubah / hapus konfigurasi kanban     |
| GET    | `/api/master/cycle-time`                    | Cycle time semua part               |
| PATCH  | `/api/master/cycle-time/:partNumber`        | Ubah cycle time / group             |
| GET/POST | `/api/master/work-areas`                  | Daftar / buat work area             |
| PATCH/DELETE | `/api/master/work-areas/:id`         | Ubah / hapus work area              |

### Users

| Method | Path                                  | Keterangan                            |
| ------ | ------------------------------------- | ------------------------------------- |
| GET    | `/api/users`                          | Daftar user                           |
| POST   | `/api/users`                          | Buat user                             |
| GET    | `/api/users/:id`                      | Detail user                           |
| PATCH  | `/api/users/:id`                      | Ubah user / status / role             |
| DELETE | `/api/users/:id`                      | Hapus user                            |
| PUT    | `/api/users/:id/work-areas`           | Set work area user                    |
| GET    | `/api/users/roles`                    | Daftar role yang tersedia             |
| GET/POST | `/api/users/devices`                | Daftar / buat device                  |
| PATCH/DELETE | `/api/users/devices/:id`        | Ubah / hapus device                   |

### Reports

| Method | Path                             | Keterangan                                     |
| ------ | -------------------------------- | ---------------------------------------------- |
| GET    | `/api/report/audit`               | Audit log terbaru                              |
| GET    | `/api/report/production`          | Hasil produksi + summary (`from`, `to`, `line`, `partNumber`) |
| GET    | `/api/report/ng`                  | Data NG + pareto                               |
| GET    | `/api/report/completed-boxes`     | Completed box (`line`, `partNumber`)           |
| GET    | `/api/report/inventory`           | Stock + summary per kategori                   |
| GET    | `/api/report/material-usage`      | Pemakaian material dari ledger (`from`, `to`)  |
| GET    | `/api/report/transactions`        | Transaksi ledger (`from`, `to`, `type`, `partNumber`) |

### Settings

| Method | Path                        | Keterangan                              |
| ------ | --------------------------- | --------------------------------------- |
| GET    | `/api/settings`             | Semua setting sebagai object            |
| GET    | `/api/settings/:key`        | Satu setting                            |
| PUT    | `/api/settings/:key`        | Upsert setting `{ "value": ... }`       |
| GET    | `/api/settings/backups`     | Daftar file backup (admin/leader)       |
| POST   | `/api/settings/backup`      | Backup database via `pg_dump` (admin)   |

## Error handling

- `422` — validasi Zod gagal, berisi `errors[]`.
- `409` — unique constraint.
- `404` — data/route tidak ditemukan.
- `400` — aturan bisnis (stok tidak cukup, part belum terdaftar, dll).

## Scripts

```bash
npm run dev            # tsx watch
npm run build          # compile ke dist/
npm start              # jalankan hasil build
npm run typecheck      # tsc --noEmit
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:sync-workbook
npm run db:start       # PostgreSQL lokal port 5433
npm run db:stop
```
