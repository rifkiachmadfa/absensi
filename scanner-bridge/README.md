# scanner-bridge

Local Scanner Service untuk integrasi 4x EPPOS EP5300BT ke aplikasi web absensi
(lihat `docs/scanner-integration/01-audit-dan-arsitektur.md` di root repo untuk
audit & desain arsitektur lengkap).

## Status implementasi (per akhir Phase 9)

| Bagian | Status |
|---|---|
| Project skeleton (.csproj, struktur folder) | ✅ Selesai |
| Hardware Discovery mode (`--discover`) | ✅ Selesai & **terverifikasi fisik** (lihat Adendum di `docs/scanner-integration/01-audit-dan-arsitektur.md`) |
| Device Mapping (`--assign`, baca/tulis `config/scanner-map.json`) | ✅ Selesai — implementasi ada, **belum diuji dengan 4 unit sekaligus** (baru 2 unit tersedia saat ditulis) |
| Raw Input listener + buffer per-device (parser scan, `--listen`) | ✅ Selesai — deteksi selesai-scan berbasis jeda waktu (EP5300BT tidak mengirim terminator), dedupe self-repeat hardware |
| WebSocket server loopback (`--serve`) | ✅ Selesai kode — **belum pernah dijalankan/dites di Windows sungguhan**, lihat batasan di bawah |
| Reconnect/offline detection sisi browser | ⏳ Belum — bagian dari Phase 10 di repo `absensi` |
| Integrasi Next.js (`scannerServiceClient.ts`, `useScannerBridge`) | ⏳ Dikerjakan di repo `absensi`, bukan di sini |

> ⚠️ Sama seperti Phase 5-8, kode Phase 9 di bawah ditulis di sandbox Linux
> tanpa .NET SDK dan tanpa akses Windows. **Belum pernah di-`dotnet build`,
> apalagi diuji koneksi WebSocket sungguhan dari browser.** Jangan anggap
> `--serve` sudah pasti berjalan mulus sebelum diverifikasi fisik (termasuk
> apakah `netsh http add urlacl` benar-benar diperlukan di PC target —
> lihat penjelasan di bagian "Menjalankan mode Serve" di bawah).

## ✅ Sudah terverifikasi fisik (29 Agustus 2026)

- EP5300BT = **Bluetooth Classic HID** (bukan USB keyboard-wedge, bukan dongle 2.4G). **Kabel USB hanya untuk charging.**
- VID/PID sama di semua unit (`0001045E`/`0040`) — tidak bisa jadi identity.
- **Device Path lengkap** BISA membedakan unit yang berbeda (diuji dengan 2 unit sekaligus), dan **stabil** setelah power-off/power-on (tanpa unpair).
- Detail lengkap & yang masih terbuka (unit 3-4, restart Windows) ada di dokumen audit utama.

## Cara pairing & mapping (Phase 6)

1. **Pairing Bluetooth** — pasangkan tiap EPPOS lewat Windows Settings > Bluetooth & devices > Add device, SATU PER SATU (supaya gampang mencocokkan device baru mana yang muncul di `--discover` dengan unit fisik mana). Setelah terpasang, scanner siap dipakai sebagai keyboard biasa (test cepat: scan ke Notepad, harus muncul teks).

2. **Jangan sambungkan kabel USB berharap itu jalur data** — itu cuma charging untuk EP5300BT ini.

3. Jalankan:
   ```powershell
   dotnet run -- --discover
   ```
   Cari device baru bertipe `Keyboard` yang barusan muncul (device lain yang sudah ada sebelumnya, seperti `MSFT0001...` atau `ACPI#PTL0001...`, itu bukan scanner — biasanya touchpad/keyboard bawaan PC, abaikan).

4. Assign device itu ke scanner ID:
   ```powershell
   dotnet run -- --assign <nomor Device # dari langkah 3> scanner-1 "Scanner Meja 1"
   ```
   Ini akan membuat/memperbarui `config/scanner-map.json` secara otomatis.

5. Ulangi langkah 1-4 untuk EPPOS ke-2, ke-3, ke-4 (`scanner-2`, `scanner-3`, `scanner-4`).

