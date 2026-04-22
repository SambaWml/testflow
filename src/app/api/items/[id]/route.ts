import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

async function resolveItem(id: string, orgId: string | null, isSuperAdmin: boolean) {
  const where = isSuperAdmin ? { id } : { id, project: { organizationId: orgId! } };
  return prisma.item.findFirst({ where });
}

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const item = await prisma.item.findFirst({
    where: u.isSuperAdmin ? { id } : { id, project: { organizationId: u.orgId! } },
    include: { module: true, project: true, _count: { select: { cases: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await resolveItem(id, u.orgId, u.isSuperAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, type, priority, status, projectId, moduleId, reference, acceptanceCriteria, notes } = body;

  const item = await prisma.item.update({
    where: { id },
    data: {
      ...(title && { title }),
      description: description ?? undefined,
      ...(type && { type }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(projectId && { projectId }),
      moduleId: moduleId || null,
      reference: reference || null,
      acceptanceCriteria: acceptanceCriteria || null,
      notes: notes || null,
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await resolveItem(id, u.orgId, u.isSuperAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
