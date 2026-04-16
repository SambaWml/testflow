import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, currentPassword, newPassword } = body as {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isChangingEmail = email && email !== user.email;
  const isChangingPassword = !!newPassword;

  // Current password required when changing email or password
  if (isChangingEmail || isChangingPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "current_password_required" }, { status: 400 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: "no_password" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    }
  }

  // Check email uniqueness
  if (isChangingEmail) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(isChangingEmail && { email }),
      ...(isChangingPassword && { passwordHash: await bcrypt.hash(newPassword, 10) }),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
