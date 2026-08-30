# Fitur: Notifikasi WhatsApp Orang Tua (Blast Masuk/Pulang)

> Dokumen ini adalah **source of truth** untuk implementasi fitur notifikasi WhatsApp ke orang tua/wali murid.
>
> Dokumen dibuat sebelum kode ditulis agar keputusan arsitektur, scope, behavior, dan batasan implementasi tidak berubah atau hilang antar sesi development.
>
> **Status: DISEPAKATI — SIAP DIIMPLEMENTASIKAN**
>
> ⚠️ **UPDATE:** Keputusan "1 token via env var, tidak ada migration/tabel baru" pada dokumen awal (§3, §4, §19–§23, §40–§42) **telah direvisi**. Nomor pengirim Fonnte kini dikonfigurasi dinamis (multi-sender, disimpan di database) melalui halaman Pengaturan khusus SUPERADMIN. **Baca §45 (Adendum) sebagai rujukan final** sebelum mengikuti section-section lama yang disebut di atas.

---

## 1. Tujuan

Menambahkan notifikasi WhatsApp otomatis kepada orang tua/wali murid setiap kali siswa melakukan:

1. **Check-in (masuk sekolah)** — setelah proses scan barcode atau absensi manual oleh guru berhasil.
2. **Check-out (pulang sekolah)** — setelah proses scan barcode atau absensi manual oleh guru berhasil.

### Estimasi volume

Sekolah memiliki sekitar:

* ±400 siswa aktif.
* ±2 notifikasi per siswa per hari sekolah.
* 1 notifikasi check-in.
* 1 notifikasi check-out.

Estimasi:

**±800 pesan/hari sekolah**

atau sekitar:

**±17.000–18.000 pesan/bulan**

---

## 2. Scope Fitur

Fitur versi ini hanya menangani dua event:

| Event                         | Kirim WhatsApp |
| ----------------------------- | -------------- |
| Check-in berhasil             | ✅ Ya           |
| Check-out berhasil            | ✅ Ya           |
| Siswa sudah check-in          | ❌ Tidak        |
| Siswa tidak ditemukan         | ❌ Tidak        |
| Sekolah tutup                 | ❌ Tidak        |
| Check-out belum diizinkan     | ❌ Tidak        |
| SAKIT                         | ❌ Tidak        |
| IZIN                          | ❌ Tidak        |
| DISPENSASI                    | ❌ Tidak        |
| ALPHA                         | ❌ Tidak        |
| Perubahan status manual admin | ❌ Tidak        |

Notifikasi hanya dikirim apabila benar-benar terjadi **event check-in/check-out baru yang berhasil**.

---

# 3. Provider WhatsApp

Provider yang digunakan:

**Fonnte**

Fonnte dipilih berdasarkan pertimbangan:

| Pertimbangan   | Alasan                                                       |
| -------------- | ------------------------------------------------------------ |
| Biaya          | Flat sekitar Rp66.000–Rp175.000/bulan sesuai paket           |
| Volume         | Sesuai untuk ±17.000–18.000 pesan/bulan                      |
| Setup          | Tidak memerlukan proses approval WhatsApp Business API resmi |
| Implementasi   | API sederhana                                                |
| Penggunaan     | Banyak digunakan untuk otomasi WhatsApp di Indonesia         |
| Nomor pengirim | Sekolah sudah memiliki nomor WhatsApp khusus                 |

---

## 3.1 Trade-off Provider

Fonnte merupakan **unofficial WhatsApp gateway**.

Sistem tidak menggunakan WhatsApp Business Cloud API resmi dari Meta.

Konsekuensinya terdapat risiko:

* nomor WhatsApp dapat terkena pembatasan;
* nomor dapat logout;
* nomor dapat terkena banned apabila pola pengiriman dianggap mencurigakan;
* availability bergantung pada koneksi/device WhatsApp Fonnte.

Risiko tersebut diterima untuk versi fitur ini.

Mitigasi dilakukan melalui:

* tidak melakukan blast massal dari aplikasi;
* pesan hanya dikirim berdasarkan event absensi;
* satu event menghasilkan maksimal satu notifikasi;
* tidak menggunakan retry otomatis;
* tidak membuat loop pengiriman massal;
* tidak mengirim notifikasi untuk event yang bukan check-in/check-out.

---

# 4. API Fonnte

Endpoint:

```text
https://api.fonnte.com/send
```

Method:

```text
POST
```

Header:

```text
Authorization: <FONNTE_TOKEN>
```

> ⚠️ Nilai `<FONNTE_TOKEN>` **tidak lagi berasal dari environment variable tunggal** — lihat **§45**. Token diambil dari nomor pengirim yang sedang `isActive = true` di database.

**Catatan penting:**

Header Authorization Fonnte **tidak menggunakan `Bearer`**.

Contoh:

```text
Authorization: abc123xxxxxxxx
```

Bukan:

```text
Authorization: Bearer abc123xxxxxxxx
```

---

## 4.1 Request

Request menggunakan:

```text
multipart/form-data
```

Field minimum:

```text
target  = 628xxxxxxxxxx
message = isi pesan
```

Contoh konseptual:

```text
target=628123456789
message=Assalamu'alaikum...
```

---

# 5. Titik Integrasi

Notifikasi WhatsApp harus dipicu dari:

```text
AttendanceService
```

Tujuannya agar seluruh jalur absensi memiliki behavior yang konsisten.

Sumber event:

```text
AttendanceService.checkIn()
AttendanceService.checkOut()
```

---

## 5.1 Check-in

Notifikasi hanya dipanggil apabila:

```ts
result.type === "SUCCESS"
```

dari:

```text
AttendanceService.checkIn()
```

Flow:

```text
Guru scan barcode / input manual
        ↓
AttendanceService.checkIn()
        ↓
Validasi siswa
        ↓
Validasi jam/sekolah
        ↓
Prisma transaction
        ↓
Attendance berhasil disimpan
        ↓
Transaction COMMIT
        ↓
WhatsAppService.notifyAttendance()
        ↓
Fonnte API
```

---

## 5.2 Check-out

Notifikasi hanya dipanggil apabila:

```ts
result.type === "SUCCESS"
```

dari:

```text
AttendanceService.checkOut()
```

Flow:

```text
Guru scan barcode / input manual
        ↓
AttendanceService.checkOut()
        ↓
Validasi
        ↓
Update attendance
        ↓
Prisma transaction
        ↓
Transaction COMMIT
        ↓
WhatsAppService.notifyAttendance()
        ↓
Fonnte API
```

---

# 6. Separation of Concerns

Logic WhatsApp **tidak boleh digabungkan** langsung ke dalam logic provider/database attendance.

Buat service terpisah:

```text
lib/services/whatsapp-service.ts
```

Tanggung jawab:

```text
WhatsAppService
```

adalah:

* membaca konfigurasi Fonnte;
* melakukan validasi nomor;
* melakukan normalisasi nomor;
* membuat template pesan;
* melakukan HTTP request ke Fonnte;
* menangani response/error dari Fonnte.

Sedangkan:

```text
AttendanceService
```

tetap bertanggung jawab terhadap:

* check-in;
* check-out;
* validasi attendance;
* transaksi database;
* status attendance.

