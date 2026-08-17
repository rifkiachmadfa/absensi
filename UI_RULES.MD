# UI RULES — MODERN SCHOOL

## Sistem Absensi Siswa — SMK Yadika Tanjungsari Sumedang

> Dokumen ini merupakan pedoman utama desain UI/UX untuk seluruh aplikasi Sistem Absensi Siswa.
>
> Semua halaman, komponen, dialog, tabel, form, dashboard, kartu siswa, fitur absensi, dan fitur baru WAJIB mengikuti aturan dalam dokumen ini.
>
> Design system harus merepresentasikan identitas visual SMK Yadika Tanjungsari dengan pendekatan **Modern School**: modern, bersih, profesional, ramah, dan efisien.

---

# 1. DESIGN DIRECTION

Nama design system:

**Modern School**

Brand visual:

**SMK Yadika Tanjungsari**

Pendekatan:

**Modern School × Yadika Branding**

Fokus utama:

**Mobile First**

Karakter utama:

* Modern
* Clean
* Professional
* Friendly
* Trustworthy
* Simple
* Efficient
* Educational
* Accessible
* Consistent

Aplikasi harus terlihat seperti **software administrasi sekolah modern** yang memiliki identitas sekolah yang kuat.

Aplikasi BUKAN:

* Website profil sekolah
* Dashboard startup
* Aplikasi corporate banking
* UI gaming
* UI futuristic
* UI yang terlalu colorful
* UI yang terlalu dekoratif

---

# 2. CORE DESIGN PRINCIPLE

Prioritas desain:

1. Usability
2. Clarity
3. Consistency
4. Accessibility
5. Visual hierarchy
6. Branding
7. Aesthetics

Jangan mengorbankan usability hanya untuk membuat UI terlihat menarik.

Setiap elemen visual harus memiliki tujuan.

Gunakan warna, typography, spacing, icon, dan layout untuk membantu pengguna memahami informasi dengan cepat.

---

# 3. BRAND IDENTITY

Identitas visual aplikasi mengambil inspirasi langsung dari branding SMK Yadika Tanjungsari.

Warna utama:

```text
Deep Teal
#17586F

Yadika Teal
#22949E

Yadika Yellow
#FFCC31
```

Karakter warna:

### Deep Teal — `#17586F`

Digunakan untuk:

* Sidebar
* Header tertentu
* Heading khusus
* Elemen branding
* Navigational emphasis
* Dark surface
* Active navigation pada mode tertentu

Karakter:

* terpercaya
* profesional
* stabil
* akademik

Jangan menggunakan Deep Teal untuk seluruh background aplikasi.

---

### Yadika Teal — `#22949E`

Merupakan warna primary aplikasi.

Digunakan untuk:

* Primary button
* Active state
* Link
* Focus state
* CTA
* Icon penting
* Selected state
* Highlight
* Interactive component

Hover:

Gunakan versi yang lebih gelap dari primary.

Target visual:

```text
Primary
#22949E

Primary Hover
#1C7F88
```

---

### Yadika Yellow — `#FFCC31`

Merupakan warna accent.

Digunakan secara terbatas untuk:

* Highlight
* Badge khusus
* Warning ringan
* Decorative accent
* Important statistic
* CTA sekunder
* Informasi yang membutuhkan perhatian

Yellow BUKAN warna primary button utama.

Jangan menggunakan yellow sebagai background besar.

Yellow harus terasa seperti **accent branding**, bukan warna dominan UI.

---

# 4. COLOR SYSTEM

## Brand Colors

```text
Brand Deep:
#17586F

Brand Primary:
#22949E

Brand Accent:
#FFCC31
```

---

## Background

App Background:

```text
#F8FAFA
```

Surface:

```text
#FFFFFF
```

Surface Muted:

```text
#F1F5F5
```

Surface Teal Soft:

```text
#EAF7F8
```

Surface Yellow Soft:

```text
#FFF8D9
```

---

## Text

Primary Text:

```text
#17313A
```

Secondary Text:

```text
#48616A
```

Muted Text:

```text
#71858C
```

Disabled Text:

```text
#A5B2B6
```

Text on Dark:

