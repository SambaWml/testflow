import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-id";

export async function GET() {
  const reports = await prisma.report.findMany({
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
    const body = await req.json();
    const { testPlanId, title, notes } = body;

    if (!testPlanId) {
      return NextResponse.json({ error: "Selecione um plano de teste" }, { status: 400 });
    }

    const testPlan = await prisma.testPlan.findUnique({
      where: { id: testPlanId },
      include: {
        executions: { select: { id: true, status: true } },
      },
    });

    if (!testPlan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    if (!testPlan.executions.length) {
      return NextResponse.json({ error: "O plano não possui execuções registradas" }, { status: 400 });
    }

    // Compute stats
    const counts: Record<string, number> = {};
    testPlan.executions.forEach((ex) => {
      counts[ex.status] = (counts[ex.status] ?? 0) + 1;
    });
    const total = testPlan.executions.length;
    const pass = counts.PASS ?? 0;
    const executed = total - (counts.NOT_EXECUTED ?? 0) - (counts.SKIPPED ?? 0);
    const passRate = executed > 0 ? Math.round((pass / executed) * 100) : 0;

    const metadata = JSON.stringify({
      counts, total, passRate,
      testPlanId, testPlanName: testPlan.name,
    });

    await ensureDemoUser();

    const report = await prisma.report.create({
      data: {
        title: (title?.trim()) || testPlan.name,
        projectId: testPlan.projectId,
        authorId: DEMO_USER_ID,
        environment: testPlan.environment || null,
        buildVersion: testPlan.buildVersion || null,
        notes: notes?.trim() || testPlan.notes || null,
        metadata,
        items: {
          create: testPlan.executions.map((ex, i) => ({
            executionId: ex.id,
            order: i,
          })),
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

async function ensureDemoUser() {
  const exists = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (!exists) {
    await prisma.user.create({
      data: { id: DEMO_USER_ID, name: "Demo User", email: "demo@testflow.com" },
    });
  }
}