Tujuan separation ini adalah agar provider WhatsApp dapat diganti di masa depan tanpa perlu mengubah business logic attendance secara besar-besaran.

---

# 7. Prinsip Utama: Best-Effort

> **Kegagalan pengiriman WhatsApp TIDAK BOLEH menyebabkan proses absensi gagal.**

Ini adalah requirement paling penting dari fitur ini.

Urutan prioritas:

```text
Attendance correctness
        ↓
Database persistence
        ↓
WhatsApp notification
```

WhatsApp merupakan fitur tambahan, bukan bagian dari transaksi inti attendance.

---

## 7.1 WhatsApp Tidak Boleh Blocking Attendance

Jika Fonnte:

* timeout;
* HTTP error;
* server error;
* connection error;
* response tidak sesuai;
* token salah;
* device Fonnte offline;

maka:

**attendance tetap dianggap berhasil selama proses attendance/database berhasil.**

Contoh:

```text
Scan siswa
   ↓
Attendance berhasil disimpan
   ↓
Fonnte error
   ↓
Attendance tetap SUCCESS
```

Bukan:

```text
Scan siswa
   ↓
Attendance berhasil
   ↓
Fonnte error
   ↓
Attendance FAILED
```

---

# 8. Defensive Error Boundary

Pemanggilan:

```ts
WhatsAppService.notifyAttendance(...)
```

harus memiliki defensive `try/catch` pada boundary `AttendanceService`.

Konsep:

```ts
try {
  await WhatsAppService.notifyAttendance(...)
} catch (error) {
  console.error(...)
}
```

Error WhatsApp **tidak boleh propagate** sehingga menggagalkan `checkIn()` atau `checkOut()`.

---

## 8.1 Catatan Implementasi

`WhatsAppService` juga sebaiknya dirancang agar tidak melempar error yang tidak perlu.

Namun **defensive `try/catch` tetap wajib berada di caller** sebagai lapisan perlindungan tambahan.

Dengan demikian arsitekturnya:

```text
AttendanceService
       │
       │ try/catch
       ▼
WhatsAppService
       │
       ▼
Fonnte API
```

---

# 9. Setelah Transaction Commit

HTTP request ke Fonnte **tidak boleh dilakukan di dalam transaksi Prisma**.

Benar:

```text
Prisma transaction
      ↓
COMMIT
      ↓
Fonnte API
```

Tidak boleh:

```text
Prisma transaction
      ↓
Fonnte API
      ↓
COMMIT
```

Alasannya:

* request HTTP dapat lambat;
* Fonnte dapat timeout;
* koneksi database tidak boleh ditahan selama request eksternal;
* burst scan pada jam masuk dapat meningkatkan beban database.

---

# 10. Queue dan Retry

Untuk versi ini:

### Tidak menggunakan queue

Tidak perlu:

* Redis;
* BullMQ;
* RabbitMQ;
* database queue;
* background worker.

### Tidak menggunakan retry otomatis

Jika pengiriman gagal:

```text
1 request → gagal → selesai
```

Bukan:

```text
request
 ↓
retry
 ↓
retry
 ↓
retry
```

Hal ini sengaja dibuat sederhana untuk versi pertama.

---

# 11. Rate Limiting & Anti-Banned

Fonnte memiliki batas pengiriman yang jauh lebih tinggi dibanding kebutuhan aplikasi.

Sistem tidak melakukan blast massal secara bersamaan.

Notifikasi dikirim sebagai konsekuensi dari event scan:

```text
Siswa scan
   ↓
Attendance success
   ↓
1 WhatsApp
```

Dengan demikian pengiriman secara natural mengikuti kecepatan proses absensi guru.

Untuk versi ini:

* tidak perlu custom rate limiter;
* tidak perlu queue;
* tidak perlu batch sender;
* tidak perlu parallel blast;
* jangan menggunakan `Promise.all()` untuk mengirim banyak nomor sekaligus.

---

# 12. Nomor WhatsApp

Data nomor orang tua tersedia melalui:

```text
student.whatsappNumber
```

Kolom tersebut sudah tersedia pada schema Prisma.

**Tidak diperlukan perubahan schema Prisma.**

---

## 12.1 Nomor Kosong

Jika:

```text
whatsappNumber = null
```

atau:

```text
whatsappNumber = ""
```

atau hanya berisi whitespace:

```text
"   "
```

maka:

```text
SKIP
```

Ini bukan error.

Attendance tetap berhasil.

---

# 13. Normalisasi Nomor WhatsApp

Nomor WhatsApp harus dinormalisasi sebelum dikirim ke Fonnte.

Format final:

```text
62xxxxxxxxxx
```

Contoh:

```text
081234567890
```

menjadi:

```text
6281234567890
```

---

### Contoh normalisasi

```text
081234567890
→ 6281234567890
```

```text
+6281234567890
→ 6281234567890
```

```text
6281234567890
→ 6281234567890
```

Jika input menggunakan format:

```text
81234567890
```

maka dapat dinormalisasi menjadi:

```text
6281234567890
```

---

## 13.1 Nomor Tidak Valid

Jika nomor tidak dapat dinormalisasi menjadi nomor Indonesia yang masuk akal:

```text
SKIP
```

dan catat warning server.

Contoh:

```text
console.warn(...)
```

Jangan menyebabkan attendance gagal.

---

# 14. Template Pesan

Template pesan untuk versi pertama bersifat:

**HARDCODED**

Belum dapat diedit melalui UI.

---

## 14.1 Check-in

```text
Assalamu'alaikum, Bapak/Ibu Wali Murid.

Ananda {nama} ({kelas}) telah tiba di sekolah pada {jam} WIB
dengan status {status}.

— SMK Yadika Tanjungsari
```

---

## 14.2 Check-out

```text
Assalamu'alaikum, Bapak/Ibu Wali Murid.

Ananda {nama} ({kelas}) telah pulang sekolah pada {jam} WIB.

— SMK Yadika Tanjungsari
```

---

# 15. Placeholder Template

## Check-in

| Placeholder | Sumber            |
| ----------- | ----------------- |
| `{nama}`    | Nama siswa        |
| `{kelas}`   | Kelas siswa       |
| `{jam}`     | Waktu check-in    |
| `{status}`  | Status attendance |

---

## Check-out

| Placeholder | Sumber          |
| ----------- | --------------- |
| `{nama}`    | Nama siswa      |
| `{kelas}`   | Kelas siswa     |
| `{jam}`     | Waktu check-out |

---

# 16. Attendance Status

Untuk status pada pesan check-in:

```text
{status}
```

gunakan:

```text
STATUS_LABEL
```

yang sudah tersedia di:

```text
lib/constants/attendance.ts
```

**Jangan membuat mapping status baru di `WhatsAppService`.**

Contoh:

```text
HADIR
TERLAMBAT
```

Service WhatsApp harus menggunakan sumber status/label yang sudah menjadi standar aplikasi.

Tujuannya agar tidak terjadi perbedaan label antara:

```text
UI attendance
```

dan:

```text
WhatsApp notification
```

---

# 17. Timezone

Semua waktu pada pesan WhatsApp harus menggunakan:

```text
Asia/Jakarta
```

atau:

```text
WIB
```

Jangan bergantung pada timezone server.

Hal ini penting karena deployment dapat berada pada server/cloud dengan timezone berbeda.

---

