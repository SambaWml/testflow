import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

// PATCH /api/orgs/members/[memberId] — update role, skills or status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await params;
  const body = await req.json() as { role?: string; skills?: string[]; status?: string };

  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId: u.orgId },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.role !== undefined) data.role = body.role;
  if (body.skills !== undefined) data.skills = JSON.stringify(body.skills);
  if (body.status !== undefined) data.status = body.status;

  const updated = await prisma.orgMember.update({ where: { id: memberId }, data });
  return NextResponse.json({ member: updated });
}

// DELETE /api/orgs/members/[memberId] — remove member
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await params;
  const member = await prisma.orgMember.findFirst({ where: { id: memberId, organizationId: u.orgId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (member.role === "OWNER") return NextResponse.json({ error: "Não é possível remover o OWNER" }, { status: 400 });

  await prisma.orgMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
