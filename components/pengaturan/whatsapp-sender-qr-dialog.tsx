"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createWhatsAppSenderAction,
  regenerateSenderQrAction,
  refreshSenderStatusAction,
  type WhatsAppSenderFormState,
} from "@/app/(protected)/pengaturan/actions";
import type { WhatsAppSenderSummary } from "@/lib/services/pengaturan-service";

// Alur QR (docs/whatsapp-blast.md Section 45.3.1):
//   Tambah Nomor -> input label/nomor -> QR ditampilkan -> polling status
//   -> begitu Fonnte melapor "connect", sender OTOMATIS diaktifkan.
// Komponen ini juga dipakai untuk "Scan Ulang" (Section 45.3.2) pada
// sender PENDING_SCAN/DISCONNECTED yang sudah ada -- lewat prop `sender`,
// langsung lompat ke tampilan QR tanpa form label/nomor.

const POLL_INTERVAL_MS = 3000;

const initialFormState: WhatsAppSenderFormState = {};

type Step = "form" | "qr" | "connected";

type Props =
  | { mode: "create" }
  | { mode: "regenerate"; sender: WhatsAppSenderSummary };

export function WhatsAppSenderQrDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(
    props.mode === "regenerate" ? "qr" : "form"
  );
  const [sender, setSender] = useState<WhatsAppSenderSummary | null>(
    props.mode === "regenerate" ? props.sender : null
  );
  const [qrImageBase64, setQrImageBase64] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | undefined>();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [formState, formAction] = useActionState(
    createWhatsAppSenderAction,
    initialFormState
  );

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hasil submit form "Tambah Nomor" -> pindah ke tampilan QR. Disinkronkan
  // saat render (bukan di useEffect) mengikuti pola "adjusting state when
  // props change" dari React docs, supaya tidak ada render tambahan yang
  // tidak perlu untuk transisi step ini.
  const [handledFormState, setHandledFormState] = useState(formState);
  if (formState !== handledFormState) {
    setHandledFormState(formState);
    if (formState.success && formState.sender) {
      setSender(formState.sender);
      setQrImageBase64(formState.qrImageBase64 ?? null);
      setQrError(formState.qrError);
      setStep("qr");
    }
  }

  const fetchQrForExisting = async (senderId: string) => {
    setIsRegenerating(true);
    const result = await regenerateSenderQrAction(senderId);
    setIsRegenerating(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    setQrImageBase64(result.qrImageBase64 ?? null);
    setQrError(result.qrError);
  };

  // Mode "regenerate": begitu dialog dibuka, langsung ambil QR baru untuk
  // sender yang sudah ada -- tidak ada form label/nomor untuk diisi ulang.
  useEffect(() => {
    if (open && props.mode === "regenerate" && !qrImageBase64 && !qrError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open pattern (React docs); setIsRegenerating/setQrImageBase64 di dalam fetchQrForExisting mencerminkan hasil panggilan server, bukan loop render.
      fetchQrForExisting(props.sender.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Polling status (Section 45.3.1) selagi berada di step "qr".
  useEffect(() => {
    if (step !== "qr" || !open || !sender) {
      return;
    }

    pollRef.current = setInterval(async () => {
      const result = await refreshSenderStatusAction(sender.id);
      if (result.error) {
        // Diamkan -- kegagalan cek status sementara (mis. Fonnte lambat)
        // bukan alasan menghentikan polling atau mengganggu admin.
        return;
      }
      if (result.sender) {
        setSender(result.sender);
        if (result.sender.status === "CONNECTED") {
          setStep("connected");
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // `sender` object identity berubah tiap hasil polling -- sengaja hanya
    // depend pada sender?.id supaya interval tidak dibuat ulang tiap tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open, sender?.id]);

  const resetAndClose = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (props.mode === "create") {
        setStep("form");
        setSender(null);
        setQrImageBase64(null);
        setQrError(undefined);
      } else {
        // Mode regenerate: biarkan siap dipakai lagi lain kali (sender
        // tetap sama, cuma QR image-nya di-reset).
        setQrImageBase64(null);
        setQrError(undefined);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogTrigger
        render={
          props.mode === "create" ? (
            <Button>Tambah Nomor</Button>
          ) : (
            <Button variant="outline" size="sm">
              <RefreshCw />
              Scan Ulang
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "connected"
              ? "Nomor Terhubung"
              : "Tambah Nomor Pengirim WhatsApp"}
          </DialogTitle>
          <DialogDescription>
            {step === "form" &&
              "Nomor WhatsApp sekolah yang akan mengirim notifikasi absensi ke orang tua/wali murid."}
            {step === "qr" &&
              "Buka WhatsApp di HP sekolah, lalu scan QR ini melalui menu Perangkat Tertaut."}
            {step === "connected" &&
              "Nomor ini sekarang aktif sebagai pengirim notifikasi WhatsApp."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-label">Label</Label>
              <Input
                id="wa-label"
                name="label"
                placeholder="mis. Nomor Utama TU"
                required
              />
              {formState.fieldErrors?.label && (
                <p className="text-sm text-destructive">
                  {formState.fieldErrors.label[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-phone">Nomor WhatsApp</Label>
              <Input
                id="wa-phone"
                name="phoneNumber"
                placeholder="08xx, +62xx, atau 62xx"
                required
              />
              {formState.fieldErrors?.phoneNumber && (
                <p className="text-sm text-destructive">
                  {formState.fieldErrors.phoneNumber[0]}
                </p>
              )}
            </div>

            {formState.error && (
              <p className="text-sm text-destructive">{formState.error}</p>
            )}

            <DialogFooter>
              <SubmitButton pendingText="Membuat device...">
                Lanjut &amp; Tampilkan QR
              </SubmitButton>
            </DialogFooter>
          </form>
        )}

        {step === "qr" && (
          <div className="flex flex-col items-center gap-4 py-2">
            {sender && (
              <p className="text-center text-sm text-muted-foreground">
                {sender.label} &middot; {sender.phoneNumber}
              </p>
            )}

            <div className="flex size-56 items-center justify-center rounded-lg border bg-muted/40">
              {isRegenerating ? (
                <Spinner className="size-6" />
              ) : qrImageBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    qrImageBase64.startsWith("http") ||
                    qrImageBase64.startsWith("data:")
                      ? qrImageBase64
                      : `data:image/png;base64,${qrImageBase64}`
                  }
                  alt="QR code WhatsApp"
                  className="size-48 object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
                  <QrCode className="size-8" />
                  {qrError ?? "QR belum tersedia."}
                </div>
              )}
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              Menunggu hasil scan...
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRegenerating || !sender}
              onClick={() => sender && fetchQrForExisting(sender.id)}
            >
              <RefreshCw />
              Generate Ulang QR
            </Button>
          </div>
        )}

        {step === "connected" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <p className="text-sm text-muted-foreground">
              {sender?.label} ({sender?.phoneNumber}) terhubung &amp;
              otomatis diaktifkan sebagai pengirim.
            </p>
            <DialogFooter className="w-full sm:justify-center">
              <Button type="button" onClick={() => resetAndClose(false)}>
                Selesai
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}