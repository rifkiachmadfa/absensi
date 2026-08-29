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