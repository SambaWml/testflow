-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "invitedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT,
    "creatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "environment" TEXT NOT NULL DEFAULT '',
    "buildVersion" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "test_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_plan_cases" (
    "id" TEXT NOT NULL,
    "testPlanId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "test_plan_cases_pkey" PRIMARY KEY ("id")
);

-- Add columns to existing tables (PostgreSQL supports ALTER TABLE ADD COLUMN directly)
ALTER TABLE "executions" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "executions" ADD COLUMN "testPlanId" TEXT;

ALTER TABLE "items" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "projects" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "reports" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "test_cases" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "users" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "test_plans" ADD CONSTRAINT "test_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_plans" ADD CONSTRAINT "test_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "test_plans" ADD CONSTRAINT "test_plans_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "test_plan_cases" ADD CONSTRAINT "test_plan_cases_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "test_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_plan_cases" ADD CONSTRAINT "test_plan_cases_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "test_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "executions" ADD CONSTRAINT "executions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "executions" ADD CONSTRAINT "executions_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "test_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items" ADD CONSTRAINT "items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports" ADD CONSTRAINT "reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "org_members_organizationId_userId_key" ON "org_members"("organizationId", "userId");
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");
CREATE UNIQUE INDEX "test_plan_cases_testPlanId_caseId_key" ON "test_plan_cases"("testPlanId", "caseId");
