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
    /// Jeda diam (ms) yang dianggap "scan selesai". 80ms dipilih sebagai
    /// titik awal yang aman (scanner biasanya mengirim seluruh payload
    /// jauh di bawah itu, sementara keystroke manusia tercepat pun jarang
    /// di bawah ~60-70ms antar tombol) -- TAPI ini nilai awal yang perlu
    /// divalidasi lewat Test concurrency (Tahap R/S) dengan QR sungguhan
    /// yang lebih panjang, bukan angka final yang sudah pasti benar.
    /// </summary>
    public int CompletionTimeoutMs { get; set; } = 80;

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
            string? completedText = null;

            lock (buf.SyncRoot)
            {
                if (buf.Text.Length == 0) continue;
                if ((now - buf.LastKeystrokeUtc).TotalMilliseconds < CompletionTimeoutMs) continue;

                completedText = buf.Text.ToString();
                buf.Text.Clear();
            }

            var identity = ResolveIdentity(hDevice);
            if (identity is null) continue; // seharusnya tidak terjadi, jaga-jaga

            completedText = DeduplicateSelfRepeat(completedText, identity.Id);

            toEmit ??= [];
            toEmit.Add(new ScanCompletedEventArgs(identity.Id, identity.Name, completedText, now));
        }

        if (toEmit is null) return;
        foreach (var args in toEmit)
        {
            try
            {
                ScanCompleted?.Invoke(args);
            }
            catch (Exception ex)
            {
                // Satu handler yang error tidak boleh menjatuhkan listener
                // device lain (Section AC: "Semua error harus recoverable").
                Log.Error($"ScanCompleted handler melempar exception: {ex.Message}");
            }
        }
    }

    public void Dispose()
    {
        _completionTimer.Dispose();
        _window.Dispose();
    }
}
