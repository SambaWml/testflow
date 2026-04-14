import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";
import { sendWelcomeEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// GET /api/orgs/members — list members of the current org
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const isManager = u.orgRole === "OWNER" || u.orgRole === "ADMIN";

  // For non-managers, get the projects this user belongs to
  let allowedProjectIds: string[] | null = null;
  if (!isManager) {
    const myProjects = await prisma.projectMember.findMany({
      where: { userId: u.id, project: { organizationId: u.orgId } },
      select: { projectId: true },
    });
    allowedProjectIds = myProjects.map((p) => p.projectId);
  }

  // Fetch all org members with their project memberships
  const members = await prisma.orgMember.findMany({
    where: { organizationId: u.orgId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          avatarUrl: true,
          projectMembers: {
            where: { project: { organizationId: u.orgId } },
            select: { projectId: true, role: true, project: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { invitedAt: "asc" },
  });

  // For non-managers: only return members who share at least one allowed project
  const filtered = isManager
    ? members
    : members.filter((m) =>
        m.user.id === u.id ||
        m.user.projectMembers.some((pm) => allowedProjectIds!.includes(pm.projectId))
      );

  const result = filtered.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    skills: JSON.parse(m.skills || "[]") as string[],
    joinedAt: m.joinedAt,
    invitedAt: m.invitedAt,
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.user.role,
      avatarUrl: m.user.avatarUrl,
      createdAt: m.user.createdAt,
      updatedAt: m.user.updatedAt,
    },
    projects: m.user.projectMembers.map((pm) => ({
      id: pm.project.id,
      name: pm.project.name,
      role: pm.role,
    })),
  }));

  return NextResponse.json({ members: result });
}

// POST /api/orgs/members — invite a new member to the org
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Apenas OWNER ou ADMIN podem convidar membros" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({ where: { id: u.orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json();
  const { name, email, role } = body as { name: string; email: string; role?: string };
  if (!name || !email) return NextResponse.json({ error: "name e email são obrigatórios" }, { status: 400 });

  const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  let user = await prisma.user.findUnique({ where: { email } });
  const isNewUser = !user;

  const result = await prisma.$transaction(async (tx) => {
    if (!user) {
      user = await tx.user.create({ data: { name, email, passwordHash, role: "TESTER" } });
    }
    const existing = await tx.orgMember.findUnique({
      where: { organizationId_userId: { organizationId: u.orgId!, userId: user!.id } },
    });
    if (existing) throw new Error("Usuário já é membro desta organização");

    await tx.orgMember.create({
      data: { organizationId: u.orgId!, userId: user!.id, role: role ?? "MEMBER", joinedAt: new Date() },
    });
    return user;
  });

  let emailSent = false;
  if (isNewUser) {
    try {
      const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
      await sendWelcomeEmail({ to: email, name, orgName: org.name, email, password: tempPassword, loginUrl });
      emailSent = true;
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    user: { id: result!.id, name: result!.name, email: result!.email },
    isNewUser,
    emailSent,
    ...(isNewUser && !emailSent ? { tempPassword } : {}),
  });
}
