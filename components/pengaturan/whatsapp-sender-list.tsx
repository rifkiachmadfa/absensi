"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, Trash2, Unplug } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { WhatsAppSenderQrDialog } from "@/components/pengaturan/whatsapp-sender-qr-dialog";
import {
  disconnectSenderAction,
  deleteSenderAction,
} from "@/app/(protected)/pengaturan/actions";
import type { WhatsAppSenderSummary } from "@/lib/services/pengaturan-service";

// Daftar nomor pengirim WhatsApp (docs/whatsapp-blast.md Section 45.3.2).
// Status koneksi ditampilkan icon+text (bukan cuma warna, UI_RULES Section
// 32/19), dan badge "Aktif" terpisah dari status koneksi karena keduanya
// bermakna berbeda: sender bisa CONNECTED tapi tidak isActive (cadangan).

const STATUS_META: Record<
  WhatsAppSenderSummary["status"],
  { label: string; icon: typeof Clock; className: string }
> = {
  PENDING_SCAN: {
    label: "Menunggu Scan",
    icon: Clock,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  CONNECTED: {
    label: "Terhubung",
    icon: CheckCircle2,
    className:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  DISCONNECTED: {
    label: "Terputus",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function WhatsAppSenderList({
  senders,
}: {
  senders: WhatsAppSenderSummary[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Hanya satu nomor yang dapat aktif mengirim notifikasi pada satu
          waktu.
        </p>
        <WhatsAppSenderQrDialog mode="create" />
      </div>

      {senders.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Belum ada nomor pengirim WhatsApp yang ditambahkan. Notifikasi
          absensi akan di-skip sampai ada nomor yang terhubung &amp; aktif.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Nomor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktif</TableHead>
                <TableHead>Diperbarui</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {senders.map((sender) => (
                <SenderRow key={sender.id} sender={sender} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SenderRow({ sender }: { sender: WhatsAppSenderSummary }) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<
    "disconnect" | "delete" | null
  >(null);

  const meta = STATUS_META[sender.status];
  const StatusIcon = meta.icon;

  const canScanUlang = sender.status !== "CONNECTED";
  const canDisconnect = sender.status === "CONNECTED";
  const canDelete = !sender.isActive;

  const handleDisconnect = () => {
    setPendingAction("disconnect");
    startTransition(async () => {
      const result = await disconnectSenderAction(sender.id);
      setPendingAction(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Nomor ${sender.label} berhasil diputuskan.`);
      }
    });
  };

  const handleDelete = () => {
    setPendingAction("delete");
    startTransition(async () => {
      const result = await deleteSenderAction(sender.id);
      setPendingAction(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Nomor ${sender.label} berhasil dihapus.`);
      }
    });
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{sender.label}</TableCell>
      <TableCell className="whitespace-nowrap">{sender.phoneNumber}</TableCell>
      <TableCell>
        <Badge variant="outline" className={meta.className}>
          <StatusIcon className="size-3" />
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell>
        {sender.isActive ? (
          <Badge>Aktif</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Nonaktif
          </Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatDateTime(sender.updatedAt)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {canScanUlang && (
            <WhatsAppSenderQrDialog mode="regenerate" sender={sender} />
          )}

          {canDisconnect && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleDisconnect}
            >
              {pendingAction === "disconnect" ? <Spinner /> : <Unplug />}
              Putuskan
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canDelete || isPending}
                  title={
                    canDelete
                      ? undefined
                      : "Nonaktifkan atau ganti sender aktif sebelum menghapus nomor ini."
                  }
                  aria-label={`Hapus nomor ${sender.label}`}
                />
              }
            >
              {pendingAction === "delete" ? (
                <Spinner className="size-4" />
              ) : (
                <Trash2 className="size-4 text-destructive" />
              )}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Hapus nomor &quot;{sender.label}&quot;?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Nomor {sender.phoneNumber} akan dihapus dari daftar
                  pengirim. Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction type="button" onClick={handleDelete}>
                  Ya, Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}