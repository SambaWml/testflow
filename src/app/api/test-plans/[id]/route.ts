import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const plan = await prisma.testPlan.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true } },
        items: {
          include: {
            case: {
              include: {
                steps: { orderBy: { order: "asc" } },
              },
            },
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const plan = await prisma.testPlan.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.result !== undefined && { result: body.result }),
        ...(body.notes !== undefined && { notes: body.notes }),
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.testPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/test-plans/[id]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
