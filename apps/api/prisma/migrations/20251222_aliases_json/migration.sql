DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'CharacterOrTeam'
      AND table_schema = 'public'
      AND column_name = 'aliases'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "CharacterOrTeam" ADD COLUMN IF NOT EXISTS "aliases_tmp" JSONB;

    UPDATE "CharacterOrTeam"
    SET "aliases_tmp" = CASE
      WHEN "aliases" IS NULL OR trim("aliases") = '' THEN NULL
      ELSE to_jsonb(
        array_remove(
          regexp_split_to_array(
            regexp_replace(
              regexp_replace(trim("aliases"), '<br\\s*/?>', E'\\n', 'gi'),
              E'\\r',
              E'\\n',
              'g'
            ),
            '\\s*[,;\\n]+\\s*'
          ),
          ''
        )
      )
    END;

    ALTER TABLE "CharacterOrTeam" DROP COLUMN "aliases";
    ALTER TABLE "CharacterOrTeam" RENAME COLUMN "aliases_tmp" TO "aliases";
  END IF;
END $$;
