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
  const type = searchParams.get("type") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const limit = Number(searchParams.get("limit") ?? "50");

  let projectIdFilter: string[] | null = null;
  if (!u.isSuperAdmin && u.orgId && u.orgRole) {
    projectIdFilter = await getProjectsForUser(u.id, u.orgId, u.orgRole);
  }

  const items = await prisma.item.findMany({
    where: {
      project: { isActive: true },
      ...(u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {}),
      ...(projectIdFilter !== null ? { projectId: { in: projectIdFilter } } : {}),
      ...(q && { OR: [{ title: { contains: q } }, { description: { contains: q } }] }),
      ...(type && { type }),
      ...(projectId && { projectId }),
    },
    include: {
      module: { select: { name: true } },
      _count: { select: { cases: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const body = await req.json();
  const { title, description, type, priority, projectId, moduleId, reference, acceptanceCriteria, notes } = body;

  if (!title || !projectId) return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });

  const item = await prisma.item.create({
    data: {
      title,
      description: description || null,
      type: type || "USER_STORY",
      priority: priority || "MEDIUM",
      projectId,
      moduleId: moduleId || null,
      reference: reference || null,
      acceptanceCriteria: acceptanceCriteria || null,
      notes: notes || null,
      authorId: u.id,
      organizationId: project?.organizationId ?? u.orgId ?? null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
