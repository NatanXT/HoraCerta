-- AlterEnum
ALTER TYPE "CalendarOccurrenceType" ADD VALUE 'BANK_HOURS_LEAVE';

-- AlterTable
ALTER TABLE "work_breaks" ADD COLUMN     "autoResumeAt" TIMESTAMP(3),
ADD COLUMN     "plannedDurationMinutes" INTEGER,
ADD COLUMN     "resumedAutomatically" BOOLEAN NOT NULL DEFAULT false;
