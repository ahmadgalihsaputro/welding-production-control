# Product Requirements Document (PRD)
# WPC — Welding Production Control

> Dokumen ini adalah konteks produk dan panduan kerja untuk manusia maupun AI yang membaca
> repository. Dokumen ini menggabungkan tujuan bisnis, alur kerja yang diinginkan, aturan data,
> serta kondisi implementasi yang tercatat saat ini. Jika perilaku dokumen ini berbeda dengan
> kode yang berjalan, jangan menganggap implementasi sudah sesuai: verifikasi, laporkan
> perbedaannya, dan minta keputusan bila menyangkut aturan bisnis.

## 1. Ringkasan produk

**WPC (Welding Production Control)** adalah aplikasi internal untuk membantu mengendalikan aliran
produksi welding/assembly pada line manufaktur. Aplikasi dimaksudkan untuk menghubungkan data
master produksi dengan pekerjaan harian: permintaan/kanban, alokasi ke shift, antrean operator,
hasil produksi, material, stok, laporan, dan audit.

Pilot yang terdokumentasi berfokus pada **Robot G**. Desain data mengandung `line`, `process`,
`model`, dan identitas mesin agar dapat berkembang ke line atau robot lain tanpa mengasumsikan
bahwa seluruh pabrik sudah dimodelkan.

WPC bukan pengganti PLC, sistem kualitas, ERP, ataupun FSS. Integrasi eksternal tidak boleh
dianggap aktif hanya karena menu atau halaman integrasinya tersedia.

## 2. Tujuan dan hasil yang diharapkan

1. Menyediakan satu alur yang bisa ditelusuri dari permintaan produksi/scan kanban sampai antrean,
   hasil produksi, dan completed box.
2. Membantu leader mengalokasikan pekerjaan ke shift dan membentuk antrean produksi, termasuk
   kebutuhan Sub Assy yang diturunkan dari BOM.
3. Membantu operator melihat pekerjaan sesuai role, line, proses, area kerja, dan shift aktif.
4. Mencatat OK/NG serta aktivitas penting dengan waktu, part, shift, line/proses, dan operator.
5. Menghubungkan permintaan/pengeluaran/penerimaan material dengan jumlah stok dan ledger.
6. Menyediakan master data yang konsisten sebagai dasar perhitungan kapasitas, BOM, stock policy,
   kanban, dan laporan.
7. Memberikan dashboard/laporan untuk memantau produksi, NG, antrean, material, stok, dan audit.
8. Mengurangi input ganda: misalnya penyelesaian box/kanban ikut memperbarui antrean dan hasil
   otomatis sesuai aturan yang sudah diterapkan.

## 3. Prinsip produk

- **Data master mendahului transaksi.** Part, tipe, line, model, BOM, packaging, jam kerja, dan
  kebijakan stok harus benar sebelum transaksi operasional bergantung padanya.
- **Database adalah sumber data lintas perangkat** untuk alur yang sudah terintegrasi. Jangan
  mengganti hasil backend dengan mock/localStorage pada modul terintegrasi.
- **Server menegakkan validasi dan hak akses.** Menyembunyikan tombol di UI bukan kontrol akses.
- **Perubahan stok harus dapat ditelusuri.** Pergerakan stok membuat ledger; jangan mengubah saldo
  saja tanpa histori.
- **Data kumulatif tidak boleh terhitung ganda.** Simpan ulang hasil shift memperbarui total, bukan
  menambahkan nilai lagi. Box yang selesai juga tidak boleh dihitung dua kali.
- **Nilai yang tidak diketahui tetap tidak diketahui.** Jangan mengarang cycle time, jumlah BOM,
  safety stock, line, atau jadwal.
- **Gunakan satuan eksplisit.** Cycle time adalah detik per pcs; kuantitas transaksi adalah pcs
  atau box sesuai field-nya.
- **Audit dan keterlacakan adalah bagian dari alur**, bukan fitur kosmetik.

## 4. Ruang lingkup

### Termasuk

- Autentikasi, role, profil, work area, dan device.
- Dashboard produksi.
- Production Control: scan/request, alokasi, antrean Assy/Sub Assy, hasil, NG, jadwal, completed
  box, dan audit.
