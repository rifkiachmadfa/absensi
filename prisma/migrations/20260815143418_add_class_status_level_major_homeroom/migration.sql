-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "homeroomTeacherId" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "major" TEXT,
ADD COLUMN     "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Class_status_idx" ON "Class"("status");

-- CreateIndex
CREATE INDEX "Class_homeroomTeacherId_idx" ON "Class"("homeroomTeacherId");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_homeroomTeacherId_fkey" FOREIGN KEY ("homeroomTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
