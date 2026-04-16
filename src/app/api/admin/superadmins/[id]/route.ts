import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/admin/superadmins/[id] — revoke super admin or delete user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = session.user as { id?: string; isSuperAdmin?: boolean };
  if (!me.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (me.id === id) {
    return NextResponse.json({ error: "Você não pode remover a si mesmo." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  // If user has org memberships, just revoke super admin — don't delete
  const memberCount = await prisma.orgMember.count({ where: { userId: id } });
  if (memberCount > 0) {
    await prisma.user.update({ where: { id }, data: { isSuperAdmin: false } });
    return NextResponse.json({ revoked: true });
  }

  // No org ties — delete entirely
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
