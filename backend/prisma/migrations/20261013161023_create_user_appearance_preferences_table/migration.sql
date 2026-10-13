-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "user_appearance_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "ThemeMode" NOT NULL DEFAULT 'DARK',
    "accentHex" TEXT NOT NULL DEFAULT '#4F46E5',
    "favorites" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_appearance_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_appearance_preferences_userId_key" ON "user_appearance_preferences"("userId");

-- AddForeignKey
ALTER TABLE "user_appearance_preferences" ADD CONSTRAINT "user_appearance_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