## 17.1 Format Waktu

Format:

```text
HH:mm WIB
```

Contoh:

```text
07:32 WIB
```

atau:

```text
15:47 WIB
```

---

# 18. Data yang Dibutuhkan WhatsAppService

`WhatsAppService` membutuhkan informasi minimal:

### Check-in

* nama siswa;
* kelas siswa;
* nomor WhatsApp;
* waktu check-in;
* status attendance.

### Check-out

* nama siswa;
* kelas siswa;
* nomor WhatsApp;
* waktu check-out.

---

## 18.1 Hindari Query Tambahan

Jika seluruh data tersebut sudah tersedia dari hasil proses `AttendanceService`, jangan membuat query database tambahan hanya untuk mengirim WhatsApp.

Tujuannya:

* menghindari N+1 query;
* mengurangi beban database;
* menjaga performa saat jam masuk sekolah.

Ikuti struktur data yang sudah digunakan oleh `AttendanceService`.

**Jangan mengubah struktur database hanya untuk fitur WhatsApp.**

---

# 19. Security

> ⚠️ **Superseded sebagian oleh §45.** `FONNTE_TOKEN` sebagai satu-satunya sumber token **tidak lagi berlaku** — token kini per-nomor pengirim di tabel `WhatsAppSender`. Prinsip "tidak boleh sampai ke client/log/source code" di bawah ini **tetap berlaku penuh**, hanya sumber penyimpanannya yang berubah dari env var menjadi database (server-only).

`FONNTE_TOKEN` adalah secret.

Token:

* hanya boleh digunakan server-side;
* tidak boleh dikirim ke browser;
* tidak boleh dimasukkan ke client component;
* tidak boleh menggunakan prefix `NEXT_PUBLIC_`;
* tidak boleh dimasukkan ke response API;
* tidak boleh dimasukkan ke log;
* tidak boleh dimasukkan ke source code;
* tidak boleh di-commit ke Git.

Gunakan:

```text
FONNTE_TOKEN
```

Bukan:

```text
NEXT_PUBLIC_FONNTE_TOKEN
```

---

# 20. Environment Variables

> ⚠️ **Superseded oleh §45.** Section ini (env var `FONNTE_TOKEN` sebagai sumber token) **tidak lagi dipakai** untuk fitur ini. Token disimpan di database lewat halaman Pengaturan (SUPERADMIN). Tidak perlu menambahkan `FONNTE_TOKEN` ke `.env`/`.env.example`.

Tambahkan ke:

```text
.env
```

```env
FONNTE_TOKEN=
```

Contoh:

```env
FONNTE_TOKEN=isi-token-fonnte-di-environment
```

**Jangan menuliskan token asli ke repository.**

---

## 20.1 `.env.example`

Tambahkan:

```env
FONNTE_TOKEN=
```

Tanpa nilai asli.

---

# 21. Development Environment

Jika:

```text
FONNTE_TOKEN
```

tidak tersedia, fitur WhatsApp harus otomatis:

```text
SKIP
```

Attendance tetap berjalan normal.

Contoh behavior:

```text
FONNTE_TOKEN tidak ditemukan
        ↓
Log info/warning
        ↓
Skip WhatsApp
        ↓
Attendance tetap SUCCESS
```

Jangan menjadikan environment development gagal hanya karena token belum tersedia.

---

# 22. File yang Dibuat/Diubah

> ⚠️ **Tabel di bawah ini superseded oleh §45** (ada tabel & migration baru untuk konfigurasi nomor pengirim). Baris untuk `whatsapp-service.ts` dan `attendance-service.ts` tetap berlaku apa adanya.

| File                                  | Perubahan                                                      |
| -------------------------------------- | --------------------------------------------------------------- |
| `lib/services/whatsapp-service.ts`     | **BARU** — implementasi `WhatsAppService.notifyAttendance()`    |
| `lib/services/attendance-service.ts`   | Memanggil WhatsAppService setelah check-in/check-out SUCCESS    |
| ~~`.env.example` — `FONNTE_TOKEN`~~    | **Dibatalkan**, lihat §45 (token pindah ke database)            |

Lihat **§45.6** untuk daftar file lengkap termasuk konfigurasi multi-sender.

---

# 23. Prisma Schema

> ⚠️ **Superseded oleh §45.** Fitur ini sekarang **membutuhkan** migration baru untuk tabel `WhatsAppSender`. Larangan "jangan membuat migration/tabel baru" pada section ini **tidak berlaku lagi**.

Kolom:

```text
student.whatsappNumber
```

sudah tersedia dan tetap dipakai apa adanya untuk **nomor penerima** (orang tua/wali) — ini tidak berubah.

Yang berubah hanyalah sumber **token/nomor pengirim**, yang sebelumnya direncanakan dari env var, sekarang dari tabel baru `WhatsAppSender` (lihat §45).

Jangan menambahkan:

```text
whatsapp_logs
```

atau:

```text
whatsapp_messages
```

untuk versi ini — larangan ini tetap berlaku (tidak ada tabel log pengiriman/riwayat pesan, hanya tabel konfigurasi pengirim).

---

# 24. Logging

Untuk versi pertama tidak dibuat tabel database khusus untuk log WhatsApp.

Jika request gagal, gunakan server-side logging.

Contoh:

```ts
console.error(...)
```

atau:

```ts
console.warn(...)
```

Logging tidak boleh membocorkan:

* Fonnte token;
* credential;
* secret;
* informasi sensitif yang tidak diperlukan.

---

# 25. Response Fonnte

Implementasi harus memeriksa response HTTP dari Fonnte.

Jika HTTP request gagal:

```text
catch
```

Jika HTTP response menunjukkan error:

```text
log error
```

Namun:

```text
Attendance tetap SUCCESS
```

Service tidak boleh mengubah hasil attendance menjadi gagal hanya karena Fonnte gagal.

---

# 26. Duplicate Notification

Untuk satu event attendance:

```text
1 check-in SUCCESS
```

maksimal:

```text
1 WhatsApp
```

Untuk:

```text
1 check-out SUCCESS
```

maksimal:

```text
1 WhatsApp
```

Jangan membuat mekanisme yang dapat mengirim pesan berulang hanya karena:

* component re-render;
* API request diulang;
* UI refresh;
* webhook;
* retry HTTP client;
* React Strict Mode.

Trigger harus berada pada business logic:

```text
AttendanceService
```

bukan pada:

```text
React component
```

---

# 27. Manual Attendance

Absensi manual oleh guru tetap harus mengirim WhatsApp apabila menghasilkan:

```text
SUCCESS
```

Contoh:

```text
Guru scan barcode
→ SUCCESS
→ WhatsApp
```

dan:

```text
Guru input NISN manual
→ SUCCESS
→ WhatsApp
```

Keduanya harus melalui `AttendanceService`.

Jangan membuat trigger WhatsApp terpisah di UI.

---

# 28. Manual Status Admin

Perubahan status melalui:

```text
setManualStatus()
```

tidak boleh mengirim WhatsApp.

Contoh:

```text
Admin mengubah siswa menjadi SAKIT
→ Tidak ada WhatsApp
```

```text
Admin mengubah siswa menjadi IZIN
→ Tidak ada WhatsApp
```

```text
Admin mengubah siswa menjadi DISPENSASI
→ Tidak ada WhatsApp
```

