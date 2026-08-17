// components/kartu-siswa/card-with-preview.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StudentIdCard, type StudentIdCardData } from "./student-id-card";
import { DownloadPdfButton } from "./download-pdf-button";

export function CardWithPreview({
  card,
  schoolName,
}: {
  card: StudentIdCardData;
  schoolName: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Lihat kartu ${card.name}`}
            className="w-full max-w-[400px] cursor-pointer rounded-[18px] text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <StudentIdCard student={card} schoolName={schoolName} />
      </DialogTrigger>

      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <StudentIdCard student={card} schoolName={schoolName} />
        </div>

        <div className="flex justify-center pt-2">
          <DownloadPdfButton
            cards={[card]}
            schoolName={schoolName}
            fileName={`kartu-murid-${card.nis}.pdf`}
            label="Download Kartu Ini"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}