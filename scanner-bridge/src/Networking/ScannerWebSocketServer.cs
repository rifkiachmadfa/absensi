using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using ScannerBridge.Logging;
using ScannerBridge.RawInput;

namespace ScannerBridge.Networking;

/// <summary>
/// Implementasi Phase 9: server WebSocket LOKAL (loopback only) yang
/// menyiarkan setiap <see cref="ScanCompletedEventArgs"/> dari
/// <see cref="RawInputListener"/> ke tab browser yang sedang membuka
/// dialog Scan Absensi / Scan Pulang di PC yang sama.
///
/// KEPUTUSAN DESAIN PENTING:
///
/// 1. HANYA bind ke 127.0.0.1 (loopback), TIDAK PERNAH ke 0.0.0.0/"+"/"*".
///    Server ini tidak boleh bisa diakses dari perangkat lain di jaringan
///    sekolah -- hanya proses di PC yang sama (browser guru/petugas absen
///    yang duduk di depan PC yang sama dengan 4x EPPOS) yang boleh
///    menyambung. Ini BUKAN pengganti autentikasi Supabase: autentikasi
///    tetap 100% di browser (lihat Log.cs) -- server ini hanya mengantar
///    TEKS QR mentah, sama persis seperti kamera HP mengantar teks QR ke
///    handleDetected() di scan-dialog.tsx. Endpoint /api/absensi/scan yang
///    sebenarnya menyimpan absensi tetap mewajibkan sesi Supabase yang sah.
///
/// 2. Token pairing OPSIONAL (config "websocket.token"). Kalau diisi,
///    client WAJIB mengirim {"type":"auth","token":"..."} sebagai pesan
///    PERTAMA sebelum menerima siaran apa pun. Ini bukan menggantikan
///    autentikasi user -- tujuannya semata mencegah proses lokal LAIN di
///    PC yang sama (mis. malware) ikut menyambung ke port ini dan
///    menyuntikkan scan palsu. Kalau token dikosongkan, server tetap
///    berjalan (loopback-only sudah jadi lapisan pertahanan utama), tapi
///    ini dicatat sebagai peringatan di log.
///
/// 3. Kalau HttpListener gagal bind dengan "Access is denied" (error code
///    5), itu artinya Windows mewajibkan reservasi URL ACL untuk user
///    non-Administrator. Section AB proyek ini melarang menebak perilaku
///    Windows yang belum diverifikasi -- jadi di sini kita TIDAK mencoba
///    workaround otomatis (mis. auto-elevate), melainkan mencetak PERINTAH
///    PERSIS yang perlu dijalankan sekali oleh Administrator, supaya
///    operator sekolah tahu tindakan pasti yang harus diambil.
/// </summary>
public sealed class ScannerWebSocketServer : IDisposable
{
    private sealed record ScannerInfo(string Id, string Name);

    private readonly HttpListener _listener = new();
    private readonly string _prefix;
    private readonly string? _authToken;
    private readonly IReadOnlyList<ScannerInfo> _knownScanners;
    private readonly ConcurrentDictionary<Guid, WebSocket> _clients = new();
    private readonly CancellationTokenSource _cts = new();
    private Task? _acceptLoopTask;
    private Task? _pingLoopTask;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public ScannerWebSocketServer(Mapping.ScannerMapConfig config)
    {
        var host = string.IsNullOrWhiteSpace(config.WebSocket.Host) ? "127.0.0.1" : config.WebSocket.Host;

        if (host is not ("127.0.0.1" or "localhost"))
        {
            // Section AB & security hardening (Bagian 27 spesifikasi utama):
            // jangan pernah mengekspos data absensi mentah ke jaringan lebih
            // luas dari yang benar-benar dibutuhkan. Loopback saja sudah
            // cukup untuk skenario "4 scanner di 1 PC meja absensi", jadi
            // host non-loopback ditolak eksplisit alih-alih diam-diam
            // dipercaya.
            throw new InvalidOperationException(
                $"websocket.host di scanner-map.json harus \"127.0.0.1\" atau \"localhost\" (loopback saja), bukan \"{host}\". " +
                "Scanner-bridge sengaja tidak boleh menerima koneksi dari luar PC ini.");
        }

        _prefix = $"http://{host}:{config.WebSocket.Port}/";
        _listener.Prefixes.Add(_prefix);

        _authToken = string.IsNullOrWhiteSpace(config.WebSocket.Token) ? null : config.WebSocket.Token;
        _knownScanners = config.Scanners.Select(s => new ScannerInfo(s.Id, s.Name)).ToList();
    }

