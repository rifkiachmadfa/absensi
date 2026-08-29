using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace ScannerBridge.RawInput;

/// <summary>
/// Informasi satu device HID hasil pembacaan Raw Input API, cukup untuk
/// mengisi seluruh field yang diminta Section E/F spesifikasi:
/// Device Name, VID, PID, Device Path. "Device Instance ID" Windows yang
/// sesungguhnya (dari SetupAPI/PnP) TIDAK sama persis dengan Device Path
/// Raw Input -- lihat catatan di DevicePathParser di bawah.
/// </summary>
public sealed record RawDeviceInfo(
    IntPtr Handle,
    string DevicePath,
    uint VendorId,
    uint ProductId,
    uint UsagePage,
    uint Usage
)
{
    /// <summary>
    /// String stabil yang dipakai sebagai "identity" untuk mapping
    /// scanner-map.json. INI BELUM TENTU STABIL lintas cabut-pasang --
    /// harus diverifikasi manual (lihat README.md langkah verifikasi).
    /// </summary>
    public string StableIdentityCandidate => DevicePath;
}

internal static class RawDeviceInfoReader
{
    /// <summary>
    /// Baca device path (RIDI_DEVICENAME) untuk sebuah hDevice hasil
    /// GetRawInputDeviceList / header.hDevice dari WM_INPUT.
    /// </summary>
    public static string? GetDevicePath(IntPtr hDevice)
    {
        uint size = 0;
        NativeMethods.GetRawInputDeviceInfo(hDevice, NativeMethods.RIDI_DEVICENAME, IntPtr.Zero, ref size);
        if (size == 0) return null;

        IntPtr buffer = Marshal.AllocHGlobal((int)size * sizeof(char));
        try
        {
            uint written = NativeMethods.GetRawInputDeviceInfo(
                hDevice, NativeMethods.RIDI_DEVICENAME, buffer, ref size);
            if (written == unchecked((uint)-1)) return null;
            return Marshal.PtrToStringUni(buffer);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    /// <summary>
    /// Device path Raw Input berbentuk mis.
    ///   \\?\HID#VID_1A86&PID_E026#7&2b4c8e1a&0&0000#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}
    /// VID/PID bisa diparse langsung dari string ini tanpa perlu SetupAPI
    /// tambahan -- ini pola resmi Windows device path untuk HID.
    /// </summary>
    private static readonly Regex VidPidPattern = new(
        @"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})",
        RegexOptions.Compiled);

    public static RawDeviceInfo? TryRead(IntPtr hDevice)
    {
        var path = GetDevicePath(hDevice);
        if (string.IsNullOrEmpty(path)) return null;

        var match = VidPidPattern.Match(path);
        uint vid = 0, pid = 0;
        if (match.Success)
        {
            vid = Convert.ToUInt32(match.Groups[1].Value, 16);
            pid = Convert.ToUInt32(match.Groups[2].Value, 16);
        }

        return new RawDeviceInfo(hDevice, path, vid, pid, 0, 0);
    }
}
