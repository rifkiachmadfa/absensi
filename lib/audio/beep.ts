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
    const duration = 0.12;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);

    // Envelope naik-turun singkat supaya tidak ada bunyi "klik" di awal/akhir.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
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