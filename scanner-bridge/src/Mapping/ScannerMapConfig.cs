using System.Text.Json;
using System.Text.Json.Serialization;

namespace ScannerBridge.Mapping;

public sealed class ScannerEntry
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("devicePath")]
    public string DevicePath { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    /// <summary>
    /// OPSIONAL, override PER SCANNER dari
    /// <see cref="ScannerMapConfig.DefaultCompletionTimeoutMs"/>. Diperlukan
    /// karena unit yang lebih jauh dari PC (Bluetooth Classic HID, bukan
    /// USB) punya jeda antar-keystroke yang lebih besar -- kalau default
    /// global (80ms) dipakai untuk unit itu, satu barcode bisa terpecah
    /// jadi beberapa event scan begitu jeda transmisi Bluetooth-nya
    /// melebihi 80ms di tengah pengiriman (lihat catatan di
    /// RawInputListener.CompletionTimeoutForScanner). Null berarti pakai
    /// default global -- isi field ini HANYA untuk scanner yang memang
    /// bermasalah, bukan menaikkan semuanya sekaligus.
    /// </summary>
    [JsonPropertyName("completionTimeoutMs")]
    public int? CompletionTimeoutMs { get; set; }

    /// <summary>
    /// OPSIONAL, override PER SCANNER dari
    /// <see cref="ScannerMapConfig.DefaultExpectedTokenLength"/>. Kalau
    /// diisi, buffer scanner ini di-flush SEGERA saat mencapai panjang ini
    /// -- tidak menunggu idle-timeout sama sekali. Ini mencegah dua scan
    /// cepat berurutan di scanner FISIK YANG SAMA (jam padat) tersambung
    /// jadi satu string gabungan, karena buffer sudah kosong lagi begitu
    /// token pertama genap sepanjang ini. Null berarti pakai default
    /// global; kalau keduanya null, scanner ini murni pakai idle-timeout
    /// seperti sebelumnya.
    /// </summary>
    [JsonPropertyName("expectedTokenLength")]
    public int? ExpectedTokenLength { get; set; }
}

public sealed class WebSocketConfig
{
    [JsonPropertyName("host")]
    public string Host { get; set; } = "127.0.0.1";

    [JsonPropertyName("port")]
    public int Port { get; set; } = 8765;

    /// <summary>
    /// Token pairing OPSIONAL (Phase 9). Kalau diisi, browser (lewat
    /// scannerServiceClient.ts) wajib mengirim token yang sama sebagai
    /// pesan pertama sebelum menerima siaran scan apa pun. Ini BUKAN
    /// credential Supabase/session -- murni token lokal untuk memastikan
    /// hanya tab yang memang dikonfigurasi admin sekolah yang bisa
    /// menyambung ke port loopback ini. Kosongkan ("") untuk menonaktifkan
    /// (server tetap loopback-only sebagai lapisan pertahanan utama).
    /// </summary>
    [JsonPropertyName("token")]
    public string Token { get; set; } = "";
}

public sealed class ScannerMapConfig
{
    [JsonPropertyName("websocket")]
    public WebSocketConfig WebSocket { get; set; } = new();

    [JsonPropertyName("scanners")]
    public List<ScannerEntry> Scanners { get; set; } = [];

    /// <summary>
    /// Jeda diam (ms) default yang dianggap "satu scan selesai" untuk
    /// scanner yang TIDAK mengisi "completionTimeoutMs" sendiri di
    /// entry-nya. 80ms cocok untuk unit yang dekat/berkabel; unit
    /// Bluetooth yang jauh dari PC butuh nilai lebih tinggi (mulai dari
    /// 200-300ms, naikkan bertahap sambil uji dengan --listen kalau masih
    /// terpecah) -- lihat README bagian Troubleshooting.
    /// </summary>
    [JsonPropertyName("defaultCompletionTimeoutMs")]
    public int DefaultCompletionTimeoutMs { get; set; } = 80;

    /// <summary>
    /// Panjang token QR yang diharapkan (karakter), dipakai untuk flush
    /// SEGERA (bukan lewat idle-timeout) begitu buffer scanner mencapai
    /// panjang ini. Format qrToken proyek absensi saat ini SELALU
    /// `STD-XXXXXXXXXXXX` (16 karakter -- lihat generateQrToken() di
    /// lib/services/siswa-service.ts repo absensi), jadi 16 adalah nilai
    /// yang benar untuk deployment saat ini. Null (default) menonaktifkan
    /// fitur ini -- sengaja tidak di-hardcode 16 di kode C# supaya kalau
    /// format token proyek Next.js berubah di masa depan, cukup ubah angka
    /// di config ini (atau kosongkan untuk kembali ke idle-timeout murni),
    /// tanpa perlu build ulang scanner-bridge.
    /// </summary>
    [JsonPropertyName("defaultExpectedTokenLength")]
    public int? DefaultExpectedTokenLength { get; set; }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
    };

    /// <summary>
    /// Resolusi path config: dicari relatif ke folder tempat .exe berjalan
    /// (AppContext.BaseDirectory) supaya tetap benar walau dijalankan dari
    /// Windows Startup / Scheduled Task dengan working directory berbeda.
    /// Fallback ke folder kerja saat ini kalau tidak ditemukan di sana
    /// (memudahkan development lewat `dotnet run`).
    /// </summary>
    public static string ResolveConfigPath()
    {
        var besideExe = Path.Combine(AppContext.BaseDirectory, "config", "scanner-map.json");
        if (File.Exists(besideExe)) return besideExe;

        var inWorkingDir = Path.Combine(Directory.GetCurrentDirectory(), "config", "scanner-map.json");
        return inWorkingDir;
    }

    public static ScannerMapConfig LoadOrDefault(string path)
    {
        if (!File.Exists(path))
        {
            return new ScannerMapConfig();
        }

        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<ScannerMapConfig>(json, JsonOptions)
               ?? new ScannerMapConfig();
    }

    public void Save(string path)
    {
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        var json = JsonSerializer.Serialize(this, JsonOptions);
        File.WriteAllText(path, json);
    }
}