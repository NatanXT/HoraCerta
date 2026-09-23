-- DropIndex
DROP INDEX "work_schedules_userId_weekday_key";

-- AlterTable
ALTER TABLE "work_schedules" ADD COLUMN     "effectiveFrom" DATE NOT NULL DEFAULT '2000-01-01'::date;

-- CreateIndex
CREATE INDEX "work_schedules_userId_effectiveFrom_idx" ON "work_schedules"("userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_userId_weekday_effectiveFrom_key" ON "work_schedules"("userId", "weekday", "effectiveFrom");