```text
#FFFFFF
```

Text on Teal:

```text
#FFFFFF
```

---

## Border

Default Border:

```text
#DCE7E9
```

Strong Border:

```text
#C5D6D9
```

Focus Border:

```text
#22949E
```

---

# 5. STATUS COLORS

Status colors harus tetap berbeda dari warna branding agar informasi mudah dipahami.

## Success — Hadir

```text
Success:
#16A34A

Success Background:
#F0FDF4
```

Gunakan untuk:

* Hadir
* Berhasil
* Aktif
* Tersimpan
* Scan berhasil

---

## Warning — Terlambat

```text
Warning:
#D97706

Warning Background:
#FFFBEB
```

Gunakan untuk:

* Terlambat
* Perhatian
* Data belum lengkap

Gunakan `#FFCC31` hanya ketika warning juga berfungsi sebagai accent branding.

---

## Danger — Tidak Hadir / Error

```text
Danger:
#DC2626

Danger Background:
#FEF2F2
```

Gunakan untuk:

* Alpa
* Error
* Hapus
* Gagal
* Tindakan destruktif

---

## Info

Gunakan brand primary:

```text
Info:
#22949E

Info Background:
#EAF7F8
```

---

# 6. COLOR USAGE RATIO

Gunakan komposisi visual secara konservatif.

Target visual:

```text
Neutral / White     ≈ 70–80%
Teal                ≈ 10–20%
Yellow              ≈ 5–10%
Status Colors       sesuai kebutuhan
```

UI harus tetap terlihat **clean dan mostly neutral**.

Jangan membuat setiap card menggunakan warna berbeda.

Jangan membuat seluruh dashboard berwarna teal.

Brand color digunakan untuk menciptakan identitas, bukan memenuhi seluruh layar.

---

# 7. COLOR RULES

WAJIB:

* Primary interaction menggunakan `#22949E`
* Deep navigation dapat menggunakan `#17586F`
* Yellow digunakan sebagai accent
* Status memiliki warna sendiri
* Background utama tetap terang dan netral
* Text tetap memiliki contrast tinggi

HINDARI:

* Rainbow gradient
* Neon color
* Purple sebagai warna utama
* Blue generic `#2563EB`
* Gradient sebagai background utama
* Banyak accent color
* Card dengan warna berbeda tanpa alasan
* Saturated background
* Teal pada seluruh elemen UI

---

# 8. GRADIENT RULE

Gradient bukan bagian utama dari UI.

Jangan menggunakan gradient untuk:

* Background halaman
* Card utama
* Table
* Form
* Navigation
* Modal

Gradient hanya boleh digunakan secara sangat terbatas untuk elemen dekoratif tertentu.

Jika menggunakan gradient, tetap berada dalam keluarga warna brand.

Contoh yang diperbolehkan:

```text
#17586F → #22949E
```

Contoh yang tidak diperbolehkan:

```text
Blue → Purple
Purple → Pink
Rainbow
Neon Gradient
```

---

# 9. TYPOGRAPHY

Gunakan font sans-serif modern.

Prioritas:

```text
Inter
```

Jika project sudah menggunakan font lain yang konsisten, gunakan font tersebut.

Typography harus terasa:

* modern
* readable
* professional
* friendly

---

## Page Title

```text
24–30px
Weight: 600–700
```

Contoh:

```text
Dashboard
Data Siswa
Laporan Absensi
```

---

## Section Title

```text
18–20px
Weight: 600
```

---

## Body

```text
14–16px
Weight: 400
```

---

## Caption

```text
12–14px
Weight: 400–500
```

---

## Numbers / Statistics

Untuk angka statistik penting:

```text
24–32px
Weight: 600–700
```

Gunakan typography yang kuat tetapi jangan menggunakan font display/decorative.

---

# 10. TYPOGRAPHY RULES

Jangan menggunakan terlalu banyak ukuran font dalam satu halaman.

Maksimal gunakan:

* Display
* Heading
* Body
* Caption

Gunakan weight untuk menciptakan hierarchy daripada menambahkan terlalu banyak ukuran.

Hindari:

