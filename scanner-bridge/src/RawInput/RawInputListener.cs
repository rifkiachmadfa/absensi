using System.Runtime.InteropServices;
using System.Text;
using ScannerBridge.Logging;
using ScannerBridge.Mapping;

namespace ScannerBridge.RawInput;

public sealed record ScanCompletedEventArgs(string ScannerId, string ScannerName, string Text, DateTime TimestampUtc);

/// <summary>
/// Implementasi Phase 7-8: mendengarkan WM_INPUT, memisahkan keystroke
/// PER DEVICE FISIK (bukan digabung global -- ini yang mencegah larangan
/// eksplisit Section H: "ABXCYZ123789"), dan mendeteksi kapan satu scan
/// selesai.
///
/// PENTING -- perubahan desain dari asumsi awal: hasil uji fisik
/// (Notepad test, 29 Agustus 2026) mengonfirmasi EP5300BT TIDAK mengirim
/// karakter terminator apa pun (bukan Enter, bukan Tab) di akhir scan.
/// Karena itu deteksi "scan selesai" TIDAK bisa berbasis karakter
/// terminator (asumsi umum yang awalnya dipertimbangkan di Phase 2/3),
/// dan sebagai gantinya dipakai deteksi JEDA WAKTU antar-keystroke:
/// scanner mengirim seluruh isi barcode dalam hitungan milidetik (jauh
/// lebih cepat dari manusia mengetik), jadi begitu ada jeda diam
/// >= CompletionTimeoutMs sejak keystroke terakhir pada device tsb,
/// buffer dianggap selesai dan satu event scan dipancarkan. Ini teknik
/// standar untuk skenario scanner tanpa suffix (dipakai juga oleh
/// library populer seperti onScan.js), bukan pendekatan yang belum
/// pernah diuji di dunia nyata.
///
/// Filtering: hanya device yang device path-nya ADA di scanner-map.json
/// yang diproses. Device lain (keyboard/touchpad bawaan PC) diabaikan
/// total -- tidak pernah di-buffer, tidak pernah memicu event apa pun.
/// Raw Input berjalan PARALEL dengan jalur keyboard normal Windows (kita
/// tidak memakai RIDEV_NOLEGACY), jadi keyboard fisik PC tetap berfungsi
/// normal untuk aplikasi lain (Test 14 di spesifikasi) tanpa perlakuan
/// khusus apa pun dari kode ini.
/// </summary>
public sealed class RawInputListener : IDisposable
{
    private sealed class DeviceBuffer
    {
        public readonly object SyncRoot = new();
        public readonly StringBuilder Text = new();
        public DateTime LastKeystrokeUtc;
        public bool ShiftDown;
    }

    private readonly RawInputWindow _window;
    private readonly ScannerMapConfig _config;
    private readonly System.Collections.Concurrent.ConcurrentDictionary<IntPtr, DeviceBuffer> _buffers = new();
    private readonly System.Collections.Concurrent.ConcurrentDictionary<IntPtr, ScannerEntry?> _deviceIdentityCache = new();
    private readonly System.Threading.Timer _completionTimer;

    /// <summary>
    /// PERBAIKAN (8 Sept 2026): jeda diam yang dianggap "scan selesai" TIDAK
    /// lagi satu angka global tetap. 80ms cocok waktu semua unit dekat/
    /// berkabel, tapi begitu salah satu EPPOS dipindah lebih jauh dari PC
    /// (Bluetooth Classic HID), latensi transmisi antar-karakter unit itu
    /// bisa melebihi 80ms DI TENGAH satu barcode -- akibatnya buffer
    /// dianggap selesai sebelum barcode-nya habis terkirim, lalu sisa
    /// karakter yang datang belakangan mulai buffer baru. Satu QR yang
    /// valid pun terpecah jadi 2-3+ token pendek yang tidak dikenali
    /// server. Timeout sekarang diresolusi PER DEVICE lewat
    /// <see cref="CompletionTimeoutForScanner"/>: scanner yang tidak
    /// mengisi "completionTimeoutMs" di scanner-map.json tetap memakai
    /// default 80ms (atau "defaultCompletionTimeoutMs" kalau diisi), jadi
    /// unit yang selama ini baik-baik saja tidak terpengaruh -- hanya unit
    /// yang jauh yang perlu dinaikkan.
    /// </summary>
    private int CompletionTimeoutForScanner(ScannerEntry identity)
        => identity.CompletionTimeoutMs ?? _config.DefaultCompletionTimeoutMs;

