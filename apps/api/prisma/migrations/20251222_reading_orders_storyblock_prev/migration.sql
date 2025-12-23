ALTER TABLE "StoryBlock" ADD COLUMN "previousStoryBlockId" UUID;

ALTER TABLE "StoryBlock"
  ADD CONSTRAINT "StoryBlock_previousStoryBlockId_fkey"
  FOREIGN KEY ("previousStoryBlockId") REFERENCES "StoryBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReadingOrder" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ReadingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ReadingOrder_userId_name_key" ON "ReadingOrder"("userId", "name");

CREATE TABLE "ReadingOrderItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "readingOrderId" UUID NOT NULL,
  "storyBlockId" UUID NOT NULL,
  "orderIndex" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ReadingOrderItem_readingOrderId_fkey" FOREIGN KEY ("readingOrderId") REFERENCES "ReadingOrder"("id") ON DELETE CASCADE,
  CONSTRAINT "ReadingOrderItem_storyBlockId_fkey" FOREIGN KEY ("storyBlockId") REFERENCES "StoryBlock"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ReadingOrderItem_readingOrderId_storyBlockId_key"
  ON "ReadingOrderItem"("readingOrderId", "storyBlockId");

CREATE INDEX "ReadingOrderItem_readingOrderId_orderIndex_idx"
  ON "ReadingOrderItem"("readingOrderId", "orderIndex");
