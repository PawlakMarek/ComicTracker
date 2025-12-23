ALTER TABLE "CharacterOrTeam" ADD COLUMN IF NOT EXISTS "realName" TEXT;

ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "issueNumberSort" DOUBLE PRECISION;

UPDATE "Issue"
SET "issueNumberSort" = NULLIF(
  regexp_replace(regexp_replace("issueNumber", '[^0-9.]', '', 'g'), '\.(?=.*\.)', '', 'g'),
  ''
)::DOUBLE PRECISION
WHERE "issueNumberSort" IS NULL;

CREATE TABLE IF NOT EXISTS "CharacterTeam" (
  "characterId" UUID NOT NULL,
  "teamId" UUID NOT NULL
);

ALTER TABLE "CharacterTeam" DROP CONSTRAINT IF EXISTS "CharacterTeam_characterId_fkey";
ALTER TABLE "CharacterTeam" DROP CONSTRAINT IF EXISTS "CharacterTeam_teamId_fkey";
ALTER TABLE "CharacterTeam" DROP CONSTRAINT IF EXISTS "CharacterTeam_pkey";

ALTER TABLE "CharacterTeam"
  ALTER COLUMN "characterId" TYPE UUID USING "characterId"::uuid;

ALTER TABLE "CharacterTeam"
  ALTER COLUMN "teamId" TYPE UUID USING "teamId"::uuid;

ALTER TABLE "CharacterTeam"
  ADD CONSTRAINT "CharacterTeam_pkey" PRIMARY KEY ("characterId", "teamId");

ALTER TABLE "CharacterTeam"
  ADD CONSTRAINT "CharacterTeam_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "CharacterOrTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterTeam"
  ADD CONSTRAINT "CharacterTeam_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "CharacterOrTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
