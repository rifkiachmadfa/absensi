using System.Windows.Forms;

namespace ScannerBridge.RawInput;

/// <summary>
/// Window "message-only" (tidak terlihat, tidak punya UI) yang tugasnya
/// HANYA menerima pesan Windows WM_INPUT. Raw Input API mengharuskan ada
/// window handle untuk didaftarkan sebagai target (hwndTarget di
/// RAWINPUTDEVICE) -- kita pakai HWND_MESSAGE (-3) supaya window ini
/// benar-benar tidak muncul di mana pun, sesuai desain "aplikasi ini
/// tanpa jendela terlihat" (lihat catatan UseWindowsForms di .csproj).
/// </summary>
internal sealed class RawInputWindow : NativeWindow, IDisposable
{
    public event Action<IntPtr>? RawInputReceived;

    private static readonly IntPtr HWND_MESSAGE = new(-3);

    public RawInputWindow()
    {
        var cp = new CreateParams
        {
            Parent = HWND_MESSAGE,
        };
        CreateHandle(cp);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == NativeMethods.WM_INPUT)
        {
            RawInputReceived?.Invoke(m.LParam);
        }

        base.WndProc(ref m);
    }

    public void Dispose()
    {
        DestroyHandle();
    }
}
