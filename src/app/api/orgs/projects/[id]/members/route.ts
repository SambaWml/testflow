import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

// GET /api/orgs/projects/[id]/members — list project members
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: u.orgId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ members });
}

// POST /api/orgs/projects/[id]/members — add user to project
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: u.orgId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { userId, role } = await req.json() as { userId: string; role?: string };
  if (!userId) return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });

  // Ensure user is an org member
  const orgMember = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: u.orgId, userId } },
  });
  if (!orgMember) return NextResponse.json({ error: "Usuário não é membro da organização" }, { status: 400 });

  const pm = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { role: role ?? "MEMBER" },
    create: { projectId, userId, role: role ?? "MEMBER" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ member: pm });
}

// DELETE /api/orgs/projects/[id]/members?userId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await params;
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });

  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  return NextResponse.json({ ok: true });
}
