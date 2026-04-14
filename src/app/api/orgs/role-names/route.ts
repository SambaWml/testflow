import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

// GET /api/orgs/role-names — returns current org's custom role names
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  if (!u.orgId) {
    return NextResponse.json({ roleNames: { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Membro" } });
  }

  const org = await prisma.organization.findUnique({
    where: { id: u.orgId },
    select: { roleNames: true },
  });

  let roleNames = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Membro" };
  try {
    if (org?.roleNames) roleNames = { ...roleNames, ...JSON.parse(org.roleNames) };
  } catch { /* fallback to default */ }

  return NextResponse.json({ roleNames });
}

// PATCH /api/orgs/role-names — Owner only, updates custom role display names
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER") {
    return NextResponse.json({ error: "Apenas o Owner pode renomear os cargos" }, { status: 403 });
  }

  const body = await req.json();
  const { OWNER, ADMIN, MEMBER } = body as { OWNER?: string; ADMIN?: string; MEMBER?: string };

  // Validate: all must be non-empty strings
  if (!OWNER?.trim() || !ADMIN?.trim() || !MEMBER?.trim()) {
    return NextResponse.json({ error: "Todos os nomes são obrigatórios" }, { status: 400 });
  }

  const roleNames = JSON.stringify({
    OWNER: OWNER.trim(),
    ADMIN: ADMIN.trim(),
    MEMBER: MEMBER.trim(),
  });

  await prisma.organization.update({
    where: { id: u.orgId },
    data: { roleNames },
  });

  return NextResponse.json({ roleNames: { OWNER: OWNER.trim(), ADMIN: ADMIN.trim(), MEMBER: MEMBER.trim() } });
}
