// components/absensi/live-log/types.ts

export type LiveLogMode = "masuk" | "pulang";
export type LiveLogStatus = "pending" | "success" | "warning" | "error";

// Satu baris di tab "Log Live". `id` dipakai sebagai React key DAN
// sebagai kunci pencocokan event broadcast: baris dari event "identified"
// (id = scanId) di-patch oleh event "result" berikutnya yang scanId-nya
// SAMA -- lihat use-live-scan-log.ts. Baris hasil seed awal
// (getInitialLiveLog) memakai id sintetis ("seed-...") yang sengaja tidak
// pernah cocok dengan scanId manapun.
export type LiveLogRow = {
  id: string;
  mode: LiveLogMode;
  name: string | null;
  className: string | null;
  status: LiveLogStatus;
  label: string;
  detail?: string;
  identified: boolean;
  ts: string;
};