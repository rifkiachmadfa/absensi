import "server-only";
import QRCode from "qrcode";

/**
 * Generate QR Code sebagai data URL (PNG base64) dari sebuah token.
 *
 * QR Code HANYA berisi qrToken (identifier), bukan data pribadi siswa
 * (lihat prinsip 3.4 pada spesifikasi project).
 */
export async function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}

/**
 * Generate QR Code untuk banyak token sekaligus (dipakai saat mencetak
 * satu kelas / seluruh siswa) agar tidak query/generate berulang secara serial.
 */
export async function generateQrDataUrlBatch(
  tokens: string[]
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    tokens.map(async (token) => [token, await generateQrDataUrl(token)] as const)
  );
  return new Map(entries);
}