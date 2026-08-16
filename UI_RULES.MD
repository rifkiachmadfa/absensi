# UI RULES — MODERN SCHOOL
## Sistem Absensi Siswa

> Dokumen ini merupakan pedoman utama desain UI/UX untuk seluruh aplikasi Sistem Absensi Siswa.
> Semua halaman, komponen, dialog, tabel, form, dashboard, dan fitur baru WAJIB mengikuti aturan dalam dokumen ini.

---

# 1. DESIGN DIRECTION

Nama design system:

**Modern School**
fokus utama pada mobile first
Karakter utama:

- Modern
- Clean
- Professional
- Friendly
- Trustworthy
- Simple
- Efficient
- Educational
- Accessible

Aplikasi harus terlihat seperti software administrasi sekolah modern, bukan website sekolah tradisional dan bukan dashboard startup yang terlalu dekoratif.

Prioritas desain:

1. Usability
2. Clarity
3. Consistency
4. Accessibility
5. Visual hierarchy
6. Aesthetics

Jangan mengorbankan usability hanya untuk membuat UI terlihat lebih menarik.

---

# 2. VISUAL PERSONALITY

UI harus memberikan kesan:

- profesional
- terpercaya
- terorganisir
- modern
- ringan
- mudah dipahami guru
- nyaman digunakan setiap hari

Hindari kesan:

- terlalu corporate
- terlalu childish
- terlalu colorful
- terlalu futuristic
- terlalu gaming
- terlalu experimental

---

# 3. COLOR SYSTEM

Gunakan warna utama bernuansa blue.

## Primary

Primary:
`#2563EB`

Primary Hover:
`#1D4ED8`

Primary Soft:
`#EFF6FF`

## Background

App Background:
`#F8FAFC`

Surface:
`#FFFFFF`

Surface Muted:
`#F1F5F9`

## Text

Primary Text:
`#0F172A`

Secondary Text:
`#475569`

Muted Text:
`#64748B`

Disabled Text:
`#94A3B8`

## Border

Default Border:
`#E2E8F0`

Strong Border:
`#CBD5E1`

## Status Colors

Success:
`#16A34A`

Success Background:
`#F0FDF4`

Warning:
`#D97706`

Warning Background:
`#FFFBEB`

Danger:
`#DC2626`

Danger Background:
`#FEF2F2`

Info:
`#2563EB`

Info Background:
`#EFF6FF`

---

# 4. COLOR RULES

Gunakan warna primary sebagai aksen utama aplikasi.

Jangan menggunakan banyak warna utama dalam satu halaman.

Secara umum:

- Blue → primary/action
- Green → success/hadir
- Yellow/amber → warning/terlambat
- Red → danger/alpa/error
- Gray → neutral/inactive

Jangan menggunakan gradient sebagai elemen utama UI.

Hindari:

- rainbow gradient
- neon color
- warna terlalu saturated
- background berwarna kuat
- card dengan warna berbeda-beda tanpa alasan

Warna harus membantu pengguna memahami informasi, bukan menjadi dekorasi.

---

# 5. TYPOGRAPHY

Gunakan font sans-serif modern.

Jika project sudah memiliki font, gunakan font tersebut secara konsisten.

Jika tidak ada font khusus, gunakan:

`Inter`

Typography harus memiliki hierarchy yang jelas.

## Page Title

Ukuran:
`24–30px`

Weight:
`600–700`

## Section Title

Ukuran:
`18–20px`

Weight:
`600`

## Body

Ukuran:
`14–16px`

Weight:
`400`

## Caption

Ukuran:
`12–14px`

Weight:
`400–500`

Jangan menggunakan terlalu banyak ukuran font dalam satu halaman.

---

# 6. SPACING SYSTEM

Gunakan spacing berbasis kelipatan 4px.

Token:

```text
xs  = 4px
sm  = 8px
md  = 16px
lg  = 24px
xl  = 32px
2xl = 48px
3xl = 64px