- Material Control: request, pickup, return, receiving, external material.
- Inventory Control: stock overview, buffer, store, ledger, adjustment.
- Master Data: model, part, BOM, cycle time/capacity, mesin/line, stock policy, lokasi, shift,
  dan konfigurasi kanban.
- Reports dan pengaturan aplikasi.
- Import/seed data awal dari workbook yang tersedia.

### Target modul Database / Master Data

Modul Database adalah tempat role berwenang mengelola master data operasional. Data yang disimpan
harus persisten di PostgreSQL dan menjadi sumber yang sama bagi production, material, inventory,
dan report—bukan salinan yang hanya berlaku di browser.

Target pengelolaan meliputi user, kredensial, role dan work area; mesin/line; model dan part;
komposisi BOM per part Assy; cycle time; jumlah standar pcs; stock policy, saldo/lokasi inventory,
dan buffer.

Wadah standar dicatat sebagai satu angka pcs per wadah. Penyebutan “box” atau “pallet” menyesuaikan
ukuran/jenis barang; saat ini tidak ada konversi terpisah box-per-pallet.

Perpindahan part antar robot/line dilakukan dari UI Master Data dengan mengubah mapping line dan
proses part. Aksi ini memperbarui master di PostgreSQL dan memengaruhi transaksi baru. Riwayat
transaksi lama tetap pada line saat transaksi terjadi; saldo/lokasi stok tidak berubah dan tidak
dibuat transaksi stock transfer. Perubahan mapping harus dikonfirmasi di UI dan dicatat pada audit.
Part memiliki satu mapping line/proses aktif pada satu waktu. Mapping tidak boleh diubah selama
masih ada request produksi pending atau item antrean waiting/running untuk part tersebut; selesaikan
atau batalkan pekerjaan aktif sebelum memindahkannya.

Istilah “jumlah part” juga perlu dibedakan: jumlah jenis PN terdaftar, saldo stok per part/lokasi,
dan target/hasil produksi adalah tiga hal berbeda. Standar box/pallet harus menyimpan satuan dan
konversi eksplisit; jangan mengasumsikan pallet selalu memuat jumlah box tetap.

### Belum boleh diasumsikan

- Semua halaman frontend sudah tersambung ke database.
- Integrasi FSS, printer fisik, scanner, notifikasi, atau perangkat telah berjalan.
- Seluruh data pabrik/seluruh line sudah dimuat.
- Dashboard demo mencerminkan data produksi aktual.
- Menu atau API yang tersedia otomatis berarti perilaku telah diuji end-to-end.

## 5. Aktor dan tanggung jawab

Role yang dikenal sistem (enum backend):

| Role | Tanggung jawab yang diharapkan |
|---|---|
| `operator_assy` | Menangani pekerjaan/antrean Assy dalam work area yang ditugaskan. |
| `operator_sub_assy` | Menangani pekerjaan/antrean Sub Assy dalam work area yang ditugaskan. |
| `operator_both` | Menangani Assy dan Sub Assy sesuai area yang ditugaskan. |
| `leader` | Mengelola operasi shift, alokasi, dan fungsi produksi/material/inventory yang diizinkan. |
| `admin` | Mengelola aplikasi, master/user, konfigurasi, dan seluruh fungsi administratif. |
| `management` | Memantau dashboard/laporan dan fungsi manajemen yang diizinkan. |

User baru dibuat dengan memilih salah satu role yang sudah tersedia di atas. Pembuatan role
kustom atau pengaturan permission role secara dinamis bukan kebutuhan saat ini; akses mengikuti
skema role dan aturan yang sudah ditetapkan aplikasi.

Matriks akses final harus mengikuti backend `requireRole`/middleware serta frontend route access.
Tabel di atas menjelaskan niat produk, bukan pengganti pemeriksaan hak akses per endpoint.

### Login dan area kerja

- Login menerima `username` atau `employeeId` serta password; password diverifikasi backend.
- Sesi frontend dan JWT mengidentifikasi user. Data sensitif tidak boleh disimpan sebagai mock
  kredensial.
- Operator memiliki satu atau lebih `WorkArea` yang ditugaskan Admin. Area memuat line, tipe
  produksi, dan proses.
- Area aktif membantu memfilter konteks kerja; role tetap membatasi tindakan.
- Akun demo dan password hanya untuk lingkungan development/demo sebagaimana dokumentasi backend.
  Jangan menggunakan kredensial demo untuk deployment produksi.

