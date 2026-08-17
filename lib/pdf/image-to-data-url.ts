// lib/pdf/image-to-data-url.ts

/**
 * Mengambil gambar dari URL (avatar DiceBear, logo Cloudinary, dll) di sisi
 * browser dan mengonversinya jadi data URL base64 agar bisa dipakai oleh
 * jsPDF.addImage (yang tidak menerima URL eksternal langsung).
 *
 * Mengembalikan null bila gagal (mis. offline / CORS), supaya proses
 * generate PDF tetap lanjut tanpa gambar tersebut alih-alih gagal total.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Gagal membaca gambar"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}