```text
Admin mengubah siswa menjadi ALPHA
→ Tidak ada WhatsApp
```

Hal ini merupakan keputusan scope versi pertama.

---

# 29. Out of Scope

Fitur berikut **tidak boleh ditambahkan dalam implementasi versi ini**, kecuali diminta secara eksplisit pada task terpisah.

### 29.1 Retry otomatis

Tidak dibuat.

---

### 29.2 Queue

Tidak dibuat.

---

### 29.3 WhatsApp delivery log database

Tidak dibuat.

---

### 29.4 Admin template editor

Tidak dibuat.

Template tetap hardcoded.

---

### 29.5 Multiple WhatsApp numbers

Satu siswa hanya menggunakan:

```text
student.whatsappNumber
```

Tidak ada:

```text
fatherWhatsapp
motherWhatsapp
guardianWhatsapp
```

tambahan.

---

### 29.6 Delivery status

Tidak dibuat.

Tidak ada:

* delivered tracking;
* read tracking;
* centang biru;
* webhook delivery status.

---

### 29.7 Notifikasi perubahan status manual

Tidak dibuat.

---

### 29.8 Blast massal

Tidak dibuat.

Fitur ini adalah:

```text
event-based notification
```

bukan:

```text
mass broadcast system
```

---

# 30. Arsitektur Final

Arsitektur yang disepakati:

```text
                    ┌─────────────────────┐
                    │   Teacher / Client  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Attendance API / UI │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ AttendanceService   │
                    └──────────┬──────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
          Prisma Transaction          SUCCESS result
                  │                         │
                  ▼                         ▼
              COMMIT              WhatsAppService
                                            │
                                            ▼
                                     Fonnte API
                                            │
                                            ▼
                                      WhatsApp
                                            │
                                            ▼
                                    Parent / Guardian
```

---

# 31. Prinsip Arsitektur

Implementasi harus mengikuti prinsip:

```text
AttendanceService
    = business logic attendance

WhatsAppService
    = integration dengan WhatsApp provider
```

Jangan membuat:

```text
AttendanceService
    = business logic + HTTP Fonnte + template + normalization
```

---

# 32. Public Interface

Service dapat menggunakan interface sederhana seperti:

```ts
WhatsAppService.notifyAttendance(...)
```

Detail implementasi internal bebas mengikuti style project selama memenuhi seluruh requirement dalam dokumen ini.

Jangan membuat API publik yang tidak diperlukan.

---

# 33. Implementasi Tidak Boleh Mengubah Business Logic Attendance

Implementasi fitur WhatsApp tidak boleh mengubah behavior existing:

* check-in;
* check-out;
* validasi siswa;
* validasi jam;
* status attendance;
* transaksi Prisma;
* response API;
* manual attendance.

Perubahan pada `attendance-service.ts` harus seminimal mungkin dan hanya untuk menambahkan notification hook.

---

# 34. Prinsip Dependency

`AttendanceService` boleh bergantung pada:

```text
WhatsAppService
```

tetapi `WhatsAppService` tidak boleh bergantung pada:

```text
AttendanceService
```

Hindari circular dependency.

---

# 35. Error Handling Matrix

| Kondisi                 | Attendance                  | WhatsApp      |
| ----------------------- | --------------------------- | ------------- |
| Fonnte sukses           | SUCCESS                     | Terkirim      |
| Fonnte timeout          | SUCCESS                     | Gagal/log     |
| Fonnte HTTP error       | SUCCESS                     | Gagal/log     |
| Token kosong            | SUCCESS                     | Skip          |
| Nomor kosong            | SUCCESS                     | Skip          |
| Nomor invalid           | SUCCESS                     | Skip          |
| Student tidak ditemukan | Gagal sesuai existing logic | Tidak dikirim |
| Sudah check-in          | Existing behavior           | Tidak dikirim |
| Sekolah tutup           | Existing behavior           | Tidak dikirim |
| Manual status           | Existing behavior           | Tidak dikirim |

---

# 36. Acceptance Criteria

Implementasi dianggap selesai apabila seluruh kondisi berikut terpenuhi.

## Check-in

* [ ] Check-in `SUCCESS` mengirim 1 WhatsApp.
* [ ] Check-in `ALREADY_CHECKED_IN` tidak mengirim WhatsApp.
* [ ] Check-in `STUDENT_NOT_FOUND` tidak mengirim WhatsApp.
* [ ] Check-in `SCHOOL_CLOSED` tidak mengirim WhatsApp.
* [ ] Error validasi lain tidak mengirim WhatsApp.

## Check-out

* [ ] Check-out `SUCCESS` mengirim 1 WhatsApp.
* [ ] Check-out gagal tidak mengirim WhatsApp.

## Nomor WhatsApp

* [ ] `whatsappNumber = null` melakukan skip.
* [ ] `whatsappNumber = ""` melakukan skip.
* [ ] whitespace-only melakukan skip.
* [ ] Nomor `08xxxxxxxxxx` dinormalisasi ke `628xxxxxxxxxx`.
* [ ] Nomor `+628xxxxxxxxxx` dinormalisasi ke `628xxxxxxxxxx`.
* [ ] Nomor `628xxxxxxxxxx` tetap valid.
* [ ] Nomor invalid tidak menyebabkan attendance gagal.

## Environment

> ⚠️ Checklist di bawah **diperbarui** — sumber token bukan lagi env var tunggal, lihat §45.

* [ ] Token diambil dari `WhatsAppSender` yang `isActive = true` di database, bukan hardcode/env var.
* [ ] Token tidak pernah dikirim ke client (termasuk dalam response API config).
* [ ] Token tidak ditampilkan penuh di UI manapun (masked, mis. `••••3xF2`).
* [ ] Token tidak masuk source code.
* [ ] Token tidak masuk Git.
* [ ] Token tidak muncul di log.
* [ ] Jika tidak ada sender yang `isActive = true`, WhatsApp di-skip dan attendance tetap berjalan.

## Database

> ⚠️ Checklist di bawah **diperbarui** — migration & tabel baru untuk `WhatsAppSender` kini diperbolehkan, lihat §45.

* [ ] Attendance disimpan terlebih dahulu.
* [ ] Prisma transaction selesai commit sebelum request Fonnte.
* [ ] Tidak ada request Fonnte di dalam `$transaction()`.
* [ ] Migration untuk `WhatsAppSender` dibuat dengan aman (tidak mengubah/menghapus data existing).
* [ ] Tidak ada tabel log pengiriman/riwayat pesan WhatsApp (`whatsapp_logs`/`whatsapp_messages`) — hanya tabel konfigurasi pengirim.
* [ ] Hanya ada maksimal satu `WhatsAppSender.isActive = true` pada satu waktu (dijamin di service layer, bukan hard constraint DB).

## Error Handling

* [ ] Fonnte timeout tidak menggagalkan attendance.
* [ ] Fonnte HTTP error tidak menggagalkan attendance.
* [ ] Fonnte response error tidak menggagalkan attendance.
* [ ] Error WhatsApp tidak propagate ke response attendance.
* [ ] Tidak ada retry otomatis.

## Performance

* [ ] Tidak menggunakan `Promise.all()` untuk blast paralel.
* [ ] Tidak membuat queue.
* [ ] Tidak membuat query database tambahan jika data siswa sudah tersedia.
* [ ] WhatsApp request tidak memperpanjang Prisma transaction.

