import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tc = await prisma.testCase.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: "asc" } },
      item: { select: { title: true, reference: true } },
      module: { select: { name: true } },
    },
  });
  if (!tc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tc);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const tc = await prisma.$transaction(async (tx) => {
    const updated = await tx.testCase.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.priority && { priority: body.priority }),
        ...(body.precondition !== undefined && { precondition: body.precondition }),
        ...(body.bddGiven !== undefined && { bddGiven: body.bddGiven }),
        ...(body.bddWhen !== undefined && { bddWhen: body.bddWhen }),
        ...(body.bddThen !== undefined && { bddThen: body.bddThen }),
        ...(body.expectedResult !== undefined && { expectedResult: body.expectedResult }),
        ...(body.notes !== undefined && { notes: body.notes }),
        version: { increment: 1 },
      },
    });

    if (Array.isArray(body.steps)) {
      await tx.testStep.deleteMany({ where: { caseId: id } });
      const validSteps = (body.steps as { description: string; expectedData?: string }[]).filter(
        (s) => s.description?.trim()
      );
      if (validSteps.length > 0) {
        await tx.testStep.createMany({
          data: validSteps.map((s, i) => ({
            caseId: id,
            order: i + 1,
            description: s.description.trim(),
            expectedData: s.expectedData?.trim() || null,
          })),
        });
      }
    }

    return updated;
  });

  return NextResponse.json({ tc });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.testCase.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
