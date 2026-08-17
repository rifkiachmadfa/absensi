// lib/kartu-siswa/constants.ts

/**
 * Placeholder logo sekolah dari Cloudinary.
 *
 * TODO: Ganti dengan URL Cloudinary logo SMK Yadika Tanjungsari yang asli,
 * atau set melalui environment variable NEXT_PUBLIC_SCHOOL_LOGO_URL
 * tanpa perlu mengubah kode.
 */
export const SCHOOL_LOGO_URL: string =
  process.env.NEXT_PUBLIC_SCHOOL_LOGO_URL ??
  "https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill,r_max,q_auto,f_auto/sample.jpg";