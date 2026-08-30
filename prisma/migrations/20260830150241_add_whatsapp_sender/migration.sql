-- CreateEnum
CREATE TYPE "WhatsAppSenderStatus" AS ENUM ('PENDING_SCAN', 'CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "WhatsAppSender" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "fonteToken" TEXT NOT NULL,
    "status" "WhatsAppSenderStatus" NOT NULL DEFAULT 'PENDING_SCAN',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppSender_isActive_idx" ON "WhatsAppSender"("isActive");

-- CreateIndex
CREATE INDEX "WhatsAppSender_status_idx" ON "WhatsAppSender"("status");

-- AddForeignKey
ALTER TABLE "WhatsAppSender" ADD CONSTRAINT "WhatsAppSender_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
