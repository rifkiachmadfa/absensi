# Fitur: Notifikasi WhatsApp Orang Tua (Blast Masuk/Pulang)

> Dokumen ini adalah **source of truth** untuk implementasi fitur notifikasi WhatsApp ke orang tua/wali murid.
>
> Dokumen dibuat sebelum kode ditulis agar keputusan arsitektur, scope, behavior, dan batasan implementasi tidak berubah atau hilang antar sesi development.
>
> **Status: DISEPAKATI — SIAP DIIMPLEMENTASIKAN**

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

Hanya file berikut yang direncanakan untuk perubahan.

| File                                 | Perubahan                                                    |
| ------------------------------------ | ------------------------------------------------------------ |
| `lib/services/whatsapp-service.ts`   | **BARU** — implementasi `WhatsAppService.notifyAttendance()` |
| `lib/services/attendance-service.ts` | Memanggil WhatsAppService setelah check-in/check-out SUCCESS |
| `.env.example`                       | Menambahkan `FONNTE_TOKEN`                                   |

Tidak ada perubahan schema Prisma.

Tidak ada migration baru.

Tidak ada tabel baru.

---

# 23. Prisma Schema

Kolom:

```text
student.whatsappNumber
```

sudah tersedia.

**Jangan membuat migration baru untuk fitur ini.**

Jangan menambahkan:

```text
whatsapp_logs
```

atau:

```text
whatsapp_messages
```

untuk versi ini.

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

* [ ] `FONNTE_TOKEN` digunakan dari server environment.
* [ ] `FONNTE_TOKEN` tidak menggunakan `NEXT_PUBLIC_`.
* [ ] Token tidak masuk source code.
* [ ] Token tidak masuk Git.
* [ ] Token tidak muncul di log.
* [ ] Jika token tidak tersedia, WhatsApp di-skip dan attendance tetap berjalan.

## Database

* [ ] Attendance disimpan terlebih dahulu.
* [ ] Prisma transaction selesai commit sebelum request Fonnte.
* [ ] Tidak ada request Fonnte di dalam `$transaction()`.
* [ ] Tidak ada migration baru.
* [ ] Tidak ada schema Prisma baru.
* [ ] Tidak ada tabel WhatsApp baru.

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

5. Buat `lib/services/whatsapp-service.ts`.
6. Modifikasi `attendance-service.ts` seminimal mungkin.
7. Tambahkan `FONNTE_TOKEN` ke `.env.example`.
8. Jangan mengubah schema Prisma.
9. Jangan membuat migration.
10. Jangan membuat queue.
11. Jangan membuat retry.
12. Jangan membuat tabel log.
13. Jangan membuat UI pengaturan WhatsApp.
14. Jangan mengubah behavior existing attendance.
15. Jangan mengekspos Fonnte token ke client.
16. Gunakan `STATUS_LABEL` existing.
17. Gunakan timezone `Asia/Jakarta`.
18. Pastikan WhatsApp failure tidak menggagalkan attendance.

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
* menggunakan `NEXT_PUBLIC_FONNTE_TOKEN`;
* hardcode token;
* mengirim token ke browser;
* memasukkan token ke log;
* membuat migration;
* membuat tabel WhatsApp;
* membuat queue;
* membuat Redis dependency;
* membuat retry otomatis;
* mengirim pesan menggunakan `Promise.all()` secara massal;
* mengirim WhatsApp dari React component;
* mengirim WhatsApp untuk `setManualStatus()`;
* mengirim WhatsApp untuk status SAKIT/IZIN/DISPENSASI/ALPHA;
* mengubah business logic attendance yang sudah ada;
* menambahkan provider WhatsApp kedua;
* membuat UI pengaturan template;
* membuat sistem delivery tracking;
* membuat multiple recipient;
* membuat scheduled blast;
* melakukan refactor besar yang tidak diperlukan untuk fitur ini.

---

# 42. Expected File Structure

Setelah implementasi, struktur minimal yang diharapkan:

```text
lib/
├── constants/
│   └── attendance.ts
│
└── services/
    ├── attendance-service.ts
    └── whatsapp-service.ts
```

Tidak diperlukan struktur tambahan untuk versi pertama.

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

## Status

**DISEPAKATI**

**SIAP DIIMPLEMENTASIKAN**

**Source of Truth: `docs/whatsapp-blast.md`**
