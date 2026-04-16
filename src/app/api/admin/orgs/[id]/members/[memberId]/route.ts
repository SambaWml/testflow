import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";
import { sendPasswordResetEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string; memberId: string }> };

function superAdminOnly(u: ReturnType<typeof sessionUser>) {
  if (!u.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// PATCH — change role
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  const guard = superAdminOnly(u);
  if (guard) return guard;

  const { id: orgId, memberId } = await params;
  const { role } = await req.json() as { role: string };

  const VALID_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
  }

  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId: orgId },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  const updated = await prisma.orgMember.update({
    where: { id: memberId },
    data: { role },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ member: updated });
}

// DELETE — remove member from org
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  const guard = superAdminOnly(u);
  if (guard) return guard;

  const { id: orgId, memberId } = await params;

  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId: orgId },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  await prisma.orgMember.delete({ where: { id: memberId } });

  return NextResponse.json({ success: true });
}

// POST — reset password and send email
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  const guard = superAdminOnly(u);
  if (guard) return guard;

  const { id: orgId, memberId } = await params;

  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId: orgId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      organization: { select: { name: true } },
    },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  const tempPassword =
    Math.random().toString(36).slice(-8) +
    Math.random().toString(36).slice(-4).toUpperCase();

  await prisma.user.update({
    where: { id: member.user.id },
    data: { passwordHash: await bcrypt.hash(tempPassword, 12) },
  });

  let emailSent = false;
  try {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
    await sendPasswordResetEmail({
      to: member.user.email,
      name: member.user.name,
      orgName: member.organization.name,
      email: member.user.email,
      password: tempPassword,
      loginUrl,
    });
    emailSent = true;
  } catch { /* non-fatal */ }

  return NextResponse.json({
    success: true,
    emailSent,
    ...(!emailSent ? { tempPassword } : {}),
  });
}
