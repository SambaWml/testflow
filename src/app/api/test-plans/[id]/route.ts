import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// Shared ownership check: returns null (→ 404) for cross-org access instead of 403
// so attackers can't distinguish "plan exists but forbidden" from "plan doesn't exist".
async function resolvePlan(id: string, orgId: string | null, isSuperAdmin: boolean) {
  const where = isSuperAdmin ? { id } : { id, organizationId: orgId! };
  return prisma.testPlan.findFirst({ where, select: { id: true } });
}

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const where = u.isSuperAdmin ? { id } : { id, organizationId: u.orgId! };

    const plan = await prisma.testPlan.findFirst({
      where,
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true } },
        items: {
          include: {
            case: { include: { steps: { orderBy: { order: "asc" } } } },
          },
          orderBy: { order: "asc" },
        },
        executions: {
          include: {
            case: { select: { id: true, title: true, format: true } },
            evidence: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (err) {
    console.error("[GET /api/test-plans/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const existing = await resolvePlan(id, u.orgId, u.isSuperAdmin);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const plan = await prisma.testPlan.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
        ...(body.result !== undefined && { result: body.result }),
        ...(body.notes !== undefined && { notes: body.notes }),
        // Auto-stamp timestamps when the plan transitions to a terminal or active state.
        ...(body.status === "IN_PROGRESS" && { startedAt: new Date() }),
        ...(["COMPLETED", "ABORTED"].includes(body.status) && { completedAt: new Date() }),
      },
    });

    return NextResponse.json({ plan });
  } catch (err) {
    console.error("[PATCH /api/test-plans/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin && !u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const existing = await resolvePlan(id, u.orgId, u.isSuperAdmin);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.testPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/test-plans/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
