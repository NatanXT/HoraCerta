-- AlterTable
ALTER TABLE "work_days" ADD COLUMN     "expectedMinutesSnapshot" INTEGER;

-- CreateTable
CREATE TABLE "bank_hours_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "initialBalanceMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_hours_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_hours_configs_userId_key" ON "bank_hours_configs"("userId");

-- AddForeignKey
ALTER TABLE "bank_hours_configs" ADD CONSTRAINT "bank_hours_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