## 6. Urutan implementasi dan persiapan data

Gunakan urutan ini ketika data riil akan dimasukkan. Validasi referensi sebelum lanjut ke tahap
berikutnya.

### Tahap 1 — Struktur pabrik

1. Daftarkan line/robot dengan nama stabil (contoh pilot: `Robot G`).
2. Daftarkan proses/work area per line dan tipe: `Assy` atau `Sub_Assy`.
3. Pastikan ejaan line/proses konsisten di semua master data, routing, user assignment, dan transaksi.
4. Daftarkan lokasi inventory beserta tipe, line, dan kapasitas jika diketahui.
5. Daftarkan mesin dengan kode unik, line, daftar proses, dan status.

### Tahap 2 — Model dan part

1. Daftarkan model produksi dengan kode unik.
2. Daftarkan setiap part number dengan:
   - part number unik dan kapitalisasi konsisten;
   - tipe (`Assy` atau `Sub_Assy`);
   - line dan proses;
   - model-model yang valid;
   - packaging/pcs per box bila berlaku;
   - max store bila ditentukan.
3. Daftarkan komponen material/stock yang dibutuhkan pada stock master, termasuk deskripsi,
   kategori, satuan kemasan, lokasi, safety stock, max store, dan saldo awal yang disetujui.
4. Jangan menganggap part number untuk produksi otomatis memiliki record stock item atau sebaliknya;
   validasi master yang diperlukan modul terkait.

### Tahap 3 — BOM

1. Untuk setiap parent Assy, daftar semua component part number dan `quantityPerAssy`.
2. Quantity BOM berarti jumlah komponen untuk menghasilkan satu parent Assy, bukan jumlah total
   pesanan.
3. Referensi komponen harus menunjuk ke part yang terdaftar. Tipe komponen menentukan apakah
   komponen itu dibuat sebagai antrean auto Sub Assy saat parent Assy dialokasikan.
4. Verifikasi perhitungan: `kebutuhan komponen = qty request parent × quantityPerAssy`.
5. Konfirmasi apakah setiap komponen, scrap/yield, multi-level BOM, dan substitusi material
   dibutuhkan. Implementasi saat ini hanya mendokumentasikan auto-queue untuk komponen
   `Sub_Assy` langsung.
6. Setelah import, bandingkan jumlah item dan kuantitas BOM dengan sumber resmi.

### Tahap 4 — Routing, cycle time, dan kapasitas

1. Daftarkan langkah proses part per model, urutan langkah, mesin, status, versi, dan tanggal efektif.
2. Masukkan cycle time dalam **detik per pcs**; jangan memasukkan detik per box kecuali dikonversi
   secara eksplisit.
3. `cycleGroupId` mengelompokkan part yang memakai sumber daya sama secara bergantian. Cycle time
   tetap per part; beban untuk kelompok dihitung dari jumlah part yang ditugaskan.
4. Cycle time kosong/0 berarti belum menjadi angka valid untuk estimasi kapasitas. Jangan mengisi
   angka contoh atau menyimpulkan angka dari nama mesin.
5. Verifikasi beban sederhana: `qty × detik per pcs`; bila beberapa part memakai group mesin yang
   sama, beban mereka dijumlahkan sesuai aturan alokasi.
6. Periksa konsistensi routing vs mesin dan proses yang tersedia. Routing seed saat ini adalah
   template awal, bukan bukti cycle time riil.

### Tahap 5 — Shift, kalender, dan kanban

1. Konfigurasikan jam mulai/selesai, jam istirahat, jam kerja, dan batas overtime per shift.
2. Tetapkan hari kerja/kalender sesuai kebijakan pabrik.
3. Jam lokal perangkat menjadi dasar penentuan shift; waktu istirahat tidak aktif. Bagian shift
   malam sesudah tengah malam tetap terkait hari produksi saat shift dimulai.
4. Shift aktif yang overlap harus ditolak/ditangani sebagai kesalahan konfigurasi.
5. Konfigurasikan format/prefix/field/template kanban per tipe dan uji hasil cetaknya.
6. Bedakan shift sumber (dari kanban/request) dengan shift target (alokasi produksi).

### Tahap 6 — User, role, device, dan area