## Template

* [ ] Check-in menggunakan template yang sudah ditentukan.
* [ ] Check-out menggunakan template yang sudah ditentukan.
* [ ] Status menggunakan `STATUS_LABEL` existing.
* [ ] Tidak membuat mapping status baru.
* [ ] Waktu menggunakan timezone `Asia/Jakarta`.
* [ ] Format waktu `HH:mm WIB`.

## Scope

* [ ] Tidak ada notifikasi untuk `setManualStatus()`.
* [ ] Tidak ada notifikasi SAKIT/IZIN/DISPENSASI/ALPHA.
* [ ] Tidak ada multiple recipient.
* [ ] Tidak ada delivery tracking.
* [ ] Tidak ada WhatsApp history database.
* [ ] Tidak ada template editor.

## Role & Akses (baru — lihat §45)

* [ ] Halaman konfigurasi nomor pengirim hanya dapat diakses role `SUPERADMIN`.
* [ ] Server action CRUD/aktivasi sender di-guard dengan `requireRole(["SUPERADMIN"])`, bukan hanya disembunyikan di UI.
* [ ] Akses langsung via URL oleh ADMIN/GURU/WALI_KELAS ke halaman/aksi ini ditolak (redirect `/unauthorized`).
* [ ] Trigger pengiriman WhatsApp saat check-in/check-out **tidak dibatasi role** — tetap berjalan otomatis untuk siapa pun yang melakukan absensi (guru/admin), sesuai §5.

---

# 37. Testing Checklist

Sebelum dianggap selesai, lakukan pengujian minimal berikut.

### Test 1 — Check-in normal

```text
Siswa memiliki nomor WhatsApp
FONNTE_TOKEN tersedia
Check-in SUCCESS
```

Expected:

```text
Attendance tersimpan
WhatsApp terkirim
```

---

### Test 2 — Check-out normal

```text
Siswa memiliki nomor WhatsApp
FONNTE_TOKEN tersedia
Check-out SUCCESS
```

Expected:

```text
Attendance tersimpan
WhatsApp terkirim
```

---

### Test 3 — Nomor kosong

```text
student.whatsappNumber = null
```

Expected:

```text
Attendance SUCCESS
WhatsApp SKIP
```

---

### Test 4 — Token tidak tersedia

```text
FONNTE_TOKEN tidak tersedia
```

Expected:

```text
Attendance SUCCESS
WhatsApp SKIP
Application tidak crash
```

---

### Test 5 — Fonnte timeout

Simulasikan timeout/error request.

Expected:

```text
Attendance SUCCESS
Error tercatat di server log
Tidak ada retry
```

---

### Test 6 — Sudah check-in

Expected:

```text
ALREADY_CHECKED_IN
Tidak ada WhatsApp
```

---

### Test 7 — Manual status

Admin menjalankan:

```text
setManualStatus()
```

Expected:

```text
Status berubah
Tidak ada WhatsApp
```

---

### Test 8 — Manual attendance

Guru melakukan absensi manual.

Expected:

```text
Attendance SUCCESS
WhatsApp terkirim
```

---

# 38. Performance Consideration

Jam masuk sekolah merupakan periode dengan traffic tertinggi.

Contoh:

```text
07:00 — beberapa siswa scan
07:01 — beberapa siswa scan
07:02 — beberapa siswa scan
...
```

Setiap scan menghasilkan maksimal satu request WhatsApp.

Arsitektur tidak boleh melakukan:

```text
SELECT semua siswa
→ loop 400 siswa
→ kirim 400 WhatsApp
```

Fitur ini **event-driven**, bukan scheduled blast.

---

# 39. Prinsip Idempotency

Untuk versi ini tidak dibuat sistem idempotency khusus berbasis database.

Namun implementasi harus memastikan bahwa WhatsApp hanya dipanggil ketika hasil attendance adalah:

```text
SUCCESS
```

dan hanya pada jalur business logic yang benar-benar menghasilkan event attendance baru.

Jangan men-trigger WhatsApp dari:

* halaman UI;
* component mount;
* refresh;
* polling;
* fetch ulang data attendance.

---

# 40. Aturan Untuk AI / Vibe Coding Agent

Jika dokumen ini digunakan sebagai instruction untuk AI coding agent, agent wajib mengikuti aturan berikut:

### Sebelum coding

1. Baca dokumen ini secara keseluruhan.
2. Baca implementasi aktual:

   * `lib/services/attendance-service.ts`
   * `lib/constants/attendance.ts`
   * schema Prisma terkait Student dan Attendance.
3. Pahami struktur project yang sudah ada.
4. Jangan berasumsi terhadap struktur code yang belum dibaca.

### Saat coding

> ⚠️ Poin 7, 8, 9, dan 13 di bawah **sudah tidak berlaku** — lihat §45 untuk aturan pengganti.

5. Buat `lib/services/whatsapp-service.ts`.
6. Modifikasi `attendance-service.ts` seminimal mungkin.
7. ~~Tambahkan `FONNTE_TOKEN` ke `.env.example`~~ — **dibatalkan**, token disimpan di tabel `WhatsAppSender`, bukan env var.
8. ~~Jangan mengubah schema Prisma~~ — **dibatalkan**, tambahkan model `WhatsAppSender` sesuai §45.1.
9. ~~Jangan membuat migration~~ — **dibatalkan**, buat migration untuk `WhatsAppSender` sesuai §45.1.
10. Jangan membuat queue. *(tetap berlaku)*
11. Jangan membuat retry. *(tetap berlaku)*
12. Jangan membuat tabel log pengiriman/riwayat pesan WhatsApp. *(tetap berlaku — tabel baru hanya untuk konfigurasi sender, bukan log pesan)*
13. ~~Jangan membuat UI pengaturan WhatsApp~~ — **dibatalkan**, buat tab "Notifikasi WhatsApp" di `/pengaturan` khusus SUPERADMIN sesuai §45.3.
14. Jangan mengubah behavior existing attendance. *(tetap berlaku)*
15. Jangan mengekspos Fonnte token ke client (termasuk di halaman konfigurasi baru — selalu masked). *(tetap berlaku, makin penting karena sekarang ada UI-nya)*
16. Gunakan `STATUS_LABEL` existing. *(tetap berlaku)*
17. Gunakan timezone `Asia/Jakarta`. *(tetap berlaku)*
18. Pastikan WhatsApp failure tidak menggagalkan attendance. *(tetap berlaku)*
19. Guard halaman & server action konfigurasi sender dengan `requireRole(["SUPERADMIN"])`, ikuti pola `pengaturan-service.ts`/`guard.ts` yang sudah ada.
20. Pastikan hanya satu `WhatsAppSender` yang `isActive = true` pada satu waktu (lakukan dalam `$transaction` saat mengaktifkan sender lain).

### Setelah coding

19. Jalankan typecheck.
20. Jalankan lint jika tersedia.
21. Periksa import dan circular dependency.
22. Periksa bahwa secret tidak terekspos.
23. Verifikasi bahwa request Fonnte dilakukan setelah transaction commit.
24. Verifikasi bahwa `setManualStatus()` tidak memicu WhatsApp.
25. Laporkan file yang berubah.
26. Laporkan hasil testing/typecheck/lint.
27. Jika menemukan konflik antara dokumen ini dengan kode existing, **jangan mengambil keputusan arsitektur sendiri**. Jelaskan konflik tersebut terlebih dahulu.

