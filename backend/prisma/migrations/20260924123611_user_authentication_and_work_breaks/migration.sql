-- CreateEnum
CREATE TYPE "WorkBreakType" AS ENUM ('SNACK', 'LUNCH');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "work_schedules" ADD COLUMN     "lunchBreakMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plannedEndMinutes" INTEGER,
ADD COLUMN     "plannedStartMinutes" INTEGER,
ADD COLUMN     "snackBreakMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "work_breaks" (
    "id" TEXT NOT NULL,
    "workDayId" TEXT NOT NULL,
    "type" "WorkBreakType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_breaks_workDayId_startedAt_idx" ON "work_breaks"("workDayId", "startedAt");

-- AddForeignKey
ALTER TABLE "work_breaks" ADD CONSTRAINT "work_breaks_workDayId_fkey" FOREIGN KEY ("workDayId") REFERENCES "work_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
