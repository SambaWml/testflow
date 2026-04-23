import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser, getProjectsForUser } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  let projectIdFilter: string[] | null = null;
  if (!u.isSuperAdmin && u.orgId && u.orgRole) {
    projectIdFilter = await getProjectsForUser(u.id, u.orgId, u.orgRole);
  }

  const reports = await prisma.report.findMany({
    where: {
      ...(u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {}),
      ...(projectIdFilter !== null ? { projectId: { in: projectIdFilter } } : {}),
    },
    orderBy: { generatedAt: "desc" },
    include: {
      project: { select: { name: true } },
      author: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  return NextResponse.json({ reports });
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const u = sessionUser(session.user);

    const body = await req.json();
    const { testPlanId, title, notes } = body;

    if (!testPlanId) {
      return NextResponse.json({ error: "Selecione um plano de teste" }, { status: 400 });
    }

    const testPlan = await prisma.testPlan.findUnique({
      where: { id: testPlanId },
      include: { executions: { select: { id: true, status: true } } },
    });

    if (!testPlan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }
    // IDOR guard: findUnique doesn't scope by org, so we check explicitly here.
    // Return 404 (not 403) to avoid confirming that the plan ID exists in another org.
    if (!u.isSuperAdmin && testPlan.organizationId && u.orgId && testPlan.organizationId !== u.orgId) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }
    if (!testPlan.executions.length) {
      return NextResponse.json({ error: "O plano não possui execuções registradas" }, { status: 400 });
    }

    // Snapshot execution stats into JSON metadata at report creation time.
    // This ensures the report is immutable — later execution changes won't alter past reports.
    const counts: Record<string, number> = {};
    testPlan.executions.forEach((ex) => { counts[ex.status] = (counts[ex.status] ?? 0) + 1; });
    const total = testPlan.executions.length;
    const pass = counts.PASS ?? 0;
    // Pass rate excludes NOT_EXECUTED and SKIPPED so it reflects only what was actually run.
    const executed = total - (counts.NOT_EXECUTED ?? 0) - (counts.SKIPPED ?? 0);
    const passRate = executed > 0 ? Math.round((pass / executed) * 100) : 0;

    const metadata = JSON.stringify({ counts, total, passRate, testPlanId, testPlanName: testPlan.name });

    const report = await prisma.report.create({
      data: {
        title: (title?.trim()) || testPlan.name,
        projectId: testPlan.projectId,
        authorId: u.id,
        organizationId: testPlan.organizationId ?? u.orgId ?? null,
        environment: testPlan.environment || null,
        buildVersion: testPlan.buildVersion || null,
        notes: notes?.trim() || testPlan.notes || null,
        metadata,
        items: {
          create: testPlan.executions.map((ex, i) => ({ executionId: ex.id, order: i })),
        },
      },
      include: {
        project: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reports]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
