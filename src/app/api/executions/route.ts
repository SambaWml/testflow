import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser, getProjectsForUser } from "@/lib/permissions";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? "";
  const limit = Number(searchParams.get("limit") ?? "50");

  let projectIdFilter: string[] | null = null;
  if (!u.isSuperAdmin && u.orgId && u.orgRole) {
    projectIdFilter = await getProjectsForUser(u.id, u.orgId, u.orgRole);
  }

  const executions = await prisma.execution.findMany({
    where: {
      ...(u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {}),
      ...(projectIdFilter !== null ? { projectId: { in: projectIdFilter } } : {}),
      ...(projectId && { projectId }),
    },
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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const body = await req.json();
  const { caseId, projectId, testPlanId, status, environment, buildVersion, notes, relatedBugRef, executedAt } = body;

  if (!caseId || !projectId) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });

  const execution = await prisma.execution.create({
    data: {
      caseId,
      projectId,
      executorId: u.id,
      organizationId: project?.organizationId ?? u.orgId ?? null,
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
