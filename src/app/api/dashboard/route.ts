import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser, getProjectsForUser } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  // Filter by org — only show data belonging to the user's organization
  const orgFilter = u.orgId ? { organizationId: u.orgId } : {};

  // OWNER/ADMIN see all org projects (null = no filter); MEMBER sees only linked projects
  const projectIdsRaw = u.orgId
    ? await getProjectsForUser(u.id, u.orgId, u.orgRole ?? "MEMBER")
    : [];

  let projectFilter: object;
  if (projectIdsRaw === null) {
    // OWNER/ADMIN — no project restriction, just scope to org
    projectFilter = {};
  } else {
    projectFilter = { projectId: { in: projectIdsRaw } };
  }

  const baseFilter = { ...orgFilter, ...projectFilter };

  const [itemCount, caseCount, executionCount, recentPlans, recentReports] = await Promise.all([
    prisma.item.count({ where: baseFilter }),
    prisma.testCase.count({ where: { isActive: true, ...baseFilter } }),
    prisma.execution.count({ where: baseFilter }),
    prisma.testPlan.findMany({
      where: baseFilter,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        result: true,
        environment: true,
        createdAt: true,
        startedAt: true,
        project: { select: { name: true } },
        _count: { select: { executions: true } },
        executions: { select: { status: true } },
      },
    }),
    prisma.report.findMany({
      where: { ...orgFilter, ...projectFilter },
      orderBy: { generatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, environment: true, generatedAt: true, metadata: true },
    }),
  ]);

  const allExec = await prisma.execution.findMany({ where: baseFilter, select: { status: true } });
  const statusCounts: Record<string, number> = {};
  allExec.forEach((ex) => { statusCounts[ex.status] = (statusCounts[ex.status] ?? 0) + 1; });

  const pass = allExec.filter((e) => e.status === "PASS").length;
  const totalExec = allExec.filter((e) => e.status !== "NOT_EXECUTED" && e.status !== "SKIPPED").length;
  const passRate = totalExec > 0 ? Math.round((pass / totalExec) * 100) : 0;

  const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const recentPlansWithRate = recentPlans.map((plan) => {
    const total = plan.executions.length;
    const planPass = plan.executions.filter((e) => e.status === "PASS").length;
    const planExecuted = plan.executions.filter((e) => e.status !== "NOT_EXECUTED" && e.status !== "SKIPPED").length;
    const planPassRate = planExecuted > 0 ? Math.round((planPass / planExecuted) * 100) : null;
    return {
      id: plan.id,
      name: plan.name,
      status: plan.status,
      result: plan.result,
      environment: plan.environment,
      createdAt: plan.createdAt,
      startedAt: plan.startedAt,
      project: plan.project,
      totalCases: total,
      passRate: planPassRate,
    };
  });

  return NextResponse.json({
    stats: { items: itemCount, cases: caseCount, executions: executionCount, passRate },
    statusDistribution,
    recentPlans: recentPlansWithRate,
    recentReports,
  });
}
