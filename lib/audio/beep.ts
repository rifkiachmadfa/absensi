// lib/audio/beep.ts
"use client";

// Beep pendek (Web Audio API, TANPA file audio eksternal) yang dimainkan
// begitu satu scan MULAI diproses -- feedback suara opsional sesuai
// UX Scanner (Section 29 spesifikasi project: "Berikan feedback: visual,
// suara opsional, status berhasil/gagal").
//
// Satu AudioContext dipakai ulang (bukan dibuat baru tiap scan) supaya
// tidak ada delay/glitch saat burst scan berurutan (Section 38: burst
// request saat jam masuk sekolah).

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextCtor();
  }
  return audioCtx;
}

// Dipanggil tepat saat sebuah scan mulai dikirim ke server (bukan saat
// hasilnya datang) -- guru langsung dapat konfirmasi suara bahwa kartu
// terbaca, walau hasil akhirnya (berhasil/sudah absen/dsb) baru menyusul
// lewat toast + ScanQueuePanel.
//
// Karakter suara dibuat menyerupai scanner barcode/QR fisik pada umumnya
// (mis. Zebra/Symbol/Honeywell): nada tunggal, PENDEK (~80ms), TINGGI
// (~1900Hz), gelombang square (bukan sine) supaya terdengar tajam/elektronik
// -- bukan nada musik yang lembut. Attack nyaris instan (tanpa fade-in)
// supaya terasa "klik" tegas seperti bunyi scanner sungguhan, hanya bagian
// akhir yang di-fade out sangat singkat agar tidak ada bunyi "pop/klik"
// kasar saat berhenti.
export function playScanBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Browser bisa men-suspend AudioContext sampai ada user gesture. Dialog
    // scan hanya bisa dibuka lewat klik tombol, jadi resume() di sini aman
    // dipanggil setiap kali (no-op kalau context sudah "running").
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const duration = 0.08;
    const frequency = 1900;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, now);

    // Attack nyaris instan (khas bunyi scanner elektronik), fade-out sangat
    // singkat di akhir hanya untuk menghindari "klik" kasar saat berhenti.
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + duration - 0.01);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // Audio gagal dimainkan (mis. dibatasi browser) -- bukan error kritis,
    // proses absensi tetap berjalan normal tanpa suara.
  }
}