using ScannerBridge.Discovery;

namespace ScannerBridge.Mapping;

public sealed record MappingStatus(
    DiscoveredDevice Device,
    string? AssignedScannerId,
    string? AssignedName
)
{
    public bool IsAssigned => AssignedScannerId is not null;
}

/// <summary>
/// Implementasi Phase 6 (Device Mapping). Tugasnya HANYA mencocokkan device
/// yang terdeteksi saat ini dengan scanner-map.json -- tidak pernah menebak
/// atau auto-assign. Device yang belum ada di config selalu ditampilkan
/// sebagai "Unassigned" supaya admin yang memutuskan (Section I: "Admin
/// dapat melakukan: Assign -> Scanner 1").
/// </summary>
public static class ScannerMappingService
{
    public static List<MappingStatus> MatchAgainstConfig(
        IEnumerable<DiscoveredDevice> discovered,
        ScannerMapConfig config)
    {
        var result = new List<MappingStatus>();

        foreach (var device in discovered)
        {
            var match = config.Scanners.FirstOrDefault(s =>
                string.Equals(s.DevicePath, device.DevicePath, StringComparison.OrdinalIgnoreCase));

            result.Add(new MappingStatus(
                Device: device,
                AssignedScannerId: match?.Id,
                AssignedName: match?.Name
            ));
        }

        return result;
    }

    /// <summary>
    /// Assign satu device path ke scannerId+name tertentu, lalu simpan
    /// config. Kalau devicePath itu sudah pernah di-assign sebelumnya,
    /// entrinya di-update (bukan duplikat).
    /// </summary>
    public static ScannerMapConfig Assign(
        ScannerMapConfig config,
        string devicePath,
        string scannerId,
        string name)
    {
        var existing = config.Scanners.FirstOrDefault(s =>
            string.Equals(s.DevicePath, devicePath, StringComparison.OrdinalIgnoreCase));

        if (existing is not null)
        {
            existing.Id = scannerId;
            existing.Name = name;
        }
        else
        {
            config.Scanners.Add(new ScannerEntry
            {
                Id = scannerId,
                DevicePath = devicePath,
                Name = name,
            });
        }

        return config;
    }
}
