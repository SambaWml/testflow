-- Remove the temporary DEFAULT 0 from code column now that all rows have real values
ALTER TABLE "organizations" ALTER COLUMN "code" DROP DEFAULT;