* Font terlalu kecil
* ALL CAPS berlebihan
* Font decorative
* Font playful
* Text terlalu bold
* Paragraph terlalu panjang

---

# 11. SPACING SYSTEM

Gunakan spacing berbasis kelipatan 4px.

```text
xs   = 4px
sm   = 8px
md   = 16px
lg   = 24px
xl   = 32px
2xl  = 48px
3xl  = 64px
```

Prioritas spacing:

```text
Content
↓
Section
↓
Component
↓
Element
```

Gunakan whitespace untuk memberikan kesan premium.

Jangan memenuhi layar dengan elemen.

---

# 12. BORDER RADIUS

Gunakan radius modern tetapi tidak terlalu rounded.

```text
Small:
6px

Default:
10px

Card:
14px

Large:
18px

Pill:
999px
```

Gunakan:

* `10px` untuk button
* `10px` untuk input
* `14px` untuk card
* `18px` untuk feature card besar
* `999px` untuk badge/status

Hindari radius berlebihan seperti:

```text
30px
40px
50px
```

kecuali untuk elemen dekoratif.

---

# 13. SHADOW

Gunakan shadow yang sangat subtle.

Default:

```text
0 1px 3px rgba(15, 23, 42, 0.06)
```

Elevated:

```text
0 8px 24px rgba(15, 23, 42, 0.08)
```

Modal:

```text
0 20px 40px rgba(15, 23, 42, 0.12)
```

Jangan menggunakan shadow yang terlalu gelap.

Jangan membuat setiap card terlihat floating.

Border + subtle shadow lebih disukai daripada shadow berat.

---

# 14. CARD DESIGN

Card harus:

* clean
* flat
* structured
* readable
* subtle

Default:

```text
Background: #FFFFFF
Border: #DCE7E9
Radius: 14px
Shadow: subtle
```

Card tidak boleh:

* terlalu colorful
* menggunakan gradient berlebihan
* memiliki banyak icon dekoratif
* memiliki shadow berat
* memiliki terlalu banyak informasi

---

# 15. STATISTIC CARD

Statistic card digunakan untuk informasi penting.

Contoh:

```text
┌─────────────────────────┐
│ Total Siswa             │
│                         │
│ 487                     │
│                         │
│ +12 bulan ini           │
└─────────────────────────┘
```

Gunakan:

* Neutral background
* Typography kuat
* Small brand accent
* Icon sederhana

Jangan membuat setiap statistic card memiliki warna background berbeda.

Status tertentu boleh menggunakan accent tipis.

---

# 16. BUTTON

Primary Button:

```text
Background:
#22949E

Text:
#FFFFFF
```

Hover:

```text
#1C7F88
```

Secondary Button:

```text
Background:
#FFFFFF

Border:
#DCE7E9

Text:
#17313A
```

Accent Button:

Gunakan yellow hanya untuk action yang memang membutuhkan emphasis khusus.

```text
Background:
#FFCC31

Text:
#17313A
```

Danger:

```text
#DC2626
```

Button harus:

* jelas
* mudah disentuh
* memiliki hierarchy
* tidak terlalu banyak variant

---

# 17. INPUT & FORM

Input:

```text
Background:
#FFFFFF

Border:
#DCE7E9

Radius:
10px
```

Focus:

```text
Border:
#22949E
```

Focus ring harus terlihat jelas.

Placeholder:

```text
#71858C
```

Form harus memiliki label yang jelas.

Jangan mengandalkan placeholder sebagai label.

---

# 18. TABLE

Table digunakan untuk data administratif seperti:

* Data siswa
* Absensi
* Kelas
* Riwayat absensi

Header:

```text
Background:
#F1F5F5
```

Text:

```text
#48616A
```

Border:

```text
#DCE7E9
```

Row hover:

```text
#F8FAFA
```

Gunakan whitespace yang cukup.

Jangan menggunakan zebra stripe yang terlalu kontras.

---

# 19. ATTENDANCE STATUS

Status absensi harus sangat mudah dipindai secara visual.

### Hadir

```text
Green badge
```

Contoh:

```text
● Hadir
```

### Terlambat

```text
Amber badge
```

### Izin

Gunakan neutral/teal.

```text
● Izin
```