1. Buat user dengan employee ID unik, username unik, nama, role, status, line/area yang relevan.
2. Tetapkan work area eksplisit untuk operator.
3. Konfirmasi hak akses tiap role lewat UI dan endpoint backend.
4. Registrasikan perangkat (misalnya stasiun scan/printer) bila perangkat sungguhan digunakan.
5. Ganti kredensial demo dan secret environment sebelum penggunaan nyata.

### Tahap 7 — Uji data awal sebelum operasi

- Pastikan semua part pada BOM tersedia dan tipenya benar.
- Pastikan model request valid untuk part tersebut.
- Pastikan packaging/pcs per box dan unit stok tidak tertukar.
- Cocokkan saldo awal inventory; jangan seed ulang data operasional tanpa memahami perilaku upsert.
- Verifikasi shift aktif, kalender, zona waktu, dan batas break.
- Jalankan satu transaksi uji per tipe alur pada database non-produksi; periksa audit, status,
  stock, ledger, completed box, serta hasil.

## 7. Alur kerja operasional end-to-end

### 7.1 Permintaan produksi / scan kanban

1. User yang sudah login memindai atau memasukkan kanban.
2. Frontend mengirim kode kanban, part number, model, tipe produksi, qty pcs, proses opsional, dan
   shift sumber opsional ke backend.
3. Backend menormalisasi tipe (`Sub Assy` dan `Sub_Assy` dipetakan ke `Sub_Assy`), membersihkan
   identitas, lalu memeriksa:
   - part terdaftar dan tipenya cocok;
   - model termasuk dalam model yang diizinkan (bila daftar model part tidak kosong);
   - kanban belum direkam pada request, antrean, atau completed box.
4. Jika lolos, buat production request dengan status `pending` dan tulis audit log.
5. Jika part/model/kanban tidak valid, jangan membuat transaksi parsial; kembalikan error yang
   dapat dimengerti user.

### 7.2 Alokasi oleh leader/admin

1. Leader/admin meninjau request pending, line, jenis, qty, dan shift sumber.
2. Pilih shift target 1 atau 2. Saran alokasi boleh mempertimbangkan cycle time dan shared
   `cycleGroupId`, tetapi keputusan harus dapat ditinjau manusia.
3. Backend membuat queue item utama dengan status `waiting`.
4. Untuk request Assy, backend membaca BOM langsung dari parent dan membuat antrean tambahan hanya
   bagi komponen yang terdaftar sebagai tipe `Sub_Assy`; qty masing-masing adalah
   `request.qty × quantityPerAssy`.
5. Semua item yang diturunkan memakai shift target yang sama; request berubah menjadi `allocated`.
6. Pembuatan item, perubahan request, dan audit dilakukan sebagai satu transaksi database.
7. Permintaan tidak boleh dialokasikan dua kali. Penghapusan request hanya untuk status pending
   dan mengikuti role backend.

### 7.3 Antrean dan eksekusi operator

1. Operator membuka antrean sesuai tipe, line, proses/area, status, dan shift target.
2. Antrean dapat diurutkan dan prioritas diubah sesuai kewenangan yang diterapkan backend.
3. Aksi operator mengikuti shift aktif dan area kerja. Di luar waktu kerja/break, input/aksi yang
   dibatasi shift tidak boleh dilakukan.
4. Operator memproses qty sesuai kanban/packaging dan menghindari duplikasi scan/cetak.
5. Saat kanban/box dicetak/diselesaikan, backend mencatat completed box, memperbarui queue,
   menambah buffer sesuai implementasi, dan menulis audit.
6. Cetak harus mengikuti konfigurasi kanban dan menghasilkan data yang dapat ditelusuri ke queue,
   part, qty, shift, dan operator.
7. Queue item hanya dapat dihapus bila belum dicetak sesuai aturan backend.

### 7.4 Hasil produksi OK dan NG

1. Pilih tanggal produksi, shift, line, tipe, part, dan proses sesuai konteks kerja.
2. Input OK dan NG sebagai **total kumulatif** untuk kombinasi record, bukan delta penambahan.
3. Simpan ulang memperbarui total untuk kombinasi tanggal/part/tipe/shift/line/proses.
4. Record harus mencatat operator dan waktu update.
5. Penyelesaian kanban juga menambahkan hasil OK otomatis. Box yang telah tercakup dalam total
   sebelum penyimpanan tidak boleh dihitung lagi; box yang selesai setelahnya ditambahkan.
