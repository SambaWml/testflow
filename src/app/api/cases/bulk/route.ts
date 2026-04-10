import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "IDs obrigatórios" }, { status: 400 });
    }

    // Find execution IDs for these cases (needed to cascade further)
    const executions = await prisma.execution.findMany({
      where: { caseId: { in: ids } },
      select: { id: true },
    });
    const executionIds = executions.map((e) => e.id);

    // Delete in dependency order
    if (executionIds.length > 0) {
      await prisma.evidence.deleteMany({ where: { executionId: { in: executionIds } } });
      await prisma.reportItem.deleteMany({ where: { executionId: { in: executionIds } } });
      await prisma.execution.deleteMany({ where: { id: { in: executionIds } } });
    }
    await prisma.testPlanCase.deleteMany({ where: { caseId: { in: ids } } });
    await prisma.testStep.deleteMany({ where: { caseId: { in: ids } } });
    await prisma.testCase.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error("[DELETE /api/cases/bulk]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

const DEMO_USER_ID = "demo-user-id";

export async function POST(req: Request) {
  const body = await req.json();
  const { cases, itemId, projectId } = body;

  if (!cases || !projectId) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });

  await ensureDemoUser();

  const created = await Promise.all(
    cases.map(async (tc: {
      title: string; format: string; precondition?: string; priority: string;
      bddGiven?: string; bddWhen?: string; bddThen?: string;
      steps?: { order: number; description: string }[];
      expectedResult?: string; notes?: string;
    }) => {
      const testCase = await prisma.testCase.create({
        data: {
          title: tc.title,
          format: tc.format,
          precondition: tc.precondition || null,
          priority: tc.priority || "MEDIUM",
          projectId,
          itemId: itemId || null,
          authorId: DEMO_USER_ID,
          bddGiven: tc.bddGiven || null,
          bddWhen: tc.bddWhen || null,
          bddThen: tc.bddThen || null,
          expectedResult: tc.expectedResult || null,
          notes: tc.notes || null,
        },
      });

      if (tc.steps && tc.steps.length > 0) {
        await prisma.testStep.createMany({
          data: tc.steps.map((s) => ({
            caseId: testCase.id,
            order: s.order,
            description: s.description,
          })),
        });
      }

      return testCase;
    })
  );

  return NextResponse.json({ created, count: created.length }, { status: 201 });
}

async function ensureDemoUser() {
  const exists = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (!exists) {
    await prisma.user.create({
      data: { id: DEMO_USER_ID, name: "Demo User", email: "demo@testflow.com" },
    });
  }
}
