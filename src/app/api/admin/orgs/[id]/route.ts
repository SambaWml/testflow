import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

// GET /api/admin/orgs/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, role: true, createdAt: true } } } },
      projects: { select: { id: true, name: true, isActive: true, createdAt: true } },
    },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ org });
}

// PATCH /api/admin/orgs/[id] — update plan / isActive
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { plan, isActive } = body as { plan?: string; isActive?: boolean };

  const org = await prisma.organization.update({
    where: { id },
    data: {
      ...(plan !== undefined ? { plan } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  return NextResponse.json({ org });
}

// DELETE /api/admin/orgs/[id] — remove organization and all its data
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });

  // Collect member user IDs before deleting
  const members = await prisma.orgMember.findMany({
    where: { organizationId: id },
    select: { userId: true },
  });
  const memberUserIds = members.map((m) => m.userId);

  // Find which of those users also belong to other orgs (keep them)
  const sharedUsers = await prisma.orgMember.findMany({
    where: { userId: { in: memberUserIds }, organizationId: { not: id } },
    select: { userId: true },
  });
  const sharedUserIds = new Set(sharedUsers.map((m) => m.userId));
  const userIdsToDelete = memberUserIds.filter((uid) => !sharedUserIds.has(uid));

  // Nullify nullable FK references, delete org (cascades to members), then delete exclusive users
  await prisma.$transaction([
    prisma.item.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
    prisma.testCase.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
    prisma.execution.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
    prisma.testPlan.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
    prisma.report.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
    prisma.organization.delete({ where: { id } }),
    ...(userIdsToDelete.length > 0
      ? [prisma.user.deleteMany({ where: { id: { in: userIdsToDelete } } })]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
