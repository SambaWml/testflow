import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";
import { sendPasswordResetEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// POST /api/orgs/members/[memberId]/reset-password
// Owner only — generates a new temp password, updates the user, sends email, returns temp password.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER") {
    return NextResponse.json({ error: "Apenas o Owner pode redefinir senhas" }, { status: 403 });
  }

  const { memberId } = await params;

  // Resolve member → user
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId: u.orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  if (member.role === "OWNER") {
    return NextResponse.json({ error: "Não é possível redefinir a senha do Owner" }, { status: 400 });
  }

  // Generate temp password
  const tempPassword =
    Math.random().toString(36).slice(-8) +
    Math.random().toString(36).slice(-4).toUpperCase();

  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Update user's password
  await prisma.user.update({
    where: { id: member.user.id },
    data: { passwordHash },
  });

  // Try to send reset email
  let emailSent = false;
  const org = await prisma.organization.findUnique({
    where: { id: u.orgId },
    select: { name: true },
  });

  try {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
    await sendPasswordResetEmail({
      to: member.user.email,
      name: member.user.name,
      orgName: org?.name ?? "TestFlow",
      email: member.user.email,
      password: tempPassword,
      loginUrl,
    });
    emailSent = true;
  } catch (err) {
    console.error("[reset-password] email failed:", err);
  }

  return NextResponse.json({
    tempPassword,
    emailSent,
    member: { name: member.user.name, email: member.user.email },
  });
}
