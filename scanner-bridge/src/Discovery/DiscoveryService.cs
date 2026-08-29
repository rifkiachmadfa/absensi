using ScannerBridge.RawInput;

namespace ScannerBridge.Discovery;

public sealed record DiscoveredDevice(
    string DevicePath,
    string VendorId,   // hex, mis. "1A86"
    string ProductId,  // hex, mis. "E026"
    uint RawInputType  // 1 = keyboard, 2 = mouse, 3 = HID lain
);

/// <summary>
/// Implementasi PHASE 2/5 spesifikasi: "buat utility untuk melakukan
/// hardware discovery di Windows" karena mode operasi EP5300BT tidak
/// dapat dipastikan dari dokumentasi (lihat
/// docs/scanner-integration/01-audit-dan-arsitektur.md, Phase 2).
///
/// Tujuan utility ini HANYA melaporkan apa yang benar-benar terpasang --
/// tidak menyimpulkan, tidak mengasumsikan, tidak melakukan mapping
/// otomatis. Keputusan mapping (Phase 6/7) baru diambil SETELAH operator
/// menjalankan ini dan memverifikasi manual sesuai langkah di README.md.
/// </summary>
public static class DiscoveryService
{
    /// <summary>
    /// Enumerasi SEMUA raw input device yang sedang terpasang (Section E,
    /// poin 2: "buat utility untuk melakukan hardware discovery").
    /// Dipanggil langsung tanpa perlu window/message loop -- ini snapshot
    /// point-in-time, bukan listener.
    /// </summary>
    public static List<DiscoveredDevice> EnumerateAll()
    {
        uint deviceCount = 0;
        uint listSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf<NativeMethods.RAWINPUTDEVICELIST>();

        var result = NativeMethods.GetRawInputDeviceList(null, ref deviceCount, listSize);
        if (result == unchecked((uint)-1) || deviceCount == 0)
        {
            return [];
        }

        var deviceList = new NativeMethods.RAWINPUTDEVICELIST[deviceCount];
        var written = NativeMethods.GetRawInputDeviceList(deviceList, ref deviceCount, listSize);
        if (written == unchecked((uint)-1))
        {
            return [];
        }

        var discovered = new List<DiscoveredDevice>();
        foreach (var entry in deviceList)
        {
            var info = RawDeviceInfoReader.TryRead(entry.hDevice);
            if (info is null) continue;

            discovered.Add(new DiscoveredDevice(
                DevicePath: info.DevicePath,
                VendorId: info.VendorId > 0 ? info.VendorId.ToString("X4") : "?",
                ProductId: info.ProductId > 0 ? info.ProductId.ToString("X4") : "?",
                RawInputType: entry.dwType
            ));
        }

        return discovered;
    }

    public static string DescribeType(uint rawInputType) => rawInputType switch
    {
        NativeMethods.RIM_TYPEMOUSE => "Mouse (RIM_TYPEMOUSE)",
        NativeMethods.RIM_TYPEKEYBOARD => "Keyboard (RIM_TYPEKEYBOARD)",
        NativeMethods.RIM_TYPEHID => "HID lain (RIM_TYPEHID) -- kemungkinan device ini TIDAK berupa keyboard-wedge, cek lebih lanjut apakah HID POS",
        _ => $"Tidak dikenal ({rawInputType})",
    };
}
