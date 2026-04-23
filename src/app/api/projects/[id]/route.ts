import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// Shared ownership check: super admins bypass org scoping, regular users must own the project.
// Returns null (→ 404) instead of throwing, so callers never leak "project exists but forbidden".
async function resolveProject(id: string, orgId: string | null, isSuperAdmin: boolean) {
  const where = isSuperAdmin ? { id } : { id, organizationId: orgId! };
  return prisma.project.findFirst({ where, select: { id: true } });
}

// GET was missing entirely before — the project detail page had no way to fetch metadata with counts.
export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: u.isSuperAdmin ? { id } : { id, organizationId: u.orgId! },
    // _count drives the stat cards on the detail page without loading the full relations.
    include: { _count: { select: { items: true, cases: true, testPlans: true, executions: true, reports: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!u.isSuperAdmin && u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await resolveProject(id, u.orgId, u.isSuperAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (typeof body.isActive === "boolean") {
    const isActive = body.isActive;
    // Archive/unarchive cascades to all test cases in the same transaction
    // so cases never end up active under an archived project.
    const [project] = await prisma.$transaction([
      prisma.project.update({ where: { id }, data: { isActive } }),
      prisma.testCase.updateMany({ where: { projectId: id }, data: { isActive } }),
    ]);
    return NextResponse.json({ project });
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });
  return NextResponse.json({ project });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!u.isSuperAdmin && u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await resolveProject(id, u.orgId, u.isSuperAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Guard against orphaned items — the frontend shows a warning dialog using the count.
  const count = await prisma.item.count({ where: { projectId: id } });
  if (count > 0) return NextResponse.json({ error: "has_items", count }, { status: 409 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
