ALTER TABLE "Series"
  ALTER COLUMN "era" TYPE TEXT[] USING (
    CASE
      WHEN "era" IS NULL OR btrim("era") = '' THEN ARRAY[]::TEXT[]
      ELSE ARRAY["era"]::TEXT[]
    END
  );

ALTER TABLE "Series"
  ALTER COLUMN "era" SET DEFAULT '{}',
  ALTER COLUMN "era" SET NOT NULL;

ALTER TABLE "Series" DROP COLUMN "chronology";
