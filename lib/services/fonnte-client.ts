// lib/services/fonnte-client.ts
import "server-only";

// Wrapper HTTP tipis untuk Fonnte API (docs/whatsapp-blast.md Section 4 & 45).
// Tidak boleh berisi business logic attendance/template pesan -- hanya
// request/response shape ke Fonnte. Dipakai oleh:
// - whatsapp-service.ts       -> sendMessage() (kirim notifikasi absensi)
// - pengaturan-service.ts     -> addDevice/getQr/getDeviceStatus/disconnectDevice
//                                (alur setup nomor pengirim, Section 45.3)
//
// PENTING: Header Authorization Fonnte TIDAK memakai "Bearer" -- token
// dikirim apa adanya (Section 4).

const FONNTE_BASE_URL = "https://api.fonnte.com";

// Timeout dipakai supaya satu request Fonnte yang macet tidak menggantung
// selamanya. Tidak ada retry otomatis (Section 10) -- begitu timeout/gagal,
// selesai, caller yang memutuskan (whatsapp-service.ts: best-effort, log saja).
const DEFAULT_TIMEOUT_MS = 8_000;

async function fonnteFetch(
  path: string,
  options: {
    token: string;
    body?: Record<string, string>;
    timeoutMs?: number;
  }
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const form = new FormData();
    for (const [key, value] of Object.entries(options.body ?? {})) {
      form.append(key, value);
    }

    const res = await fetch(`${FONNTE_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        // Sengaja BUKAN `Bearer ${token}` -- lihat catatan di atas.
        Authorization: options.token,
      },
      body: form,
      signal: controller.signal,
    });

    let json: Record<string, unknown> | null = null;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      // Response bukan JSON valid -- biarkan json = null, caller yang
      // menentukan artinya sukses/gagal berdasarkan res.ok saja.
    }

    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// Kirim pesan -- dipakai whatsapp-service.ts (notifyAttendance)
// ============================================================

export type SendMessageResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function sendMessage(params: {
  deviceToken: string;
  target: string; // format 62xxxxxxxxxx, sudah dinormalisasi oleh caller
  message: string;
}): Promise<SendMessageResult> {
  try {
    const { ok, json } = await fonnteFetch("/send", {
      token: params.deviceToken,
      body: {
        target: params.target,
        message: params.message,
      },
    });

    // Fonnte tetap bisa balas HTTP 200 dengan status:false di body (mis.
    // device disconnect) -- keduanya dianggap gagal kirim di sisi kita.
    const bodyStatus = json?.status;
    if (!ok || bodyStatus === false) {
      const reason =
        (typeof json?.reason === "string" && json.reason) ||
        `Fonnte merespons status ${json ? "false" : "non-OK"} (HTTP ${ok ? "200" : "error"})`;
      return { ok: false, reason };
    }

    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Request ke Fonnte gagal: ${reason}` };
  }
}

// ============================================================
// Device management -- dipakai pengaturan-service.ts (Section 45.3, alur
// setup nomor pengirim SUPERADMIN). Diletakkan di sini (bukan langsung di
// pengaturan-service.ts) supaya satu tempat yang tahu bentuk request/response
// Fonnte, konsisten dengan sendMessage() di atas.
// ============================================================

export type AddDeviceResult =
  | { ok: true; deviceToken: string }
  | { ok: false; reason: string };

// Account Token (bukan device token) dipakai di sini -- lihat Section 45
// "dua jenis token berbeda, jangan tertukar".
export async function addDevice(params: {
  accountToken: string;
  phoneNumber: string;
  label: string;
}): Promise<AddDeviceResult> {
  try {
    const { ok, json } = await fonnteFetch("/add-device", {
      token: params.accountToken,
      body: {
        device: params.phoneNumber,
        name: params.label,
        autoread: "false",
        personal: "false",
        group: "false",
      },
    });

    const deviceToken = typeof json?.token === "string" ? json.token : null;

    if (!ok || !deviceToken) {
      const reason =
        (typeof json?.reason === "string" && json.reason) || "Fonnte gagal membuat device baru.";
      return { ok: false, reason };
    }

    return { ok: true, deviceToken };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Request ke Fonnte gagal: ${reason}` };
  }
}

export type GetQrResult =
  | { ok: true; qrImageBase64: string }
  | { ok: false; reason: string };

// Dipanggil pakai device token (bukan account token) -- QR khusus device
// yang baru dibuat oleh addDevice().
export async function getQr(params: { deviceToken: string }): Promise<GetQrResult> {
  try {
    const { ok, json } = await fonnteFetch("/qr", { token: params.deviceToken });

    const qr =
      (typeof json?.qr === "string" && json.qr) ||
      (typeof json?.url === "string" && json.url) ||
      null;

    if (!ok || !qr) {
      const reason =
        (typeof json?.reason === "string" && json.reason) || "Fonnte gagal mengambil QR code.";
      return { ok: false, reason };
    }

    return { ok: true, qrImageBase64: qr };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Request ke Fonnte gagal: ${reason}` };
  }
}

export type DeviceStatus = "connect" | "disconnect";

export type GetDeviceStatusResult =
  | { ok: true; status: DeviceStatus }
  | { ok: false; reason: string };

// Dipanggil pakai device token milik sender yang sedang di-polling statusnya
// (Section 45.3.1) -- pakai endpoint device profile (/device), BUKAN
// /get-devices (yang butuh account token & me-list semua device sekaligus).
export async function getDeviceStatus(params: {
  deviceToken: string;
}): Promise<GetDeviceStatusResult> {
  try {
    const { ok, json } = await fonnteFetch("/device", { token: params.deviceToken });

    const deviceStatus = json?.device_status;
    if (!ok || (deviceStatus !== "connect" && deviceStatus !== "disconnect")) {
      const reason =
        (typeof json?.reason === "string" && json.reason) ||
        "Fonnte gagal mengembalikan status device.";
      return { ok: false, reason };
    }

    return { ok: true, status: deviceStatus };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Request ke Fonnte gagal: ${reason}` };
  }
}

export type DisconnectDeviceResult = { ok: true } | { ok: false; reason: string };

// NOTE: Fonnte tidak mendokumentasikan endpoint "disconnect device" terpisah
// secara eksplisit di docs publik -- yang tersedia adalah /delete-device
// (menghapus device sepenuhnya dari akun). Karena WhatsAppSender.status
// DISCONNECTED di sistem kita berarti "tidak dipakai kirim pesan, tapi
// barisnya tetap ada" (bukan device dihapus dari Fonnte), fungsi ini perlu
// diverifikasi ulang terhadap dashboard Fonnte akun sekolah sebelum dipakai
// di alur "Putuskan" (Section 45.3.2) -- lihat TODO di pengaturan-service.ts
// saat langkah itu diimplementasikan. Untuk sekarang endpoint yang dipanggil
// adalah /delete-device sesuai API yang terdokumentasi.
export async function disconnectDevice(params: {
  deviceToken: string;
}): Promise<DisconnectDeviceResult> {
  try {
    const { ok, json } = await fonnteFetch("/delete-device", { token: params.deviceToken });

    if (!ok || json?.status === false) {
      const reason =
        (typeof json?.reason === "string" && json.reason) || "Fonnte gagal memutuskan device.";
      return { ok: false, reason };
    }

    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Request ke Fonnte gagal: ${reason}` };
  }
}