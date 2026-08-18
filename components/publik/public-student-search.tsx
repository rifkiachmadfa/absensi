"use client";

// components/publik/public-student-search.tsx
//
// Pencarian siswa di halaman publik "/". Orang tua mengetik nama atau
// NIS/NISN anaknya, memilih hasil, lalu diarahkan ke halaman kehadiran
// bulanan (read-only) di /cek-kehadiran/[id]. Tidak ada aksi apapun selain
// navigasi.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

type PublicStudentResult = { id: string; name: string; className: string };

const DEBOUNCE_MS = 300;

export function PublicStudentSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicStudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/publik/cari-siswa?q=${encodeURIComponent(q)}`);
      const data: { students: PublicStudentResult[] } = await res.json();
      setResults(data.students ?? []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-[#DCE7E9] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF7F8] text-[#17586F]">
          <Search className="size-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold text-[#17313A]">
            Cek Kehadiran Siswa
          </h2>
          <p className="mt-0.5 text-[13px] text-[#71858C]">
            Cari berdasarkan nama atau NIS/NISN untuk melihat rekap kehadiran
            bulanan.
          </p>
        </div>
      </div>

      <div className="relative mt-3.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#71858C]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik nama atau NIS/NISN siswa..."
          className="h-12 rounded-[10px] border-[#DCE7E9] pl-9 text-[15px] focus-visible:border-[#22949E] focus-visible:ring-[#22949E]/20"
          aria-label="Cari siswa"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#71858C]" />
        )}
      </div>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="mt-2 text-xs text-[#71858C]">
          Ketik minimal 2 karakter.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-[#DCE7E9] overflow-hidden rounded-[10px] border border-[#DCE7E9]">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => router.push(`/cek-kehadiran/${s.id}`)}
                className="flex w-full items-center gap-3 bg-white px-3 py-2.5 text-left transition-colors hover:bg-[#F8FAFA]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EAF7F8] text-[11px] font-semibold text-[#17586F]">
                  {s.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#17313A]">
                    {s.name}
                  </span>
                  <span className="block truncate text-xs text-[#71858C]">
                    {s.className}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[#71858C]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && hasSearched && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-3 text-center text-sm text-[#71858C]">
          Siswa tidak ditemukan.
        </p>
      )}
    </div>
  );
}