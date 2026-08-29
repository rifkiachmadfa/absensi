namespace ScannerBridge.Logging;

/// <summary>
/// Logger sederhana. Format sesuai Section U spesifikasi:
///   [INFO] Scanner 1 connected
///   [ERROR] Scanner 3 disconnected
///
/// ATURAN KERAS (Section U): "Jangan log secret." -- logger ini TIDAK
/// PERNAH menerima/menulis credential, token sesi, atau apa pun dari
/// Supabase, karena scanner-bridge memang tidak pernah memegang hal-hal
/// tsb (lihat desain Phase 4: autentikasi 100% di browser).
/// </summary>
public static class Log
{
    public static void Info(string message) => Write("INFO", message);
    public static void Debug(string message) => Write("DEBUG", message);
    public static void Warn(string message) => Write("WARN", message);
    public static void Error(string message) => Write("ERROR", message);

    private static void Write(string level, string message)
    {
        var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        Console.WriteLine($"{timestamp} [{level}] {message}");
    }
}
