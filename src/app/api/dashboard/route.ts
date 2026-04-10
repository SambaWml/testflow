import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [itemCount, caseCount, executionCount, executions, recentReports] = await Promise.all([
    prisma.item.count(),
    prisma.testCase.count({ where: { isActive: true } }),
    prisma.execution.count(),
    prisma.execution.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        case: { select: { title: true } },
        executor: { select: { name: true } },
      },
    }),
    prisma.report.findMany({
      orderBy: { generatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, environment: true, generatedAt: true, metadata: true },
    }),
  ]);

  // status distribution
  const statusCounts: Record<string, number> = {};
  executions.forEach((ex) => {
    statusCounts[ex.status] = (statusCounts[ex.status] ?? 0) + 1;
  });

  const allExecForRate = await prisma.execution.findMany({ select: { status: true } });
  const pass = allExecForRate.filter((e) => e.status === "PASS").length;
  const totalExec = allExecForRate.filter((e) => e.status !== "NOT_EXECUTED" && e.status !== "SKIPPED").length;
  const passRate = totalExec > 0 ? Math.round((pass / totalExec) * 100) : 0;

  const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  return NextResponse.json({
    stats: { items: itemCount, cases: caseCount, executions: executionCount, passRate },
    statusDistribution,
    recentExecutions: executions.slice(0, 5),
    recentReports,
  });
}
