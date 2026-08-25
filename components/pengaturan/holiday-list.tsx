import { Trash2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { deleteHolidayAction } from "@/app/(protected)/pengaturan/actions";

type Holiday = {
  id: string;
  date: Date;
  name: string;
};

function formatHolidayDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function HolidayList({ holidays }: { holidays: Holiday[] }) {
  if (holidays.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Belum ada hari libur yang diatur. Hari Sabtu &amp; Minggu tetap
        otomatis dianggap libur tanpa perlu ditambahkan di sini.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead className="w-[1%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {holidays.map((holiday) => (
            <TableRow key={holiday.id}>
              <TableCell className="whitespace-nowrap">
                {formatHolidayDate(holiday.date)}
              </TableCell>
              <TableCell>{holiday.name}</TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus hari libur ${holiday.name}`}
                      />
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Hapus hari libur &quot;{holiday.name}&quot;?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tanggal {formatHolidayDate(holiday.date)} akan kembali
                        dihitung sebagai hari sekolah biasa. Tindakan ini
                        tidak dapat dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <form action={deleteHolidayAction.bind(null, holiday.id)}>
                        <AlertDialogAction type="submit">
                          Ya, Hapus
                        </AlertDialogAction>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