    public event Action<ScanCompletedEventArgs>? ScanCompleted;

    /// <summary>
    /// Dipanggil untuk keystroke dari device yang TIDAK ada di
    /// scanner-map.json -- berguna untuk debugging ("kenapa scan saya
    /// tidak terbaca, apa device-nya belum ter-assign?"), tidak memicu
    /// business logic apa pun.
    /// </summary>
    public event Action<IntPtr>? UnmappedDeviceKeystroke;

    public RawInputListener(ScannerMapConfig config)
    {
        _config = config;
        _window = new RawInputWindow();
        _window.RawInputReceived += OnRawInput;

        var device = new NativeMethods.RAWINPUTDEVICE
        {
            usUsagePage = NativeMethods.HID_USAGE_PAGE_GENERIC,
            usUsage = NativeMethods.HID_USAGE_GENERIC_KEYBOARD,
            dwFlags = NativeMethods.RIDEV_INPUTSINK,
            hwndTarget = _window.Handle,
        };

        var registered = NativeMethods.RegisterRawInputDevices(
            [device], 1, (uint)Marshal.SizeOf<NativeMethods.RAWINPUTDEVICE>());

        if (!registered)
        {
            throw new InvalidOperationException(
                "RegisterRawInputDevices gagal -- cek apakah dijalankan di Windows dan window handle valid.");
        }

        // Poll semua buffer tiap 20ms, finalize yang sudah lewat batas
        // jeda diam. Pendekatan polling dipilih (bukan Timer per-device)
        // supaya sederhana dikelola untuk 4 device sekaligus.
        _completionTimer = new System.Threading.Timer(CheckCompletions, null, 20, 20);
    }

