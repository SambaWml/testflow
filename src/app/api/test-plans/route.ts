import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser, getProjectsForUser } from "@/lib/permissions";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const u = sessionUser(session.user);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const projectId = searchParams.get("projectId") ?? "";

    let projectIdFilter: string[] | null = null;
    if (!u.isSuperAdmin && u.orgId && u.orgRole) {
      projectIdFilter = await getProjectsForUser(u.id, u.orgId, u.orgRole);
    }

    const plans = await prisma.testPlan.findMany({
      where: {
        project: { isActive: true },
        ...(u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {}),
        ...(projectIdFilter !== null ? { projectId: { in: projectIdFilter } } : {}),
        ...(status && { status }),
        ...(projectId && { projectId }),
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true } },
        items: {
          include: { case: { select: { id: true, title: true, format: true, priority: true } } },
          orderBy: { order: "asc" },
        },
        executions: {
          include: { case: { select: { id: true, title: true, format: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ plans });
  } catch (err) {
    console.error("[GET /api/test-plans]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const u = sessionUser(session.user);

    const body = await req.json();
    const { name, projectId, environment, buildVersion, notes, caseIds } = body;

    if (!name || !projectId) {
      return NextResponse.json({ error: "Nome e projeto são obrigatórios" }, { status: 400 });
    }
    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um caso de teste" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });

    const plan = await prisma.testPlan.create({
      data: {
        name,
        projectId,
        creatorId: u.id,
        organizationId: project?.organizationId ?? u.orgId ?? null,
        environment: environment || "",
        buildVersion: buildVersion || null,
        notes: notes || null,
        items: {
          create: (caseIds as string[]).map((caseId, i) => ({ caseId, order: i + 1 })),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true } },
        items: {
          include: { case: { select: { id: true, title: true, format: true, priority: true } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/test-plans]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
