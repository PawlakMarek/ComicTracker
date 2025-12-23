ALTER TABLE "StoryBlock" ADD COLUMN IF NOT EXISTS "publisherId" UUID;

UPDATE "StoryBlock" sb
SET "publisherId" = s."publisherId"
FROM "StoryBlockSeries" sbs
JOIN "Series" s ON sbs."seriesId" = s.id
WHERE sbs."storyBlockId" = sb.id
  AND sb."publisherId" IS NULL;

UPDATE "StoryBlock" sb
SET "publisherId" = e."publisherId"
FROM "Event" e
WHERE sb."eventId" = e.id
  AND sb."publisherId" IS NULL;

ALTER TABLE "StoryBlock" DROP CONSTRAINT IF EXISTS "StoryBlock_publisherId_fkey";

ALTER TABLE "StoryBlock"
  ALTER COLUMN "publisherId" TYPE UUID USING "publisherId"::uuid;

ALTER TABLE "StoryBlock"
  ADD CONSTRAINT "StoryBlock_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
