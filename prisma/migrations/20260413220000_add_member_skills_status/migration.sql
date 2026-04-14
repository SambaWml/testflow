-- AlterTable
ALTER TABLE "org_members" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "org_members" ADD COLUMN "skills" TEXT NOT NULL DEFAULT '[]';