    public int ConnectedClientCount => _clients.Count;

    public void Start()
    {
        try
        {
            _listener.Start();
        }
        catch (HttpListenerException ex) when (ex.ErrorCode == 5)
        {
            Log.Error("Gagal bind WebSocket server: Access is denied.");
            Log.Error("Windows mewajibkan reservasi URL ACL untuk user non-Administrator pada prefix ini.");
            Log.Error("Jalankan PERINTAH INI SEKALI di Command Prompt (Run as Administrator), lalu jalankan scanner-bridge lagi sebagai user biasa:");
            Log.Error($"  netsh http add urlacl url={_prefix} user=Everyone");
            Log.Error("(Atau ganti \"Everyone\" dengan nama user Windows spesifik yang menjalankan scanner-bridge kalau ingin lebih ketat.)");
            throw;
        }

        if (_authToken is null)
        {
            Log.Warn("websocket.token TIDAK diisi di scanner-map.json -- proses lokal lain di PC ini bisa ikut menyambung ke WebSocket ini. Loopback-only sudah jadi lapisan pertahanan utama, tapi isi \"token\" kalau ingin lebih ketat.");
        }

        Log.Info($"WebSocket server aktif di {_prefix} (loopback only).");
        _acceptLoopTask = Task.Run(AcceptLoopAsync);
        _pingLoopTask = Task.Run(PingLoopAsync);
    }

    private async Task AcceptLoopAsync()
    {
        while (!_cts.IsCancellationRequested)
        {
            HttpListenerContext ctx;
            try
            {
                ctx = await _listener.GetContextAsync().ConfigureAwait(false);
            }
            catch (Exception) when (_cts.IsCancellationRequested)
            {
                return; // listener di-stop lewat Dispose() -- keluar bersih, bukan error
            }
            catch (Exception ex)
            {
                Log.Error($"Gagal menerima koneksi masuk: {ex.Message}");
                continue;
            }

            _ = HandleClientAsync(ctx); // fire-and-forget: satu client tidak boleh memblokir client lain
        }
    }

