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
  const projectId = searchParams.get("projectId") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const status = searchParams.get("status") ?? "";
  const limit = Number(searchParams.get("limit") ?? "200");

  // OWNER/ADMIN see all org projects (null = no filter); MEMBER sees only linked projects
  const linkedProjectIds = u.orgId && !u.isSuperAdmin
    ? await getProjectsForUser(u.id, u.orgId, u.orgRole ?? "MEMBER")
    : null;

  // Bug author filter: MEMBER sees only their own bugs; OWNER/ADMIN see all
  const isMember = u.orgRole === "MEMBER";
  const authorFilter = isMember ? { authorId: u.id } : {};

  const bugs = await prisma.item.findMany({
    where: {
      type: "BUG",
      ...authorFilter,
      ...(u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {}),
      ...(linkedProjectIds !== null ? { projectId: { in: linkedProjectIds } } : {}),
      ...(q && { OR: [{ title: { contains: q } }, { description: { contains: q } }] }),
      ...(projectId && { projectId }),
      ...(priority && { priority }),
      ...(status && { status }),
    },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ bugs });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const body = await req.json();
  const { title, description, priority, projectId, reference, acceptanceCriteria, notes } = body;

  if (!title || !projectId) return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });

  const bug = await prisma.item.create({
    data: {
      title,
      description: description || null,
      type: "BUG",
      priority: priority || "MEDIUM",
      status: "OPEN",
      projectId,
      reference: reference || null,
      acceptanceCriteria: acceptanceCriteria || null,
      notes: notes || null,
      authorId: u.id,
      organizationId: project?.organizationId ?? u.orgId ?? null,
    },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ bug }, { status: 201 });
}
