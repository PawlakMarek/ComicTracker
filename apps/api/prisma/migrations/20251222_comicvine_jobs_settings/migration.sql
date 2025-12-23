CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'COMPLETED');
CREATE TYPE "JobType" AS ENUM ('COMICVINE_IMPORT');

ALTER TABLE "Publisher" ADD COLUMN "comicVineId" INTEGER;
ALTER TABLE "Series" ADD COLUMN "comicVineId" INTEGER;
ALTER TABLE "CharacterOrTeam" ADD COLUMN "comicVineId" INTEGER;
ALTER TABLE "Issue" ADD COLUMN "comicVineId" INTEGER;

CREATE UNIQUE INDEX "Publisher_userId_comicVineId_key" ON "Publisher"("userId", "comicVineId");
CREATE UNIQUE INDEX "Series_userId_comicVineId_key" ON "Series"("userId", "comicVineId");
CREATE UNIQUE INDEX "CharacterOrTeam_userId_comicVineId_key" ON "CharacterOrTeam"("userId", "comicVineId");
CREATE UNIQUE INDEX "Issue_userId_comicVineId_key" ON "Issue"("userId", "comicVineId");

CREATE TABLE "UserSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE,
  "comicVineApiKey" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "Job" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "JobType" NOT NULL,
  "status" "JobStatus" NOT NULL,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