6. Jalankan `--discover` sekali lagi — keempat EPPOS harus menunjukkan `Status: Assigned -> scanner-N (...)`.

⚠️ **Penting**: nomor `Device #` di output `--discover` bisa berubah urutannya kalau ada device yang dicabut/dipasang di antara dua run. Selalu jalankan `--discover` TEPAT SEBELUM `--assign` untuk memastikan nomornya masih sesuai.

⚠️ **Jangan unpair scanner dari Windows Bluetooth setelah di-assign** — kemungkinan besar itu akan mengubah Device Path-nya (belum diuji, tapi ini risiko yang wajar untuk mekanisme Bluetooth pairing Windows), yang berarti mapping lama tidak cocok lagi dan harus di-assign ulang.


## ⚠️ Batasan penting: kode ini belum pernah di-build atau dijalankan

Kode di repo ini ditulis di lingkungan sandbox **Linux (Ubuntu), tanpa Windows,
tanpa .NET SDK terpasang, dan tanpa akses jaringan ke NuGet**. Artinya:

- Signature P/Invoke di `src/RawInput/NativeMethods.cs` ditulis mengikuti
  dokumentasi resmi Win32 (Microsoft Learn), **tapi belum pernah dikompilasi**
  di lingkungan ini untuk memverifikasi tidak ada typo/kesalahan marshalling.
- Belum ada `dotnet build`, `dotnet run`, lint, atau test yang dijalankan
  terhadap kode ini di sini.

**Sebelum dipakai untuk apa pun**, jalankan di PC Windows target:

```powershell
cd scanner-bridge
dotnet restore
dotnet build
```

Kalau ada error compile, itu perlu diperbaiki dulu di situ (biasanya typo
struct layout/offset atau nama P/Invoke) sebelum lanjut ke langkah
berikutnya. Laporkan error-nya supaya bisa diperbaiki di source.

## Menjalankan mode Discovery

```powershell
dotnet run -- --discover
```

Mode ini HANYA membaca & menampilkan device yang terpasang -- tidak menyimpan
apa pun, tidak melakukan mapping otomatis, tidak menyentuh aplikasi web.
Amanuntuk dijalankan kapan saja untuk melihat device apa saja yang terdeteksi
Windows sebagai Raw Input HID.

Output berisi per device: Tipe (Keyboard/Mouse/HID lain), VID, PID, Device Path.

## Langkah Verifikasi Fisik (WAJIB sebelum Phase 6 dilanjutkan)

Ini menjawab pertanyaan terbuka dari Phase 2 (lihat
`docs/scanner-integration/01-audit-dan-arsitektur.md`). Jalankan `--discover`
di setiap langkah dan catat hasilnya:

1. **Baseline** — jalankan `--discover` TANPA scanner terpasang sama sekali.
   Catat device keyboard/HID apa saja yang sudah ada (keyboard PC bawaan,
   dll) — ini "noise" yang nanti harus diabaikan scanner-bridge saat mode
   service (karena bukan scanner, lihat catatan Test 14 di audit).

2. **1 unit, port A** — pasang 1 EP5300BT (mode kabel USB langsung dulu) ke
   satu port USB tertentu. Jalankan `--discover` lagi. Cari device baru yang
   muncul — catat VID/PID/Device Path-nya.
   - **Pertanyaan kunci**: apakah tipe device-nya `Keyboard (RIM_TYPEKEYBOARD)`
     (mendukung dugaan Phase 2: HID keyboard-wedge), atau `HID lain
     (RIM_TYPEHID)` (kemungkinan HID POS — kabar baik, lebih reliable)?

3. **Cabut, pasang lagi ke port SAMA** — jalankan `--discover`. Apakah
   Device Path-nya PERSIS SAMA dengan langkah 2?
   - Kalau YA → identity stabil di port yang sama.
   - Kalau TIDAK → sudah ada indikasi awal Device Path tidak sepenuhnya stabil.