### Sakit

Gunakan neutral/teal atau status khusus.

### Alpa

```text
Red badge
```

Status harus menggunakan:

**Icon + text**

Jangan hanya menggunakan warna.

---

# 20. SCANNER UI

Scanner adalah salah satu fitur utama aplikasi.

UI scanner harus:

* simple
* focused
* mobile first
* high contrast
* cepat dipahami

Prioritas:

```text
Camera
↓
Scan Area
↓
Instruction
↓
Result
```

Jangan menampilkan banyak informasi ketika proses scanning berlangsung.

Setelah berhasil scan, tampilkan:

```text
✓
Absensi Berhasil

Nama Siswa
Kelas

Status
Jam
```

Feedback harus muncul dengan cepat.

---

# 21. MOBILE FIRST

Aplikasi dirancang terlebih dahulu untuk smartphone.

Prioritas:

1. Scanner
2. Absensi
3. Search siswa
4. Detail siswa
5. Status absensi
6. Navigation

Touch target minimal:

```text
44 × 44px
```

Button penting harus mudah disentuh dengan satu tangan.

Hindari:

* table yang terlalu lebar
* text terlalu kecil
* button terlalu rapat
* modal terlalu besar
* navigation yang sulit dijangkau

---

# 22. DESKTOP LAYOUT

Desktop menggunakan:

```text
Sidebar
+
Topbar
+
Main Content
```

Sidebar dapat menggunakan:

```text
#17586F
```

Namun jangan membuat seluruh aplikasi dark.

Main content tetap menggunakan:

```text
#F8FAFA
```

Navigation active state:

```text
Background:
rgba(255,255,255,0.12)

Accent:
#FFCC31
```

Yellow dapat digunakan sebagai indikator active state secara subtle.

---

# 23. NAVIGATION

Menu harus sederhana.

Contoh:

```text
Dashboard

Absensi

Siswa

Kelas

Laporan

Pengaturan
```

Gunakan icon Lucide.

Icon harus konsisten.

Jangan menggunakan emoji sebagai icon UI utama.

---

# 24. ICONOGRAPHY

Gunakan:

**Lucide Icons**

Style:

* outline
* simple
* consistent
* modern

Default size:

```text
16px
20px
24px
```

Jangan mencampur icon style.

Hindari:

* 3D icon
* colorful icon
* emoji sebagai icon utama
* icon dengan style berbeda

---

# 25. LOGO & BRANDING

Logo sekolah digunakan secara konsisten.

Prioritas:

* Login
* Sidebar
* Header mobile
* Kartu siswa
* Print/export tertentu

Jangan menggunakan logo terlalu besar.

Logo harus menjadi bagian dari identity, bukan dekorasi.

Gunakan brand colors secara konsisten dengan identitas visual sekolah.

---

# 26. VISUAL RELATIONSHIP DENGAN BRANDING SEKOLAH

UI tidak perlu meniru flyer secara literal.

Flyer sekolah menggunakan visual marketing yang lebih ekspresif.

Aplikasi absensi harus mengambil:

**warna + karakter + identity**

bukan menyalin:

* layout flyer
* typography flyer
* decorative shapes
* ilustrasi
* elemen promosi

Dengan demikian:

```text
FLYER SEKOLAH
     ↓
Brand Identity
     ↓
Color + Tone + Visual Character
     ↓
MODERN SCHOOL UI
```

Hasil akhirnya harus terasa sebagai:

**produk digital resmi sekolah**

bukan:

**flyer yang dijadikan dashboard.**

---

# 27. DECORATIVE ELEMENTS

Elemen dekoratif boleh digunakan secara terbatas.

Contoh:

* geometric shape
* subtle curve
* small accent line
* abstract teal shape

Gunakan opacity rendah.

Decorative element tidak boleh mengganggu informasi utama.

Untuk dashboard administratif:

**Content > Decoration**

---

# 28. EMPTY STATE

Empty state harus informatif.

Contoh:

```text
Belum ada data siswa

Belum terdapat siswa yang terdaftar
pada kelas ini.

[ Tambah Siswa ]
```

Gunakan icon sederhana.

