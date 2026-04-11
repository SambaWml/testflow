import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [itemCount, caseCount, executionCount, recentPlans, recentReports] = await Promise.all([
    prisma.item.count(),
    prisma.testCase.count({ where: { isActive: true } }),
    prisma.execution.count(),
    prisma.testPlan.findMany({
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
      orderBy: { generatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, environment: true, generatedAt: true, metadata: true },
    }),
  ]);

  // status distribution from all executions
  const allExec = await prisma.execution.findMany({ select: { status: true } });
  const statusCounts: Record<string, number> = {};
  allExec.forEach((ex) => { statusCounts[ex.status] = (statusCounts[ex.status] ?? 0) + 1; });

  const pass = allExec.filter((e) => e.status === "PASS").length;
  const totalExec = allExec.filter((e) => e.status !== "NOT_EXECUTED" && e.status !== "SKIPPED").length;
  const passRate = totalExec > 0 ? Math.round((pass / totalExec) * 100) : 0;

  const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Compute pass rate per plan
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