4. **Cabut, pasang ke port USB BERBEDA** — jalankan `--discover`. Apakah
   Device Path-nya masih sama dengan langkah 2, atau berubah?
   - Ini menjawab pertanyaan inti Section F: apakah identity terikat ke
     device fisik (bagus) atau ke lokasi port USB (perlu strategi tambahan:
     scanner tidak boleh dipindah-pindah port setelah mapping selesai).

5. **Pasang 4 unit sekaligus** (port A, B, C, D yang sudah ditentukan tetap).
   Jalankan `--discover`. Apakah muncul **4 entry berbeda** dengan Device
   Path yang **berbeda satu sama lain**?
   - Kalau YA untuk keempatnya → identity per-device berhasil dibedakan,
     lanjut ke Phase 6 dengan strategi "Device Path sebagai identity utama".
   - Kalau ADA yang identik/duplikat → chipset HID tidak menyertakan serial
     number unik; perlu strategi cadangan (mapping berbasis port tetap,
     lihat Bagian 4.2 di dokumen arsitektur) sebelum Phase 6 dilanjutkan.

6. **Ulangi langkah 2-5 untuk mode Bluetooth** (lewat dongle USB receiver-nya),
   kalau sekolah berencana memakai mode itu untuk sebagian/semua unit.

7. **Catat karakter terminator** — scan satu QR kartu siswa sungguhan ke
   Notepad (bukan ke aplikasi absensi) sambil scanner tersambung sebagai
   keyboard biasa. Amati apakah setelah teks QR muncul, kursor otomatis
   pindah baris baru (berarti scanner mengirim Enter/CR sebagai terminator
   — asumsi paling umum) atau tidak ada karakter tambahan sama sekali.

Kirimkan/catat hasil ketujuh langkah ini sebelum Phase 6 (Device Mapping) dan
Phase 7-8 (input parser) dikerjakan — supaya keputusan strategi mapping &
deteksi akhir-scan berdasarkan **fakta**, bukan tebakan.

## Menjalankan mode Serve (Phase 9 — mode harian)

```powershell
dotnet run -- --serve
```

Mode ini menggabungkan `--listen` (Raw Input + parser per-device) dengan
server WebSocket lokal yang menyiarkan setiap hasil scan ke browser. Ini
mode yang dipakai sehari-hari di PC meja absensi (bukan `--listen`, yang
tetap dipertahankan khusus untuk debugging tanpa melibatkan WebSocket sama
sekali).

Server WebSocket **hanya bind ke `127.0.0.1`** (dari `websocket.host` di
config) — tidak bisa diakses dari perangkat lain di jaringan sekolah, hanya
dari browser yang berjalan di PC yang sama. Ini konsisten dengan Bagian 27
spesifikasi utama proyek (jangan mengekspos lebih dari yang dibutuhkan) dan
dengan catatan di `Log.cs`: autentikasi user tetap 100% di browser lewat
Supabase Auth — bridge ini tidak pernah memegang session/credential apa
pun, cuma mengantar teks QR mentah ke tab yang sedang terbuka, persis
seperti peran kamera HP di `qr-scanner.tsx`.

### Kalau muncul error "Access is denied" saat start

Windows kadang mewajibkan reservasi URL ACL untuk proses non-Administrator
yang mem-bind `HttpListener`, walau ke loopback sekalipun. **Ini belum
diverifikasi apakah benar-benar terjadi di konfigurasi Windows target** —
kalau terjadi, `--serve` akan mencetak perintah PERSIS yang perlu
dijalankan, bentuknya:

```powershell
netsh http add urlacl url=http://127.0.0.1:8765/ user=Everyone
```

Jalankan itu SEKALI di Command Prompt **as Administrator**, lalu jalankan
`scanner-bridge.exe --serve` lagi sebagai user biasa. Kalau ternyata tidak
pernah muncul error ini di PC target, berarti tidak perlu langkah ini sama
sekali — catat hasilnya (perlu/tidak) supaya dokumentasi ini bisa
diperbarui berdasarkan fakta, bukan asumsi (Section AB).

### Protokol WebSocket

Pesan **server → browser**, semua JSON teks (`WebSocketMessageType.Text`):

