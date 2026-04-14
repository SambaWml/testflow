-- AlterTable: dashboard feature flags
ALTER TABLE "organizations" ADD COLUMN "overviewEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN "qaDashboardEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN "qaDashboardName" TEXT NOT NULL DEFAULT 'Dashboard QA';
