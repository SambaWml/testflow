import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-id";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? "";
  const limit = Number(searchParams.get("limit") ?? "50");

  const executions = await prisma.execution.findMany({
    where: { ...(projectId && { projectId }) },
    include: {
      case: { select: { title: true, format: true } },
      executor: { select: { name: true } },
      project: { select: { name: true } },
      evidence: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ executions });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { caseId, projectId, testPlanId, status, environment, buildVersion, notes, relatedBugRef, executedAt } = body;

  if (!caseId || !projectId) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });

  await ensureDemoUser();

  const execution = await prisma.execution.create({
    data: {
      caseId, projectId,
      executorId: DEMO_USER_ID,
      testPlanId: testPlanId || null,
      status: status || "NOT_EXECUTED",
      environment: environment || "",
      buildVersion: buildVersion || null,
      notes: notes || null,
      relatedBugRef: relatedBugRef || null,
      executedAt: executedAt ? new Date(executedAt) : null,
    },
    include: { case: { select: { title: true } }, executor: { select: { name: true } } },
  });

  return NextResponse.json({ execution }, { status: 201 });
}

async function ensureDemoUser() {
  const exists = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (!exists) {
    await prisma.user.create({
      data: { id: DEMO_USER_ID, name: "Demo User", email: "demo@testflow.com" },
    });
  }
}
