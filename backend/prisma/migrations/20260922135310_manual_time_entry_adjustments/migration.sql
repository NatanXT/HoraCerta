-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('CLOCK', 'MANUAL');

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "source" "TimeEntrySource" NOT NULL DEFAULT 'CLOCK';

-- CreateTable
CREATE TABLE "work_day_adjustments" (
    "id" TEXT NOT NULL,
    "workDayId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeEntries" JSONB NOT NULL,
    "afterEntries" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_day_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_day_adjustments_workDayId_createdAt_idx" ON "work_day_adjustments"("workDayId", "createdAt");

-- AddForeignKey
ALTER TABLE "work_day_adjustments" ADD CONSTRAINT "work_day_adjustments_workDayId_fkey" FOREIGN KEY ("workDayId") REFERENCES "work_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
