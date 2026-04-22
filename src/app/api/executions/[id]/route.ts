import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

async function resolveExecution(id: string, orgId: string | null, isSuperAdmin: boolean) {
  const where = isSuperAdmin
    ? { id }
    : { id, testPlan: { project: { organizationId: orgId! } } };
  return prisma.execution.findFirst({ where, select: { id: true } });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await resolveExecution(id, u.orgId, u.isSuperAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const execution = await prisma.execution.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.relatedBugRef !== undefined && { relatedBugRef: body.relatedBugRef }),
      ...(body.executedAt && { executedAt: new Date(body.executedAt) }),
    },
  });
  return NextResponse.json({ execution });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await resolveExecution(id, u.orgId, u.isSuperAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.execution.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