    private async Task HandleClientAsync(HttpListenerContext ctx)
    {
        if (!ctx.Request.IsWebSocketRequest)
        {
            ctx.Response.StatusCode = 400;
            ctx.Response.Close();
            return;
        }

        // Loopback ekstra-defensif: tolak kalau remote address BUKAN
        // loopback, walau prefix sudah 127.0.0.1 (jaga-jaga proxy/relay
        // lokal yang tidak terduga).
        if (!IPAddress.IsLoopback(ctx.Request.RemoteEndPoint.Address))
        {
            Log.Warn($"Koneksi WebSocket ditolak dari alamat non-loopback: {ctx.Request.RemoteEndPoint}");
            ctx.Response.StatusCode = 403;
            ctx.Response.Close();
            return;
        }

        WebSocket socket;
        try
        {
            var wsCtx = await ctx.AcceptWebSocketAsync(subProtocol: null).ConfigureAwait(false);
            socket = wsCtx.WebSocket;
        }
        catch (Exception ex)
        {
            Log.Error($"Gagal accept WebSocket handshake: {ex.Message}");
            return;
        }

        var clientId = Guid.NewGuid();
        var buffer = new byte[4096];

        try
        {
            if (_authToken is not null)
            {
                var authed = await TryAuthenticateAsync(socket, buffer).ConfigureAwait(false);
                if (!authed)
                {
                    await CloseQuietlyAsync(socket, WebSocketCloseStatus.PolicyViolation, "Token tidak valid").ConfigureAwait(false);
                    return;
                }
            }

            _clients[clientId] = socket;
            Log.Info($"Browser tersambung ke scanner-bridge ({_clients.Count} aktif).");

            await SendJsonAsync(socket, new
            {
                type = "hello",
                scanners = _knownScanners,
            }).ConfigureAwait(false);

            // Loop terima pesan dari client HANYA untuk mendeteksi
            // close/disconnect -- protokol saat ini tidak membutuhkan
            // perintah apa pun dari browser ke bridge (arah data satu jalur:
            // hardware scanner -> bridge -> browser, lihat komentar kelas).
            while (socket.State == WebSocketState.Open && !_cts.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, _cts.Token).ConfigureAwait(false);
                if (result.MessageType == WebSocketMessageType.Close) break;
            }
        }
        catch (OperationCanceledException)
        {
            // server sedang dimatikan -- bukan error
        }
        catch (WebSocketException)
        {
            // koneksi terputus paksa (tab ditutup, laptop sleep, dll) -- normal, tidak perlu di-log sebagai error
        }
        catch (Exception ex)
        {
            Log.Error($"Koneksi client WebSocket berakhir dengan error: {ex.Message}");
        }
        finally
        {
            _clients.TryRemove(clientId, out _);
            Log.Info($"Browser terputus dari scanner-bridge ({_clients.Count} aktif).");
            await CloseQuietlyAsync(socket, WebSocketCloseStatus.NormalClosure, "bye").ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Menunggu pesan auth pertama dari client dengan batas waktu singkat
    /// supaya client yang tidak mengirim apa pun tidak menggantung
    /// selamanya. Dibungkus try/catch penuh -- kegagalan parse dianggap
    /// auth gagal, bukan exception yang menjatuhkan server (Section AC:
    /// semua error harus recoverable).
    /// </summary>
    private async Task<bool> TryAuthenticateAsync(WebSocket socket, byte[] buffer)
    {
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(timeoutCts.Token, _cts.Token);

        try
        {
            var result = await socket.ReceiveAsync(buffer, linkedCts.Token).ConfigureAwait(false);
            if (result.MessageType != WebSocketMessageType.Text) return false;

            var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeProp) || typeProp.GetString() != "auth") return false;
            if (!root.TryGetProperty("token", out var tokenProp)) return false;

            return string.Equals(tokenProp.GetString(), _authToken, StringComparison.Ordinal);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Dipanggil dari RunServe() (Program.cs) setiap kali RawInputListener
    /// memancarkan ScanCompleted. Menyiarkan ke SEMUA client yang sedang
    /// tersambung (biasanya 1 tab browser, tapi tidak dibatasi -- berguna
    /// juga untuk development/testing dengan >1 tab).
    /// </summary>
    public Task BroadcastScanAsync(ScanCompletedEventArgs args)
    {
        return BroadcastJsonAsync(new
        {
            type = "scan",
            scannerId = args.ScannerId,
            scannerName = args.ScannerName,
            text = args.Text,
            timestampUtc = args.TimestampUtc.ToString("o"),
        });
    }

    /// <summary>
    /// Ping level-aplikasi (BUKAN WebSocket ping frame -- System.Net.WebSockets
    /// tidak mengekspos itu secara langsung) tiap 15 detik, supaya client
    /// browser bisa memastikan koneksi masih hidup dan reset status
    /// "terputus" kalau sempat salah deteksi.
    /// </summary>
    private async Task PingLoopAsync()
    {
        try
        {
            while (!_cts.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(15), _cts.Token).ConfigureAwait(false);
                if (_clients.IsEmpty) continue;
                await BroadcastJsonAsync(new { type = "ping" }).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException)
        {
            // server dimatikan -- normal
        }
    }

    private async Task BroadcastJsonAsync(object payload)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, JsonOptions));

        foreach (var (id, socket) in _clients)
        {
            if (socket.State != WebSocketState.Open)
            {
                _clients.TryRemove(id, out _);
                continue;
            }

            try
            {
                await socket.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, _cts.Token)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                // Satu client gagal kirim (mis. baru saja disconnect) tidak
                // boleh menggagalkan siaran ke client lain.
                Log.Debug($"Gagal kirim ke satu client WebSocket (kemungkinan baru disconnect): {ex.Message}");
                _clients.TryRemove(id, out _);
            }
        }
    }

    private static async Task SendJsonAsync(WebSocket socket, object payload)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, JsonOptions));
        await socket.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, CancellationToken.None)
            .ConfigureAwait(false);
    }

    private static async Task CloseQuietlyAsync(WebSocket socket, WebSocketCloseStatus status, string description)
    {
        try
        {
            if (socket.State == WebSocketState.Open || socket.State == WebSocketState.CloseReceived)
            {
                await socket.CloseAsync(status, description, CancellationToken.None).ConfigureAwait(false);
            }
        }
        catch
        {
            // socket sudah dalam kondisi tidak bisa ditutup dengan rapi -- aman diabaikan
        }
    }

    public void Dispose()
    {
        _cts.Cancel();

        try
        {
            _listener.Stop();
            _listener.Close();
        }
        catch
        {
            // sudah stopped/disposed -- aman diabaikan
        }

        foreach (var (_, socket) in _clients)
        {
            socket.Dispose();
        }
        _clients.Clear();

        _cts.Dispose();
    }
}