```jsonc
// Sekali, tepat setelah koneksi diterima (dan lolos auth token kalau
// websocket.token diisi)
{ "type": "hello", "scanners": [{ "id": "scanner-1", "name": "Scanner Meja 1" }, ...] }

// Setiap kali satu scan selesai dibaca dari salah satu EPPOS
{
  "type": "scan",
  "scannerId": "scanner-1",
  "scannerName": "Scanner Meja 1",
  "text": "STD-8F72A91C",
  "timestampUtc": "2026-08-29T06:52:17.1234567Z"
}

// Tiap 15 detik selagi ada client tersambung — keepalive level-aplikasi
{ "type": "ping" }
```

Pesan **browser → server** (hanya dibutuhkan kalau `websocket.token` diisi
di config):

```jsonc
// WAJIB jadi pesan PERTAMA kalau token diaktifkan, dalam 5 detik sejak
// connect — kalau tidak ada / salah, server menutup koneksi
{ "type": "auth", "token": "..." }
```

Kalau `websocket.token` kosong (default), browser tidak perlu mengirim apa
pun — cukup dengarkan pesan `"scan"` yang masuk.

`text` pada pesan `"scan"` adalah **QR token mentah apa adanya** hasil baca
hardware (mis. `STD-8F72A91C`) — bridge ini TIDAK memvalidasi apakah token
itu valid/terdaftar/siswa aktif. Validasi, cek duplikat, penentuan status
HADIR/TERLAMBAT, dan penyimpanan tetap 100% tanggung jawab
`AttendanceService.checkIn()`/`checkOut()` di server Next.js lewat endpoint
yang SAMA PERSIS dipakai kamera HP (`/api/absensi/scan`,
`/api/absensi/scan-pulang`) — scanner-bridge tidak menduplikasi logic
absensi apa pun, sesuai instruksi eksplisit di spesifikasi utama proyek
("jangan merubah aturan attendance").

---

## Struktur project

```
scanner-bridge/
  ScannerBridge.csproj
  src/
    Program.cs                    -- entry point: --discover, --assign, --listen, --serve
    RawInput/
      NativeMethods.cs            -- P/Invoke Win32 Raw Input API
      RawDeviceInfo.cs            -- parsing VID/PID dari device path
      RawInputWindow.cs           -- message-only window penerima WM_INPUT
      RawInputListener.cs         -- Phase 7-8: buffer per-device, deteksi selesai-scan, dedupe self-repeat
    Mapping/
      ScannerMapConfig.cs         -- baca/tulis scanner-map.json (termasuk config websocket)
      ScannerMappingService.cs    -- cocokkan device terdeteksi vs config
    Networking/
      ScannerWebSocketServer.cs   -- Phase 9: WebSocket server loopback-only, siaran event scan
    Discovery/
      DiscoveryService.cs         -- enumerasi semua HID device terpasang
    Logging/
      Log.cs                      -- logger [INFO]/[DEBUG]/[WARN]/[ERROR]
  config/
    scanner-map.example.json      -- schema (device mapping + config websocket)
```

## Kenapa Phase 9 baru dikerjakan sekarang (bukan lebih awal)?

Sesuai instruksi project (Section AB): *"Jika menemukan asumsi hardware yang
belum dapat dipastikan: JANGAN mengarang. Buat discovery utility/test
terlebih dahulu."* — Phase 6-8 (mapping, listener, parser) sengaja
diselesaikan dan diverifikasi lebih dulu lewat `--discover`/`--listen`
SEBELUM WebSocket server ditambahkan, supaya kalau ada bug di parser
(salah baca karakter, salah deteksi selesai-scan, dst.) tidak bercampur
dengan debugging koneksi WebSocket sekaligus. Sekarang `--listen` sudah
dianggap menangkap isi QR dengan benar, Phase 9 (`--serve`, kelas
`ScannerWebSocketServer`) tinggal menyalurkan event `ScanCompleted` yang
sama ke browser — tidak ada logic parsing baru di lapisan ini.

Sisa pekerjaan (Phase 10: `scannerServiceClient.ts` + hook React di sisi
Next.js) dikerjakan di repo `absensi`, bukan di repo `scanner-bridge` ini.