---

# 41. Hal yang Tidak Boleh Dilakukan Agent

Agent **JANGAN**:

* membuat WhatsApp service di client;
* menggunakan `NEXT_PUBLIC_FONNTE_TOKEN` atau `NEXT_PUBLIC_` apa pun untuk token;
* hardcode token di source code;
* mengirim token (utuh) ke browser, termasuk di halaman konfigurasi sender — selalu masked;
* memasukkan token ke log;
* ~~membuat migration~~ / ~~membuat tabel WhatsApp~~ — **dibatalkan untuk kasus `WhatsAppSender`**, lihat §45. Larangan ini tetap berlaku untuk tabel *log/riwayat pengiriman pesan*;
* membuat queue;
* membuat Redis dependency;
* membuat retry otomatis;
* mengirim pesan menggunakan `Promise.all()` secara massal;
* mengirim WhatsApp dari React component;
* mengirim WhatsApp untuk `setManualStatus()`;
* mengirim WhatsApp untuk status SAKIT/IZIN/DISPENSASI/ALPHA;
* mengubah business logic attendance yang sudah ada;
* menambahkan provider WhatsApp kedua (selain Fonnte);
* membuat UI pengaturan **template** pesan (template tetap hardcoded — ini beda dengan UI konfigurasi **nomor pengirim** yang sekarang justru wajib dibuat, lihat §45.3);
* membuat sistem delivery tracking;
* membuat multiple recipient (nomor **penerima**/orang tua tetap satu, `student.whatsappNumber`);
* membuat scheduled blast;
* mengizinkan role selain SUPERADMIN mengelola/melihat konfigurasi sender (CRUD & isi token);
* melakukan refactor besar yang tidak diperlukan untuk fitur ini.

---

# 42. Expected File Structure

> ⚠️ **Superseded oleh §45.6** — ada file tambahan untuk konfigurasi multi-sender (migration, service, validation, komponen UI, server action). Struktur di bawah ini adalah baseline lama untuk notifikasi itu sendiri dan tetap benar, tapi tidak lengkap lagi.

```text
lib/
├── constants/
│   └── attendance.ts
│
└── services/
    ├── attendance-service.ts
    └── whatsapp-service.ts
```

Lihat **§45.6** untuk struktur file lengkap termasuk konfigurasi sender.

---

# 43. Definition of Done

Fitur dinyatakan **DONE** apabila:

```text
Check-in SUCCESS
        ↓
Attendance committed
        ↓
WhatsApp notification attempted
```

dan:

```text
Check-out SUCCESS
        ↓
Attendance committed
        ↓
WhatsApp notification attempted
```

Dengan ketentuan:

```text
WhatsApp gagal
      ↓
Attendance tetap berhasil
```

dan:

```text
Token tidak tersedia
      ↓
WhatsApp skip
      ↓
Attendance tetap berhasil
```

serta:

```text
Nomor WA kosong/invalid
      ↓
WhatsApp skip
      ↓
Attendance tetap berhasil
```

Tidak ada perubahan database.

Tidak ada queue.

Tidak ada retry.

Tidak ada notification untuk manual status.

---

# 44. Final Implementation Contract

Dokumen ini merupakan kontrak implementasi untuk fitur WhatsApp Notification versi pertama.

Prioritas requirement:

```text
1. Attendance correctness
2. Database correctness
3. Security
4. Reliability
5. WhatsApp notification
6. Performance
7. Code maintainability
8. UI / visual polish
```

Jika terjadi konflik antara:

```text
WhatsApp notification
```

dan:

```text
attendance correctness
```

maka:

> **Attendance correctness selalu menang.**

Jika Fonnte down, attendance tetap harus berjalan.

Jika token hilang, attendance tetap harus berjalan.

Jika nomor WhatsApp invalid, attendance tetap harus berjalan.

Jika request Fonnte timeout, attendance tetap harus berjalan.

**WhatsApp adalah best-effort side effect, bukan bagian dari core attendance transaction.**

---

# 45. ADENDUM — Nomor Pengirim Dinamis (Multi-Sender)

> **Status: DISEPAKATI — SUPERSEDES bagian terkait di §3–§4, §19–§23, §36, §40–§42.**
>
> Semua prinsip di dokumen utama (best-effort, non-blocking, event-driven, tanpa queue/retry/blast massal, tanpa tabel log pesan) **tetap berlaku penuh**. Adendum ini **hanya** mengubah *dari mana token/nomor pengirim Fonnte diambil* dan *siapa yang boleh mengelolanya* — bukan mengubah kapan/bagaimana pesan dikirim.

## 45.0 Latar Belakang

Desain awal (`FONNTE_TOKEN` sebagai satu env var statis, diisi manual) diganti karena kebutuhan operasional:

* Nomor WhatsApp pengirim sekolah bisa berganti (device logout, nomor diblokir/dibatasi, ganti provider device, dst — lihat risiko di §3.1).
* Admin tertinggi perlu bisa mengganti nomor pengirim **tanpa deploy ulang** aplikasi atau mengubah environment variable di hosting.
* Ke depan mungkin ada lebih dari satu nomor terdaftar (cadangan), tapi hanya **satu yang aktif digunakan mengirim** pada satu waktu.
* **Setup harus lewat scan QR langsung di aplikasi kita** (mirip pairing WhatsApp Web), **bukan** admin copy-paste device token dari dashboard Fonnte secara manual.

Fonnte menyediakan API resmi untuk kebutuhan ini — dikonfirmasi dari dokumentasi mereka (`docs.fonnte.com`):

| Endpoint Fonnte     | Fungsi                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `POST /add-device`  | Buat device baru via API (pakai **Account Token**) → Fonnte balikin **device token** otomatis |
| `POST /qr`           | Ambil QR code (base64 image) untuk device tersebut, ditampilkan di UI kita |
| `POST /get-devices`  | Cek status semua device (`connect`/`disconnect`) — dipakai untuk polling |
| Disconnect Device    | Putuskan device yang sedang terhubung (dipakai saat mengganti nomor)   |

Dengan ini, **admin tidak pernah mengetik device token secara manual** — token didapat otomatis dari response `/add-device` dan disimpan langsung oleh server. Yang diketik admin hanya label & nomor WA (bukan secret).

**Penting — dua jenis token berbeda, jangan tertukar:**

* **Account Token** — satu token untuk seluruh akun Fonnte sekolah (bukan per-nomor). Dipakai server untuk memanggil `/add-device` dan cek status device. Disimpan sebagai env var `FONNTE_ACCOUNT_TOKEN` (server-only, bukan `NEXT_PUBLIC_`).
* **Device Token** (`WhatsAppSender.fonteToken`) — token spesifik per nomor/device, didapat otomatis dari Fonnte saat device dibuat, dipakai untuk kirim pesan (`/send`). Disimpan di database, bukan env var, sesuai §45.1.

Konsekuensi paket: Fonnte membatasi **paket Free hanya boleh 1 device tersambung** bersamaan. Kalau sekolah butuh menyimpan beberapa nomor cadangan yang bisa dipakai kapan saja, pastikan paket Fonnte yang dipakai mendukung jumlah device sesuai kebutuhan.

