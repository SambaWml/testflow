-- Add code column with temporary default, then assign sequential values to existing rows

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

INSERT INTO "new_organizations" ("id", "code", "name", "slug", "logoUrl", "plan", "isActive", "createdAt", "updatedAt")
SELECT
    "id",
    (ROW_NUMBER() OVER (ORDER BY "createdAt") + 1000) AS "code",
    "name", "slug", "logoUrl", "plan", "isActive", "createdAt", "updatedAt"
FROM "organizations";

DROP TABLE "organizations";
ALTER TABLE "new_organizations" RENAME TO "organizations";
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