6. NG dicatat terpisah untuk analisis pareto dan laporan.
7. Validasi batas non-negatif, konsistensi total dan duplikasi, serta hak akses wajib dilakukan
   sebelum write.

### 7.5 Jadwal produksi

1. Leader/admin mengelola schedule berdasarkan part/model, target, aktual, status, shift, due
   time, dan line.
2. Jadwal menjadi konteks target/monitoring; jangan menganggap perubahan schedule otomatis
   mengubah request atau antrean kecuali implementasi eksplisit menyatakan demikian.
3. Aktual harus memiliki definisi yang sama dengan hasil produksi agar tidak menimbulkan dua angka
   yang berbeda.

### 7.6 Material dan inventory

1. Buat material request dengan part, jumlah box, pcs per box, tujuan, requester, dan catatan.
2. Part harus memiliki StockItem. Kode request dibuat otomatis bila tidak diberikan.
3. Status tengah seperti `waiting`/`partial` tidak memindahkan saldo.
4. Saat request/pickup mencapai status selesai (`completed` atau `received`), jumlah
   `boxes × pcsPerBox` mengurangi store untuk jenis yang mengeluarkan material.
5. Return, receiving, dan external menambah store sesuai arah movement yang ditentukan.
6. Perubahan saldo harus atomik dengan pembuatan ledger entry; catat tipe movement, referensi,
   saldo setelah transaksi, lokasi, user, dan waktu.
7. Stok tidak boleh menjadi negatif tanpa aturan bisnis eksplisit. Insufficient stock adalah
   kesalahan bisnis, bukan sukses parsial.
8. Buffer merupakan material/box hasil produksi yang belum dipindahkan ke store. Perubahan status
   buffer menjadi `stored` menambah store sesuai aturan backend; hindari pemindahan ganda.
9. Stock adjustment hanya untuk role yang diizinkan; wajib punya alasan, user, dan ledger.
10. Status `safe`/`low`/`full`/`empty` harus dihitung dari angka store, safety stock, dan max store
    sesuai implementasi. Tampilkan unitnya.

### 7.7 Dashboard, reports, audit

- Dashboard meringkas KPI, tren, NG pareto, queue, mesin, alert, dan aktivitas sesuai filter line.
- Production report merangkum hasil untuk tanggal/line/part; NG report menyajikan jumlah dan
  pareto; inventory/material/transaction report mengambil data dari stock/ledger.
- Audit log merekam tindakan operasional/admin penting dengan aktor, waktu, konteks dan referensi
  yang tersedia.
- Filter tanggal, line, part, shift, dan proses harus konsisten pada seluruh modul yang relevan.
- Data agregat harus berasal dari sumber data yang sama dengan halaman transaksi, bukan mock yang
  memberi angka berbeda.

## 8. Aturan data dan istilah

| Istilah | Arti dalam WPC |
|---|---|
| Assy | Produksi assembly utama. Enum backend: `Assy`. |
| Sub Assy | Sub-assembly yang dibutuhkan parent/line. Enum database: `Sub_Assy`. |
| Part number | Identifier part; backend mengubah input produksi menjadi huruf kapital. |
| BOM | Daftar komponen untuk satu parent, dengan kuantitas komponen per parent. |
| Routing | Urutan proses part/model; steps disimpan sebagai JSON. |
| Cycle time | Waktu proses per satu pcs, dalam detik. |
| Cycle group | ID shared-resource untuk part yang menggunakan kapasitas mesin yang sama. |
| Kanban | Identitas kartu/box transaksi. Kode duplikat harus ditolak pada alur produksi. |
| Request | Permintaan produksi atau material; bukan otomatis berarti pekerjaan telah dimulai. |
| Queue | Pekerjaan produksi setelah alokasi. |
| Completed box | Catatan box/kanban yang selesai diproses. |
| Buffer | Hasil yang menunggu perpindahan/pengelolaan stok berikutnya. |
| Store | Saldo inventory yang tersedia pada lokasi/stock item. |
| Ledger | Histori perubahan stok, termasuk qty dan saldo setelah transaksi. |
| Shift sumber | Shift asal scan/request, jika ada. |
| Shift target | Shift tempat request dialokasikan/dikerjakan. |

