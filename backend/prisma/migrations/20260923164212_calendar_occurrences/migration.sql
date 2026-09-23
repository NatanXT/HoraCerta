-- CreateEnum
CREATE TYPE "CalendarOccurrenceType" AS ENUM ('HOLIDAY', 'VACATION', 'MEDICAL_LEAVE', 'JUSTIFIED_ABSENCE', 'EXCEPTIONAL_DAY_OFF');

-- CreateTable
CREATE TABLE "calendar_occurrences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CalendarOccurrenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_occurrences_userId_startDate_endDate_idx" ON "calendar_occurrences"("userId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "calendar_occurrences" ADD CONSTRAINT "calendar_occurrences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
