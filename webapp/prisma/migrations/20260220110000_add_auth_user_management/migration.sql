-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "session_token" TEXT,
  ADD COLUMN "session_expires_at" TIMESTAMP(3);

-- Backfill existing users
UPDATE "users"
SET "password_hash" = 'CHANGE_ME_WITH_RESET';

-- Enforce not null after backfill
ALTER TABLE "users"
  ALTER COLUMN "password_hash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_session_token_key" ON "users"("session_token");