## 45.1 Model Data Baru — `WhatsAppSender`

Tabel baru khusus **konfigurasi pengirim** (bukan log/riwayat pesan — itu tetap dilarang, lihat §29.3):

```prisma
enum WhatsAppSenderStatus {
  PENDING_SCAN   // device sudah dibuat di Fonnte, QR sudah digenerate, menunggu discan
  CONNECTED      // berhasil discan & terhubung ke WhatsApp
  DISCONNECTED   // pernah connect, sekarang putus (logout/expired/manual disconnect)
}

model WhatsAppSender {
  id          String                @id @default(cuid())
  label       String                // nama bebas untuk memudahkan admin, mis. "Nomor Utama TU"
  phoneNumber String                // nomor WA device ini, format 62xxxxxxxxxx, diinput admin saat create
  fonteToken  String                // device token — DIISI OTOMATIS dari response Fonnte /add-device, TIDAK PERNAH diketik admin, TIDAK PERNAH dikirim utuh ke client
  status      WhatsAppSenderStatus  @default(PENDING_SCAN)
  isActive    Boolean               @default(false)
  updatedById String?
  updatedBy   User?                 @relation("WhatsAppSenderUpdatedBy", fields: [updatedById], references: [id])
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  @@index([isActive])
  @@index([status])
}
```

Tambahkan relasi balik di `model User`:

```prisma
updatedWhatsappSenders WhatsAppSender[] @relation("WhatsAppSenderUpdatedBy")
```

Aturan data:

* Hanya boleh ada **maksimal satu** baris dengan `isActive = true` pada satu waktu. Ini **dijamin di service layer** (bukan constraint database), lewat `$transaction`: set semua sender lain `isActive = false`, baru set target `isActive = true`.
* **Hanya sender dengan `status = CONNECTED`** yang boleh menjadi `isActive = true`. Sender `PENDING_SCAN`/`DISCONNECTED` tidak boleh diaktifkan (lihat §45.3 untuk kapan status berubah jadi `CONNECTED`).
* Tidak ada batas jumlah baris `isActive = false` (riwayat/cadangan nomor boleh disimpan banyak, masing-masing dengan status-nya sendiri).
* `WhatsAppSender` boleh dihapus (hard delete — ini data konfigurasi, bukan data historis absensi, jadi tidak tunduk pada aturan soft-delete §3.3 yang berlaku untuk `Student`). **Kecuali** baris yang sedang `isActive = true` — sender aktif harus dinonaktifkan/diganti aktifnya dulu sebelum bisa dihapus. Saat dihapus dan statusnya masih `CONNECTED`, server juga memanggil Fonnte Disconnect Device supaya device tidak menggantung di sisi Fonnte.
* `fonteToken` **tidak pernah** diinput manual oleh admin — selalu hasil response `/add-device` dari Fonnte, ditulis langsung oleh server ke database.

## 45.2 Perubahan `WhatsAppService`

`WhatsAppService.notifyAttendance()` sekarang mengambil sender aktif di awal, sebelum membangun request:

```ts
const sender = await prisma.whatsAppSender.findFirst({
  where: { isActive: true },
  select: { fonteToken: true },
});

if (!sender) {
  console.warn("[WhatsAppService] Tidak ada sender aktif — skip notifikasi.");
  return;
}
```

Ini **satu query ringan**, sejalan dengan §18.1 (hindari query tambahan yang tidak perlu) — bukan N+1, hanya dipanggil sekali per notifikasi, dan tidak menyentuh tabel `Student`/`Attendance` yang datanya sudah tersedia dari `AttendanceService`.

Behavior tetap mengikuti §7/§8: jika `sender` tidak ada → **skip, bukan error**, attendance tetap `SUCCESS` — sama persis seperti perilaku lama "token tidak tersedia di env".

## 45.3 UI Konfigurasi — Khusus SUPERADMIN, Setup via Scan QR

Tambahkan tab baru **"Notifikasi WhatsApp"** di `/pengaturan`, mengikuti pola tab "Jadwal Absensi"/"Hari Libur" yang sudah ada (lihat `app/(protected)/pengaturan/page.tsx` — hanya render jika `actor.role === "SUPERADMIN"`).

### 45.3.1 Alur Tambah Nomor (Scan QR)

```text
SUPERADMIN klik "Tambah Nomor"
        ↓
Input: label + nomor WA (bukan secret, boleh manual)
        ↓
Server panggil Fonnte POST /add-device (pakai FONNTE_ACCOUNT_TOKEN)
        ↓
Fonnte balikin device token
        ↓
WhatsAppSender dibuat: status = PENDING_SCAN, isActive = false
        ↓
Server panggil Fonnte POST /qr (pakai device token)
        ↓
QR image (base64) ditampilkan di UI kita
        ↓
Admin scan pakai HP WhatsApp sekolah
        ↓
Client polling ke server kita setiap beberapa detik
        ↓
Server cek status device ke Fonnte (get-devices / device profile)
        ↓
Status Fonnte = "connect"
        ↓
WhatsAppSender.status → CONNECTED
        ↓
Dalam satu $transaction: semua sender lain isActive=false, sender ini isActive=true
        ↓
UI menampilkan "Terhubung & Aktif" — nomor langsung bisa dipakai kirim WhatsApp
```

**Auto-aktivasi**: begitu status berubah menjadi `CONNECTED`, sender itu **langsung otomatis diaktifkan** (`isActive = true`) tanpa perlu klik tombol tambahan — sesuai keputusan bisnis. Sender lama yang sebelumnya aktif otomatis menjadi nonaktif di transaksi yang sama, sehingga **selalu ada maksimal 1 sender aktif**, tidak pernah 2 sekaligus.

Sender yang gagal discan (QR kedaluwarsa, admin batal) tetap tersimpan dengan `status = PENDING_SCAN` — bisa di-generate ulang QR-nya atau dihapus, tidak otomatis terhapus.

### 45.3.2 Isi Halaman

* Daftar sender tersimpan: label, nomor, **status koneksi** (badge: "Menunggu Scan" / "Terhubung" / "Terputus" — ikon+teks, bukan cuma warna, sesuai §32), badge aktif/nonaktif terpisah dari status koneksi.
* Tombol "Tambah Nomor" → membuka modal alur QR (§45.3.1).
* Tombol "Scan Ulang" untuk sender `PENDING_SCAN`/`DISCONNECTED` (generate ulang QR pakai device token yang sama, tidak membuat device baru).
* Tombol "Putuskan" (disconnect) untuk sender `CONNECTED` yang bukan sedang aktif — memanggil Fonnte Disconnect Device, status → `DISCONNECTED`.
* Aksi hapus — ditolak untuk sender yang sedang `isActive = true` (harus diputuskan/nonaktif dulu), sesuai §45.1.
* **Tidak ada** form input token manual di mana pun pada halaman ini — token selalu berasal dari server (§45.1).

**Role guard wajib di dua lapis** (konsisten dengan §5 project spec & pola `guard.ts` existing):

