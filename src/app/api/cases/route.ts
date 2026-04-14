import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser, getProjectsForUser } from "@/lib/permissions";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const format = searchParams.get("format") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const limit = Number(searchParams.get("limit") ?? "50");

  let projectIdFilter: string[] | null = null;
  if (!u.isSuperAdmin && u.orgId && u.orgRole) {
    projectIdFilter = await getProjectsForUser(u.id, u.orgId, u.orgRole);
  }

  const cases = await prisma.testCase.findMany({
    where: {
      isActive: true,
      project: { isActive: true },
      ...(u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {}),
      ...(projectIdFilter !== null ? { projectId: { in: projectIdFilter } } : {}),
      ...(q && { OR: [{ title: { contains: q } }, { bddGiven: { contains: q } }] }),
      ...(format && { format }),
      ...(projectId && { projectId }),
    },
    include: {
      steps: { orderBy: { order: "asc" } },
      item: { select: { title: true } },
      module: { select: { name: true } },
      project: { select: { id: true, name: true } },
      executions: { select: { status: true, executedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const body = await req.json();
  const { title, format, priority, projectId, itemId, moduleId, precondition, notes,
          bddGiven, bddWhen, bddThen, expectedResult, steps } = body;

  if (!title || !projectId) {
    return NextResponse.json({ error: "title and projectId are required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });

  const tc = await prisma.testCase.create({
    data: {
      title,
      format: format ?? "BDD",
      priority: priority ?? "MEDIUM",
      projectId,
      itemId: itemId || null,
      moduleId: moduleId || null,
      authorId: u.id,
      organizationId: project?.organizationId ?? u.orgId ?? null,
      precondition: precondition || null,
      notes: notes || null,
      bddGiven: bddGiven || null,
      bddWhen: bddWhen || null,
      bddThen: bddThen || null,
      expectedResult: expectedResult || null,
      ...(Array.isArray(steps) && steps.length > 0 && {
        steps: {
          create: steps
            .filter((s: { description: string }) => s.description?.trim())
            .map((s: { description: string; expectedData?: string }, i: number) => ({
              order: i + 1,
              description: s.description,
              expectedData: s.expectedData || null,
            })),
        },
      }),
    },
  });

  return NextResponse.json({ tc }, { status: 201 });
}
