using ScannerBridge.Discovery;
using ScannerBridge.Logging;
using ScannerBridge.Mapping;
using ScannerBridge.Networking;
using ScannerBridge.RawInput;

namespace ScannerBridge;

/// <summary>
/// Entry point scanner-bridge.
///
/// STATUS SAAT INI (akhir Phase 9): --discover, --assign, --listen (parser
/// scan live, cetak ke konsol -- dipertahankan untuk debugging tanpa
/// WebSocket), dan --serve (Phase 9: RawInputListener + WebSocket server,
/// mode yang sebenarnya dipakai harian) semuanya sudah bisa dipakai.
/// Integrasi sisi Next.js (scannerServiceClient.ts, Phase 10) dikerjakan
/// terpisah di repo absensi.
/// </summary>
internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Contains("--discover"))
        {
            return RunDiscover();
        }

        if (args.Contains("--assign"))
        {
            return RunAssign(args);
        }

        if (args.Contains("--listen"))
        {
            return RunListen();
        }

        if (args.Contains("--serve"))
        {
            return RunServe();
        }

        Log.Error("Mode belum diimplementasikan.");
        Log.Info("Gunakan salah satu:");
        Log.Info("  scanner-bridge.exe --discover");
        Log.Info("  scanner-bridge.exe --assign <deviceIndex> <scannerId> <name>");
        Log.Info("  scanner-bridge.exe --listen");
        Log.Info("  scanner-bridge.exe --serve");
        return 1;
    }

    /// <summary>
    /// Mode Phase 9 -- mode yang sebenarnya dipakai sehari-hari (mis. lewat
    /// Windows Task Scheduler "run at logon"). Menjalankan RawInputListener
    /// PERSIS seperti --listen, tapi setiap ScanCompleted juga disiarkan
    /// lewat WebSocket ke tab browser yang membuka dialog Scan Absensi /
    /// Scan Pulang di PC yang sama. Tidak ada logic absensi apa pun di
    /// sini -- bridge ini murni mengantar teks QR mentah, identik dengan
    /// peran kamera HP di qr-scanner.tsx (lihat komentar besar di
    /// ScannerWebSocketServer.cs).
    /// </summary>
    private static int RunServe()
    {
        var configPath = ScannerMapConfig.ResolveConfigPath();
        var config = ScannerMapConfig.LoadOrDefault(configPath);

        if (config.Scanners.Count == 0)
        {
            Log.Error("scanner-map.json kosong atau belum ada. Jalankan --discover lalu --assign dulu.");
            return 1;
        }

        Log.Info("=== ScannerBridge Serve Mode (Phase 9) ===");
        Log.Info($"Config dimuat dari: {configPath}");
        Log.Info($"Scanner terdaftar: {string.Join(", ", config.Scanners.Select(s => $"{s.Id} ({s.Name})"))}");
        Log.Info("");

        using var listener = new RawInputListener(config);
        using var wsServer = new ScannerWebSocketServer(config);

        try
        {
            wsServer.Start();
        }
        catch
        {
            // Pesan error+remediasi persisnya sudah dicetak di dalam Start().
            return 1;
        }

        listener.ScanCompleted += args =>
        {
            Log.Info($"[SCAN] {args.ScannerId} ({args.ScannerName}) -> \"{args.Text}\" (panjang: {args.Text.Length} karakter, {wsServer.ConnectedClientCount} browser tersambung)");
            _ = wsServer.BroadcastScanAsync(args);
        };

        listener.UnmappedDeviceKeystroke += hDevice =>
        {
            Log.Debug($"Keystroke dari device yang BELUM di-assign (hDevice={hDevice}) -- diabaikan.");
        };

        var exiting = false;
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            exiting = true;
        };

        Log.Info("Listener + WebSocket server aktif.");
        Log.Info("Buka halaman /absensi di browser (PC yang sama) untuk mulai menerima scan.");
        Log.Info("Tekan Ctrl+C untuk berhenti.");
        Log.Info("");

        // Message loop manual (bukan Application.Run()) -- sama seperti
        // --listen, supaya WM_INPUT tetap terpompa tanpa perlu form/tray
        // icon terlihat.
        while (!exiting)
        {
            System.Windows.Forms.Application.DoEvents();
            System.Threading.Thread.Sleep(15);
        }

        Log.Info("Berhenti.");
        return 0;
    }

    private static int RunListen()
    {
        var configPath = ScannerMapConfig.ResolveConfigPath();
        var config = ScannerMapConfig.LoadOrDefault(configPath);

        if (config.Scanners.Count == 0)
        {
            Log.Error("scanner-map.json kosong atau belum ada. Jalankan --discover lalu --assign dulu.");
            return 1;
        }

        Log.Info("=== ScannerBridge Listen Mode (Phase 8 test) ===");
        Log.Info($"Config dimuat dari: {configPath}");
        Log.Info($"Scanner terdaftar: {string.Join(", ", config.Scanners.Select(s => $"{s.Id} ({s.Name})"))}");
        Log.Info("");
        Log.Info("Silakan scan kartu QR dengan salah satu scanner terdaftar.");
        Log.Info("Tekan Ctrl+C untuk berhenti.");
        Log.Info("");

        using var listener = new RawInputListener(config);

        listener.ScanCompleted += args =>
        {
            Log.Info($"[SCAN] {args.ScannerId} ({args.ScannerName}) -> \"{args.Text}\" (panjang: {args.Text.Length} karakter)");
        };

        listener.UnmappedDeviceKeystroke += hDevice =>
        {
            Log.Debug($"Keystroke dari device yang BELUM di-assign (hDevice={hDevice}) -- diabaikan. Kalau ini seharusnya salah satu EPPOS, jalankan --discover & --assign dulu.");
        };

        var exiting = false;
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            exiting = true;
        };

        Log.Info("Listener aktif.");

        // Message loop manual (bukan Application.Run()) supaya kita bisa
        // keluar bersih lewat Ctrl+C tanpa perlu form/tray icon. DoEvents()
        // tetap memompa message queue Windows sehingga WM_INPUT diterima.
        while (!exiting)
        {
            System.Windows.Forms.Application.DoEvents();
            System.Threading.Thread.Sleep(15);
        }

        Log.Info("Berhenti.");
        return 0;
    }

    private static int RunDiscover()
    {
        Log.Info("=== ScannerBridge Hardware Discovery ===");
        Log.Info("Mengenumerasi semua Raw Input HID device yang terpasang saat ini...");
        Log.Info("");

        List<DiscoveredDevice> devices;
        try
        {
            devices = DiscoveryService.EnumerateAll();
        }
        catch (Exception ex)
        {
            Log.Error($"Gagal enumerasi device: {ex.Message}");
            Log.Error("Pastikan program ini dijalankan di Windows (bukan di sandbox Linux tempat kode ini ditulis).");
            return 1;
        }

        if (devices.Count == 0)
        {
            Log.Warn("Tidak ada Raw Input device ditemukan. Periksa apakah scanner sudah terpasang.");
            return 0;
        }

        var configPath = ScannerMapConfig.ResolveConfigPath();
        var config = ScannerMapConfig.LoadOrDefault(configPath);
        var statuses = ScannerMappingService.MatchAgainstConfig(devices, config);

        Log.Info($"Ditemukan {devices.Count} device (config: {(File.Exists(configPath) ? configPath : "belum ada, semua dianggap Unassigned")}):");
        Log.Info("");

        int i = 0;
        foreach (var s in statuses)
        {
            Console.WriteLine($"--- Device #{i} ---");
            Console.WriteLine($"  Tipe          : {DiscoveryService.DescribeType(s.Device.RawInputType)}");
            Console.WriteLine($"  VID           : {s.Device.VendorId}");
            Console.WriteLine($"  PID           : {s.Device.ProductId}");
            Console.WriteLine($"  Device Path   : {s.Device.DevicePath}");
            Console.WriteLine(s.IsAssigned
                ? $"  Status        : Assigned -> {s.AssignedScannerId} ({s.AssignedName})"
                : "  Status        : Unassigned");
            Console.WriteLine();
            i++;
        }

        Log.Info("Discovery selesai.");

        if (statuses.Any(s => !s.IsAssigned && s.Device.RawInputType == 1 /* keyboard */))
        {
            Log.Info("");
            Log.Info("Ada device bertipe Keyboard yang belum di-assign. Kalau itu memang");
            Log.Info("salah satu EPPOS, assign dengan:");
            Log.Info("  scanner-bridge.exe --assign <nomor Device # di atas> scanner-1 \"Scanner Meja 1\"");
        }

        return 0;
    }

    private static int RunAssign(string[] args)
    {
        var idx = Array.IndexOf(args, "--assign");
        if (idx + 3 >= args.Length)
        {
            Log.Error("Pemakaian: scanner-bridge.exe --assign <deviceIndex> <scannerId> <name>");
            Log.Info("Jalankan --discover dulu untuk melihat nomor Device # yang mau di-assign.");
            return 1;
        }

        if (!int.TryParse(args[idx + 1], out var deviceIndex))
        {
            Log.Error($"deviceIndex harus angka, dapat: '{args[idx + 1]}'");
            return 1;
        }

        var scannerId = args[idx + 2];
        var name = args[idx + 3];

        List<DiscoveredDevice> devices;
        try
        {
            devices = DiscoveryService.EnumerateAll();
        }
        catch (Exception ex)
        {
            Log.Error($"Gagal enumerasi device: {ex.Message}");
            return 1;
        }

        if (deviceIndex < 0 || deviceIndex >= devices.Count)
        {
            Log.Error($"deviceIndex {deviceIndex} di luar jangkauan (ditemukan {devices.Count} device, index 0-{devices.Count - 1}). Jalankan --discover dulu untuk melihat nomor yang benar SEKARANG (nomor bisa berubah kalau device dicabut/pasang ulang).");
            return 1;
        }

        var target = devices[deviceIndex];

        var configPath = ScannerMapConfig.ResolveConfigPath();
        var config = ScannerMapConfig.LoadOrDefault(configPath);
        ScannerMappingService.Assign(config, target.DevicePath, scannerId, name);
        config.Save(configPath);

        Log.Info($"Berhasil assign device #{deviceIndex} -> {scannerId} (\"{name}\")");
        Log.Info($"Device Path : {target.DevicePath}");
        Log.Info($"Disimpan ke : {configPath}");
        Log.Info("");
        Log.Info("Jalankan --discover lagi untuk konfirmasi status Assigned.");

        return 0;
    }
}