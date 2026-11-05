-- AlterTable
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'tokenVersion'
    ) THEN
        ALTER TABLE "users" RENAME COLUMN "tokenVersion" TO "authVersion";
        ALTER TABLE "users" ALTER COLUMN "authVersion" SET DEFAULT 0;
    ELSE
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

