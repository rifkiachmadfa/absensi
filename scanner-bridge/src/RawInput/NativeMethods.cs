using System.Runtime.InteropServices;

namespace ScannerBridge.RawInput;

/// <summary>
/// P/Invoke declarations untuk Windows Raw Input API (user32.dll) dan
/// SetupAPI (setupapi.dll / cfgmgr32.dll untuk info tambahan device).
///
/// Kenapa Raw Input, bukan global keyboard hook biasa (SetWindowsHookEx
/// WH_KEYBOARD_LL) atau SendInput interception:
///   - Raw Input API adalah SATU-SATUNYA cara standar Windows untuk tahu
///     PERSIS handle (`hDevice`) fisik device HID mana yang mengirim tiap
///     keystroke. Keyboard hook biasa hanya memberi tahu KODE TOMBOLnya,
///     TIDAK memberi tahu device fisik asalnya -- kalau dipakai untuk 4
///     scanner identik (VID/PID sama), hasilnya akan tercampur persis
///     seperti larangan di Section H spesifikasi ("ABXCYZ123789").
///   - Ini didokumentasikan resmi oleh Microsoft:
///     https://learn.microsoft.com/windows/win32/inputdev/raw-input
///
/// Referensi seluruh signature di file ini: Microsoft Learn / Win32 API
/// (user32.dll, setupapi.dll) -- signature P/Invoke standar, TIDAK
/// mengarang struct/field yang tidak ada di dokumentasi resmi Win32.
/// </summary>
internal static class NativeMethods
{
    // ---- Registrasi Raw Input device (supaya window kita menerima WM_INPUT) ----

    [StructLayout(LayoutKind.Sequential)]
    public struct RAWINPUTDEVICE
    {
        public ushort usUsagePage;
        public ushort usUsage;
        public uint dwFlags;
        public IntPtr hwndTarget;
    }

    public const ushort HID_USAGE_PAGE_GENERIC = 0x01;
    public const ushort HID_USAGE_GENERIC_KEYBOARD = 0x06;
    public const uint RIDEV_INPUTSINK = 0x00000100; // terima input walau window tidak fokus

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool RegisterRawInputDevices(
        [MarshalAs(UnmanagedType.LPArray)] RAWINPUTDEVICE[] pRawInputDevices,
        uint uiNumDevices,
        uint cbSize);

    // ---- Membaca payload WM_INPUT (dipanggil dari WndProc saat WM_INPUT) ----

    public const int WM_INPUT = 0x00FF;
    public const uint RID_INPUT = 0x10000003;

    // ---- Message code di RAWKEYBOARD.Message (key up/down) & VK Shift ----
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_KEYUP = 0x0101;
    public const uint WM_SYSKEYDOWN = 0x0104;
    public const uint WM_SYSKEYUP = 0x0105;

    public const int VK_SHIFT = 0x10;
    public const int VK_LSHIFT = 0xA0;
    public const int VK_RSHIFT = 0xA1;

    /// <summary>
    /// Menerjemahkan (VKey, ScanCode, state Shift) menjadi karakter sesuai
    /// keyboard layout aktif -- supaya scanner bisa mengirim huruf besar,
    /// angka, dan simbol seperti '-' dengan benar (bukan cuma VKey mentah).
    /// </summary>
    [DllImport("user32.dll")]
    public static extern int ToUnicode(
        uint wVirtKey,
        uint wScanCode,
        byte[] lpKeyState,
        [Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pwszBuff,
        int cchBuff,
        uint wFlags);

    // Nilai resmi Win32 (winuser.h): RIM_TYPEMOUSE=0, RIM_TYPEKEYBOARD=1,
    // RIM_TYPEHID=2. (Versi sebelumnya SALAH menganggap Mouse=2/HID=3 --
    // diperbaiki di sini setelah ditemukan lewat hasil --discover asli:
    // device dengan dwType=0 salah ditampilkan sbg "Tidak dikenal".)
    public const uint RIM_TYPEMOUSE = 0;
    public const uint RIM_TYPEKEYBOARD = 1;
    public const uint RIM_TYPEHID = 2;

    [StructLayout(LayoutKind.Sequential)]
    public struct RAWINPUTHEADER
    {
        public uint dwType;
        public uint dwSize;
        public IntPtr hDevice; // <-- identitas fisik device, inilah kuncinya
        public IntPtr wParam;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RAWKEYBOARD
    {
        public ushort MakeCode;
        public ushort Flags;
        public ushort Reserved;
        public ushort VKey;
        public uint Message;
        public uint ExtraInformation;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct RAWINPUT
    {
        [FieldOffset(0)] public RAWINPUTHEADER header;
        // Offset persis bergantung arsitektur (padding alignment berbeda
        // 32-bit vs 64-bit) -- karena target build HANYA win-x64 (lihat
        // .csproj RuntimeIdentifier), offset di bawah ini valid untuk x64.
        [FieldOffset(24)] public RAWKEYBOARD keyboard;
    }

    [DllImport("user32.dll")]
    public static extern uint GetRawInputData(
        IntPtr hRawInput,
        uint uiCommand,
        IntPtr pData,
        ref uint pcbSize,
        uint cbSizeHeader);

    // ---- Info device: VID/PID/Device Path dari hDevice ----

    public const uint RIDI_DEVICENAME = 0x20000007;
    public const uint RIDI_DEVICEINFO = 0x2000000b;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern uint GetRawInputDeviceInfo(
        IntPtr hDevice,
        uint uiCommand,
        IntPtr pData,
        ref uint pcbSize);

    // ---- Enumerasi SEMUA raw input device yang terpasang saat ini ----
    // (dipakai oleh mode --discover, TIDAK butuh window/WM_INPUT)

    [StructLayout(LayoutKind.Sequential)]
    public struct RAWINPUTDEVICELIST
    {
        public IntPtr hDevice;
        public uint dwType;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetRawInputDeviceList(
        [Out] RAWINPUTDEVICELIST[]? pRawInputDeviceList,
        ref uint puiNumDevices,
        uint cbSize);

    // ---- Device change notification (deteksi cabut/pasang, Tahap P) ----

    public const int WM_DEVICECHANGE = 0x0219;
    public const int DBT_DEVICEARRIVAL = 0x8000;
    public const int DBT_DEVICEREMOVECOMPLETE = 0x8004;
}