    private void OnRawInput(IntPtr hRawInput)
    {
        uint size = 0;
        NativeMethods.GetRawInputData(hRawInput, NativeMethods.RID_INPUT, IntPtr.Zero, ref size, (uint)Marshal.SizeOf<NativeMethods.RAWINPUTHEADER>());
        if (size == 0) return;

        var buffer = Marshal.AllocHGlobal((int)size);
        try
        {
            var written = NativeMethods.GetRawInputData(
                hRawInput, NativeMethods.RID_INPUT, buffer, ref size,
                (uint)Marshal.SizeOf<NativeMethods.RAWINPUTHEADER>());
            if (written != size) return;

            var raw = Marshal.PtrToStructure<NativeMethods.RAWINPUT>(buffer);
            if (raw.header.dwType != NativeMethods.RIM_TYPEKEYBOARD) return;

            HandleKeyboardInput(raw.header.hDevice, raw.keyboard);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private void HandleKeyboardInput(IntPtr hDevice, NativeMethods.RAWKEYBOARD kb)
    {
        var identity = ResolveIdentity(hDevice);
        if (identity is null)
        {
            UnmappedDeviceKeystroke?.Invoke(hDevice);
            return; // bukan scanner yang di-assign -- diabaikan total
        }

        var isKeyUp = kb.Message == NativeMethods.WM_KEYUP || kb.Message == NativeMethods.WM_SYSKEYUP;

        // Lacak state Shift PER DEVICE (bukan global) -- penting supaya
        // scan bersamaan dari device lain tidak saling mempengaruhi.
        if (kb.VKey is NativeMethods.VK_SHIFT or NativeMethods.VK_LSHIFT or NativeMethods.VK_RSHIFT)
        {
            var buf = GetOrCreateBuffer(hDevice);
            lock (buf.SyncRoot)
            {
                buf.ShiftDown = !isKeyUp;
            }
            return;
        }

        if (isKeyUp) return; // hanya proses key-down untuk karakter

        var deviceBuffer = GetOrCreateBuffer(hDevice);
        bool shiftDown;
        lock (deviceBuffer.SyncRoot)
        {
            shiftDown = deviceBuffer.ShiftDown;
        }

        var ch = TranslateToChar(kb.VKey, kb.MakeCode, shiftDown);
        if (ch is null) return; // tombol non-printable (mis. fungsi/kontrol lain)

        lock (deviceBuffer.SyncRoot)
        {
            deviceBuffer.Text.Append(ch.Value);
            deviceBuffer.LastKeystrokeUtc = DateTime.UtcNow;
        }

        TryFlushOnExpectedLength(deviceBuffer, identity);
    }

    /// <summary>
    /// PERBAIKAN (8 Sept 2026, lanjutan): idle-timeout (CheckCompletions)
    /// sendirian tidak cukup untuk kasus dua siswa berbeda di-scan CEPAT
    /// berurutan lewat scanner FISIK YANG SAMA (mis. jam padat) -- kalau
    /// jeda antara karakter terakhir siswa A dan karakter pertama siswa B
    /// lebih pendek dari completionTimeoutMs (yang untuk scanner jauh
    /// sudah dinaikkan supaya tidak kepotong di tengah), karakter B akan
    /// menyambung ke buffer sisa A alih-alih memulai buffer baru --
    /// menghasilkan satu string gabungan yang tidak cocok siswa mana pun.
    ///
    /// Karena SEMUA qrToken sistem ini punya format tetap
    /// `STD-XXXXXXXXXXXX` (lihat generateQrToken() di siswa-service.ts,
    /// repo absensi) -- selalu PERSIS 16 karakter -- buffer di-flush
    /// SEGERA begitu mencapai panjang itu, tanpa menunggu jeda diam sama
    /// sekali. Ini menutup celah di atas: begitu token A genap 16 karakter,
    /// buffer langsung dikosongkan, jadi karakter siswa B (walau datang
    /// hanya beberapa milidetik kemudian) pasti mulai dari buffer kosong.
    ///
    /// Opt-in lewat "expectedTokenLength" di scanner-map.json (per scanner
    /// atau default global) -- kosongkan/null kalau format token berubah
    /// atau tidak seragam, dan sistem akan kembali murni mengandalkan
    /// idle-timeout seperti sebelumnya.
    /// </summary>
    private void TryFlushOnExpectedLength(DeviceBuffer deviceBuffer, ScannerEntry identity)
    {
        var expectedLength = ExpectedTokenLengthForScanner(identity);
        if (expectedLength is not int len || len <= 0) return;

        string? completedText = null;
        lock (deviceBuffer.SyncRoot)
        {
            if (deviceBuffer.Text.Length < len) return;
            completedText = deviceBuffer.Text.ToString();
            deviceBuffer.Text.Clear();
        }

        completedText = DeduplicateSelfRepeat(completedText, identity.Id);
        RaiseScanCompleted(new ScanCompletedEventArgs(identity.Id, identity.Name, completedText, DateTime.UtcNow));
    }

    private int? ExpectedTokenLengthForScanner(ScannerEntry identity)
        => identity.ExpectedTokenLength ?? _config.DefaultExpectedTokenLength;

    /// <summary>
    /// Satu titik pemancar ScanCompleted, dipakai baik oleh flush berbasis
    /// panjang (TryFlushOnExpectedLength, segera saat karakter datang)
    /// maupun flush berbasis idle-timeout (CheckCompletions, dari timer) --
    /// supaya penanganan error "satu handler gagal tidak boleh menjatuhkan
    /// listener device lain" konsisten di kedua jalur, bukan hanya salah
    /// satu.
    /// </summary>
    private void RaiseScanCompleted(ScanCompletedEventArgs args)
    {
        try
        {
            ScanCompleted?.Invoke(args);
        }
        catch (Exception ex)
        {
            Log.Error($"ScanCompleted handler melempar exception: {ex.Message}");
        }
    }

    private DeviceBuffer GetOrCreateBuffer(IntPtr hDevice)
    {
        return _buffers.GetOrAdd(hDevice, _ => new DeviceBuffer());
    }

    private ScannerEntry? ResolveIdentity(IntPtr hDevice)
    {
        if (_deviceIdentityCache.TryGetValue(hDevice, out var cached))
        {
            return cached;
        }

        var path = RawDeviceInfoReader.GetDevicePath(hDevice);
        var entry = path is null
            ? null
            : _config.Scanners.FirstOrDefault(s =>
                string.Equals(s.DevicePath, path, StringComparison.OrdinalIgnoreCase));

        _deviceIdentityCache[hDevice] = entry; // cache walau null, supaya tidak syscall berulang
        return entry;
    }

    private static char? TranslateToChar(ushort vKey, ushort scanCode, bool shiftDown)
    {
        var keyState = new byte[256];
        if (shiftDown)
        {
            keyState[NativeMethods.VK_SHIFT] = 0x80;
        }

        var sb = new StringBuilder(4);
        var result = NativeMethods.ToUnicode(vKey, scanCode, keyState, sb, sb.Capacity, 0);

        // result == 1: satu karakter berhasil diterjemahkan.
        // result == 0/negatif/>1: tombol non-printable, dead-key, atau
        // kombinasi yang tidak relevan untuk isi QR token -- diabaikan.
        if (result == 1 && sb.Length > 0)
        {
            return sb[0];
        }

        return null;
    }

    /// <summary>
    /// Mitigasi untuk perilaku hardware EP5300BT: kalau trigger ditahan
    /// lebih lama, decoder mengirim isi barcode yang sama BERULANG KALI
    /// (bukan cuma 2x -- hasil uji 29 Agustus 2026 menunjukkan sampai 5x
    /// repeat kalau trigger ditahan lama) dalam satu burst keystroke yang
    /// tetap tergabung jadi satu completion event (jeda antar-repeat
    /// lebih pendek dari CompletionTimeoutMs).
    ///
    /// Deteksi: cari UNIT PENGULANGAN TERKECIL yang membentuk seluruh
    /// teks persis N kali berturut-turut (N>=2), lalu ambil satu unit
    /// saja. Unit minimal 6 karakter supaya tidak salah memotong konten
    /// pendek yang sah tapi kebetulan punya pola berulang di awalnya.
    /// </summary>
    private static string DeduplicateSelfRepeat(string text, string scannerId)
    {
        var len = text.Length;
        if (len < 12) return text;

        for (var period = 6; period <= len / 2; period++)
        {
            if (len % period != 0) continue;

            var unit = text.AsSpan(0, period);
            var isFullRepeat = true;

            for (var offset = period; offset < len; offset += period)
            {
                if (!text.AsSpan(offset, period).SequenceEqual(unit))
                {
                    isFullRepeat = false;
                    break;
                }
            }

            if (isFullRepeat)
            {
                var repeatCount = len / period;
                Log.Warn($"{scannerId}: hasil scan terdeteksi terkirim {repeatCount}x berulang oleh hardware ('{text}'), dipotong jadi satu ('{unit}'). Kemungkinan trigger scanner ditahan terlalu lama -- edukasikan operator untuk tap-lepas cepat, bukan ditahan.");
                return unit.ToString();
            }
        }

        return text;
    }

    private void CheckCompletions(object? state)
    {
        var now = DateTime.UtcNow;
        List<ScanCompletedEventArgs>? toEmit = null;

        foreach (var (hDevice, buf) in _buffers)
        {
            // Identity diresolusi DULUAN (sebelum cek buffer) karena timeout
            // yang dipakai sekarang bergantung pada scanner mana ini --
            // lihat CompletionTimeoutForScanner.
            var identity = ResolveIdentity(hDevice);
            if (identity is null) continue; // seharusnya tidak terjadi, jaga-jaga

            var timeoutMs = CompletionTimeoutForScanner(identity);
            string? completedText = null;

            lock (buf.SyncRoot)
            {
                if (buf.Text.Length == 0) continue;
                if ((now - buf.LastKeystrokeUtc).TotalMilliseconds < timeoutMs) continue;

                completedText = buf.Text.ToString();
                buf.Text.Clear();
            }

            completedText = DeduplicateSelfRepeat(completedText, identity.Id);

            toEmit ??= [];
            toEmit.Add(new ScanCompletedEventArgs(identity.Id, identity.Name, completedText, now));
        }

        if (toEmit is null) return;
        foreach (var args in toEmit)
        {
            RaiseScanCompleted(args);
        }
    }

    public void Dispose()
    {
        _completionTimer.Dispose();
        _window.Dispose();
    }
}