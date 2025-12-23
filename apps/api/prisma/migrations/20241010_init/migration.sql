CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "SeriesType" AS ENUM ('ONGOING', 'LIMITED', 'ONE_SHOT', 'SPECIAL', 'DIGITAL');
CREATE TYPE "CharacterType" AS ENUM ('CHARACTER', 'TEAM');
CREATE TYPE "TrackingPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');
CREATE TYPE "StoryBlockType" AS ENUM ('ARC', 'RUN', 'EVENT', 'TIE_IN_GROUP', 'OTHER');
CREATE TYPE "StoryBlockImportance" AS ENUM ('CORE', 'SIDE', 'DEEP_CUT');
CREATE TYPE "SyncLevel" AS ENUM ('ISOLATED_0', 'LIGHT_OVERLAP_1', 'MAJOR_EVENT_2');
CREATE TYPE "StoryBlockStatus" AS ENUM ('NOT_STARTED', 'READING', 'FINISHED', 'SKIPPED');
CREATE TYPE "IssueStatus" AS ENUM ('UNREAD', 'READING', 'FINISHED', 'SKIPPED');
CREATE TYPE "FatigueLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Publisher" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Publisher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Publisher_userId_name_key" ON "Publisher"("userId", "name");

CREATE TABLE "Series" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "publisherId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "startYear" INTEGER NOT NULL,
  "endYear" INTEGER,
  "era" TEXT,
  "type" "SeriesType" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Series_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Series_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Series_userId_name_key" ON "Series"("userId", "name");

CREATE TABLE "CharacterOrTeam" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "publisherId" UUID,
  "name" TEXT NOT NULL,
  "type" "CharacterType" NOT NULL,
  "aliases" TEXT,
  "continuity" TEXT,
  "majorStatusQuoNotes" TEXT,
  "currentTrackingPriority" "TrackingPriority" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CharacterOrTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "CharacterOrTeam_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id")
);

CREATE UNIQUE INDEX "CharacterOrTeam_userId_name_type_key" ON "CharacterOrTeam"("userId", "name", "type");

CREATE TABLE "Event" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "publisherId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "startYear" INTEGER NOT NULL,
  "endYear" INTEGER,
  "sequenceOrder" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Event_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Event_userId_name_key" ON "Event"("userId", "name");

CREATE TABLE "StoryBlock" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "StoryBlockType" NOT NULL,
  "era" TEXT,
  "startYear" INTEGER NOT NULL,
  "endYear" INTEGER,
  "importance" "StoryBlockImportance" NOT NULL,
  "syncLevel" "SyncLevel" NOT NULL,
  "eventId" UUID,
  "orderIndex" INTEGER NOT NULL,
  "status" "StoryBlockStatus" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoryBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "StoryBlock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id")
);

CREATE UNIQUE INDEX "StoryBlock_userId_name_key" ON "StoryBlock"("userId", "name");

CREATE TABLE "Issue" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "seriesId" UUID NOT NULL,
  "issueNumber" TEXT NOT NULL,
  "title" TEXT,
  "releaseDate" TIMESTAMPTZ,
  "readingOrderIndex" INTEGER,
  "status" "IssueStatus" NOT NULL,
  "readDate" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Issue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Issue_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Issue_userId_seriesId_issueNumber_key" ON "Issue"("userId", "seriesId", "issueNumber");

CREATE TABLE "ReadingSession" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "sessionDate" TIMESTAMPTZ NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "fatigueLevel" "FatigueLevel" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ReadingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "StoryBlockSeries" (
  "storyBlockId" UUID NOT NULL,
  "seriesId" UUID NOT NULL,
  CONSTRAINT "StoryBlockSeries_storyBlockId_fkey" FOREIGN KEY ("storyBlockId") REFERENCES "StoryBlock"("id") ON DELETE CASCADE,
  CONSTRAINT "StoryBlockSeries_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE,
  PRIMARY KEY ("storyBlockId", "seriesId")
);

CREATE TABLE "StoryBlockIssue" (
  "storyBlockId" UUID NOT NULL,
  "issueId" UUID NOT NULL,
  CONSTRAINT "StoryBlockIssue_storyBlockId_fkey" FOREIGN KEY ("storyBlockId") REFERENCES "StoryBlock"("id") ON DELETE CASCADE,
  CONSTRAINT "StoryBlockIssue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE,
  PRIMARY KEY ("storyBlockId", "issueId")
);

CREATE TABLE "StoryBlockCharacter" (
  "storyBlockId" UUID NOT NULL,
  "characterOrTeamId" UUID NOT NULL,
  CONSTRAINT "StoryBlockCharacter_storyBlockId_fkey" FOREIGN KEY ("storyBlockId") REFERENCES "StoryBlock"("id") ON DELETE CASCADE,
  CONSTRAINT "StoryBlockCharacter_characterOrTeamId_fkey" FOREIGN KEY ("characterOrTeamId") REFERENCES "CharacterOrTeam"("id") ON DELETE CASCADE,
  PRIMARY KEY ("storyBlockId", "characterOrTeamId")
);

CREATE TABLE "IssueCharacter" (
  "issueId" UUID NOT NULL,
  "characterOrTeamId" UUID NOT NULL,
  CONSTRAINT "IssueCharacter_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE,
  CONSTRAINT "IssueCharacter_characterOrTeamId_fkey" FOREIGN KEY ("characterOrTeamId") REFERENCES "CharacterOrTeam"("id") ON DELETE CASCADE,
  PRIMARY KEY ("issueId", "characterOrTeamId")
);

CREATE TABLE "IssueEvent" (
  "issueId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  CONSTRAINT "IssueEvent_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE,
  CONSTRAINT "IssueEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE,
  PRIMARY KEY ("issueId", "eventId")
);

CREATE TABLE "ReadingSessionIssue" (
  "readingSessionId" UUID NOT NULL,
  "issueId" UUID NOT NULL,
  CONSTRAINT "ReadingSessionIssue_readingSessionId_fkey" FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id") ON DELETE CASCADE,
  CONSTRAINT "ReadingSessionIssue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE,
  PRIMARY KEY ("readingSessionId", "issueId")
);
