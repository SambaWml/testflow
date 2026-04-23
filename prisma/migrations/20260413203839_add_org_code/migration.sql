-- Add code column to organizations with sequential values starting at 1001
ALTER TABLE "organizations" ADD COLUMN "code" INTEGER NOT NULL DEFAULT 0;

-- Assign sequential codes to existing rows
WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt") + 1000)::INTEGER AS new_code
    FROM "organizations"
)
UPDATE "organizations"
SET "code" = numbered.new_code
FROM numbered
WHERE "organizations"."id" = numbered.id;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");