Jenis transaksi material backend: `request`, `pickup`, `return`, `receiving`, `external`.
Status material yang dikenal: `waiting`, `partial`, `received`, `completed`, `rejected`.
Status request produksi: `pending`, `allocated`. Status queue: `waiting`, `running`, `complete`.
Nama label UI dapat berbeda; normalisasi harus dilakukan di boundary API, bukan dengan mengubah
nilai historis sembarangan.

## 9. Modul dan halaman

Rute frontend yang terdokumentasi:

| Modul | Route |
|---|---|
| Auth | `/login`, `/forgot-password` |
| Supply scan | `/supply/scan` |
| Dashboard | `/` |
| Production | `/production/schedule`, `/production/assy-queue`, `/production/assy`, `/production/queue`, `/production/allocation`, `/production/sub-assy`, `/production/results` |
| Material | `/material/request`, `/material/pickup`, `/material/return`, `/material/assy-pickup`, `/material/external`, `/material/receiving` |
| Inventory | `/inventory/overview`, `/inventory/buffer`, `/inventory/assy-store`, `/inventory/sub-assy-store`, `/inventory/ledger`, `/inventory/adjustment` |
| Master Data | `/master/structure`, `/master/models`, `/master/parts`, `/master/bom`, `/master/cycle-time`, `/master/routing`, `/master/machines`, `/master/stock-policy`, `/master/locations`, `/master/shifts`, `/master/kanban` |
| Reports | `/reports/production`, `/reports/inventory`, `/reports/material-usage`, `/reports/ng`, `/reports/transactions` |
| Users | `/users/list`, `/users/roles`, `/users/devices` |
| Settings | `/settings/profile`, `/settings/preferences`, `/settings/notifications`, `/settings/integration`, `/settings/printing`, `/settings/security`, `/settings/backup` |

Route aktual mengikuti `frontend/src/App.tsx`; daftar ini adalah peta produk, bukan jaminan semua
halaman terintegrasi atau tersedia untuk semua role.

## 10. Kondisi implementasi yang diketahui

Catatan di bawah berasal dari dokumentasi repository dan harus diperbarui setiap integrasi selesai.
**Jangan menghapus pembedaan ini saat memberi instruksi atau membuat perubahan.**

### Backend

- Node.js + Express + Prisma + PostgreSQL.
- Endpoint API mencakup auth, users, settings, dashboard, production, material, inventory,
  master, dan report.
- Alur produksi utama tersimpan di database: scan/request, alokasi, antrean, cetak/completed box,
  hasil/NG, audit.
- Material/inventory/master/users/report/settings memiliki endpoint database di backend; status
  dukungan UI untuk masing-masing harus dicek terpisah.
- Error API yang didokumentasikan: `422` validasi, `409` constraint unik, `404` tidak ditemukan,
  `400` aturan bisnis.

### Frontend

- React 18 + TypeScript + Vite; proxy `/api` mengarah ke backend port 4000.
- Login, sesi JWT, scan, alokasi, antrean, print/completed box, hasil/NG disebut telah memakai
  backend.
- Banyak halaman masih menggunakan `frontend/src/data/mock.ts` atau localStorage; dokumentasi
  menyebut halaman master, inventory, material, reports, users, settings, dashboard, dan jadwal
  belum seluruhnya tersambung ke database.
- Kode saat ini menghubungkan halaman User List/work area, Part Number, BOM, Cycle Time, serta
  Packaging & Stock Policy ke API PostgreSQL. Perubahan standar isi satu wadah disimpan pada
  `ProductionPart.packaging` dan disinkronkan ke `StockItem.packaging`; max store juga
  disinkronkan. Verifikasi setiap form dan aksi terhadap kode terkini sebelum menganggap integrasi
  lain sudah selesai.
- Perubahan line/proses part lewat Part Number hanya mengubah master dan membuat audit, tanpa
  mengubah saldo stok atau line pada transaksi historis. UI meminta konfirmasi. Backend menolak
  perubahan mapping bila part masih memiliki request pending atau antrean waiting/running.
- Production Structure pernah memakai data statis; cek kembali kode sebelum mengasumsikan status
  integrasi halaman tersebut atau halaman lain yang belum diverifikasi.
- Backend mempunyai endpoint PostgreSQL untuk users, parts, BOM, cycle time, stock policy, dan
  beberapa master lain; keberadaan endpoint saja tidak membuktikan setiap form UI telah
  menggunakannya.
