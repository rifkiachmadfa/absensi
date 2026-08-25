// app/login/page.tsx
//
// Gerbang masuk untuk Admin/Guru/Wali Kelas. Bahasa visual disamakan dengan
// halaman publik ("/" dan "/cek-kehadiran/[id]"): hero gradient brand
// (#17586F -> #22949E, UI_RULES §8) dengan aksen blur dekoratif, lalu kartu
// putih rounded yang overlap ke hero -- pola yang sama persis dipakai di
// PublicStudentProfileCard supaya seluruh halaman publik & gerbang login
// terasa satu keluarga desain, bukan halaman generik terpisah.
"use client";

import { use, useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
} from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SCHOOL_LOGO_URL } from "@/lib/kartu-siswa/constants";

const initialState: LoginState = {};

export default function LoginPage({
  searchParams,
}: {
  // Next.js 15/16: searchParams SELALU berupa Promise, termasuk saat
  // di-pass ke Client Component seperti page.tsx ini -- bukan objek biasa.
  // Diakses langsung (searchParams.notice) akan lolos secara diam-diam di
  // beberapa kasus tapi memicu warning "must be unwrapped with React.use()"
  // dan nilainya tidak pernah terbaca benar. use() di sini yang benar,
  // BUKAN useState/useEffect, karena use() bisa membaca Promise yang
  // dikirim sebagai prop dari boundary Server Component tanpa render tambahan.
  searchParams: Promise<{ notice?: string }>;
}) {
  const resolvedSearchParams = use(searchParams);
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState
  );
  const [showPassword, setShowPassword] = useState(false);

  // Muncul kalau user datang dari /api/auth/session-repair (lihat
  // lib/auth/session.ts: requireAuth) -- sesi lama sudah otomatis
  // di-sign-out karena akunnya tidak/tidak lagi terdaftar aktif di
  // sistem, supaya user tidak bingung tiba-tiba dilempar ke sini.
  const sessionExpiredNotice = resolvedSearchParams?.notice === "session-expired";

  return (
    <div className="min-h-screen bg-[#F8FAFA]">
      {/* Hero band -- identik dengan pola di app/page.tsx (root publik) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#17586F] to-[#1C7F88]">
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-10 bottom-0 size-56 rounded-full bg-[#FFCC31]/10 blur-2xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-5 lg:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-[8px] py-1 text-[13px] font-medium text-white/80 transition-colors hover:text-white"
          >
            <ChevronLeft className="size-4" />
            Kembali ke Beranda
          </Link>
        </div>
        {/* Spacer -- tinggi band cukup untuk ditumpangi kartu login */}
        <div className="h-36 sm:h-28" />
      </section>

      <main className="relative mx-auto -mt-24 max-w-sm px-4 pb-10 sm:-mt-20">
        <div className="overflow-hidden rounded-[18px] border border-[#DCE7E9] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1)] sm:p-8">
          {/* Logo -- di atas title, sesuai permintaan */}
          <div className="flex flex-col items-center text-center">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
              <Image
                src={SCHOOL_LOGO_URL}
                alt="Logo SMK Yadika"
                width={56}
                height={56}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="mt-4 text-[22px] font-bold tracking-tight text-[#17313A]">
              Sistem Absensi Siswa
            </h1>
            <p className="mt-1 text-[13px] text-[#71858C]">
              Masuk untuk melanjutkan ke dashboard
            </p>
          </div>

          {sessionExpiredNotice && (
            <div className="mt-6 flex items-start gap-2 rounded-[10px] border border-[#DCE7E9] bg-[#F1F5F5] p-3 text-[13px] text-[#48616A]">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#71858C]" />
              <span>Sesi Anda telah berakhir. Silakan masuk kembali.</span>
            </div>
          )}

          <form action={formAction} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[#48616A]">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@smkyadikasumedang.sch.id"
                  required
                  className="h-11 rounded-[10px] border-[#DCE7E9] pl-9 focus-visible:border-[#22949E] focus-visible:ring-[#22949E]/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[#48616A]">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="h-11 rounded-[10px] border-[#DCE7E9] pl-9 pr-9 focus-visible:border-[#22949E] focus-visible:ring-[#22949E]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] transition-colors hover:text-[#48616A]"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {state.error && (
              <div className="flex items-start gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-[13px] text-[#DC2626]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full gap-1.5 rounded-[10px] bg-[#22949E] text-white hover:bg-[#1C7F88]"
            >
              {isPending ? (
                <Spinner />
              ) : (
                <LogIn className="size-4" />
              )}
              {isPending ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-[#71858C]">
          SMK Yadika Tanjungsari Sumedang &bull; Sistem Absensi Siswa
        </p>
      </main>
    </div>
  );
}