import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";
import { sendWelcomeEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// POST /api/admin/orgs/[id]/members — add member to org and optionally create user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: orgId } = await params;
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json();
  const { name, email, role, sendEmail } = body as {
    name: string;
    email: string;
    role?: string;
    sendEmail?: boolean;
  };

  if (!name || !email) return NextResponse.json({ error: "name e email são obrigatórios" }, { status: 400 });

  const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  let user = await prisma.user.findUnique({ where: { email } });
  const isNewUser = !user;

  const result = await prisma.$transaction(async (tx) => {
    if (!user) {
      user = await tx.user.create({
        data: { name, email, passwordHash, role: "TESTER" },
      });
    }
    const existing = await tx.orgMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: user!.id } } });
    if (existing) throw new Error("Usuário já é membro desta organização");

    await tx.orgMember.create({
      data: { organizationId: orgId, userId: user!.id, role: role ?? "MEMBER", joinedAt: new Date() },
    });
    return user;
  });

  let emailSent = false;
  if (sendEmail !== false && isNewUser) {
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