- Data demo tidak boleh diperlakukan sebagai data produksi aktual.
- Sesi dan preferensi UI yang diketahui disimpan di localStorage dengan key WPC; token API juga
  disimpan di localStorage pada implementasi pilot.
- Backend CORS default mengizinkan `http://localhost:5173`; port/host dev lain harus dikonfigurasi
  secara sadar.

### Seed dan workbook

- `backend/prisma/seed.ts` membaca workbook `KOMPOSISI RB.G.xlsx` dari root.
- Sheet `Komposisi` membentuk data Assy, Sub Assy, komponen, packaging/max store, BOM, dan data
  terkait. Sheet `Jam Kerja` membentuk shift, jam kerja, break, dan overtime.
- Seed menggunakan upsert untuk banyak master, tetapi BOM untuk parent yang dikelola seed dihapus
  lalu dibuat ulang dari workbook.
- Karena itu, sebelum menjalankan seed terhadap database berisi data nyata, pahami efeknya dan
  lakukan backup. Seed bukan migrasi aman untuk semua data operasional.
- Data pendukung juga dapat meliputi model, mesin, lokasi, kanban config, settings, work area,
  user demo, routing awal, serta contoh material request.
- Perubahan workbook tidak otomatis memengaruhi database yang sudah berjalan sampai seed dijalankan
  kembali.

## 11. Entitas database utama

Schema Prisma saat ini memuat:

- **Identity/access:** `User`, `WorkArea`, `UserWorkArea`, `Device`.
- **Production master:** `ProductionPart`, `ProductionModel`, `Machine`, `BomComponent`, `Routing`,
  `ScheduleItem`, `ShiftConfig`, `KanbanConfig`.
- **Production transactions:** `ProductionRequest`, `QueueItem`, `CompletedBox`,
  `ProductionShiftRecord`, `NgShiftRecord`.
- **Materials/inventory:** `MaterialRequest`, `StockItem`, `BufferItem`, `LedgerEntry`,
  `InventoryLocation`.
- **System:** `AppSetting`, `AuditLog`.

Periksa `backend/prisma/schema.prisma` sebelum mengubah tipe, relasi, unique key, atau cascade
behavior. Perubahan schema perlu migrasi Prisma dan dampaknya ke data harus dipikirkan.
Schema saat ini memuat `ProductionPart.packaging` dan `StockItem.packaging` untuk jumlah pcs per
wadah; tidak ada konversi box-ke-pallet terpisah. Tidak ada transaksi transfer stok antar
line/robot khusus, karena perubahan mapping part tidak memindahkan saldo.

## 12. Kebutuhan kualitas dan acceptance criteria

Fitur dianggap siap hanya bila kriteria yang relevan berikut dipenuhi:

1. **Kebenaran data:** input divalidasi; part/model/line/shift/referensi tidak saling bertentangan.
2. **Konsistensi transaksi:** operasi multi-tabel atomik; tidak meninggalkan request tanpa queue,
   ledger tanpa saldo, atau saldo berubah tanpa ledger.
3. **Idempotensi/duplikasi:** retry tidak menggandakan scan, alokasi, completed box, hasil kumulatif,
   atau pergerakan stock.
4. **Hak akses:** role/work area ditegakkan server; akses ditolak dengan status yang tepat.
5. **Kejelasan status:** UI membedakan pending, dialokasikan, berjalan, selesai, ditolak, dan gagal.
6. **Keterlacakan:** transaksi punya waktu, aktor, part, qty, line/proses/shift, serta referensi yang
   tersedia.
7. **Satuan:** semua qty, cycle time, packaging, dan saldo jelas satuannya.
8. **Waktu:** uji shift melintasi tengah malam, break, tanggal produksi, timezone, dan overlap.
9. **UX operasional:** error memberi arahan; loading/empty state tidak menyamar sebagai data aktual.
10. **Responsif dan aksesibilitas:** UI usable di perangkat operator; kontrol semantik, fokus,
    kontras, dan tabel tetap jelas.
11. **Testing:** build/typecheck dan test terkait lulus; test transaksi memeriksa database setelah
    sukses maupun gagal.
12. **Data demo:** akun, data, dan secret demo terpisah dari konfigurasi/seed produksi.

## 13. Panduan untuk AI/engineer berikutnya

Sebelum mengubah kode:

1. Baca PRD ini dan README pada `backend/` serta `frontend/`.
2. Pastikan apakah permintaan menyasar **kebutuhan target**, **bug perilaku saat ini**, atau
   **migrasi demo ke backend**.
3. Telusuri route, schema, helper bisnis, UI yang memakai helper, dan test terkait. Jangan
   menyimpulkan integrasi dari keberadaan endpoint atau halaman saja.
4. Identifikasi dampak pada BOM, stok, queue, shift, role, audit, serta data historis.
5. Bila keputusan akan mengubah aturan pabrik (misalnya yield/scrap, stock deduction, routing,
   jadwal, overtime, atau hubungan BOM bertingkat), ajukan pertanyaan terarah sebelum menebak.
6. Implementasikan perubahan konsisten pada API, schema/migrasi, UI, validasi, hak akses, audit,
   serta dokumentasi terkait.
7. Tambahkan/ubah test sesuai risiko. Utamakan test unit/endpoint yang kecil dan deterministik;
   hindari stress test atau membuka banyak halaman browser secara bersamaan.
8. Jangan menjalankan seed, menghapus data, mengubah saldo riil, atau melakukan operasi produksi
   nyata tanpa persetujuan eksplisit dan database yang aman untuk pengujian.
9. Laporkan dengan jelas apa yang diubah, test yang dijalankan, hasilnya, batas verifikasi, dan
   risiko yang belum diselesaikan.
10. Jangan mengklaim “semua fitur aman/lancar” hanya dari typecheck, build, HTTP 200, atau render
    halaman.

## 14. Pertanyaan bisnis yang masih perlu dikonfirmasi

Gunakan daftar ini ketika data nyata mulai dimasukkan atau aturan belum tercermin jelas di kode:

- Apakah BOM hanya satu tingkat atau perlu multi-level explosion, yield/scrap, alternatif, dan
  revisi/effective date?
- Apakah request qty selalu dalam pcs? Bagaimana konversi box, pallet, dan sisa box?
- Saat menyebut “jumlah part”, apakah yang dimaksud jumlah jenis PN terdaftar, saldo pcs per
  part/lokasi, atau target/hasil produksi?
- Apa definisi tepat `store`, `buffer`, `maxStore`, dan kapan hasil Assy/Sub Assy berpindah di antara
  lokasi?
- Apakah material issue terjadi saat request disetujui, saat pickup, atau saat konsumsi aktual?
- Bagaimana perlakuan partial issue/receipt dan pembatalan transaksi yang telah memindahkan stok?
- Apakah NG mengurangi output target, membutuhkan reason code, atau mengonsumsi material tambahan?
- Bagaimana target/actual schedule dihitung dan apakah schedule menjadi sumber rencana resmi?
- Bagaimana prioritas queue, urutan operator, kapasitas mesin, downtime, setup/changeover, dan
  alokasi multi-line ditentukan?
- Apakah cycle time bervariasi menurut part, model, mesin, operator, revisi, atau kondisi proses?
- Bagaimana kalender libur, overtime, pergantian tanggal produksi, dan timezone ditetapkan?
- Apa format barcode/kanban final, aturan reprint, scan ganda, dan penanganan label rusak?
- Apakah FSS/ERP, printer, scanner, dan notifikasi akan diintegrasikan; melalui protokol/API apa?
- Siapa yang boleh mengoreksi transaksi yang sudah selesai dan bagaimana jejak koreksinya?
- Apa kebijakan retensi audit, backup, pemulihan, keamanan akun, dan deployment?

## 15. Referensi repository

- Backend setup/API/seed: [`backend/README.md`](./backend/README.md)
- Frontend setup, halaman, route, dan batas integrasi: [`frontend/README.md`](./frontend/README.md)
- API server: `backend/src/app.ts` dan `backend/src/routes/`
- Skema database: `backend/prisma/schema.prisma`
- Import Excel dan demo seed: `backend/prisma/seed.ts`
- Route frontend: `frontend/src/App.tsx`
- Pemetaan menu dan akses: `frontend/src/data/navigation.ts` dan
  `frontend/src/config/access.ts`
- Data demo frontend: `frontend/src/data/mock.ts`

---

**Status dokumen:** konteks produk awal berdasarkan repository yang tersedia. Perbarui bagian
“Kondisi implementasi yang diketahui” dan acceptance criteria setiap kali batas integrasi atau
aturan bisnis berubah.