Jangan menggunakan ilustrasi besar yang menghabiskan ruang.

---

# 29. LOADING STATE

Gunakan:

* Skeleton
* Spinner
* Progress indicator

Skeleton lebih disukai untuk halaman data.

Hindari loading screen yang terlalu lama atau dekoratif.

---

# 30. ERROR STATE

Error harus:

* jelas
* singkat
* actionable

Contoh:

```text
Data gagal dimuat

Terjadi masalah saat mengambil data siswa.

[ Coba Lagi ]
```

Jangan menampilkan error teknis seperti:

```text
PrismaClientKnownRequestError
```

kepada pengguna.

---

# 31. SUCCESS FEEDBACK

Gunakan toast atau inline feedback.

Contoh:

```text
✓ Siswa berhasil ditambahkan
```

Feedback harus:

* singkat
* jelas
* tidak mengganggu workflow

---

# 32. ACCESSIBILITY

Pastikan:

* contrast cukup
* focus state terlihat
* keyboard navigation bekerja
* touch target cukup besar
* status tidak hanya dibedakan berdasarkan warna
* label form jelas
* error message mudah dipahami

Jangan mengandalkan warna saja.

Contoh:

Buruk:

```text
Hijau = hadir
Merah = alpa
```

Lebih baik:

```text
✓ Hadir
✕ Alpa
```

---

# 33. RESPONSIVE BREAKPOINT

Gunakan pendekatan responsive sederhana.

```text
Mobile:
< 640px

Tablet:
640px – 1024px

Desktop:
> 1024px
```

Namun jangan mendesain berdasarkan breakpoint saja.

Komponen harus fluid.

---

# 34. ANIMATION

Animation harus subtle.

Gunakan untuk:

* hover
* modal
* dropdown
* toast
* page transition
* scanner feedback

Durasi umum:

```text
150–250ms
```

Gunakan easing yang natural.

Hindari:

* bounce berlebihan
* spinning decoration
* animation terus menerus
* parallax
* flashy transition

Aplikasi administrasi harus terasa cepat.

---

# 35. SHADCN/UI

Gunakan **shadcn/ui** sebagai component foundation.

Komponen harus mengikuti design system ini.

Komponen utama:

```text
Button
Input
Select
Dialog
AlertDialog
DropdownMenu
Tabs
Card
Table
Badge
Tooltip
Sheet
Drawer
Toast
Skeleton
```

Jangan membuat setiap komponen dengan style berbeda.

Jika membuat custom component, gunakan token design system yang sama.

---

# 36. DESIGN TOKEN PRINCIPLE

Jangan hardcode warna secara sembarangan.

Gunakan semantic token.

Contoh:

```text
--primary
--primary-foreground

--secondary
--secondary-foreground

--accent
--accent-foreground

--background
--foreground

--card
--card-foreground

--muted
--muted-foreground

--border

--success
--warning
--danger
```

Brand token:

```text
--brand-deep: #17586F
--brand-primary: #22949E
--brand-accent: #FFCC31
```

Komponen harus menggunakan semantic token sebisa mungkin.

---

# 37. OVERALL VISUAL RULE

Ketika ragu dalam membuat keputusan desain, gunakan prinsip berikut:

```text
Simple
    ↓
Clear
    ↓
Consistent
    ↓
Useful
    ↓
Beautiful
```

Bukan:

```text
Beautiful
    ↓
Decorative
    ↓
Complex
    ↓
Confusing
```

---

# 38. FINAL DESIGN CHARACTER

Sistem Absensi Siswa harus terasa seperti:

> **Modern digital school platform dengan identitas visual SMK Yadika.**

Visual keywords:

```text
Modern
Clean
Teal
Professional
Friendly
Academic
Minimal
Premium
Accessible
Efficient
```

Gunakan:

```text
#17586F
#22949E
#FFCC31
```

sebagai identitas utama.

Gunakan neutral colors sebagai fondasi.

Gunakan yellow sebagai accent.

Gunakan status colors hanya ketika memiliki makna.

Prioritaskan usability daripada dekorasi.

**Branding sekolah harus terasa konsisten dari flyer → kartu siswa → dashboard → scanner → laporan → halaman login.**
