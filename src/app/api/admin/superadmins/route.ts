import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function requireSuperAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(session.user as { isSuperAdmin?: boolean }).isSuperAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// GET /api/admin/superadmins — list all super admins
export async function GET() {
  const session = await auth();
  const err = requireSuperAdmin(session);
  if (err) return err;

  const admins = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins });
}

// POST /api/admin/superadmins — create a new super admin
export async function POST(req: NextRequest) {
  const session = await auth();
  const err = requireSuperAdmin(session);
  if (err) return err;

  const { name, email, password } = await req.json() as { name: string; email: string; password: string };

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.isSuperAdmin) {
      return NextResponse.json({ error: "Este e-mail já é super admin." }, { status: 409 });
    }
    // Promote existing user to super admin
    await prisma.user.update({
      where: { id: existing.id },
      data: { isSuperAdmin: true },
    });
    return NextResponse.json({ admin: { id: existing.id, name: existing.name, email: existing.email }, promoted: true });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { name, email, passwordHash, role: "ADMIN", isSuperAdmin: true },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return NextResponse.json({ admin });
}
