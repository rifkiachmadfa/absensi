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
            className="cursor-pointer rounded-lg text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <StudentIdCard student={card} schoolName={schoolName} />
      </DialogTrigger>

      <DialogContent className="max-w-fit">
        <DialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center overflow-x-auto py-6">
          <div className="scale-150">
            <StudentIdCard student={card} schoolName={schoolName} />
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <DownloadPdfButton
            cards={[card]}
            schoolName={schoolName}
            fileName={`kartu-siswa-${card.nis}.pdf`}
            label="Download Kartu Ini"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}