1. Halaman/tab hanya tampil untuk `SUPERADMIN` (kosmetik).
2. Setiap server action (`createSenderAndGetQr`, `refreshSenderStatus`, `disconnectSender`, `deleteSender`) memanggil `requireRole(["SUPERADMIN"])` di awal — supaya akses langsung lewat request tidak bisa bypass UI.

ADMIN, GURU, dan WALI_KELAS **tidak** melihat tab ini dan **tidak** bisa memanggil action-nya sama sekali (bukan cuma read-only — no access).

## 45.4 Audit Log

Setiap perubahan tercatat di `AuditLog` yang sudah ada (pola sama seperti `pengaturan-service.ts`), entity `"WhatsAppSender"`:

* `CREATE` — "Menambahkan nomor pengirim WhatsApp: {label} ({phoneNumber}), menunggu scan QR"
* `UPDATE` (saat status → CONNECTED + auto-aktif) — "Nomor WhatsApp {label} ({phoneNumber}) terhubung & otomatis diaktifkan sebagai pengirim"
* `UPDATE` (saat sender lain otomatis nonaktif karena ada yang baru connect) — "Nomor WhatsApp {label lama} dinonaktifkan (digantikan {label baru})"
* `UPDATE` (disconnect manual) — "Memutuskan nomor pengirim WhatsApp: {label} ({phoneNumber})"
* `DELETE` — "Menghapus nomor pengirim WhatsApp: {label} ({phoneNumber})"

Token (device token maupun `FONNTE_ACCOUNT_TOKEN`) **tidak boleh** dicatat di `description` audit log dalam bentuk apa pun (utuh maupun masked).

## 45.5 Security Tambahan

* `fonteToken` (device token) hanya boleh di-`select` di server (`whatsapp-service.ts`, service sender saat memanggil Fonnte). Query list untuk UI **tidak boleh** `select: { fonteToken: true }` — ambil `status`/`isActive`/`label`/`phoneNumber` saja.
* `FONNTE_ACCOUNT_TOKEN` hanya dibaca di server (server action/service), tidak pernah lewat props ke client component, tidak pakai prefix `NEXT_PUBLIC_`.
* Response server action (`createSenderAndGetQr`, dst.) **tidak pernah** mengembalikan `fonteToken` maupun `FONNTE_ACCOUNT_TOKEN` ke client — yang dikembalikan ke client untuk ditampilkan hanya QR **image** (base64 png dari Fonnte), bukan token.
* Endpoint polling status (dipanggil berulang dari client) hanya boleh mengembalikan `status`/`isActive`, tidak pernah token.
* Halaman/action ini tunduk pada semua larangan §19 yang masih berlaku (no `NEXT_PUBLIC_`, no log, no expose ke response API).

## 45.6 File yang Dibuat/Diubah (Lengkap — menggantikan §22 & §42)

| File                                                    | Perubahan                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                  | **BARU** — model `WhatsAppSender` + enum `WhatsAppSenderStatus` + relasi di `User` |
| `prisma/migrations/xxxx_add_whatsapp_sender/`           | **BARU** — migration                                                     |
| `lib/services/whatsapp-service.ts`                      | **BARU** — `notifyAttendance()`, ambil sender aktif dari DB              |
| `lib/services/fonnte-client.ts`                         | **BARU** — wrapper tipis panggilan Fonnte (`addDevice`, `getQr`, `getDeviceStatus`, `disconnectDevice`), dipakai oleh service sender maupun `whatsapp-service.ts` |
| `lib/services/pengaturan-service.ts`                    | Tambah fungsi: buat sender + generate QR, refresh status (+auto-aktivasi), disconnect, delete |
| `lib/validations/pengaturan.ts`                         | Tambah schema Zod untuk input sender (label, nomor — **tanpa field token**) |
| `lib/services/attendance-service.ts`                    | Memanggil `WhatsAppService` setelah check-in/check-out `SUCCESS`         |
| `app/(protected)/pengaturan/actions.ts`                 | Tambah server actions sender, di-guard `requireRole(["SUPERADMIN"])`     |
| `app/(protected)/pengaturan/page.tsx`                   | Tambah tab "Notifikasi WhatsApp", render khusus `actor.role==="SUPERADMIN"` |
| `components/pengaturan/whatsapp-sender-list.tsx`        | **BARU** — daftar sender + status + aksi                                 |
| `components/pengaturan/whatsapp-sender-qr-dialog.tsx`   | **BARU** — modal tambah nomor: input label/nomor → tampilkan QR → polling status |
| `.env.example`                                          | Tambah `FONNTE_ACCOUNT_TOKEN=` (tanpa nilai asli)                         |
| `.env`                                                  | Tambah `FONNTE_ACCOUNT_TOKEN` dengan nilai asli (tidak di-commit)         |

## 45.7 Testing Tambahan (melengkapi §37)

* Tambah sender baru → `status = PENDING_SCAN`, `isActive = false`, QR tampil, belum bisa kirim WhatsApp (belum ada sender `isActive` kalau ini sender pertama).
* Simulasikan device Fonnte jadi `connect` → polling mendeteksi → `status = CONNECTED` **dan** `isActive = true` otomatis, tanpa klik tambahan.
* Sebelumnya ada sender A aktif → tambah & scan sender B sampai connect → B otomatis aktif, A otomatis nonaktif dalam transaksi yang sama → cek di DB **tidak pernah** ada momen 2 sender `isActive = true` bersamaan.
* Tidak ada sender `status = CONNECTED` sama sekali (semua PENDING_SCAN/DISCONNECTED/kosong) → attendance tetap `SUCCESS`, WhatsApp skip.
* QR tidak discan (timeout) → sender tetap `PENDING_SCAN`, tidak otomatis terhapus, admin bisa generate ulang QR.
* Klik "Putuskan" pada sender yang sedang aktif → **diizinkan** (tidak diblokir seperti delete). Efeknya: `status → DISCONNECTED`, `isActive → false`, sistem sementara **tanpa sender aktif** → WhatsApp otomatis skip (attendance tetap `SUCCESS`, sesuai §7/§8) sampai admin scan/aktifkan sender lain. Ini disengaja lebih longgar daripada aturan hapus (§45.1), karena "putuskan" dipakai justru saat device bermasalah dan admin perlu segera menandainya, bukan operasi destruktif seperti hapus data.
* User role `ADMIN`/`GURU`/`WALI_KELAS` mengakses tab/aksi konfigurasi sender → ditolak (`/unauthorized`), baik lewat UI (tab tidak muncul) maupun lewat pemanggilan action langsung.
* Percobaan hapus sender yang sedang aktif → ditolak dengan pesan jelas, bukan error database mentah (ikuti §33 Error Handling).
* Response dari server action (create/QR/status/list) tidak mengandung `fonteToken` maupun `FONNTE_ACCOUNT_TOKEN` di payload manapun (cek network/response, bukan cuma tampilan UI).
* `FONNTE_ACCOUNT_TOKEN` tidak tersedia di environment → aksi "Tambah Nomor" gagal dengan pesan jelas ("Konfigurasi Fonnte belum lengkap, hubungi developer"), tidak crash, dan **tidak memengaruhi** attendance/WhatsApp yang sudah berjalan lewat sender aktif existing.

---

## Status

**DISEPAKATI**

**SIAP DIIMPLEMENTASIKAN** (termasuk §45 — adendum multi-sender)

**Source of Truth: `docs/whatsapp-blast.md`**